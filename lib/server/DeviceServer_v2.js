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
* 
*
*/

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
// TODO: Rename ICrypto to CryptoLib


var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _SparkCore = require('../clients/SparkCore');

var _SparkCore2 = _interopRequireDefault(_SparkCore);

var _ICrypto = require('../lib/ICrypto');

var _ICrypto2 = _interopRequireDefault(_ICrypto);

var _logger = require('../lib/logger.js');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var connectionIdCounter = 0;

var DeviceServer = function () {
  function DeviceServer(deviceServerConfig) {
    _classCallCheck(this, DeviceServer);

    this._devicesById = new WeakMap();

    this._config = deviceServerConfig;
  }

  _createClass(DeviceServer, [{
    key: 'start',
    value: function start() {
      var _this = this;

      var server = _net2.default.createServer(function (socket) {
        process.nextTick(function () {
          try {
            var key = "_" + connectionIdCounter++;
            _logger2.default.log('Connection from: ' + socket.remoteAddress + ' - ' + ('Connection ID: ' + connectionIdCounter));

            // TODO: This is really shitty. Refactor `SparkCore` and clean this up
            var core = new _SparkCore2.default();
            core.socket = socket;
            core.startupProtocol();
            core._connection_key = key;

            core.on('ready', function () {
              _logger2.default.log("Device online!");
              var deviceId = core.getHexCoreID();
              var deviceAttributes = _extends({}, _this._config.deviceAttributeRepository.getById(deviceId), {
                ip: core.getRemoteIPAddress(),
                particleProductId: core.spark_product_id,
                productFirmwareVersion: core.product_firmware_version
              });

              _this._config.deviceAttributeRepository.update(deviceId, deviceAttributes);

              _this._publishSpecialEvent('particle/status', 'online', deviceId);
            });

            core.on('disconnect', function (message) {
              var coreId = core.getHexCoreID();
              _this._devicesById.delete(coreId);
              _this._publishSpecialEvent('particle/status', 'offline', coreId);
              _logger2.default.log("Session ended for " + core._connection_key);
            });
          } catch (exception) {
            _logger2.default.error("Device startup failed " + exception);
          }
        });
      });

      server.on('error', function () {
        _logger2.default.error("something blew up ", arguments);
      });

      // Create the keys if they don't exist
      this._config.serverConfigRepository.setupKeys();

      // TODO: These files should come from a repository -- not using fs in the
      // lib
      //
      //  Load our server key
      //
      console.info("Loading server key from " + this._config.serverKeyFile);
      _ICrypto2.default.loadServerKeys(this._config.serverKeyFile, this._config.serverKeyPassFile, this._config.serverKeyPassEnvVar);

      //
      //  Wait for the keys to be ready, then start accepting connections
      //
      server.listen({
        host: this._config.host,
        port: this._config.port
      }, function () {
        return _logger2.default.log("Server started", { host: _this._config.host, port: _this._config.port });
      });
    }
  }, {
    key: '_publishSpecialEvent',
    value: function _publishSpecialEvent(eventName, foo, coreId) {}
  }, {
    key: '_createCore',
    value: function _createCore() {}
  }]);

  return DeviceServer;
}();

exports.default = DeviceServer;