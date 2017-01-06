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
  ServerKeyRepository,
} from '../types';
import type EventPublisher from '../lib/EventPublisher';
import CryptoManager from '../lib/CryptoManager';
import Handshake from '../lib/Handshake';

import net from 'net';
import nullthrows from 'nullthrows';
import moment from 'moment';
import Device from '../clients/Device';

import logger from '../lib/logger';
import Messages from '../lib/Messages';
import {
  DEVICE_EVENT_NAMES,
  DEVICE_MESSAGE_EVENTS_NAMES,
} from '../clients/Device';

type DeviceServerConfig = {|
  host: string,
  port: number,
|};

let connectionIdCounter = 0;
class DeviceServer {
  _config: DeviceServerConfig;
  _cryptoManager: CryptoManager;
  _deviceAttributeRepository: Repository<DeviceAttributes>;
  _devicesById: Map<string, Device> = new Map();
  _eventPublisher: EventPublisher;

  constructor(
    deviceAttributeRepository: Repository<DeviceAttributes>,
    deviceKeyRepository: Repository<string>,
    serverKeyRepository: ServerKeyRepository,
    eventPublisher: EventPublisher,
    deviceServerConfig: DeviceServerConfig,
  ) {
    this._config = deviceServerConfig;
    this._deviceAttributeRepository =
      deviceAttributeRepository;
    this._cryptoManager = new CryptoManager(
      deviceKeyRepository,
      serverKeyRepository,
    );
    this._eventPublisher = eventPublisher;
  }

  start() {
    const server = net.createServer(
      (socket: Socket): void =>
        process.nextTick((): Promise<void> =>
          this._onNewSocketConnection(socket),
        ),
    );

    server.on('error', (error: Error): void =>
      logger.error(`something blew up ${error.message}`),
    );

    const serverPort = this._config.port.toString();
    server.listen(
      serverPort,
      (): void => logger.log(`Server started on port: ${serverPort}`),
    );
  }

  _onNewSocketConnection = async (socket: Socket): Promise<void> => {
    try {
      // eslint-disable-next-line no-plusplus
      const connectionKey = `_${connectionIdCounter++}`;
      const handshake = new Handshake(this._cryptoManager);
      const device = new Device(
        socket,
        connectionKey,
        handshake,
      );

      device.on(
        DEVICE_EVENT_NAMES.READY,
        (): Promise<void> => this._onDeviceReady(device),
      );

      device.on(
        DEVICE_EVENT_NAMES.DISCONNECT,
        (): void => this._onDeviceDisconnect(device, connectionKey),
      );

      device.on(
        // TODO figure out is this message for subscriptions on public events or
        // public + private
        DEVICE_MESSAGE_EVENTS_NAMES.SUBSCRIBE,
        (message: Message): Promise<void> =>
          this._onDeviceSubscribe(message, device),
      );

      device.on(
        DEVICE_MESSAGE_EVENTS_NAMES.PRIVATE_EVENT,
        (message: Message): Promise<void> =>
          this._onDeviceSentMessage(
            message,
            /* isPublic */false,
            device,
          ),
      );

      device.on(
        DEVICE_MESSAGE_EVENTS_NAMES.PUBLIC_EVENT,
        (message: Message): Promise<void> =>
          this._onDeviceSentMessage(
            message,
            /* isPublic */true,
            device,
          ),
      );

      device.on(
        DEVICE_MESSAGE_EVENTS_NAMES.GET_TIME,
        (message: Message): void =>
          this._onDeviceGetTime(message, device),
      );

      device.on(
        DEVICE_EVENT_NAMES.FLASH_STARTED,
        (): Promise<void> => this.publishSpecialEvent(
          'spark/flash/status',
          'started',
          device.getID(),
        ),
      );

      device.on(
        DEVICE_EVENT_NAMES.FLASH_SUCCESS,
        (): Promise<void> => this.publishSpecialEvent(
          'spark/flash/status',
          'success',
          device.getID(),
        ),
      );

      device.on(
        DEVICE_EVENT_NAMES.FLASH_FAILED,
        (): Promise<void> => this.publishSpecialEvent(
          'spark/flash/status',
          'failed',
          device.getID(),
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
  };

  _onDeviceDisconnect = (device: Device, connectionKey: string) => {
    const deviceID = device.getID();

    if (this._devicesById.has(deviceID)) {
      this._devicesById.delete(deviceID);
      this._eventPublisher.unsubscribeBySubscriberID(deviceID);

      this.publishSpecialEvent('particle/status', 'offline', deviceID);
      logger.log(`Session ended for device with ID: ${deviceID} with connectionKey: ${connectionKey}`);
    }
  };

  _onDeviceGetTime = (message: Message, device: Device) => {
    const timeStamp = moment().utc().unix();
    const binaryValue = Messages.toBinary(timeStamp, 'uint32');

    device.sendReply(
      'GetTimeReturn',
      message.getId(),
      binaryValue,
      message.getToken(),
    );
  };

  _onDeviceReady = async (device: Device): Promise<void> => {
    logger.log('Device online!');
    const deviceID = device.getID();

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
  };

  _onDeviceSentMessage = async (
    message: Message,
    isPublic: boolean,
    device: Device,
  ): Promise<void> => {
    const deviceID = device.getID();
    const deviceAttributes =
      await this._deviceAttributeRepository.getById(deviceID);

    const eventData = {
      data: message.getPayloadLength() === 0 ? null : message.getPayload().toString(),
      deviceID,
      isPublic,
      name: message.getUriPath().substr(3),
      ttl: message.getMaxAge() > 0 ? message.getMaxAge() : 60,
      userID: deviceAttributes && deviceAttributes.ownerID,
    };


    const lowerEventName = eventData.name.toLowerCase();

    if (lowerEventName.match('spark/device/claim/code')) {
      const claimCode = message.getPayload().toString();

      if (deviceAttributes && deviceAttributes.claimCode !== claimCode) {
        await this._deviceAttributeRepository.update({
          ...deviceAttributes,
          claimCode,
        });
        // todo figure this out
        // if (global.api) {
        //   global.api.linkDevice(deviceID, claimCode, this._particleProductId);
        // }
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
    // if (lowerEventName.indexOf('spark/device/safemode') === 0) {
    //   const token = device.sendMessage('Describe');
    //   const systemMessage = await device.listenFor(
    //     'DescribeReturn',
    //     null,
    //     token,
    //   );
    //
    //   if (global.api) {
    //     global.api.safeMode(
    //       deviceID,
    //       systemMessage.getPayload().toString(),
    //     );
    //   }
    // }

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
        // set_cc3000_version(this._id, obj.data);
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
    device: Device,
  ): Promise<void> => {
    const deviceID = device.getID();
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

      if (!deviceAttributes || !deviceAttributes.ownerID) {
        device.sendReply('SubscribeFail', message.getId());
        return;
      }

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
        /* filterOptions */{},
        deviceID,
      );
    }

    device.sendReply('SubscribeAck', message.getId());
  };

  getDevice = (deviceID: string): ?Device =>
    this._devicesById.get(deviceID);

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
}

export default DeviceServer;
