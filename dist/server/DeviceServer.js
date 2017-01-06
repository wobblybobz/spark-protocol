'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

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

var _CryptoManager = require('../lib/CryptoManager');

var _CryptoManager2 = _interopRequireDefault(_CryptoManager);

var _Handshake = require('../lib/Handshake');

var _Handshake2 = _interopRequireDefault(_Handshake);

var _net = require('net');

var _net2 = _interopRequireDefault(_net);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _Device = require('../clients/Device');

var _Device2 = _interopRequireDefault(_Device);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _Messages = require('../lib/Messages');

var _Messages2 = _interopRequireDefault(_Messages);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var connectionIdCounter = 0; /*
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

var DeviceServer = function () {
  function DeviceServer(deviceAttributeRepository, deviceKeyRepository, serverKeyRepository, eventPublisher, deviceServerConfig) {
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
                            return _this.publishSpecialEvent('spark/flash/status', 'started', device.getID());
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.FLASH_SUCCESS, function () {
                            return _this.publishSpecialEvent('spark/flash/status', 'success', device.getID());
                          });

                          device.on(_Device.DEVICE_EVENT_NAMES.FLASH_FAILED, function () {
                            return _this.publishSpecialEvent('spark/flash/status', 'failed', device.getID());
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

        _this.publishSpecialEvent('particle/status', 'offline', deviceID);
        _logger2.default.log('Session ended for device with ID: ' + deviceID + ' with connectionKey: ' + connectionKey);
      }
    };

    this._onDeviceGetTime = function (message, device) {
      var timeStamp = (0, _moment2.default)().utc().unix();
      var binaryValue = _Messages2.default.toBinary(timeStamp, 'uint32');

      device.sendReply('GetTimeReturn', message.getId(), binaryValue, message.getToken());
    };

    this._onDeviceReady = function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(device) {
        var deviceID, existingConnection, existingAttributes, deviceAttributes;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _logger2.default.log('Device online!');
                deviceID = device.getID();


                if (_this._devicesById.has(deviceID)) {
                  existingConnection = _this._devicesById.get(deviceID);

                  (0, _nullthrows2.default)(existingConnection).disconnect('Device was already connected. Reconnecting.\r\n');
                }

                _this._devicesById.set(deviceID, device);

                _context3.next = 6;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 6:
                existingAttributes = _context3.sent;
                deviceAttributes = (0, _extends3.default)({}, existingAttributes, {
                  deviceID: deviceID,
                  ip: device.getRemoteIPAddress(),
                  particleProductId: device._particleProductId,
                  productFirmwareVersion: device._productFirmwareVersion
                });


                _this._deviceAttributeRepository.update(deviceAttributes);

                _this.publishSpecialEvent('particle/status', 'online', deviceID);

              case 10:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this);
      }));

      return function (_x2) {
        return _ref2.apply(this, arguments);
      };
    }();

    this._onDeviceSentMessage = function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(message, isPublic, device) {
        var deviceID, deviceAttributes, eventData, lowerEventName, claimCode, deviceSystemVersion, eatMessage, isEventPublic;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                deviceID = device.getID();
                _context4.next = 3;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 3:
                deviceAttributes = _context4.sent;
                eventData = {
                  data: message.getPayloadLength() === 0 ? null : message.getPayload().toString(),
                  deviceID: deviceID,
                  isPublic: isPublic,
                  name: message.getUriPath().substr(3),
                  ttl: message.getMaxAge() > 0 ? message.getMaxAge() : 60,
                  userID: deviceAttributes && deviceAttributes.ownerID
                };
                lowerEventName = eventData.name.toLowerCase();

                if (!lowerEventName.match('spark/device/claim/code')) {
                  _context4.next = 11;
                  break;
                }

                claimCode = message.getPayload().toString();

                if (!(deviceAttributes && deviceAttributes.claimCode !== claimCode)) {
                  _context4.next = 11;
                  break;
                }

                _context4.next = 11;
                return _this._deviceAttributeRepository.update((0, _extends3.default)({}, deviceAttributes, {
                  claimCode: claimCode
                }));

              case 11:
                if (!lowerEventName.match('spark/device/system/version')) {
                  _context4.next = 15;
                  break;
                }

                deviceSystemVersion = message.getPayload().toString();
                _context4.next = 15;
                return _this._deviceAttributeRepository.update((0, _extends3.default)({}, deviceAttributes, {
                  // TODO should it be this key?:
                  spark_system_version: deviceSystemVersion
                }));

              case 15:
                if (!lowerEventName.match('spark')) {
                  _context4.next = 22;
                  break;
                }

                // allow some kinds of message through.
                eatMessage = true;

                // if we do let these through, make them private.

                isEventPublic = false;

                // TODO: (old code todo)
                // if the message is 'cc3000-radio-version', save to the core_state collection for this core?

                if (lowerEventName === 'spark/cc3000-patch-version') {
                  // set_cc3000_version(this._id, obj.data);
                  // eat_message = false;
                }

                if (!eatMessage) {
                  _context4.next = 22;
                  break;
                }

                // short-circuit
                device.sendReply('EventAck', message.getId());
                return _context4.abrupt('return');

              case 22:
                _context4.next = 24;
                return _this._eventPublisher.publish(eventData);

              case 24:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this);
      }));

      return function (_x3, _x4, _x5) {
        return _ref3.apply(this, arguments);
      };
    }();

    this._onDeviceSubscribe = function () {
      var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(message, device) {
        var deviceID, messageName, query, isFromMyDevices, deviceAttributes;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                deviceID = device.getID();
                // uri -> /e/?u    --> firehose for all my devices
                // uri -> /e/ (deviceid in body)   --> allowed
                // uri -> /e/    --> not allowed (no global firehose for cores, kthxplox)
                // uri -> /e/event_name?u    --> all my devices
                // uri -> /e/event_name?u (deviceid)    --> deviceid?

                messageName = message.getUriPath().substr(3);

                if (messageName) {
                  _context5.next = 5;
                  break;
                }

                device.sendReply('SubscribeFail', message.getId());
                return _context5.abrupt('return');

              case 5:
                query = message.getUriQuery();
                isFromMyDevices = query && !!query.match('u');


                _logger2.default.log('Got subscribe request from device with ID ' + deviceID + ' ' + ('on event: \'' + messageName + '\' ') + ('from my devices only: ' + (isFromMyDevices || false)));

                if (!isFromMyDevices) {
                  _context5.next = 18;
                  break;
                }

                _context5.next = 11;
                return _this._deviceAttributeRepository.getById(deviceID);

              case 11:
                deviceAttributes = _context5.sent;

                if (!(!deviceAttributes || !deviceAttributes.ownerID)) {
                  _context5.next = 15;
                  break;
                }

                device.sendReply('SubscribeFail', message.getId());
                return _context5.abrupt('return');

              case 15:

                _this._eventPublisher.subscribe(messageName, device.onCoreEvent, { userID: deviceAttributes.ownerID }, deviceID);
                _context5.next = 19;
                break;

              case 18:
                _this._eventPublisher.subscribe(messageName, device.onCoreEvent,
                /* filterOptions */{}, deviceID);

              case 19:

                device.sendReply('SubscribeAck', message.getId());

              case 20:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this);
      }));

      return function (_x6, _x7) {
        return _ref4.apply(this, arguments);
      };
    }();

    this.getDevice = function (deviceID) {
      return _this._devicesById.get(deviceID);
    };

    this._config = deviceServerConfig;
    this._deviceAttributeRepository = deviceAttributeRepository;
    this._cryptoManager = new _CryptoManager2.default(deviceKeyRepository, serverKeyRepository);
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
      var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(eventName, data, deviceID) {
        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this._eventPublisher.publish({
                  data: data,
                  deviceID: deviceID,
                  isPublic: false,
                  name: eventName,
                  ttl: 60
                });

              case 2:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function publishSpecialEvent(_x8, _x9, _x10) {
        return _ref5.apply(this, arguments);
      }

      return publishSpecialEvent;
    }()
  }]);
  return DeviceServer;
}();

exports.default = DeviceServer;