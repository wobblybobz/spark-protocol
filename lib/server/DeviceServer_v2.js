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
*/

import type {DeviceAttributes, Repository} from '../types';

import net from 'net';
import SparkCore from '../clients/SparkCore';

class DeviceServer {
  _deviceAttributeRepository: Repository<Device>;
  _devicesById: WeakMap<string, SparkCore> = new WeakMap();

  constructor(deviceAttributeRepository: Repository<Device>) {
    this._deviceAttributeRepository = deviceAttributeRepository;
  }

  start(): void {
    const server = net.createServer(socket => {
      process.nextTick(() => {
        try {
          var key = "_" + connId++;
          logger.log(
            `Connection from: ${socket.remoteAddress}, connId: ${connId}`,
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
              ...this._deviceAttributeRepository.getById(deviceId);
              ip = core.getRemoteIPAddress(),
              particleProductId = core.spark_product_id,
              productFirmwareVersion = core.product_firmware_version,
            };

            this._deviceAttributeRepository.update(
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
        } catch (exception: Exception) {
          logger.error("core startup failed " + ex);
        }
      });
    });

    server.on('error', function () {
      logger.error("something blew up ", arguments);
    });

    //
    //  Load the provided key, or generate one
    //
    if (!fs.existsSync(settings.serverKeyFile)) {
      console.warn("Creating NEW server key");
      var keys = ursa.generatePrivateKey();

      var extIdx = settings.serverKeyFile.lastIndexOf(".");
      var derFilename = settings.serverKeyFile.substring(0, extIdx) + ".der";
      var pubPemFilename = settings.serverKeyFile.substring(0, extIdx) + ".pub.pem";

      fs.writeFileSync(settings.serverKeyFile, keys.toPrivatePem('binary'));
      fs.writeFileSync(pubPemFilename, keys.toPublicPem('binary'));

      //DER FORMATTED KEY for the core hardware
      //TODO: fs.writeFileSync(derFilename, keys.toPrivatePem('binary'));
    }

    //
    //  Load our server key
    //
    console.info("Loading server key from " + settings.serverKeyFile);
    CryptoLib.loadServerKeys(
      settings.serverKeyFile,
      settings.serverKeyPassFile,
      settings.serverKeyPassEnvVar,
    );

    //
    //  Wait for the keys to be ready, then start accepting connections
    //
    server.listen(settings.PORT, function () {
        logger.log("server started", { host: settings.HOST, port: settings.PORT });
    });
  }

  _publishSpecialEvent(eventName: string, foo: string, coreId: string): void {

  }

  _createCore
}

export default DeviceServer;
