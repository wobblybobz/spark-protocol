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

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

var _SparkCore = require('../clients/SparkCore');

var _SparkCore2 = _interopRequireDefault(_SparkCore);

var _ICrypto = require('../lib/ICrypto');

var _ICrypto2 = _interopRequireDefault(_ICrypto);

var _EventPublisher = require('../lib/EventPublisher');

var _EventPublisher2 = _interopRequireDefault(_EventPublisher);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var connectionIdCounter = 0;

var DeviceServer = function () {
  function DeviceServer(deviceServerConfig) {
    _classCallCheck(this, DeviceServer);

    this._devicesById = new Map();

    this._config = deviceServerConfig;
    this._deviceAttributeRepository = this._config.deviceAttributeRepository;
    // TODO: Remove this once the event system has been reworked
    global.publisher = this._eventPublisher = new _EventPublisher2.default();
    _settings2.default.coreKeysDir = deviceServerConfig.coreKeysDir || _settings2.default.coreKeysDir;
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
            var core = new _SparkCore2.default(socket);
            core.startupProtocol();
            core._connectionKey = key;

            core.on('ready', _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
              var deviceID, existingConnection, existingAttributes, deviceAttributes;
              return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                  switch (_context.prev = _context.next) {
                    case 0:
                      _logger2.default.log("Device online!");
                      deviceID = core.getHexCoreID();


                      if (_this._devicesById.has(deviceID)) {
                        existingConnection = _this._devicesById.get(deviceID);

                        (0, _nullthrows2.default)(existingConnection).disconnect('Device was already connected. Reconnecting.\r\n');
                      }

                      _this._devicesById.set(deviceID, core);
                      _context.next = 6;
                      return _this._deviceAttributeRepository.getById(deviceID);

                    case 6:
                      existingAttributes = _context.sent;
                      deviceAttributes = _extends({}, existingAttributes, {
                        deviceID: deviceID,
                        ip: core.getRemoteIPAddress(),
                        particleProductId: core._particleProductId,
                        productFirmwareVersion: core._productFirmwareVersion
                      });


                      _this._deviceAttributeRepository.update(deviceAttributes);

                      _this.publishSpecialEvent('particle/status', 'online', deviceID);

                    case 10:
                    case 'end':
                      return _context.stop();
                  }
                }
              }, _callee, _this);
            })));

            core.on('disconnect', function (message) {
              var deviceID = core.getHexCoreID();
              var coreInDevicesByID = (0, _nullthrows2.default)(_this._devicesById.get(deviceID));
              if (core._connectionKey === coreInDevicesByID._connectionKey) {
                _this._devicesById.delete(deviceID);
                _this.publishSpecialEvent('particle/status', 'offline', deviceID);
              }
              _logger2.default.log("Session ended for " + (core._connectionKey || ''));
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
      var serverConfig = {
        port: this._config.port
      };
      server.listen(serverConfig, function () {
        return _logger2.default.log('Server started', serverConfig);
      });
    }
  }, {
    key: 'publishSpecialEvent',
    value: function publishSpecialEvent(eventName, data, coreId) {
      this._eventPublisher.publish(
      /* isPublic */false, eventName,
      /* userId */null, data,
      /* ttl */60, new Date(), coreId);
    }
  }, {
    key: '_createCore',
    value: function _createCore() {
      console.log('_createCore');
    }
  }, {
    key: 'init',
    value: function init() {
      console.log('init');
    }
  }, {
    key: 'addCoreKey',
    value: function addCoreKey(coreID, publicKey) {
      console.log('addCoreKey');
    }
  }, {
    key: 'loadCoreData',
    value: function loadCoreData() {
      console.log('loadCoreData');
    }
  }, {
    key: 'saveCoreData',
    value: function saveCoreData(coreID, attribs) {
      console.log('saveCoreData');
    }
  }, {
    key: 'getCore',
    value: function getCore(coreID) {
      return this._devicesById.get(coreID);
    }
  }, {
    key: 'getCoreAttributes',
    value: function getCoreAttributes(coreID) {
      return this._config.deviceAttributeRepository.getById(coreID);
    }
  }, {
    key: 'setCoreAttribute',
    value: function setCoreAttribute(coreID, name, value) {
      console.log('getCoreAttributes');
    }
  }, {
    key: 'getCoreByName',
    value: function getCoreByName(name) {
      console.log('getCoreByName');
    }

    /**
     * return all the cores we know exist
     * @returns {null}
     */
    // TODO: Remove this function and have the callers use the repository.

  }, {
    key: 'getAllCoreIDs',
    value: function getAllCoreIDs() {
      console.log('getAllCoreIDs');
    }

    /**
     * return all the cores that are connected
     * @returns {null}
     */

  }, {
    key: 'getAllCores',
    value: function getAllCores() {
      console.log('getAllCores');
    }
  }]);

  return DeviceServer;
}();

exports.default = DeviceServer;