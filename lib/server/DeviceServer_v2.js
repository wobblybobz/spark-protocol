'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
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

// TODO: Rename ICrypto to CryptoLib


var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

var _SparkCore = require('../clients/SparkCore');

var _SparkCore2 = _interopRequireDefault(_SparkCore);

var _ICrypto = require('../lib/ICrypto');

var _ICrypto2 = _interopRequireDefault(_ICrypto);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var connectionIdCounter = 0;

var DeviceServer = function () {
  function DeviceServer(deviceServerConfig, eventPublisher) {
    var _this = this;

    _classCallCheck(this, DeviceServer);

    this._devicesById = new Map();

    this._onDeviceSentMessage = function () {
      var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(message, isPublic, device) {
        var deviceID, eventData, lowerEventName, claimCode, deviceAttributes, deviceSystemVersion, _deviceAttributes, token, systemMessage, eatMessage, isEventPublic;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                deviceID = device.getHexCoreID();
                eventData = {
                  data: message.getPayloadLength() === 0 ? null : message.getPayload().toString(),
                  deviceID: deviceID,
                  isPublic: isPublic,
                  name: message.getUriPath().substr(3),
                  ttl: message.getMaxAge() > 0 ? message.getMaxAge() : 60
                };
                lowerEventName = eventData.name.toLowerCase();

                if (!lowerEventName.match('spark/device/claim/code')) {
                  _context.next = 12;
                  break;
                }

                claimCode = message.getPayload().toString();
                _context.next = 7;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 7:
                deviceAttributes = _context.sent;

                if (!(deviceAttributes.claimCode !== claimCode)) {
                  _context.next = 12;
                  break;
                }

                _context.next = 11;
                return _this._deviceAttributeRepository.update(_extends({}, deviceAttributes, {
                  claimCode: claimCode
                }));

              case 11:
                // todo figure this out
                if (global.api) {
                  global.api.linkDevice(deviceID, claimCode, _this._particleProductId);
                }

              case 12:
                if (!lowerEventName.match('spark/device/system/version')) {
                  _context.next = 19;
                  break;
                }

                deviceSystemVersion = message.getPayload().toString();
                _context.next = 16;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 16:
                _deviceAttributes = _context.sent;
                _context.next = 19;
                return _this._deviceAttributeRepository.update(_extends({}, _deviceAttributes, {
                  // TODO should it be this key?:
                  spark_system_version: deviceSystemVersion
                }));

              case 19:
                if (!(lowerEventName.indexOf('spark/device/safemode') === 0)) {
                  _context.next = 25;
                  break;
                }

                token = device.sendMessage('Describe');
                _context.next = 23;
                return device.listenFor('DescribeReturn', null, token);

              case 23:
                systemMessage = _context.sent;


                if (global.api) {
                  global.api.safeMode(deviceID, systemMessage.getPayload().toString());
                }

              case 25:
                if (!lowerEventName.match('spark')) {
                  _context.next = 32;
                  break;
                }

                // allow some kinds of message through.
                eatMessage = true;

                // if we do let these through, make them private.

                isEventPublic = false;

                // TODO: (old code todo)
                // if the message is 'cc3000-radio-version', save to the core_state collection for this core?

                if (lowerEventName === 'spark/cc3000-patch-version') {
                  // set_cc3000_version(this._coreId, obj.data);
                  // eat_message = false;
                }

                if (!eatMessage) {
                  _context.next = 32;
                  break;
                }

                // short-circuit
                device.sendReply('EventAck', message.getId());
                return _context.abrupt('return');

              case 32:
                _context.next = 34;
                return _this._eventPublisher.publish(eventData);

              case 34:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, _this);
      }));

      return function (_x, _x2, _x3) {
        return _ref.apply(this, arguments);
      };
    }();

    this._config = deviceServerConfig;
    this._deviceAttributeRepository = this._config.deviceAttributeRepository;
    // TODO: Remove this once the event system has been reworked
    global.publisher = this._eventPublisher = eventPublisher;
    _settings2.default.coreKeysDir = deviceServerConfig.coreKeysDir || _settings2.default.coreKeysDir;
  }

  _createClass(DeviceServer, [{
    key: 'start',
    value: function start() {
      var _this2 = this;

      var server = _net2.default.createServer(function (socket) {
        process.nextTick(_asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.prev = 0;
                  return _context4.delegateYield(regeneratorRuntime.mark(function _callee3() {
                    var connectionKey, device;
                    return regeneratorRuntime.wrap(function _callee3$(_context3) {
                      while (1) {
                        switch (_context3.prev = _context3.next) {
                          case 0:
                            // eslint-disable-next-line no-plusplus
                            connectionKey = '_' + connectionIdCounter++;
                            device = new _SparkCore2.default(socket);

                            device._connectionKey = connectionKey;

                            device.on('ready', _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
                              var deviceID, existingConnection, existingAttributes, deviceAttributes;
                              return regeneratorRuntime.wrap(function _callee2$(_context2) {
                                while (1) {
                                  switch (_context2.prev = _context2.next) {
                                    case 0:
                                      _logger2.default.log('Device online!');
                                      deviceID = device.getHexCoreID();


                                      if (_this2._devicesById.has(deviceID)) {
                                        existingConnection = _this2._devicesById.get(deviceID);

                                        (0, _nullthrows2.default)(existingConnection).disconnect('Device was already connected. Reconnecting.\r\n');
                                      }

                                      _this2._devicesById.set(deviceID, device);
                                      _context2.next = 6;
                                      return _this2._deviceAttributeRepository.getById(deviceID);

                                    case 6:
                                      existingAttributes = _context2.sent;
                                      deviceAttributes = _extends({}, existingAttributes, {
                                        deviceID: deviceID,
                                        ip: device.getRemoteIPAddress(),
                                        particleProductId: device._particleProductId,
                                        productFirmwareVersion: device._productFirmwareVersion
                                      });


                                      _this2._deviceAttributeRepository.update(deviceAttributes);

                                      _this2.publishSpecialEvent('particle/status', 'online', deviceID);

                                    case 10:
                                    case 'end':
                                      return _context2.stop();
                                  }
                                }
                              }, _callee2, _this2);
                            })));

                            device.on('disconnect', function () {
                              var deviceID = device.getHexCoreID();
                              var coreInDevicesByID = (0, _nullthrows2.default)(_this2._devicesById.get(deviceID));
                              if (device._connectionKey === coreInDevicesByID._connectionKey) {
                                _this2._devicesById.delete(deviceID);
                                _this2.publishSpecialEvent('particle/status', 'offline', deviceID);
                              }
                              _logger2.default.log('Session ended for ' + (device._connectionKey || ''));
                            });

                            device.on('msg_PrivateEvent'.toLowerCase(), function (message) {
                              return _this2._onDeviceSentMessage(message,
                              /* isPublic */false, device);
                            });

                            device.on('msg_PublicEvent'.toLowerCase(), function (message) {
                              return _this2._onDeviceSentMessage(message,
                              /* isPublic */true, device);
                            });

                            _context3.next = 9;
                            return device.startupProtocol();

                          case 9:

                            _logger2.default.log('Connection from: ' + device.getRemoteIPAddress() + ' - ' + ('Connection ID: ' + connectionIdCounter));

                          case 10:
                          case 'end':
                            return _context3.stop();
                        }
                      }
                    }, _callee3, _this2);
                  })(), 't0', 2);

                case 2:
                  _context4.next = 7;
                  break;

                case 4:
                  _context4.prev = 4;
                  _context4.t1 = _context4['catch'](0);

                  _logger2.default.error('Device startup failed: ' + _context4.t1.message);

                case 7:
                case 'end':
                  return _context4.stop();
              }
            }
          }, _callee4, _this2, [[0, 4]]);
        })));
      });

      server.on('error', function (error) {
        return _logger2.default.error('something blew up ' + error.message);
      });

      // Create the keys if they don't exist
      this._config.serverConfigRepository.setupKeys();

      // TODO: These files should come from a repository -- not using fs in the
      // lib
      //
      //  Load our server key
      //
      _logger2.default.log('Loading server key from ' + this._config.serverKeyFile);
      _ICrypto2.default.loadServerKeys(this._config.serverKeyFile, this._config.serverKeyPassFile, this._config.serverKeyPassEnvVar);

      //
      //  Wait for the keys to be ready, then start accepting connections
      //
      var serverPort = this._config.port;
      server.listen(serverPort, function () {
        return _logger2.default.log('Server started on port: ' + serverPort);
      });
    }
  }, {
    key: 'publishSpecialEvent',
    value: function () {
      var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5(eventName, data, deviceID) {
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this._eventPublisher.publish({
                  data: data,
                  deviceID: deviceID,
                  isPublic: false,
                  name: eventName,
                  ttl: 60
                });

              case 2:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function publishSpecialEvent(_x4, _x5, _x6) {
        return _ref4.apply(this, arguments);
      }

      return publishSpecialEvent;
    }()
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