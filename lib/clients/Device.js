'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DEVICE_MESSAGE_EVENTS_NAMES = exports.DEVICE_EVENT_NAMES = undefined;

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _h = require('h5.coap');

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

var _ICrypto = require('../lib/ICrypto');

var _ICrypto2 = _interopRequireDefault(_ICrypto);

var _Messages = require('../lib/Messages');

var _Messages2 = _interopRequireDefault(_Messages);

var _Handshake = require('../lib/Handshake');

var _Handshake2 = _interopRequireDefault(_Handshake);

var _utilities = require('../lib/utilities');

var _utilities2 = _interopRequireDefault(_utilities);

var _Flasher = require('../lib/Flasher');

var _Flasher2 = _interopRequireDefault(_Flasher);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _h2 = require('h5.buffers');

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Hello — sent first by Core then by Server immediately after handshake, never again
// Ignored — sent by either side to respond to a message with a bad counter value.
// The receiver of an Ignored message can optionally decide to resend a previous message
// if the indicated bad counter value matches a recently sent message.

// package flasher
// Chunk — sent by Server to send chunks of a firmware binary to Core
// ChunkReceived — sent by Core to respond to each chunk,
// indicating the CRC of the received chunk data.
// if Server receives CRC that does not match the chunk just sent, that chunk is sent again
// UpdateBegin — sent by Server to initiate an OTA firmware update
// UpdateReady — sent by Core to indicate readiness to receive firmware chunks
// UpdateDone — sent by Server to indicate all firmware chunks have been sent

// FunctionCall — sent by Server to tell Core to call a user-exposed function
// FunctionReturn — sent by Core in response to FunctionCall to indicate return value.
// void functions will not send this message
// VariableRequest — sent by Server to request the value of a user-exposed variable
// VariableValue — sent by Core in response to VariableRequest to indicate the value

// Event — sent by Core to initiate a Server Sent Event and optionally
// an HTTP callback to a 3rd party
// KeyChange — sent by Server to change the AES credentials

var COUNTER_MAX = _settings2.default.message_counter_max; /*
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
                                                          *   Lesser General Public License for more .
                                                          *
                                                          *   You should have received a copy of the GNU Lesser General Public
                                                          *   License along with this program; if not, see <http://www.gnu.org/licenses/>.
                                                          *
                                                          * 
                                                          *
                                                          */

var KEEP_ALIVE_TIMEOUT = _settings2.default.keepaliveTimeout;
var SOCKET_TIMEOUT = _settings2.default.socketTimeout;
var MAX_BINARY_SIZE = 108000; // According to the forums this is the max size.


var DEVICE_EVENT_NAMES = exports.DEVICE_EVENT_NAMES = {
  DISCONNECT: 'disconnect',
  FLASH_FAILED: 'flash/failed',
  FLASH_STARTED: 'flash/started',
  FLASH_SUCCESS: 'flash/success',
  READY: 'ready'
};

// this constants should be consistent with message names in
// MessageSpecifications.js
var DEVICE_MESSAGE_EVENTS_NAMES = exports.DEVICE_MESSAGE_EVENTS_NAMES = {
  GET_TIME: 'GetTime',
  PRIVATE_EVENT: 'PrivateEvent',
  PUBLIC_EVENT: 'PublicEvent',
  SUBSCRIBE: 'Subscribe'
};

/**
 * Implementation of the Particle messaging protocol
 * @Device
 */

var Device = function (_EventEmitter) {
  (0, _inherits3.default)(Device, _EventEmitter);

  function Device(socket, connectionKey) {
    var _this2 = this;

    (0, _classCallCheck3.default)(this, Device);

    var _this = (0, _possibleConstructorReturn3.default)(this, (Device.__proto__ || (0, _getPrototypeOf2.default)(Device)).call(this));

    _this._cipherStream = null;
    _this._connectionKey = null;
    _this._connectionStartTime = null;
    _this._decipherStream = null;
    _this._deviceFunctionState = null;
    _this._disconnectCounter = 0;
    _this._id = '';
    _this._lastCorePing = new Date();
    _this._particleProductId = 0;
    _this._platformId = 0;
    _this._productFirmwareVersion = 0;
    _this._recieveCounter = 0;
    _this._sendCounter = 0;
    _this._sendToken = 0;
    _this._tokens = {};
    _this.startupProtocol = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _this._socket.setNoDelay(true);
              _this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); // every 15 second(s)
              _this._socket.setTimeout(SOCKET_TIMEOUT);

              _this._socket.on('error', function (error) {
                return _this.disconnect('socket error: ' + error.message);
              });
              _this._socket.on('close', function () {
                return _this.disconnect('socket close');
              });
              _this._socket.on('timeout', function () {
                return _this.disconnect('socket timeout');
              });

              _context.next = 8;
              return _this.handshake();

            case 8:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this2);
    }));
    _this.handshake = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
      var handshake;
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              handshake = new _Handshake2.default(_this);

              // when the handshake is done, we can expect two stream properties,
              // '_decipherStream' and '_cipherStream'

              _context3.prev = 1;
              return _context3.delegateYield(_regenerator2.default.mark(function _callee2() {
                var _ref3, cipherStream, decipherStream, deviceID, handshakeBuffer, pendingBuffers, sessionKey;

                return _regenerator2.default.wrap(function _callee2$(_context2) {
                  while (1) {
                    switch (_context2.prev = _context2.next) {
                      case 0:
                        _context2.next = 2;
                        return handshake.start();

                      case 2:
                        _ref3 = _context2.sent;
                        cipherStream = _ref3.cipherStream;
                        decipherStream = _ref3.decipherStream;
                        deviceID = _ref3.deviceID;
                        handshakeBuffer = _ref3.handshakeBuffer;
                        pendingBuffers = _ref3.pendingBuffers;
                        sessionKey = _ref3.sessionKey;

                        _this._id = deviceID;

                        _this._getHello(handshakeBuffer);
                        _this._sendHello(cipherStream, decipherStream);

                        _this.ready();

                        pendingBuffers.map(function (data) {
                          return _this.routeMessage(data);
                        });
                        decipherStream.on('readable', function () {
                          var chunk = decipherStream.read();
                          if (!chunk) {
                            return;
                          }
                          _this.routeMessage(chunk);
                        });

                      case 15:
                      case 'end':
                        return _context2.stop();
                    }
                  }
                }, _callee2, _this2);
              })(), 't0', 3);

            case 3:
              _context3.next = 8;
              break;

            case 5:
              _context3.prev = 5;
              _context3.t1 = _context3['catch'](1);

              _this.disconnect(_context3.t1);

            case 8:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this2, [[1, 5]]);
    }));

    _this._getHello = function (chunk) {
      var message = _Messages2.default.unwrap(chunk);
      if (!message) {
        throw new Error('failed to parse hello');
      }

      _this._recieveCounter = message.getId();

      try {
        var payload = message.getPayload();
        if (payload.length <= 0) {
          return;
        }

        var payloadBuffer = new _h2.BufferReader(payload);
        _this._particleProductId = payloadBuffer.shiftUInt16();
        _this._productFirmwareVersion = payloadBuffer.shiftUInt16();
        _this._platformId = payloadBuffer.shiftUInt16();
      } catch (exception) {
        _logger2.default.log('error while parsing hello payload ', exception);
      }
    };

    _this._sendHello = function (cipherStream, decipherStream) {
      _this._cipherStream = cipherStream;
      _this._decipherStream = decipherStream;

      // client will set the counter property on the message
      _this._sendCounter = _ICrypto2.default.getRandomUINT16();
      _this.sendMessage('Hello', {}, null);
    };

    _this.ready = function () {
      _this._connectionStartTime = new Date();

      _logger2.default.log('On Device Ready:\r\n', {
        cache_key: _this._connectionKey,
        deviceID: _this._id,
        firmwareVersion: _this._productFirmwareVersion,
        ip: _this.getRemoteIPAddress(),
        platformID: _this._platformId,
        productID: _this._particleProductId
      });

      _this.emit(DEVICE_EVENT_NAMES.READY);
    };

    _this.onApiMessage = function () {
      var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(sender, message) {
        var isBusy, result, _result, _result2, showSignal, _result3;

        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                // if we're not the owner, then the socket is busy
                isBusy = !_this._isSocketAvailable(null);

                if (!isBusy) {
                  _context4.next = 3;
                  break;
                }

                throw new Error('This device is locked during the flashing process.');

              case 3:
                _context4.t0 = message.cmd;
                _context4.next = _context4.t0 === 'Describe' ? 6 : _context4.t0 === 'GetVar' ? 16 : _context4.t0 === 'SetVar' ? 21 : _context4.t0 === 'CallFn' ? 26 : _context4.t0 === 'UFlash' ? 31 : _context4.t0 === 'RaiseHand' ? 35 : _context4.t0 === 'Ping' ? 41 : 43;
                break;

              case 6:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('Describe', { deviceID: _this._id });
                }

                _context4.prev = 7;
                _context4.next = 10;
                return _this._ensureWeHaveIntrospectionData();

              case 10:
                return _context4.abrupt('return', {
                  cmd: 'DescribeReturn',
                  firmware_version: _this._productFirmwareVersion,
                  product_id: _this._particleProductId,
                  state: _this._deviceFunctionState
                });

              case 13:
                _context4.prev = 13;
                _context4.t1 = _context4['catch'](7);
                throw new Error('Error, no device state');

              case 16:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('GetVar', { deviceID: _this._id });
                }

                _context4.next = 19;
                return _this.getVariableValue(message.name, message.type);

              case 19:
                result = _context4.sent;
                return _context4.abrupt('return', {
                  cmd: 'VarReturn',
                  name: message.name,
                  result: result
                });

              case 21:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('SetVar', { deviceID: _this._id });
                }

                _context4.next = 24;
                return _this._setVariable(message.name, message.value);

              case 24:
                _result = _context4.sent;
                return _context4.abrupt('return', {
                  cmd: 'VarReturn',
                  name: message.name,
                  result: _result.getPayload().toString()
                });

              case 26:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('FunCall', { deviceID: _this._id });
                }

                _context4.next = 29;
                return _this._callFunction(message.name, message.args);

              case 29:
                _result2 = _context4.sent;
                return _context4.abrupt('return', {
                  cmd: 'FnReturn',
                  name: message.name,
                  result: _result2
                });

              case 31:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('FlashCore', { deviceID: _this._id });
                }

                _context4.next = 34;
                return _this.flashCore(message.args.data);

              case 34:
                return _context4.abrupt('return', _context4.sent);

              case 35:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('SignalCore', { deviceID: _this._id });
                }

                showSignal = message.args && message.args.signal;
                _context4.next = 39;
                return _this._raiseYourHand(showSignal);

              case 39:
                _result3 = _context4.sent;
                return _context4.abrupt('return', { cmd: 'RaiseHandReturn', result: _result3 });

              case 41:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('Pinged, replying', { deviceID: _this._id });
                }

                return _context4.abrupt('return', {
                  cmd: 'Pong',
                  connected: _this._socket !== null,
                  lastPing: _this._lastCorePing
                });

              case 43:
                throw new Error('unknown message');

              case 44:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this2, [[7, 13]]);
      }));

      return function (_x, _x2) {
        return _ref4.apply(this, arguments);
      };
    }();

    _this.routeMessage = function (data) {
      var message = _Messages2.default.unwrap(data);
      if (!message) {
        _logger2.default.error('routeMessage got a NULL coap message ', { deviceID: _this._id });
        return;
      }

      // should be adequate
      var messageCode = message.getCode();
      var requestType = '';
      if (messageCode > _h.Message.Code.EMPTY && messageCode <= _h.Message.Code.DELETE) {
        // probably a request
        requestType = _Messages2.default.getRequestType(message);
      }

      if (!requestType) {
        requestType = _this._getResponseType(message.getTokenString());
      }

      if (message.isAcknowledgement()) {
        if (!requestType) {
          // no type, can't route it.
          requestType = 'PingAck';
        }

        _this.emit(requestType, message);
        return;
      }

      _this._incrementReceiveCounter();
      if (message.isEmpty() && message.isConfirmable()) {
        _this._lastCorePing = new Date();
        // var delta = (this._lastCorePing - this._connectionStartTime) / 1000.0;
        // logger.log('core ping @ ', delta, ' seconds ', { deviceID: this._id });
        _this.sendReply('PingAck', message.getId());
        return;
      }

      if (!message || message.getId() !== _this._recieveCounter) {
        _logger2.default.log('got counter ', message.getId(), ' expecting ', _this._recieveCounter, { deviceID: _this._id });

        if (requestType === 'Ignored') {
          // don't ignore an ignore...
          _this.disconnect('Got an Ignore');
          return;
        }

        // this.sendMessage('Ignored', null, {}, null, null);
        _this.disconnect('Bad Counter');
        return;
      }

      _this.emit(requestType || '', message);
    };

    _this.sendReply = function (messageName, id, data, token, requester) {
      if (!_this._isSocketAvailable(requester || null, messageName)) {
        _logger2.default.error('This client has an exclusive lock.');
        return;
      }

      // if my reply is an acknowledgement to a confirmable message
      // then I need to re-use the message id...

      // set our counter
      if (id < 0) {
        _this._incrementSendCounter();
        id = _this._sendCounter;
      }

      var message = _Messages2.default.wrap(messageName, id, null, data, token, null);
      if (!message) {
        _logger2.default.error('Device - could not unwrap message', { deviceID: _this._id });
        return;
      }

      if (!_this._cipherStream) {
        _logger2.default.error('Device - sendReply before READY', { deviceID: _this._id });
        return;
      }
      _this._cipherStream.write(message);
    };

    _this.sendMessage = function (messageName, params, data, requester) {
      if (!_this._isSocketAvailable(requester, messageName)) {
        _logger2.default.error('This client has an exclusive lock.');
        return -1;
      }

      // increment our counter
      _this._incrementSendCounter();

      var token = null;
      if (!_Messages2.default.isNonTypeMessage(messageName)) {
        _this._incrementSendToken();
        _this._useToken(messageName, _this._sendToken);
        token = _this._sendToken;
      }

      var message = _Messages2.default.wrap(messageName, _this._sendCounter, params, data, token);

      if (!message) {
        _logger2.default.error('Could not wrap message', messageName, params, data);
        return -1;
      }

      if (!_this._cipherStream) {
        _logger2.default.error('Client - sendMessage before READY', { deviceID: _this._id, messageName: messageName });
        return -1;
      }

      _this._cipherStream.write(message);

      return token || 0;
    };

    _this.listenFor = function () {
      var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(eventName, uri, token) {
        var tokenHex, beVerbose;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                tokenHex = token ? _utilities2.default.toHexString(token) : null;
                beVerbose = _settings2.default.showVerboseDeviceLogs;
                return _context5.abrupt('return', new _promise2.default(function (resolve, reject) {
                  var timeout = setTimeout(function () {
                    cleanUpListeners();
                    reject('Request timed out');
                  }, KEEP_ALIVE_TIMEOUT);

                  // adds a one time event
                  var handler = function handler(message) {
                    clearTimeout(timeout);
                    if (uri && message.getUriPath().indexOf(uri) !== 0) {
                      if (beVerbose) {
                        _logger2.default.log('uri filter did not match', uri, message.getUriPath(), { deviceID: _this._id });
                      }
                      reject();
                      return;
                    }

                    if (tokenHex && tokenHex !== message.getTokenString()) {
                      if (beVerbose) {
                        _logger2.default.log('Tokens did not match ', tokenHex, message.getTokenString(), { deviceID: _this._id });
                      }
                      reject();
                      return;
                    }

                    cleanUpListeners();
                    resolve(message);
                  };

                  var disconnectHandler = function disconnectHandler() {
                    cleanUpListeners();
                    reject();
                  };

                  var cleanUpListeners = function cleanUpListeners() {
                    _this.removeListener(eventName, handler);
                    _this.removeListener('disconnect', disconnectHandler);
                  };

                  _this.on(eventName, handler);
                  _this.on('disconnect', disconnectHandler);
                }));

              case 3:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this2);
      }));

      return function (_x3, _x4, _x5) {
        return _ref5.apply(this, arguments);
      };
    }();

    _this._increment = function (counter) {
      counter++;
      return counter < COUNTER_MAX ? counter : 0;
    };

    _this._incrementSendCounter = function () {
      _this._sendCounter = _this._increment(_this._sendCounter);
    };

    _this._incrementReceiveCounter = function () {
      _this._recieveCounter = _this._increment(_this._recieveCounter);
    };

    _this._incrementSendToken = function () {
      _this._sendToken = _this._increment(_this._sendToken);
      _this._clearToken(_this._sendToken);
      return _this._sendToken;
    };

    _this._useToken = function (name, sendToken) {
      var key = _utilities2.default.toHexString(sendToken);

      if (_this._tokens[key]) {
        throw new Error('Token ' + name + ' ' + _this._tokens[key] + ' ' + key + ' already in use');
      }

      _this._tokens[key] = name;
    };

    _this._clearToken = function (sendToken) {
      var key = _utilities2.default.toHexString(sendToken);

      if (_this._tokens[key]) {
        delete _this._tokens[key];
      }
    };

    _this._getResponseType = function (tokenString) {
      var request = _this._tokens[tokenString];
      // logger.log('respType for key ', tokenStr, ' is ', request);

      if (!request) {
        return '';
      }

      return _Messages2.default.getResponseType(request);
    };

    _this.getVariableValue = function () {
      var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(name) {
        var messageToken, message;
        return _regenerator2.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return _this._ensureWeHaveIntrospectionData();

              case 2:
                if (_this._hasParticleVariable(name)) {
                  _context6.next = 4;
                  break;
                }

                throw new Error('Variable not found');

              case 4:
                messageToken = _this.sendMessage('VariableRequest', { name: name });
                _context6.next = 7;
                return _this.listenFor('VariableValue', null, messageToken);

              case 7:
                message = _context6.sent;
                return _context6.abrupt('return', _this._transformVariableResult(name, message));

              case 9:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, _this2);
      }));

      return function (_x6) {
        return _ref6.apply(this, arguments);
      };
    }();

    _this._setVariable = function () {
      var _ref7 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee7(name, data) {
        var payload, token;
        return _regenerator2.default.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                // TODO: data type!
                payload = _Messages2.default.toBinary(data);
                token = _this.sendMessage('VariableRequest', { name: name }, payload);

                // are we expecting a response?
                // watches the messages coming back in, listens for a message of this type
                // with

                _context7.next = 4;
                return _this.listenFor('VariableValue', null, token);

              case 4:
                return _context7.abrupt('return', _context7.sent);

              case 5:
              case 'end':
                return _context7.stop();
            }
          }
        }, _callee7, _this2);
      }));

      return function (_x7, _x8) {
        return _ref7.apply(this, arguments);
      };
    }();

    _this._callFunction = function () {
      var _ref8 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee9(name, args) {
        var _ret2;

        return _regenerator2.default.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.prev = 0;
                return _context9.delegateYield(_regenerator2.default.mark(function _callee8() {
                  var buffer, writeUrl, token, message;
                  return _regenerator2.default.wrap(function _callee8$(_context8) {
                    while (1) {
                      switch (_context8.prev = _context8.next) {
                        case 0:
                          _context8.next = 2;
                          return _this._transformArguments(name, args);

                        case 2:
                          buffer = _context8.sent;

                          if (buffer) {
                            _context8.next = 5;
                            break;
                          }

                          throw new Error('Unknown Function ' + name);

                        case 5:

                          if (_settings2.default.showVerboseDeviceLogs) {
                            _logger2.default.log('sending function call to the core', { deviceID: _this._id, name: name });
                          }

                          writeUrl = function writeUrl(message) {
                            message.setUri('f/' + name);
                            if (buffer) {
                              message.setUriQuery(buffer.toString());
                            }

                            return message;
                          };

                          token = _this.sendMessage('FunctionCall', {
                            _writeCoapUri: writeUrl,
                            args: buffer,
                            name: name
                          }, null);
                          _context8.next = 10;
                          return _this.listenFor('FunctionReturn', null, token);

                        case 10:
                          message = _context8.sent;
                          return _context8.abrupt('return', {
                            v: _this._transformFunctionResult(name, message)
                          });

                        case 12:
                        case 'end':
                          return _context8.stop();
                      }
                    }
                  }, _callee8, _this2);
                })(), 't0', 2);

              case 2:
                _ret2 = _context9.t0;

                if (!((typeof _ret2 === 'undefined' ? 'undefined' : (0, _typeof3.default)(_ret2)) === "object")) {
                  _context9.next = 5;
                  break;
                }

                return _context9.abrupt('return', _ret2.v);

              case 5:
                _context9.next = 10;
                break;

              case 7:
                _context9.prev = 7;
                _context9.t1 = _context9['catch'](0);
                throw _context9.t1;

              case 10:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, _this2, [[0, 7]]);
      }));

      return function (_x9, _x10) {
        return _ref8.apply(this, arguments);
      };
    }();

    _this._raiseYourHand = function () {
      var _ref9 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee10(showSignal) {
        var token;
        return _regenerator2.default.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                token = _this.sendMessage('_raiseYourHand', { _writeCoapUri: _Messages2.default.raiseYourHandUrlGenerator(showSignal) }, null);
                _context10.next = 3;
                return _this.listenFor('_raiseYourHandReturn', null, token);

              case 3:
                return _context10.abrupt('return', _context10.sent);

              case 4:
              case 'end':
                return _context10.stop();
            }
          }
        }, _callee10, _this2);
      }));

      return function (_x11) {
        return _ref9.apply(this, arguments);
      };
    }();

    _this.flashCore = function (binary) {
      if (!binary || binary.length === 0) {
        _logger2.default.log('flash failed! - file is empty! ', { deviceID: _this._id });

        throw new Error('Update failed - File was too small!');
      }

      if (binary && binary.length > MAX_BINARY_SIZE) {
        _logger2.default.log('flash failed! - file is too BIG ' + binary.length, { deviceID: _this._id });

        throw new Error('Update failed - File was too big!');
      }

      var flasher = new _Flasher2.default(_this);

      try {
        _logger2.default.log('flash device started! - sending api event', { deviceID: _this._id });

        _this.emit(DEVICE_EVENT_NAMES.FLASH_STARTED);

        flasher.startFlashBuffer(binary);

        _logger2.default.log('flash device finished! - sending api event', { deviceID: _this._id });

        _this.emit(DEVICE_EVENT_NAMES.FLASH_SUCCESS);

        return {
          cmd: 'FlashReturn',
          message: 'Update started',
          name: 'Update'
        };
      } catch (error) {
        _logger2.default.log('flash device failed! - sending api event', { deviceID: _this._id, error: error });

        _this.emit(DEVICE_EVENT_NAMES.FLASH_FAILED);
        throw new Error('update failed: ' + error.message);
      }
    };

    _this._isSocketAvailable = function (requester, messageName) {
      if (!_this._owningFlasher || _this._owningFlasher === requester) {
        return true;
      }

      _logger2.default.error('This client has an exclusive lock', {
        cache_key: _this._connectionKey,
        deviceID: _this._id,
        messageName: messageName
      });

      return false;
    };

    _this.takeOwnership = function (flasher) {
      if (_this._owningFlasher) {
        _logger2.default.error('already owned', { deviceID: _this._id });
        return false;
      }
      // only permit the owning object to send messages.
      _this._owningFlasher = flasher;
      return true;
    };

    _this.releaseOwnership = function (flasher) {
      _logger2.default.log('releasing flash ownership ', { coreID: _this._id });
      if (_this._owningFlasher === flasher) {
        _this._owningFlasher = null;
      } else if (_this._owningFlasher) {
        _logger2.default.error('cannot releaseOwnership, ', flasher, ' isn\'t the current owner ', { deviceID: _this._id });
      }
    };

    _this._transformVariableResult = function (name, message) {
      // grab the variable type, if the core doesn't say, assume it's a 'string'
      var variableFunctionState = _this._deviceFunctionState ? _this._deviceFunctionState.v : null;
      var variableType = variableFunctionState && variableFunctionState[name] ? variableFunctionState[name] : 'string';

      var result = null;
      var data = null;
      try {
        if (message && message.getPayload) {
          // leaving raw payload in response message for now, so we don't shock
          // our users.
          data = message.getPayload();
          result = _Messages2.default.fromBinary(data, variableType);
        }
      } catch (error) {
        _logger2.default.error('_transformVariableResult - error transforming response ' + error);
      }

      return result;
    };

    _this._transformFunctionResult = function (name, message) {
      var variableType = 'int32';

      var result = null;
      try {
        if (message && message.getPayload) {
          result = _Messages2.default.fromBinary(message.getPayload(), variableType);
        }
      } catch (error) {
        _logger2.default.error('_transformFunctionResult - error transforming response ' + error);
        throw error;
      }

      return result;
    };

    _this._transformArguments = function () {
      var _ref10 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee11(name, args) {
        var deviceFunctionState, functionState, oldProtocolFunctionState;
        return _regenerator2.default.wrap(function _callee11$(_context11) {
          while (1) {
            switch (_context11.prev = _context11.next) {
              case 0:
                if (args) {
                  _context11.next = 2;
                  break;
                }

                return _context11.abrupt('return', null);

              case 2:
                _context11.next = 4;
                return _this._ensureWeHaveIntrospectionData();

              case 4:
                //TODO: lowercase function keys on new state format
                name = name.toLowerCase();
                deviceFunctionState = (0, _nullthrows2.default)(_this._deviceFunctionState);
                functionState = deviceFunctionState[name];

                if (!functionState || !functionState.args) {
                  //maybe it's the old protocol?
                  oldProtocolFunctionState = deviceFunctionState.f;

                  if (oldProtocolFunctionState && oldProtocolFunctionState.some(function (fn) {
                    return fn.toLowerCase() === name;
                  })) {
                    //current / simplified function format (one string arg, int return type)
                    functionState = {
                      returns: 'int',
                      args: [[null, 'string']]
                    };
                  }
                }

                if (!(!functionState || !functionState.args)) {
                  _context11.next = 10;
                  break;
                }

                return _context11.abrupt('return', null);

              case 10:
                return _context11.abrupt('return', _Messages2.default.buildArguments(args, functionState.args));

              case 11:
              case 'end':
                return _context11.stop();
            }
          }
        }, _callee11, _this2);
      }));

      return function (_x12, _x13) {
        return _ref10.apply(this, arguments);
      };
    }();

    _this._ensureWeHaveIntrospectionData = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee13() {
      return _regenerator2.default.wrap(function _callee13$(_context13) {
        while (1) {
          switch (_context13.prev = _context13.next) {
            case 0:
              if (!_this._hasFunctionState()) {
                _context13.next = 2;
                break;
              }

              return _context13.abrupt('return', _promise2.default.resolve());

            case 2:
              _context13.prev = 2;
              return _context13.delegateYield(_regenerator2.default.mark(function _callee12() {
                var systemMessage, data, firstFunctionState, functionState;
                return _regenerator2.default.wrap(function _callee12$(_context12) {
                  while (1) {
                    switch (_context12.prev = _context12.next) {
                      case 0:
                        _this.sendMessage('Describe');
                        _context12.next = 3;
                        return _this.listenFor('DescribeReturn', null, null);

                      case 3:
                        systemMessage = _context12.sent;


                        //got a description, is it any good?
                        data = systemMessage.getPayload();
                        firstFunctionState = JSON.parse(data.toString());

                        // In the newer firmware the application data comes in a later message.
                        // We run a race to see if the function state comes in the first response.

                        _context12.next = 8;
                        return _promise2.default.race([_this.listenFor('DescribeReturn', null, null).then(function (applicationMessage) {
                          //got a description, is it any good?
                          var data = applicationMessage.getPayload();
                          return JSON.parse(data.toString());
                        }), new _promise2.default(function (resolve, reject) {
                          if (firstFunctionState.f && firstFunctionState.v) {
                            resolve(firstFunctionState);
                          }
                        })]);

                      case 8:
                        functionState = _context12.sent;


                        if (functionState && functionState.v) {
                          //'v':{'temperature':2}
                          functionState.v = _Messages2.default.translateIntTypes(functionState.v);
                        }

                        _this._deviceFunctionState = functionState;

                      case 11:
                      case 'end':
                        return _context12.stop();
                    }
                  }
                }, _callee12, _this2);
              })(), 't0', 4);

            case 4:
              _context13.next = 9;
              break;

            case 6:
              _context13.prev = 6;
              _context13.t1 = _context13['catch'](2);
              throw _context13.t1;

            case 9:
            case 'end':
              return _context13.stop();
          }
        }
      }, _callee13, _this2, [[2, 6]]);
    }));

    _this.onCoreEvent = function (event) {
      _this.sendCoreEvent(event);
    };

    _this.sendCoreEvent = function (event) {
      var data = event.data,
          isPublic = event.isPublic,
          name = event.name,
          publishedAt = event.publishedAt,
          ttl = event.ttl;


      var rawFunction = function rawFunction(message) {
        try {
          message.setMaxAge(ttl >= 0 ? ttl : 60);
          if (publishedAt) {
            message.setTimestamp((0, _moment2.default)(publishedAt).toDate());
          }
        } catch (error) {
          _logger2.default.error('onCoreHeard - ' + error.message);
        }

        return message;
      };

      var messageName = isPublic ? 'PublicEvent' : 'PrivateEvent';
      // const userID = (this._userId || '').toLowerCase() + '/';
      // name = name ? name.toString() : name;
      // if (name && name.indexOf && (name.indexOf(userID)===0)) {
      //   name = name.substring(userID.length);
      // }

      _this.sendMessage(messageName, {
        _raw: rawFunction,
        event_name: name.toString()
      }, data && data.toString());
    };

    _this._hasFunctionState = function () {
      return !!_this._deviceFunctionState;
    };

    _this._hasParticleVariable = function (name) {
      return !!(_this._deviceFunctionState && _this._deviceFunctionState.v && _this._deviceFunctionState.v[name]);
    };

    _this._hasSparkFunction = function (name) {
      // has state, and... the function is an object, or it's in the function array
      var lowercaseName = name.toLowerCase();
      return !!(_this._deviceFunctionState && (_this._deviceFunctionState[name] || _this._deviceFunctionState.f && _this._deviceFunctionState.f.some(function (fn) {
        return fn.toLowerCase() === lowercaseName;
      })));
    };

    _this.getID = function () {
      return _this._id;
    };

    _this.getRemoteIPAddress = function () {
      return _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown';
    };

    _this.disconnect = function () {
      var message = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

      // eslint-disable-next-line no-plusplus
      _this._disconnectCounter++;

      if (_this._disconnectCounter > 1) {
        // don't multi-disconnect
        return;
      }

      try {
        var logInfo = {
          cache_key: _this._connectionKey,
          deviceID: _this._id,
          duration: _this._connectionStartTime ? (new Date() - _this._connectionStartTime) / 1000.0 : undefined
        };

        _logger2.default.log(_this._disconnectCounter + ' : Core disconnected: ' + (message || ''), logInfo);
      } catch (error) {
        _logger2.default.error('Disconnect log error ' + error);
      }

      try {
        _this._socket.end();
        _this._socket.destroy();
      } catch (error) {
        _logger2.default.error('Disconnect TCPSocket error: ' + error);
      }

      if (_this._decipherStream) {
        try {
          _this._decipherStream.end();
          _this._decipherStream = null;
        } catch (error) {
          _logger2.default.error('Error cleaning up decipherStream: ' + error);
        }
      }

      if (_this._cipherStream) {
        try {
          _this._cipherStream.end();
          _this._cipherStream = null;
        } catch (error) {
          _logger2.default.error('Error cleaning up cipherStream: ' + error);
        }
      }

      _this.emit(DEVICE_EVENT_NAMES.DISCONNECT, message);

      // obv, don't do this before emitting disconnect.
      try {
        _this.removeAllListeners();
      } catch (error) {
        _logger2.default.error('Problem removing listeners ' + error);
      }
    };

    _this._connectionKey = connectionKey;
    _this._socket = socket;
    return _this;
  }

  /**
   * configure our socket and start the handshake
   */


  /**
   * Handles messages coming from the API over our message queue service
   */


  /**
   * Deals with messages coming from the core over our secure connection
   * @param data
   */
  // TODO figure out and clean this method


  /**
   * Adds a listener to our secure message stream
   * @param name the message type we're waiting on
   * @param uri - a particular function / variable?
   * @param token - what message does this go with? (should come from
   *  sendMessage)
   */


  /**
   * Gets or wraps
   * @returns {null}
   */


  /**
   * increments or wraps our token value, and makes sure it isn't in use
   */


  /**
   * Associates a particular token with a message we're sending, so we know
   * what we're getting back when we get an ACK
   * @param name
   * @param sendToken
   */


  /**
   * Clears the association with a particular token
   * @param sendToken
   */


  /**
   * Ensures we have introspection data from the core, and then
   * requests a variable value to be sent, when received it transforms
   * the response into the appropriate type
   **/


  /**
   * Asks the core to start or stop its 'raise your hand' signal
   * @param showSignal - whether it should show the signal or not
   * @param callback - what to call when we're done or timed out...
   */


  /**
   *
   * @param name
   * @param message
   * @param callback-- callback expects (value, buf, err)
   * @returns {null}
   */


  /**
   * Transforms the result from a core function to the correct type.
   * @param name
   * @param msg
   * @param callback
   * @returns {null}
   */


  /**
   * transforms our object into a nice coap query string
   * @param name
   * @param args
   * @private
   */


  /**
   * Checks our cache to see if we have the function state, otherwise requests
   * it from the core, listens for it, and resolves our deferred on success
   * @returns {*}
   */


  //-------------
  // Core Events / Spark.publish / Spark.subscribe
  //-------------

  // TODO rework and figure out how to implement subscription with `MY_DEVICES`
  // right way


  // eslint-disable-next-line no-confusing-arrow


  // eslint-disable-next-line no-confusing-arrow


  return Device;
}(_events2.default);

exports.default = Device;