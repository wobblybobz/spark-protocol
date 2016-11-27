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
import logger from '../lib/logger.js';

type DeviceServerConfig = {|
  deviceAttributeRepository: Repository<DeviceAttributes>,
  host: string,
  port: number,
  serverConfigRepository: ServerConfigRepository,
  // TODO: Remove the file paths and just use the repository.
  serverKeyFile: string,
  serverKeyPassFile: string,
  serverKeyPassEnvVar: string,
|};

let connectionIdCounter = 0;
class DeviceServer {
  _config: DeviceServerConfig;
  _devicesById: WeakMap<string, SparkCore> = new WeakMap();

  constructor(deviceServerConfig: DeviceServerConfig) {
    this._config = deviceServerConfig;
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
          var core = new SparkCore();
          core.socket = socket;
          core.startupProtocol();
          core._connection_key = key;

          core.on('ready', () => {
            logger.log("Device online!");
            const deviceId = core.getHexCoreID();
            const deviceAttributes = {
              ...this._config.deviceAttributeRepository.getById(deviceId),
              ip: core.getRemoteIPAddress(),
              particleProductId: core.spark_product_id,
              productFirmwareVersion: core.product_firmware_version,
            };

            this._config.deviceAttributeRepository.update(
              deviceId,
              deviceAttributes,
            );

            this._publishSpecialEvent('particle/status', 'online', deviceId);
          });

          core.on('disconnect', (message) => {
            const coreId = core.getHexCoreID();
            this._devicesById.delete(coreId);
            this._publishSpecialEvent('particle/status', 'offline', coreId);
            logger.log("Session ended for " + core._connection_key);
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
    server.listen(
      {
        host: this._config.host,
        port: this._config.port,
      },
      () => logger.log(
        "Server started",
        { host: this._config.host, port: this._config.port },
      ),
    );
  }

  _publishSpecialEvent(eventName: string, foo: string, coreId: string): void {

  }

  _createCore(): void {

  }
}

export default DeviceServer;
