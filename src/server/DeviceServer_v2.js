'use strict';

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

import type {
  DeviceAttributes,
  Repository,
  ServerConfigRepository,
} from '../types';

import net from 'net';
import SparkCore from '../clients/SparkCore';
// TODO: Rename ICrypto to CryptoLib
import CryptoLib from '../lib/ICrypto';
import EventPublisher from '../lib/EventPublisher';
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
  _devicesById: Map<string, SparkCore> = new Map();
  _eventPublisher: EventPublisher;

  constructor(deviceServerConfig: DeviceServerConfig) {
    this._config = deviceServerConfig;
    // TODO: Remove this once the event system has been reworked
    global.publisher = this._eventPublisher = new EventPublisher();
    settings.coreKeysDir =
      deviceServerConfig.coreKeysDir || settings.coreKeysDir;
  }

  start(): void {
    const server = net.createServer(socket => {
      process.nextTick(() => {
        try {
          var key = "_" + connectionIdCounter++;
          logger.log(
            `Connection from: ${socket.remoteAddress} - ` +
              `Connection ID: ${connectionIdCounter}`,
          );

          // TODO: This is really shitty. Refactor `SparkCore` and clean this up
          var core = new SparkCore(socket);
          core.startupProtocol();
          core._connectionKey = key;

          core.on('ready', () => {
            logger.log("Device online!");
            const deviceId = core.getHexCoreID();
            this._devicesById.set(deviceId, core);
            const deviceAttributes = {
              ...this._config.deviceAttributeRepository.getById(deviceId),
              ip: core.getRemoteIPAddress(),
              _particleProductId: core._particleProductId,
              _productFirmwareVersion: core._productFirmwareVersion,
            };

            this._config.deviceAttributeRepository.update(
              deviceId,
              deviceAttributes,
            );

            this._publishSpecialEvent('particle/status', 'online', deviceId);
          });

          core.on('disconnect', (message) => {
            const deviceId = core.getHexCoreID();
            this._devicesById.delete(deviceId);
            this._publishSpecialEvent('particle/status', 'offline', deviceId);
            logger.log("Session ended for " + (core._connectionKey || ''));
          });
        } catch (exception) {
          logger.error("Device startup failed " + exception);
        }
      });
    });

    server.on('error', function () {
      logger.error("something blew up ", arguments);
    });

    // Create the keys if they don't exist
    this._config.serverConfigRepository.setupKeys();

    // TODO: These files should come from a repository -- not using fs in the
    // lib
    //
    //  Load our server key
    //
    console.info("Loading server key from " + this._config.serverKeyFile);
    CryptoLib.loadServerKeys(
      this._config.serverKeyFile,
      this._config.serverKeyPassFile,
      this._config.serverKeyPassEnvVar,
    );

    //
    //  Wait for the keys to be ready, then start accepting connections
    //
    const serverConfig = {
      port: this._config.port,
    };
    server.listen(
      serverConfig,
      () => logger.log('Server started', serverConfig),
    );
  }

  _publishSpecialEvent(eventName: string, data: string, coreId: string): void {
    this._eventPublisher.publish(
      /* isPublic */ false,
      eventName,
      /* userId */ null,
      data,
      /* ttl */ 60,
      new Date(),
      coreId,
    );
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
    return this._config.deviceAttributeRepository.getAll().map(
      core => core.coreID,
    );
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
