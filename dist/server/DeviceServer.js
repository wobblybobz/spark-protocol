'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _parseInt = require('babel-runtime/core-js/number/parse-int');

var _parseInt2 = _interopRequireDefault(_parseInt);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _binaryVersionReader = require('binary-version-reader');

var _CryptoManager = require('../lib/CryptoManager');

var _CryptoManager2 = _interopRequireDefault(_CryptoManager);

var _Handshake = require('../lib/Handshake');

var _Handshake2 = _interopRequireDefault(_Handshake);

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _Device = require('../clients/Device');

var _Device2 = _interopRequireDefault(_Device);

var _FirmwareManager = require('../lib/FirmwareManager');

var _FirmwareManager2 = _interopRequireDefault(_FirmwareManager);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _Messages = require('../lib/Messages');

var _Messages2 = _interopRequireDefault(_Messages);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var SPECIAL_EVENTS = [_Device.SYSTEM_EVENT_NAMES.APP_HASH, _Device.SYSTEM_EVENT_NAMES.FLASH_AVAILABLE, _Device.SYSTEM_EVENT_NAMES.FLASH_PROGRESS, _Device.SYSTEM_EVENT_NAMES.FLASH_STATUS, _Device.SYSTEM_EVENT_NAMES.SAFE_MODE, _Device.SYSTEM_EVENT_NAMES.SPARK_STATUS];

var connectionIdCounter = 0;

var DeviceServer = function () {
  function DeviceServer(deviceAttributeRepository, deviceKeyRepository, serverKeyRepository, claimCodeManager, eventPublisher, deviceServerConfig) {
    var _this = this;

    (0, _classCallCheck3.default)(this, DeviceServer);
    this._devicesById = new _map2.default();

    this._onNewSocketConnection = function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(socket) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.prev = 0;
                return _context2.delegateYield(_regenerator2.default.mark(function _callee() {
                  var connectionKey, handshake, device;
                  return _regenerator2.default.wrap(function _callee$(_context) {
                    while (1) {
                      switch (_context.prev = _context.next) {
                        case 0:
                          // eslint-disable-next-line no-plusplus
                          connectionKey = '_' + connectionIdCounter++;
                          handshake = new _Handshake2.default(_this._cryptoManager);
                          device = new _Device2.default(socket, connectionKey, handshake);


                          device.on(_Device.DEVICE_EVENT_NAMES.READY, function () {
                            return _this._onDeviceReady(device);
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.DISCONNECT, function () {
                            return _this._onDeviceDisconnect(device, connectionKey);
                          });

                          device.on(
                          // TODO figure out is this message for subscriptions on public events or
                          // public + private
                          // I'm pretty sure this should listen to all events but only use
                          // events for this device.
                          _Device.DEVICE_MESSAGE_EVENTS_NAMES.SUBSCRIBE, function (message) {
                            return _this._onDeviceSubscribe(message, device);
                          });

                          device.on(_Device.DEVICE_MESSAGE_EVENTS_NAMES.PRIVATE_EVENT, function (message) {
                            return _this._onDeviceSentMessage(message,
                            /* isPublic */false, device);
                          });

                          device.on(_Device.DEVICE_MESSAGE_EVENTS_NAMES.PUBLIC_EVENT, function (message) {
                            return _this._onDeviceSentMessage(message,
                            /* isPublic */true, device);
                          });

                          device.on(_Device.DEVICE_MESSAGE_EVENTS_NAMES.GET_TIME, function (message) {
                            return _this._onDeviceGetTime(message, device);
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.FLASH_STARTED, function () {
                            return _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.FLASH_STATUS, 'started', device.getID());
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.FLASH_SUCCESS, function () {
                            return _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.FLASH_STATUS, 'success', device.getID());
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.FLASH_FAILED, function () {
                            return _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.FLASH_STATUS, 'failed', device.getID());
                          });

                          _context.next = 14;
                          return device.startupProtocol();

                        case 14:

                          _logger2.default.log('Connection from: ' + device.getRemoteIPAddress() + ' - ' + ('Connection ID: ' + connectionIdCounter));

                        case 15:
                        case 'end':
                          return _context.stop();
                      }
                    }
                  }, _callee, _this);
                })(), 't0', 2);

              case 2:
                _context2.next = 7;
                break;

              case 4:
                _context2.prev = 4;
                _context2.t1 = _context2['catch'](0);

                _logger2.default.error('Device startup failed: ' + _context2.t1.message);

              case 7:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, _this, [[0, 4]]);
      }));

      return function (_x) {
        return _ref.apply(this, arguments);
      };
    }();

    this._onDeviceDisconnect = function (device, connectionKey) {
      var deviceID = device.getID();

      if (_this._devicesById.has(deviceID)) {
        _this._devicesById.delete(deviceID);
        _this._eventPublisher.unsubscribeBySubscriberID(deviceID);

        _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.SPARK_STATUS, 'offline', deviceID);
        _logger2.default.log('Session ended for device with ID: ' + deviceID + ' with connectionKey: ' + ('' + connectionKey));
      }
    };

    this._onDeviceGetTime = function (message, device) {
      var timeStamp = (0, _moment2.default)().utc().unix();
      var binaryValue = _Messages2.default.toBinary(timeStamp, 'uint32');

      device.sendReply('GetTimeReturn', message.getId(), binaryValue, message.getToken());
    };

    this._onDeviceReady = function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(device) {
        var deviceID, existingConnection, existingAttributes, description, _FirmwareManager$getA, uuid, deviceAttributes;

        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.prev = 0;

                _logger2.default.log('Device online!');
                deviceID = device.getID();


                if (_this._devicesById.has(deviceID)) {
                  existingConnection = _this._devicesById.get(deviceID);

                  (0, _nullthrows2.default)(existingConnection).disconnect('Device was already connected. Reconnecting.\r\n');
                }

                _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.SPARK_STATUS, 'online', deviceID);

                _this._devicesById.set(deviceID, device);

                _context3.next = 8;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 8:
                existingAttributes = _context3.sent;
                _context3.next = 11;
                return device.getDescription();

              case 11:
                description = _context3.sent;
                _FirmwareManager$getA = _FirmwareManager2.default.getAppModule(description.systemInformation), uuid = _FirmwareManager$getA.uuid;
                deviceAttributes = (0, _extends3.default)({}, existingAttributes, {
                  appHash: uuid,
                  deviceID: deviceID,
                  ip: device.getRemoteIPAddress(),
                  particleProductId: description.productID,
                  productFirmwareVersion: description.firmwareVersion
                });


                _this._deviceAttributeRepository.update(deviceAttributes);

                // Send app-hash if this is a new app firmware
                if (!existingAttributes || uuid !== existingAttributes.appHash) {
                  _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.APP_HASH, uuid, deviceID);
                }
                _context3.next = 21;
                break;

              case 18:
                _context3.prev = 18;
                _context3.t0 = _context3['catch'](0);

                console.log(_context3.t0);

              case 21:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this, [[0, 18]]);
      }));

      return function (_x2) {
        return _ref2.apply(this, arguments);
      };
    }();

    this._onDeviceSentMessage = function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(message, isPublic, device) {
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.prev = 0;
                return _context5.delegateYield(_regenerator2.default.mark(function _callee4() {
                  var deviceID, deviceAttributes, eventData, eventName, shouldSwallowEvent, ipAddress, name, cryptoString, systemInformation, config;
                  return _regenerator2.default.wrap(function _callee4$(_context4) {
                    while (1) {
                      switch (_context4.prev = _context4.next) {
                        case 0:
                          deviceID = device.getID();
                          _context4.next = 3;
                          return _this._deviceAttributeRepository.getById(deviceID);

                        case 3:
                          deviceAttributes = _context4.sent;

                          if (deviceAttributes) {
                            _context4.next = 6;
                            break;
                          }

                          throw new Error('Could not find device attributes for device: ' + deviceID);

                        case 6:
                          eventData = {
                            data: message.getPayloadLength() === 0 ? '' : message.getPayload().toString(),
                            deviceID: deviceID,
                            isPublic: isPublic,
                            name: message.getUriPath().substr(3),
                            ttl: message.getMaxAge(),
                            userID: deviceAttributes && deviceAttributes.ownerID
                          };
                          eventName = eventData.name.toLowerCase();
                          shouldSwallowEvent = false;

                          // All spark events except special events should be hidden from the
                          // event stream.

                          if (eventName.startsWith('spark')) {
                            // These should always be private but let's make sure. This way
                            // if you are listening to a specific device you only see the system
                            // events from it.
                            eventData.isPublic = false;

                            shouldSwallowEvent = !SPECIAL_EVENTS.some(function (specialEvent) {
                              return eventName.startsWith(specialEvent);
                            });
                            if (shouldSwallowEvent) {
                              device.sendReply('EventAck', message.getId());
                            }
                          }

                          if (shouldSwallowEvent) {
                            _context4.next = 13;
                            break;
                          }

                          _context4.next = 13;
                          return _this._eventPublisher.publish(eventData);

                        case 13:
                          if (!eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.CLAIM_CODE)) {
                            _context4.next = 16;
                            break;
                          }

                          _context4.next = 16;
                          return _this._onDeviceClaimCodeMessage(message, device);

                        case 16:

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.GET_IP)) {
                            ipAddress = device.getRemoteIPAddress();


                            _this._eventPublisher.publish({
                              data: ipAddress,
                              isPublic: false,
                              name: _Device.SYSTEM_EVENT_NAMES.GET_NAME,
                              userID: eventName.userID
                            });
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.GET_NAME)) {
                            name = deviceAttributes.name;


                            _this._eventPublisher.publish({
                              data: name,
                              isPublic: false,
                              name: _Device.SYSTEM_EVENT_NAMES.GET_NAME,
                              userID: eventName.userID
                            });
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.GET_RANDOM_BUFFER)) {
                            cryptoString = _crypto2.default.randomBytes(40).toString('base64').substring(0, 40);


                            _this._eventPublisher.publish({
                              data: cryptoString,
                              isPublic: false,
                              name: _Device.SYSTEM_EVENT_NAMES.GET_RANDOM_BUFFER,
                              userID: eventName.userID
                            });
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.IDENTITY)) {
                            // TODO - open up for possibility of retrieving multiple ID datums
                            // This is mostly for electron - You can get the IMEI and IICCID this way
                            // https://github.com/spark/firmware/blob/develop/system/src/system_cloud_internal.cpp#L682-L685
                            // https://github.com/spark/firmware/commit/73df5a4ac4c64f008f63a495d50f866d724c6201
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.LAST_RESET)) {
                            // This should be sent to the stream in DeviceServer
                            console.log('LAST_RESET', eventData.data);
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.MAX_BINARY)) {
                            device.setMaxBinarySize((0, _parseInt2.default)((0, _nullthrows2.default)(eventData.data)));
                          }

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.OTA_CHUNK_SIZE)) {
                            device.setOtaChunkSize((0, _parseInt2.default)((0, _nullthrows2.default)(eventData.data)));
                          }

                          if (!(eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.SAFE_MODE) && !deviceAttributes.isCellular)) {
                            _context4.next = 36;
                            break;
                          }

                          console.log(eventData.data);
                          _context4.t0 = _nullthrows2.default;
                          _context4.next = 28;
                          return device.getSystemInformation();

                        case 28:
                          _context4.t1 = _context4.sent;
                          systemInformation = (0, _context4.t0)(_context4.t1);
                          _context4.next = 32;
                          return _FirmwareManager2.default.getOtaSystemUpdateConfig(systemInformation);

                        case 32:
                          config = _context4.sent;


                          _this.publishSpecialEvent(_Device.SYSTEM_EVENT_NAMES.SAFE_MODE_UPDATING,
                          // Lets the user know if it's the system update part 1/2/3
                          config.moduleIndex + 1, device.getID());

                          _context4.next = 36;
                          return device.flash(config.systemFile);

                        case 36:

                          if (eventName.startsWith(_Device.SYSTEM_EVENT_NAMES.SPARK_SUBSYSTEM)) {
                            // TODO: Test this with a Core device
                            // get patch version from payload
                            // compare with version on disc
                            // if device version is old, do OTA update with patch
                          }

                        case 37:
                        case 'end':
                          return _context4.stop();
                      }
                    }
                  }, _callee4, _this);
                })(), 't0', 2);

              case 2:
                _context5.next = 7;
                break;

              case 4:
                _context5.prev = 4;
                _context5.t1 = _context5['catch'](0);

                console.log(_context5.t1.message, _context5.t1.stack);

              case 7:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this, [[0, 4]]);
      }));

      return function (_x3, _x4, _x5) {
        return _ref3.apply(this, arguments);
      };
    }();

    this._onDeviceClaimCodeMessage = function () {
      var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(message, device) {
        var claimCode, deviceID, deviceAttributes, claimRequestUserID;
        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                claimCode = message.getPayload().toString();
                deviceID = device.getID();
                _context6.next = 4;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 4:
                deviceAttributes = _context6.sent;

                if (!(!deviceAttributes || deviceAttributes.ownerID || deviceAttributes.claimCode === claimCode)) {
                  _context6.next = 7;
                  break;
                }

                return _context6.abrupt('return');

              case 7:
                claimRequestUserID = _this._claimCodeManager.getUserIDByClaimCode(claimCode);

                if (claimRequestUserID) {
                  _context6.next = 10;
                  break;
                }

                return _context6.abrupt('return');

              case 10:
                _context6.next = 12;
                return _this._deviceAttributeRepository.update((0, _extends3.default)({}, deviceAttributes, {
                  claimCode: claimCode,
                  ownerID: claimRequestUserID
                }));

              case 12:

                _this._claimCodeManager.removeClaimCode(claimCode);

              case 13:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, _this);
      }));

      return function (_x6, _x7) {
        return _ref4.apply(this, arguments);
      };
    }();

    this._onDeviceSubscribe = function () {
      var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee7(message, device) {
        var deviceID, messageName, query, isFromMyDevices, deviceAttributes;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                deviceID = device.getID();
                // uri -> /e/?u    --> firehose for all my devices
                // uri -> /e/ (deviceid in body)   --> allowed
                // uri -> /e/    --> not allowed (no global firehose for cores, kthxplox)
                // uri -> /e/event_name?u    --> all my devices
                // uri -> /e/event_name?u (deviceid)    --> deviceid?

                messageName = message.getUriPath().substr(3);

                if (messageName) {
                  _context7.next = 5;
                  break;
                }

                device.sendReply('SubscribeFail', message.getId());
                return _context7.abrupt('return');

              case 5:
                query = message.getUriQuery();
                isFromMyDevices = query && !!query.match('u');


                _logger2.default.log('Subscribe Request:\r\n', {
                  deviceID: deviceID,
                  messageName: messageName,
                  isFromMyDevices: isFromMyDevices
                });

                if (!isFromMyDevices) {
                  _context7.next = 19;
                  break;
                }

                _context7.next = 11;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 11:
                deviceAttributes = _context7.sent;

                if (!(!deviceAttributes || !deviceAttributes.ownerID)) {
                  _context7.next = 16;
                  break;
                }

                // not sure if sending 'ok subscribe reply' right in this case, but with
                // SubscribeFail the device reconnects to the cloud infinitely
                device.sendReply('SubscribeAck', message.getId());
                _logger2.default.log('device with ID ' + deviceID + ' wasn\'t subscribed to' + (messageName + ' MY_DEVICES event: the device is unclaimed.'));
                return _context7.abrupt('return');

              case 16:

                _this._eventPublisher.subscribe(messageName, device.onCoreEvent, { userID: deviceAttributes.ownerID }, deviceID);
                _context7.next = 20;
                break;

              case 19:
                _this._eventPublisher.subscribe(messageName, device.onCoreEvent,
                /* filterOptions */{}, deviceID);

              case 20:

                device.sendReply('SubscribeAck', message.getId());

              case 21:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, _this);
      }));

      return function (_x8, _x9) {
        return _ref5.apply(this, arguments);
      };
    }();

    this.getDevice = function (deviceID) {
      return _this._devicesById.get(deviceID);
    };

    this._config = deviceServerConfig;
    this._deviceAttributeRepository = deviceAttributeRepository;
    this._cryptoManager = new _CryptoManager2.default(deviceKeyRepository, serverKeyRepository);
    this._claimCodeManager = claimCodeManager;
    this._eventPublisher = eventPublisher;
  }

  (0, _createClass3.default)(DeviceServer, [{
    key: 'start',
    value: function start() {
      var _this2 = this;

      var server = _net2.default.createServer(function (socket) {
        return process.nextTick(function () {
          return _this2._onNewSocketConnection(socket);
        });
      });

      server.on('error', function (error) {
        return _logger2.default.error('something blew up ' + error.message);
      });

      var serverPort = this._config.port.toString();
      server.listen(serverPort, function () {
        return _logger2.default.log('Server started on port: ' + serverPort);
      });
    }
  }, {
    key: 'publishSpecialEvent',
    value: function () {
      var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee8(eventName, data, deviceID) {
        return _regenerator2.default.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this._eventPublisher.publish({
                  data: data,
                  deviceID: deviceID,
                  isPublic: false,
                  name: eventName
                });

              case 2:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function publishSpecialEvent(_x10, _x11, _x12) {
        return _ref6.apply(this, arguments);
      }

      return publishSpecialEvent;
    }()
  }]);
  return DeviceServer;
}();

exports.default = DeviceServer;