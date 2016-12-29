/*
*   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
*
*   This program is free software; you can redistribute it and/or
*   modify it under the terms of the GNU Lesser General Public
*   License as published by the Free Software Foundation, either
*   version 3 of the License, or (at your option) any later version.
*
*   This program is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
*   Lesser General Public License for more details.
*
*   You should have received a copy of the GNU Lesser General Public
*   License along with this program; if not, see <http://www.gnu.org/licenses/>.
*
* @flow
*
*/

import type { Socket } from 'net';
import type { Message } from 'h5.coap';
import type {
  DeviceAttributes,
  Repository,
  ServerConfigRepository,
} from '../types';
import type EventPublisher from '../lib/EventPublisher';

import net from 'net';
import nullthrows from 'nullthrows';
import SparkCore from '../clients/SparkCore';
// TODO: Rename ICrypto to CryptoLib
import CryptoLib from '../lib/ICrypto';
import logger from '../lib/logger';
import settings from '../settings';

type DeviceServerConfig = {|
  coreKeysDir?: string,
  deviceAttributeRepository: Repository<DeviceAttributes>,
  host: string,
  port: number,
  serverConfigRepository: ServerConfigRepository,
  // TODO: Remove the file paths and just use the repository.
  serverKeyFile: string,
  serverKeyPassFile: ?string,
  serverKeyPassEnvVar: ?string,
|};

let connectionIdCounter = 0;
class DeviceServer {
  _config: DeviceServerConfig;
  _deviceAttributeRepository: Repository<DeviceAttributes>;
  _devicesById: Map<string, SparkCore> = new Map();
  _eventPublisher: EventPublisher;

  constructor(deviceServerConfig: DeviceServerConfig, eventPublisher: EventPublisher) {
    this._config = deviceServerConfig;
    this._deviceAttributeRepository = this._config.deviceAttributeRepository;
    // TODO: Remove this once the event system has been reworked
    global.publisher = this._eventPublisher = eventPublisher;
    settings.coreKeysDir =
      deviceServerConfig.coreKeysDir || settings.coreKeysDir;
  }

  start() {
    const server = net.createServer((socket: Socket) => {
      process.nextTick(async (): Promise<void> => {
        try {
          // eslint-disable-next-line no-plusplus
          const connectionKey = `_${connectionIdCounter++}`;
          const device = new SparkCore(socket, connectionKey);

          device.on('ready', async (): Promise<void> => {
            logger.log('Device online!');
            const deviceID = device.getHexCoreID();

            if (this._devicesById.has(deviceID)) {
              const existingConnection = this._devicesById.get(deviceID);
              nullthrows(existingConnection).disconnect(
                'Device was already connected. Reconnecting.\r\n',
              );
            }

            this._devicesById.set(deviceID, device);
            const existingAttributes =
              await this._deviceAttributeRepository.getById(deviceID);
            const deviceAttributes = {
              ...existingAttributes,
              deviceID,
              ip: device.getRemoteIPAddress(),
              particleProductId: device._particleProductId,
              productFirmwareVersion: device._productFirmwareVersion,
            };

            this._deviceAttributeRepository.update(
              deviceAttributes,
            );

            this.publishSpecialEvent('particle/status', 'online', deviceID);
          });

          device.on('disconnect', (): void =>
            this._onDeviceDisconnect(device, connectionKey),
          );

          device.on(
            // TODO figure out is this message for subscriptions on public events or
            // public + private
            'msg_Subscribe'.toLowerCase(),
            (message: Message): void =>
              this._onDeviceSubscribe(message, device),
          );

          device.on(
            'msg_PrivateEvent'.toLowerCase(),
            (message: Message): void =>
              this._onDeviceSentMessage(
                message,
                /* isPublic */false,
                device,
              ),
          );

          device.on(
            'msg_PublicEvent'.toLowerCase(),
            (message: Message): void =>
              this._onDeviceSentMessage(
                message,
                /* isPublic */true,
                device,
              ),
          );

          await device.startupProtocol();

          logger.log(
            `Connection from: ${device.getRemoteIPAddress()} - ` +
            `Connection ID: ${connectionIdCounter}`,
          );
        } catch (error) {
          logger.error(`Device startup failed: ${error.message}`);
        }
      });
    });

    server.on('error', (error: Error): void =>
      logger.error(`something blew up ${error.message}`),
    );

    // Create the keys if they don't exist
    this._config.serverConfigRepository.setupKeys();

    // TODO: These files should come from a repository -- not using fs in the
    // lib
    //
    //  Load our server key
    //
    logger.log(`Loading server key from ${this._config.serverKeyFile}`);
    CryptoLib.loadServerKeys(
      this._config.serverKeyFile,
      this._config.serverKeyPassFile,
      this._config.serverKeyPassEnvVar,
    );

    //
    //  Wait for the keys to be ready, then start accepting connections
    //
    const serverPort = this._config.port;
    server.listen(
      serverPort,
      (): void => logger.log(`Server started on port: ${serverPort}`),
    );
  }

  _onDeviceDisconnect = (device: SparkCore, connectionKey: string) => {
    const deviceID = device.getHexCoreID();

    if (this._devicesById.has(deviceID)) {
      this._devicesById.delete(deviceID);
      this._eventPublisher.unsubscribeBySubscriberID(deviceID);

      this.publishSpecialEvent('particle/status', 'offline', deviceID);
      logger.log(`Session ended for device with ID: ${deviceID} with connectionKey: ${connectionKey}`);
    }
  };

  _onDeviceSentMessage = async (
    message: Message,
    isPublic: boolean,
    device: SparkCore,
  ): Promise<void> => {
    const deviceID = device.getHexCoreID();
    const deviceAttributes =
      await this._deviceAttributeRepository.getById(deviceID);

    const eventData = {
      data: message.getPayloadLength() === 0 ? null : message.getPayload().toString(),
      deviceID,
      isPublic,
      name: message.getUriPath().substr(3),
      ttl: message.getMaxAge() > 0 ? message.getMaxAge() : 60,
      userID: deviceAttributes.ownerID,
    };


    const lowerEventName = eventData.name.toLowerCase();

    if (lowerEventName.match('spark/device/claim/code')) {
      const claimCode = message.getPayload().toString();

      if (deviceAttributes.claimCode !== claimCode) {
        await this._deviceAttributeRepository.update({
          ...deviceAttributes,
          claimCode,
        });
        // todo figure this out
        if (global.api) {
          global.api.linkDevice(deviceID, claimCode, this._particleProductId);
        }
      }
    }

    if (lowerEventName.match('spark/device/system/version')) {
      const deviceSystemVersion = message.getPayload().toString();

      await this._deviceAttributeRepository.update({
        ...deviceAttributes,
        // TODO should it be this key?:
        spark_system_version: deviceSystemVersion,
      });
    }

    // TODO figure this out
    if (lowerEventName.indexOf('spark/device/safemode') === 0) {
      const token = device.sendMessage('Describe');
      const systemMessage = await device.listenFor(
        'DescribeReturn',
        null,
        token,
      );

      if (global.api) {
        global.api.safeMode(
          deviceID,
          systemMessage.getPayload().toString(),
        );
      }
    }

    // TODO implement this eat message more clean
    // if the event name starts with spark (upper or lower), then eat it.
    if (lowerEventName.match('spark')) {
      // allow some kinds of message through.
      let eatMessage = true;

      // if we do let these through, make them private.
      const isEventPublic = false;

      // TODO: (old code todo)
      // if the message is 'cc3000-radio-version', save to the core_state collection for this core?
      if (lowerEventName === 'spark/cc3000-patch-version') {
        // set_cc3000_version(this._coreId, obj.data);
        // eat_message = false;
      }

      if (eatMessage) {
        // short-circuit
        device.sendReply('EventAck', message.getId());
        return;
      }
    }

    await this._eventPublisher.publish(eventData);
  };

  _onDeviceSubscribe = async (
    message: Message,
    device: SparkCore,
  ): Promise<void> => {
    const deviceID = device.getHexCoreID();
    // uri -> /e/?u    --> firehose for all my devices
    // uri -> /e/ (deviceid in body)   --> allowed
    // uri -> /e/    --> not allowed (no global firehose for cores, kthxplox)
    // uri -> /e/event_name?u    --> all my devices
    // uri -> /e/event_name?u (deviceid)    --> deviceid?
    const messageName = message.getUriPath().substr(3);

    if (!messageName) {
      device.sendReply('SubscribeFail', message.getId());
      return;
    }

    const query = message.getUriQuery();
    const isFromMyDevices = query && !!query.match('u');

    logger.log(
      `Got subscribe request from device with ID ${deviceID} ` +
      `on event: '${messageName}' ` +
      `from my devices only: ${isFromMyDevices || false}`,
    );

    if (isFromMyDevices) {
      const deviceAttributes =
        await this._deviceAttributeRepository.getById(deviceID);

      this._eventPublisher.subscribe(
        messageName,
        device.onCoreEvent,
        { userID: deviceAttributes.ownerID },
        deviceID,
      );
    } else {
      this._eventPublisher.subscribe(
        messageName,
        device.onCoreEvent,
        /* filterOptions */null,
        deviceID,
      );
    }

    device.sendReply('SubscribeAck', message.getId());
  };

  async publishSpecialEvent(
    eventName: string,
    data: string,
    deviceID: string,
  ): Promise<void> {
    await this._eventPublisher.publish({
      data,
      deviceID,
      isPublic: false,
      name: eventName,
      ttl: 60,
    });
  }

  _createCore(): void {
    console.log('_createCore');
  }

  init() {
    console.log('init');
  }

  addCoreKey(coreID: string, publicKey: Object) {
    console.log('addCoreKey');
  }

  loadCoreData() {
    console.log('loadCoreData');
  }

  saveCoreData(coreID: string, attribs: Object) {
    console.log('saveCoreData');
  }

  getCore(coreID: string) {
    return this._devicesById.get(coreID);
  }
  getCoreAttributes(coreID: string) {
    return this._config.deviceAttributeRepository.getById(coreID);
  }
  setCoreAttribute(coreID: string, name: string, value: mixed) {
    console.log('getCoreAttributes');
  }
  getCoreByName(name: string) {
    console.log('getCoreByName');
  }

  /**
   * return all the cores we know exist
   * @returns {null}
   */
  // TODO: Remove this function and have the callers use the repository.
  getAllCoreIDs() {
    console.log('getAllCoreIDs');
  }

  /**
   * return all the cores that are connected
   * @returns {null}
   */
  getAllCores() {
    console.log('getAllCores');
  }
}

export default DeviceServer;
