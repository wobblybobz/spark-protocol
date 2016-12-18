'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

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

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
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

// Hello — sent first by Core then by Server immediately after handshake, never again
// Ignored — sent by either side to respond to a message with a bad counter value. The receiver of an Ignored message can optionally decide to resend a previous message if the indicated bad counter value matches a recently sent message.

// package flasher
// Chunk — sent by Server to send chunks of a firmware binary to Core
// ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
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

var COUNTER_MAX = _settings2.default.message_counter_max;
var KEEP_ALIVE_TIMEOUT = _settings2.default.keepaliveTimeout;
var SOCKET_TIMEOUT = _settings2.default.socketTimeout;
var MAX_BINARY_SIZE = 108000; // According to the forums this is the max size.

/**
 * Implementation of the Particle messaging protocol
 * @SparkCore
 */

var SparkCore = function (_EventEmitter) {
  _inherits(SparkCore, _EventEmitter);

  function SparkCore(socket) {
    var _this2 = this;

    _classCallCheck(this, SparkCore);

    var _this = _possibleConstructorReturn(this, (SparkCore.__proto__ || Object.getPrototypeOf(SparkCore)).call(this));

    _this._cipherStream = null;
    _this._connectionKey = null;
    _this._connectionStartTime = null;
    _this._decipherStream = null;
    _this._deviceFunctionState = null;
    _this._disconnectCounter = 0;
    _this._lastCorePing = new Date();
    _this._particleProductId = 0;
    _this._platformId = 0;
    _this._productFirmwareVersion = 0;
    _this._recieveCounter = 0;
    _this._sendCounter = 0;
    _this._sendToken = 0;
    _this._tokens = {};

    _this.startupProtocol = function () {
      _this._socket.setNoDelay(true);
      _this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); // every 15 second(s)
      _this._socket.setTimeout(SOCKET_TIMEOUT);

      _this._socket.on('error', function (error) {
        return _this.disconnect('socket error ' + error);
      });
      _this._socket.on('close', function (error) {
        return _this.disconnect('socket close ' + error);
      });
      _this._socket.on('timeout', function (error) {
        return _this.disconnect('socket timeout ' + error);
      });

      _this.handshake();
    };

    _this.handshake = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
      var handshake;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              handshake = new _Handshake2.default(_this);

              // when the handshake is done, we can expect two stream properties,
              // '_decipherStream' and '_cipherStream'

              _context2.prev = 1;
              return _context2.delegateYield(regeneratorRuntime.mark(function _callee() {
                var _ref2, coreId, cipherStream, decipherStream, handshakeBuffer, pendingBuffers, sessionKey;

                return regeneratorRuntime.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        _context.next = 2;
                        return handshake.start();

                      case 2:
                        _ref2 = _context.sent;
                        coreId = _ref2.coreId;
                        cipherStream = _ref2.cipherStream;
                        decipherStream = _ref2.decipherStream;
                        handshakeBuffer = _ref2.handshakeBuffer;
                        pendingBuffers = _ref2.pendingBuffers;
                        sessionKey = _ref2.sessionKey;

                        _this._coreId = coreId;

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
                        return _context.stop();
                    }
                  }
                }, _callee, _this2);
              })(), 't0', 3);

            case 3:
              _context2.next = 8;
              break;

            case 5:
              _context2.prev = 5;
              _context2.t1 = _context2['catch'](1);

              _this.disconnect(_context2.t1);

            case 8:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this2, [[1, 5]]);
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
        coreID: _this.getHexCoreID(),
        firmware_version: _this._productFirmwareVersion,
        ip: _this.getRemoteIPAddress(),
        platformId: _this._platformId,
        product_id: _this._particleProductId
      });

      _this.on('msg_PrivateEvent'.toLowerCase(), function (message) {
        return _this._onCorePrivateEvent(message);
      });
      _this.on('msg_PublicEvent'.toLowerCase(), function (message) {
        return _this._onCorePublicEvent(message);
      });
      _this.on('msg_Subscribe'.toLowerCase(), function (message) {
        return _this.onCorePublicSubscribe(message);
      });
      _this.on('msg_GetTime'.toLowerCase(), function (message) {
        return _this._onCoreGetTime(message);
      });

      _this.emit('ready');
    };

    _this.sendApiResponse = function (sender, response) {
      try {
        _this.emit(sender, sender, response);
      } catch (exception) {
        _logger2.default.error('Error during response ', exception);
      }
    };

    _this.onApiMessage = function () {
      var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(sender, message) {
        var isBusy, result, response, _response, _result, _result2, sendResult, _sendResult, showSignal, _result3, _result4;

        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                // if we're not the owner, then the socket is busy
                isBusy = !_this._isSocketAvailable(null);

                if (!isBusy) {
                  _context3.next = 4;
                  break;
                }

                _this.sendApiResponse(sender, { error: new Error('This core is locked during the flashing process.') });
                return _context3.abrupt('return', Promise.reject());

              case 4:
                _context3.t0 = message.cmd;
                _context3.next = _context3.t0 === 'Describe' ? 7 : _context3.t0 === 'GetVar' ? 19 : _context3.t0 === 'SetVar' ? 34 : _context3.t0 === 'CallFn' ? 40 : _context3.t0 === 'UFlash' ? 55 : _context3.t0 === 'FlashKnown' ? 58 : _context3.t0 === 'RaiseHand' ? 61 : _context3.t0 === 'Ping' ? 68 : 72;
                break;

              case 7:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('Describe', { coreID: _this._coreId });
                }

                _context3.prev = 8;
                _context3.next = 11;
                return _this._ensureWeHaveIntrospectionData();

              case 11:
                _this.sendApiResponse(sender, {
                  cmd: 'DescribeReturn',
                  firmware_version: _this._productFirmwareVersion,
                  name: message.name,
                  product_id: _this._particleProductId,
                  state: _this._deviceFunctionState
                });

                return _context3.abrupt('return', _this._deviceFunctionState);

              case 15:
                _context3.prev = 15;
                _context3.t1 = _context3['catch'](8);

                _this.sendApiResponse(sender, {
                  cmd: 'DescribeReturn',
                  error: 'Error, no device state',
                  name: message.name
                });

              case 18:
                return _context3.abrupt('break', 73);

              case 19:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('GetVar', { coreID: _this._coreId });
                }
                _context3.prev = 20;
                _context3.next = 23;
                return _this._getVariable(message.name, message.type);

              case 23:
                result = _context3.sent;
                response = {
                  cmd: 'VarReturn',
                  name: message.name,
                  result: result
                };

                _this.sendApiResponse(sender, response);
                return _context3.abrupt('return', result);

              case 29:
                _context3.prev = 29;
                _context3.t2 = _context3['catch'](20);
                _response = {
                  cmd: 'VarReturn',
                  error: _context3.t2,
                  name: message.name
                };

                _this.sendApiResponse(sender, _response);
                return _context3.abrupt('return', _response);

              case 34:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('SetVar', { coreID: _this._coreId });
                }
                _context3.next = 37;
                return _this._setVariable(message.name, message.value);

              case 37:
                _result = _context3.sent;


                _this.sendApiResponse(sender, {
                  cmd: 'VarReturn',
                  name: message.name,
                  result: _result.getPayload().toString()
                });
                return _context3.abrupt('break', 73);

              case 40:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('FunCall', { coreID: _this._coreId });
                }

                _context3.prev = 41;
                _context3.next = 44;
                return _this._callFunction(message.name, message.args);

              case 44:
                _result2 = _context3.sent;
                sendResult = {
                  cmd: 'FnReturn',
                  name: message.name,
                  result: _result2
                };

                _this.sendApiResponse(sender, sendResult);
                return _context3.abrupt('return', sendResult);

              case 50:
                _context3.prev = 50;
                _context3.t3 = _context3['catch'](41);
                _sendResult = {
                  cmd: 'FnReturn',
                  error: _context3.t3,
                  name: message.name
                };

                _this.sendApiResponse(sender, _sendResult);
                return _context3.abrupt('return', _sendResult);

              case 55:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('FlashCore', { coreID: _this._coreId });
                }

                _this.flashCore(message.args.data, sender);
                return _context3.abrupt('break', 73);

              case 58:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('FlashKnown', { app: message.app, coreID: _this._coreId });
                }

                // Responsibility for sanitizing app names lies with API Service
                // This includes only allowing apps whose binaries are deployed and thus exist
                _fs2.default.readFile('known_firmware/' + message.app + '_' + _settings2.default.environment + '.bin', function (error, buffer) {
                  if (!error) {
                    _this.flashCore(buffer, sender);
                    return;
                  }

                  _logger2.default.log('Error flashing known firmware', { coreID: _this._coreId, error: error });
                  _this.sendApiResponse(sender, {
                    cmd: 'Event',
                    message: 'Update failed - ' + JSON.stringify(error),
                    name: 'Update'
                  });
                });
                return _context3.abrupt('break', 73);

              case 61:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('SignalCore', { coreID: _this._coreId });
                }

                showSignal = message.args && message.args.signal;
                _context3.next = 65;
                return _this._raiseYourHand(showSignal);

              case 65:
                _result3 = _context3.sent;

                _this.sendApiResponse(sender, { cmd: 'RaiseHandReturn', result: _result3 });
                return _context3.abrupt('break', 73);

              case 68:
                if (_settings2.default.logApiMessages) {
                  _logger2.default.log('Pinged, replying', { coreID: _this._coreId });
                }
                _result4 = {
                  cmd: 'Pong',
                  connected: _this._socket !== null,
                  lastPing: _this._lastCorePing
                };

                _this.sendApiResponse(sender, _result4);

                return _context3.abrupt('return', _result4);

              case 72:
                _this.sendApiResponse(sender, { error: new Error('unknown message') });

              case 73:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, _this2, [[8, 15], [20, 29], [41, 50]]);
      }));

      return function (_x, _x2) {
        return _ref3.apply(this, arguments);
      };
    }();

    _this.routeMessage = function (data) {
      var message = _Messages2.default.unwrap(data);
      if (!message) {
        _logger2.default.error('routeMessage got a NULL coap message ', { coreID: _this.getHexCoreID() });
        return;
      }

      //should be adequate
      var messageCode = message.getCode();
      var requestType = '';
      if (messageCode > _h.Message.Code.EMPTY && messageCode <= _h.Message.Code.DELETE) {
        //probably a request
        requestType = _Messages2.default.getRequestType(message);
      }

      if (!requestType) {
        requestType = _this._getResponseType(message.getTokenString());
      }

      if (message.isAcknowledgement()) {
        if (!requestType) {
          //no type, can't route it.
          requestType = 'PingAck';
        }
        _this.emit(('msg_' + requestType).toLowerCase(), message);
        return;
      }

      _this._incrementRecieveCounter();
      if (message.isEmpty() && message.isConfirmable()) {
        _this._lastCorePing = new Date();
        //var delta = (this._lastCorePing - this._connectionStartTime) / 1000.0;
        //logger.log('core ping @ ', delta, ' seconds ', { coreID: this.getHexCoreID() });
        _this.sendReply('PingAck', message.getId());
        return;
      }

      if (!message || message.getId() !== _this._recieveCounter) {
        _logger2.default.log('got counter ', message.getId(), ' expecting ', _this._recieveCounter, { coreID: _this.getHexCoreID() });

        if (requestType === 'Ignored') {
          //don't ignore an ignore...
          _this.disconnect('Got an Ignore');
          return;
        }

        //this.sendMessage('Ignored', null, {}, null, null);
        _this.disconnect('Bad Counter');
        return;
      }

      _this.emit(('msg_' + (requestType || '')).toLowerCase(), message);
    };

    _this.sendReply = function (messageName, id, data, token, requester) {
      if (!_this._isSocketAvailable(requester || null, messageName)) {
        _logger2.default.error('This client has an exclusive lock.');
        return;
      }

      //if my reply is an acknowledgement to a confirmable message
      //then I need to re-use the message id...

      //set our counter
      if (id < 0) {
        _this._incrementSendCounter();
        id = _this._sendCounter;
      }

      var message = _Messages2.default.wrap(messageName, id, null, data, token, null);
      if (!message) {
        _logger2.default.error('Device - could not unwrap message', { coreID: _this.getHexCoreID() });
        return;
      }

      if (!_this._cipherStream) {
        _logger2.default.error('Device - sendReply before READY', { coreID: _this.getHexCoreID() });
        return;
      }
      _this._cipherStream.write(message);
    };

    _this.sendMessage = function (messageName, params, data, requester) {
      if (!_this._isSocketAvailable(requester, messageName)) {
        _logger2.default.error('This client has an exclusive lock.');
        return -1;
      }

      //increment our counter
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
        _logger2.default.error('Client - sendMessage before READY', { coreID: _this.getHexCoreID() });
        return -1;
      }

      _this._cipherStream.write(message);

      return token || 0;
    };

    _this.listenFor = function () {
      var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(name, uri, token) {
        var tokenHex, beVerbose, eventName;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                tokenHex = token ? _utilities2.default.toHexString(token) : null;
                beVerbose = _settings2.default.showVerboseDeviceLogs;
                eventName = 'msg_' + name.toLowerCase();
                return _context4.abrupt('return', new Promise(function (resolve, reject) {
                  var timeout = setTimeout(function () {
                    cleanUpListeners();
                    reject('Request timed out');
                  }, KEEP_ALIVE_TIMEOUT);

                  //adds a one time event
                  var handler = function handler(message) {
                    clearTimeout(timeout);
                    if (uri && message.getUriPath().indexOf(uri) !== 0) {
                      if (beVerbose) {
                        _logger2.default.log('uri filter did not match', uri, message.getUriPath(), { coreID: _this.getHexCoreID() });
                      }
                      reject();
                      return;
                    }

                    if (tokenHex && tokenHex !== message.getTokenString()) {
                      if (beVerbose) {
                        _logger2.default.log('Tokens did not match ', tokenHex, message.getTokenString(), { coreID: _this.getHexCoreID() });
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

              case 4:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, _this2);
      }));

      return function (_x3, _x4, _x5, _x6) {
        return _ref4.apply(this, arguments);
      };
    }();

    _this._increment = function (counter) {
      counter++;
      return counter < COUNTER_MAX ? counter : 0;
    };

    _this._incrementSendCounter = function () {
      _this._sendCounter = _this._increment(_this._sendCounter);
    };

    _this._incrementRecieveCounter = function () {
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
      //logger.log('respType for key ', tokenStr, ' is ', request);

      if (!request) {
        return '';
      }

      return _Messages2.default.getResponseType(request);
    };

    _this._getVariable = function () {
      var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5(name, type) {
        var messageToken, message;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return _this._ensureWeHaveIntrospectionData();

              case 2:
                if (_this._hasParticleVariable(name)) {
                  _context5.next = 4;
                  break;
                }

                throw new Error('Variable not found');

              case 4:
                messageToken = _this.sendMessage('VariableRequest', { name: name });
                _context5.next = 7;
                return _this.listenFor('VariableValue', null, messageToken);

              case 7:
                message = _context5.sent;
                return _context5.abrupt('return', _this._transformVariableResult(name, message));

              case 9:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, _this2);
      }));

      return function (_x7, _x8) {
        return _ref5.apply(this, arguments);
      };
    }();

    _this._setVariable = function () {
      var _ref6 = _asyncToGenerator(regeneratorRuntime.mark(function _callee6(name, data) {
        var payload, token;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                /*TODO: data type! */
                payload = _Messages2.default.toBinary(data);
                token = _this.sendMessage('VariableRequest', { name: name }, payload);

                //are we expecting a response?
                //watches the messages coming back in, listens for a message of this type with

                _context6.next = 4;
                return _this.listenFor('VariableValue', null, token);

              case 4:
                return _context6.abrupt('return', _context6.sent);

              case 5:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, _this2);
      }));

      return function (_x9, _x10, _x11) {
        return _ref6.apply(this, arguments);
      };
    }();

    _this._callFunction = function () {
      var _ref7 = _asyncToGenerator(regeneratorRuntime.mark(function _callee8(name, args) {
        var _ret2;

        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.prev = 0;
                return _context8.delegateYield(regeneratorRuntime.mark(function _callee7() {
                  var buffer, writeUrl, token, message;
                  return regeneratorRuntime.wrap(function _callee7$(_context7) {
                    while (1) {
                      switch (_context7.prev = _context7.next) {
                        case 0:
                          _context7.next = 2;
                          return _this._transformArguments(name, args);

                        case 2:
                          buffer = _context7.sent;

                          if (buffer) {
                            _context7.next = 5;
                            break;
                          }

                          throw new Error('Unknown Function ' + name);

                        case 5:

                          if (_settings2.default.showVerboseDeviceLogs) {
                            _logger2.default.log('sending function call to the core', { coreID: _this._coreId, name: name });
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
                          _context7.next = 10;
                          return _this.listenFor('FunctionReturn', null, token);

                        case 10:
                          message = _context7.sent;
                          return _context7.abrupt('return', {
                            v: _this._transformFunctionResult(name, message)
                          });

                        case 12:
                        case 'end':
                          return _context7.stop();
                      }
                    }
                  }, _callee7, _this2);
                })(), 't0', 2);

              case 2:
                _ret2 = _context8.t0;

                if (!((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object")) {
                  _context8.next = 5;
                  break;
                }

                return _context8.abrupt('return', _ret2.v);

              case 5:
                _context8.next = 10;
                break;

              case 7:
                _context8.prev = 7;
                _context8.t1 = _context8['catch'](0);
                throw _context8.t1;

              case 10:
              case 'end':
                return _context8.stop();
            }
          }
        }, _callee8, _this2, [[0, 7]]);
      }));

      return function (_x12, _x13) {
        return _ref7.apply(this, arguments);
      };
    }();

    _this._raiseYourHand = function () {
      var _ref8 = _asyncToGenerator(regeneratorRuntime.mark(function _callee9(showSignal) {
        var token;
        return regeneratorRuntime.wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                token = _this.sendMessage('_raiseYourHand', { _writeCoapUri: _Messages2.default.raiseYourHandUrlGenerator(showSignal) }, null);
                _context9.next = 3;
                return _this.listenFor('_raiseYourHandReturn', null, token);

              case 3:
                return _context9.abrupt('return', _context9.sent);

              case 4:
              case 'end':
                return _context9.stop();
            }
          }
        }, _callee9, _this2);
      }));

      return function (_x14, _x15) {
        return _ref8.apply(this, arguments);
      };
    }();

    _this.flashCore = function (binary, sender) {
      if (!binary || binary.length === 0) {
        _logger2.default.log('flash failed! - file is empty! ', { coreID: _this.getHexCoreID() });
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          error: new Error('Update failed - File was too small!'),
          name: 'Update'
        });
        return;
      }

      if (binary && binary.length > MAX_BINARY_SIZE) {
        _logger2.default.log('flash failed! - file is too BIG ' + binary.length, { coreID: _this.getHexCoreID() });
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          error: new Error('Update failed - File was too big!'),
          name: 'Update'
        });
        return;
      }

      var flasher = new _Flasher2.default(_this);
      flasher.startFlashBuffer(binary, function () {
        _logger2.default.log('flash core finished! - sending api event', { coreID: _this.getHexCoreID() });

        global.server.publishSpecialEvent('spark/flash/status', 'success', _this.getHexCoreID());
        _this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update done' });
      }, function (message) {
        _logger2.default.log('flash core failed! - sending api event', { coreID: _this.getHexCoreID(), error: message });
        global.server.publishSpecialEvent('spark/flash/status', 'failed', _this.getHexCoreID());
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          error: new Error('Update failed'),
          name: 'Update'
        });
      }, function () {
        _logger2.default.log('flash core started! - sending api event', { coreID: _this.getHexCoreID() });
        global.server.publishSpecialEvent('spark/flash/status', 'started', _this.getHexCoreID());
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          message: 'Update started',
          name: 'Update'
        });
      });
    };

    _this._isSocketAvailable = function (requester, messageName) {
      if (!_this._owningFlasher || _this._owningFlasher === requester) {
        return true;
      }

      _logger2.default.error('This client has an exclusive lock', {
        cache_key: _this._connectionKey,
        coreID: _this.getHexCoreID(),
        messageName: messageName
      });

      return false;
    };

    _this.takeOwnership = function (flasher) {
      if (_this._owningFlasher) {
        _logger2.default.error('already owned', { coreID: _this.getHexCoreID() });
        return false;
      }
      // only permit the owning object to send messages.
      _this._owningFlasher = flasher;
      return true;
    };

    _this.releaseOwnership = function (flasher) {
      _logger2.default.log('releasing flash ownership ', { coreID: _this.getHexCoreID() });
      if (_this._owningFlasher === flasher) {
        _this._owningFlasher = null;
      } else if (_this._owningFlasher) {
        _logger2.default.error('cannot releaseOwnership, ', flasher, ' isn\'t the current owner ', { coreID: _this.getHexCoreID() });
      }
    };

    _this._transformVariableResult = function (name, message) {
      //grab the variable type, if the core doesn't say, assume it's a 'string'
      var variableFunctionState = _this._deviceFunctionState ? _this._deviceFunctionState.v : null;
      var variableType = variableFunctionState && variableFunctionState[name] ? variableFunctionState[name] : 'string';

      var result = null;
      var data = null;
      try {
        if (message && message.getPayload) {
          //leaving raw payload in response message for now, so we don't shock our users.
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
      }

      return result;
    };

    _this._transformArguments = function () {
      var _ref9 = _asyncToGenerator(regeneratorRuntime.mark(function _callee10(name, args) {
        var deviceFunctionState, functionState, oldProtocolFunctionState;
        return regeneratorRuntime.wrap(function _callee10$(_context10) {
          while (1) {
            switch (_context10.prev = _context10.next) {
              case 0:
                if (args) {
                  _context10.next = 2;
                  break;
                }

                return _context10.abrupt('return', null);

              case 2:
                _context10.next = 4;
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
                    //logger.log('_transformArguments - using old format', { coreID: this.getHexCoreID() });
                    //current / simplified function format (one string arg, int return type)
                    functionState = {
                      returns: 'int',
                      args: [[null, 'string']]
                    };
                  }
                }

                if (!(!functionState || !functionState.args)) {
                  _context10.next = 10;
                  break;
                }

                return _context10.abrupt('return', null);

              case 10:
                return _context10.abrupt('return', _Messages2.default.buildArguments(args, functionState.args));

              case 11:
              case 'end':
                return _context10.stop();
            }
          }
        }, _callee10, _this2);
      }));

      return function (_x16, _x17) {
        return _ref9.apply(this, arguments);
      };
    }();

    _this._ensureWeHaveIntrospectionData = _asyncToGenerator(regeneratorRuntime.mark(function _callee12() {
      return regeneratorRuntime.wrap(function _callee12$(_context12) {
        while (1) {
          switch (_context12.prev = _context12.next) {
            case 0:
              if (!_this._hasFunctionState()) {
                _context12.next = 2;
                break;
              }

              return _context12.abrupt('return', Promise.resolve());

            case 2:
              _context12.prev = 2;
              return _context12.delegateYield(regeneratorRuntime.mark(function _callee11() {
                var systemMessage, data, firstFunctionState, functionState;
                return regeneratorRuntime.wrap(function _callee11$(_context11) {
                  while (1) {
                    switch (_context11.prev = _context11.next) {
                      case 0:
                        _this.sendMessage('Describe');
                        _context11.next = 3;
                        return _this.listenFor('DescribeReturn', null, null);

                      case 3:
                        systemMessage = _context11.sent;


                        //got a description, is it any good?
                        data = systemMessage.getPayload();
                        firstFunctionState = JSON.parse(data.toString());

                        // In the newer firmware the application data comes in a later message.
                        // We run a race to see if the function state comes in the first response.

                        _context11.next = 8;
                        return Promise.race([_this.listenFor('DescribeReturn', null, null).then(function (applicationMessage) {
                          //got a description, is it any good?
                          var data = applicationMessage.getPayload();
                          return JSON.parse(data.toString());
                        }), new Promise(function (resolve, reject) {
                          if (firstFunctionState.f && firstFunctionState.v) {
                            resolve(firstFunctionState);
                          }
                        })]);

                      case 8:
                        functionState = _context11.sent;


                        if (functionState && functionState.v) {
                          //'v':{'temperature':2}
                          functionState.v = _Messages2.default.translateIntTypes(functionState.v);
                        }

                        _this._deviceFunctionState = functionState;

                      case 11:
                      case 'end':
                        return _context11.stop();
                    }
                  }
                }, _callee11, _this2);
              })(), 't0', 4);

            case 4:
              _context12.next = 9;
              break;

            case 6:
              _context12.prev = 6;
              _context12.t1 = _context12['catch'](2);
              throw _context12.t1;

            case 9:
            case 'end':
              return _context12.stop();
          }
        }
      }, _callee12, _this2, [[2, 6]]);
    }));

    _this._onCorePrivateEvent = function (message) {
      _this._onCoreSentEvent(message, false);
    };

    _this._onCorePublicEvent = function (message) {
      _this._onCoreSentEvent(message, true);
    };

    _this._onCoreSentEvent = function () {
      var _ref11 = _asyncToGenerator(regeneratorRuntime.mark(function _callee13(message, isPublic) {
        var eventData, lowername, coreId, claimCode, coreAttributes, token, systemMessage, eatMessage, result;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                if (message) {
                  _context13.next = 3;
                  break;
                }

                _logger2.default.error('CORE EVENT - msg obj was empty?!');
                return _context13.abrupt('return');

              case 3:

                //TODO: if the core is publishing messages too fast:
                //this.sendReply('EventSlowdown', msg.getId());

                //name: '/E/TestEvent', trim the '/e/' or '/E/' off the start of the uri
                eventData = {
                  data: message.getPayload().toString(),
                  is_public: isPublic,
                  name: message.getUriPath().substr(3),
                  published_at: (0, _moment2.default)().toISOString(),
                  published_by: _this.getHexCoreID(),
                  ttl: message.getMaxAge()
                };

                //snap obj.ttl to the right value.

                eventData.ttl = eventData.ttl > 0 ? eventData.ttl : 60;

                //snap data to not incorrectly default to an empty string.
                if (message.getPayloadLength() === 0) {
                  eventData.data = null;
                }

                //logger.log(JSON.stringify(obj));

                //if the event name starts with spark (upper or lower), then eat it.
                lowername = eventData.name.toLowerCase();
                coreId = _this.getHexCoreID();


                if (lowername.indexOf('spark/device/claim/code') === 0) {
                  claimCode = message.getPayload().toString();
                  coreAttributes = global.server.getCoreAttributes(coreId);


                  if (coreAttributes.claimCode !== claimCode) {
                    global.server.setCoreAttribute(coreId, 'claimCode', claimCode);
                    // claim device
                    if (global.api) {
                      global.api.linkDevice(coreId, claimCode, _this._particleProductId);
                    }
                  }
                }

                if (lowername.indexOf('spark/device/system/version') === 0) {
                  global.server.setCoreAttribute(coreId, 'spark_system_version', message.getPayload().toString());
                }

                if (!(lowername.indexOf('spark/device/safemode') === 0)) {
                  _context13.next = 16;
                  break;
                }

                token = _this.sendMessage('Describe');
                _context13.next = 14;
                return _this.listenFor('DescribeReturn', null, token);

              case 14:
                systemMessage = _context13.sent;


                global.api && global.api.safeMode(coreId, systemMessage.getPayload().toString());

              case 16:
                if (!(lowername.indexOf('spark') === 0)) {
                  _context13.next = 23;
                  break;
                }

                // allow some kinds of message through.
                eatMessage = true;

                // if we do let these through, make them private.

                isPublic = false;

                // TODO:
                // if the message is 'cc3000-radio-version', save to the core_state collection for this core?
                if (lowername === 'spark/cc3000-patch-version') {
                  // set_cc3000_version(this._coreId, obj.data);
                  // eat_message = false;
                }

                if (!eatMessage) {
                  _context13.next = 23;
                  break;
                }

                // short-circuit
                _this.sendReply('EventAck', message.getId());
                return _context13.abrupt('return');

              case 23:
                _context13.prev = 23;

                if (global.publisher) {
                  _context13.next = 26;
                  break;
                }

                return _context13.abrupt('return');

              case 26:
                result = global.publisher.publish(isPublic, eventData.name, _this._userId, eventData.data, eventData.ttl, eventData.published_at, _this.getHexCoreID());


                if (!result) {
                  // this core is over its limit, and that message was not sent.
                  // this.sendReply('EventSlowdown', msg.getId());
                }

                if (message.isConfirmable()) {
                  // console.log('Event confirmable');
                  _this.sendReply('EventAck', message.getId());
                } else {
                  // console.log('Event non confirmable');
                }
                _context13.next = 34;
                break;

              case 31:
                _context13.prev = 31;
                _context13.t0 = _context13['catch'](23);

                _logger2.default.error('_onCoreSentEvent: failed writing to socket - ' + _context13.t0);

              case 34:
              case 'end':
                return _context13.stop();
            }
          }
        }, _callee13, _this2, [[23, 31]]);
      }));

      return function (_x18, _x19) {
        return _ref11.apply(this, arguments);
      };
    }();

    _this._onCoreGetTime = function (message) {
      //moment#unix outputs a Unix timestamp (the number of seconds since the Unix Epoch).
      var stamp = (0, _moment2.default)().utc().unix();
      var binaryValue = _Messages2.default.toBinary(stamp, 'uint32');

      _this.sendReply('GetTimeReturn', message.getId(), binaryValue, message.getToken());
    };

    _this.onCorePublicSubscribe = function (message) {
      _this.onCoreSubscribe(message, true);
    };

    _this.onCoreSubscribe = function (message, isPublic) {
      var name = message.getUriPath().substr(3);

      //var body = resp.getPayload().toString();
      //logger.log('Got subscribe request from core, path was \'' + name + '\'');
      //uri -> /e/?u    --> firehose for all my devices
      //uri -> /e/ (deviceid in body)   --> allowed
      //uri -> /e/    --> not allowed (no global firehose for cores, kthxplox)
      //uri -> /e/event_name?u    --> all my devices
      //uri -> /e/event_name?u (deviceid)    --> deviceid?

      if (!name) {
        //no firehose for cores
        _this.sendReply('SubscribeFail', message.getId());
        return;
      }

      var query = message.getUriQuery();
      var payload = message.getPayload();
      var myDevices = query && query.indexOf('u') >= 0;
      var userid = myDevices ? (_this._userId || '').toLowerCase() : null;
      var deviceID = payload ? payload.toString() : null;

      //TODO: filter by a particular deviceID

      _this.sendReply('SubscribeAck', message.getId());

      //modify our filter on the appropriate socket (create the socket if we haven't yet) to let messages through
      //this.eventsSocket.subscribe(isPublic, name, userid);
      global.publisher.subscribe(name, userid, deviceID, _this, _this.onCoreEvent);
    };

    _this._onCorePublicHeard = function (name, data, ttl, publishedAt, coreId) {
      _this.sendCoreEvent(true, name, data, ttl, publishedAt, coreId);
    };

    _this._onCorePrivateHeard = function (name, data, ttl, publishedAt, coreId) {
      _this.sendCoreEvent(false, name, data, ttl, publishedAt, coreId);
    };

    _this.onCoreEvent = function (isPublic, name, userid, data, ttl, published_at, coreid) {
      _this.sendCoreEvent(isPublic, name, data, ttl, published_at, coreid);
    };

    _this.sendCoreEvent = function (isPublic, name, data, ttl, published_at, coreid) {
      var rawFunction = function rawFunction(message) {
        try {
          message.setMaxAge(parseInt(ttl && ttl >= 0 ? ttl : 60));
          if (published_at) {
            message.setTimestamp((0, _moment2.default)(published_at).toDate());
          }
        } catch (exception) {
          _logger2.default.error('onCoreHeard - ' + exception);
        }

        return message;
      };

      var messageName = isPublic ? 'PublicEvent' : 'PrivateEvent';
      var userID = (_this._userId || '').toLowerCase() + '/';
      name = name ? name.toString() : name;
      if (name && name.indexOf && name.indexOf(userID) === 0) {
        name = name.substring(userID.length);
      }

      data = data ? data.toString() : data;
      _this.sendMessage(messageName, { event_name: name, _raw: rawFunction }, data);
    };

    _this._hasFunctionState = function () {
      return !!_this._deviceFunctionState;
    };

    _this._hasParticleVariable = function (name) {
      return !!(_this._deviceFunctionState && _this._deviceFunctionState.v && _this._deviceFunctionState.v[name]);
    };

    _this.HasSparkFunction = function (name) {
      //has state, and... the function is an object, or it's in the function array
      var lowercaseName = name.toLowerCase();
      return !!(_this._deviceFunctionState && (_this._deviceFunctionState[name] || _this._deviceFunctionState.f && _this._deviceFunctionState.f.some(function (fn) {
        return fn.toLowerCase() === lowercaseName;
      })));
    };

    _this.getHexCoreID = function () {
      return _this._coreId ? _this._coreId.toString('hex') : 'unknown';
    };

    _this.getRemoteIPAddress = function () {
      return _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown';
    };

    _this.disconnect = function (message) {
      message = message || '';
      _this._disconnectCounter++;

      if (_this._disconnectCounter > 1) {
        //don't multi-disconnect
        return;
      }

      try {
        var logInfo = {
          coreID: _this.getHexCoreID(),
          cache_key: _this._connectionKey,
          duration: _this._connectionStartTime ? (new Date() - _this._connectionStartTime) / 1000.0 : undefined
        };

        _logger2.default.log(_this._disconnectCounter + ': Core disconnected: ' + message, logInfo);
      } catch (exception) {
        _logger2.default.error('Disconnect log error ' + exception);
      }

      try {
        _this._socket.end();
        _this._socket.destroy();
      } catch (exception) {
        _logger2.default.error('Disconnect TCPSocket error: ' + exception);
      }

      if (_this._decipherStream) {
        try {
          _this._decipherStream.end();
          _this._decipherStream = null;
        } catch (exception) {
          _logger2.default.error('Error cleaning up _decipherStream ', exception);
        }
      }

      if (_this._cipherStream) {
        try {
          _this._cipherStream.end();
          _this._cipherStream = null;
        } catch (exception) {
          _logger2.default.error('Error cleaning up _cipherStream ', exception);
        }
      }

      _this.emit('disconnect', message);

      //obv, don't do this before emitting disconnect.
      try {
        _this.removeAllListeners();
      } catch (ex) {
        _logger2.default.error('Problem removing listeners ', ex);
      }
    };

    _this._socket = socket;
    return _this;
  }

  /**
   * configure our socket and start the handshake
   */


  /**
   * @param sender
   * @param response
   */


  /**
   * Handles messages coming from the API over our message queue service
   */


  /**
   * Deals with messages coming from the core over our secure connection
   * @param data
   */


  /**
   * Adds a listener to our secure message stream
   * @param name the message type we're waiting on
   * @param uri - a particular function / variable?
   * @param token - what message does this go with? (should come from sendMessage)
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
   * @param token
   */


  /**
   * Clears the association with a particular token
   * @param token
   */


  /**
   * Ensures we have introspection data from the core, and then
   * requests a variable value to be sent, when received it transforms
   * the response into the appropriate type
   * @param name
   * @param type
   * @param callback - expects (value, buf, err)
   */


  /**
   * Asks the core to start or stop its 'raise your hand' signal
   * @param showSignal - whether it should show the signal or not
   * @param callback - what to call when we're done or timed out...
   */


  /**
   *
   * @param name
   * @param msg
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
   * Checks our cache to see if we have the function state, otherwise requests it from the core,
   * listens for it, and resolves our deferred on success
   * @returns {*}
   */


  //-------------
  // Core Events / Spark.publish / Spark.subscribe
  //-------------

  /**
   * The core asked us for the time!
   * @param msg
   */

  // isPublic, name, userid, data, ttl, published_at, coreid);


  /**
   * sends a received event down to a core
   * @param isPublic
   * @param name
   * @param data
   * @param ttl
   * @param published_at
   */


  return SparkCore;
}(_events2.default);

;

exports.default = SparkCore;