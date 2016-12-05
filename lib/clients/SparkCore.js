'use strict';

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

var _utilities = require('../lib/utilities.js');

var _utilities2 = _interopRequireDefault(_utilities);

var _Flasher = require('../lib/Flasher');

var _Flasher2 = _interopRequireDefault(_Flasher);

var _logger = require('../lib/logger.js');

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

//Hello — sent first by Core then by Server immediately after handshake, never again
//Ignored — sent by either side to respond to a message with a bad counter value. The receiver of an Ignored message can optionally decide to resend a previous message if the indicated bad counter value matches a recently sent message.

//package flasher
//Chunk — sent by Server to send chunks of a firmware binary to Core
//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
//UpdateBegin — sent by Server to initiate an OTA firmware update
//UpdateReady — sent by Core to indicate readiness to receive firmware chunks
//UpdateDone — sent by Server to indicate all firmware chunks have been sent

//FunctionCall — sent by Server to tell Core to call a user-exposed function
//FunctionReturn — sent by Core in response to FunctionCall to indicate return value. void functions will not send this message
//VariableRequest — sent by Server to request the value of a user-exposed variable
//VariableValue — sent by Core in response to VariableRequest to indicate the value

//Event — sent by Core to initiate a Server Sent Event and optionally an HTTP callback to a 3rd party
//KeyChange — sent by Server to change the AES credentials

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

    _this._disconnectCounter = 0;
    _this._tokens = {};

    _this.startupProtocol = function () {
      _this._socket.setNoDelay(true);
      _this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); //every 15 second(s)
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

              //when the handshake is done, we can expect two stream properties, '_decipherStream' and '_cipherStream'

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
                        _this._decipherStream.on('readable', function () {
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
        throw 'failed to parse hello';
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

      //client will set the counter property on the message
      _this._sendCounter = _ICrypto2.default.getRandomUINT16();
      _this.sendMessage('Hello', {}, null, null);
    };

    _this.ready = function () {
      _this._connectionStartTime = new Date();

      _logger2.default.log('on ready', {
        coreID: _this.getHexCoreID(),
        ip: _this.getRemoteIPAddress(),
        product_id: _this._particleProductId,
        firmware_version: _this._productFirmwareVersion,
        _platformId: _this._platformId,
        cache_key: _this._connectionKey
      });

      //catch any and all describe responses
      _this.on('msg_describereturn', function (message) {
        return _this._onDescribeReturn(message);
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

    _this.onApiMessage = function (sender, message) {
      //if we're not the owner, then the socket is busy
      var isBusy = !_this._isSocketAvailable(null);
      if (isBusy) {
        _this.sendApiResponse(sender, { error: 'This core is locked during the flashing process.' });
        return;
      }

      switch (message.cmd) {
        case 'Describe':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('Describe', { coreID: _this.coreID });
            }
            when(_this._ensureWeHaveIntrospectionData()).then(function () {
              return _this.sendApiResponse(sender, {
                cmd: 'DescribeReturn',
                firmware_version: _this._productFirmwareVersion,
                name: message.name,
                product_id: _this._particleProductId,
                state: _this._deviceFunctionState
              });
            }, function (message) {
              return _this.sendApiResponse(sender, {
                cmd: 'DescribeReturn',
                err: 'Error, no device state',
                name: message.name
              });
            });
            break;
          }

        case 'GetVar':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('GetVar', { coreID: _this.coreID });
            }
            _this._getVariable(message.name, message.type, function (value, buffer, error) {
              _this.sendApiResponse(sender, {
                cmd: 'VarReturn',
                error: error,
                name: message.name,
                result: value
              });
            });
            break;
          }
        case 'SetVar':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('SetVar', { coreID: _this.coreID });
            }
            _this._setVariable(message.name, message.value, function (resp) {
              return _this.sendApiResponse(sender, {
                cmd: 'VarReturn',
                name: message.name,
                result: resp.getPayload().toString()
              });
            });
            break;
          }

        case 'CallFn':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('FunCall', { coreID: _this.coreID });
            }
            _this._callFunction(message.name, message.args, function (functionResult) {
              return _this.sendApiResponse(sender, {
                cmd: 'FnReturn',
                error: functionResult.Error,
                name: message.name,
                result: functionResult
              });
            });
            break;
          }

        case 'UFlash':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('FlashCore', { coreID: _this.coreID });
            }

            _this.flashCore(message.args.data, sender);
            break;
          }

        case 'FlashKnown':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('FlashKnown', { app: message.app, coreID: _this.coreID });
            }

            // Responsibility for sanitizing app names lies with API Service
            // This includes only allowing apps whose binaries are deployed and thus exist
            _fs2.default.readFile('known_firmware/' + message.app + '_' + _settings2.default.environment + '.bin', function (error, buffer) {
              if (!error) {
                _this.flashCore(buffer, buffer);
                return;
              }

              _logger2.default.log('Error flashing known firmware', { coreID: _this.coreID, error: error });
              _this.sendApiResponse(sender, {
                cmd: 'Event',
                message: 'Update failed - ' + JSON.stringify(error),
                name: 'Update'
              });
            });
            break;
          }

        case 'RaiseHand':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('SignalCore', { coreID: _this.coreID });
            }

            var showSignal = message.args && message.args.signal;
            _this._raiseYourHand(showSignal, function (result) {
              return _this.sendApiResponse(sender, { cmd: 'RaiseHandReturn', result: result });
            });
            break;
          }

        case 'Ping':
          {
            if (_settings2.default.logApiMessages) {
              _logger2.default.log('Pinged, replying', { coreID: _this.coreID });
            }

            _this.sendApiResponse(sender, {
              cmd: 'Pong',
              lastPing: _this._lastCorePing,
              online: _this._socket !== null
            });
            break;
          }

        default:
          {
            _this.sendApiResponse(sender, { error: 'unknown message' });
          }
      }
    };

    _this.routeMessage = function (data) {
      var message = _Messages2.default.unwrap(data);
      if (!message) {
        _logger2.default.error('routeMessage got a NULL coap message ', { coreID: _this.getHexCoreID() });
        return;
      }

      _this._lastMessageTime = new Date();

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

      console.log('Device got message of type ', requestType, ' with token ', message.getTokenString(), ' ', _Messages2.default.getRequestType(message));

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

      _this.emit(('msg_' + requestType).toLowerCase(), message);
    };

    _this.sendReply = function (name, id, data, token, onError, requester) {
      if (!_this._isSocketAvailable(requester, name)) {
        onError && onError('This client has an exclusive lock.');
        return;
      }

      //if my reply is an acknowledgement to a confirmable message
      //then I need to re-use the message id...

      //set our counter
      if (id < 0) {
        _this._incrementSendCounter();
        id = _this._sendCounter;
      }

      var message = _Messages2.default.wrap(name, id, null, data, token, null);
      if (!_this._cipherStream) {
        _logger2.default.error('Device - sendReply before READY', { coreID: _this.getHexCoreID() });
        return;
      }
      _this._cipherStream.write(message, null, null);
    };

    _this.sendMessage = function (name, params, data, onResponse, onError, requester) {
      if (!_this._isSocketAvailable(requester, name)) {
        onError && onError('This client has an exclusive lock.');
        return false;
      }

      //increment our counter
      _this._incrementSendCounter();

      var token = null;
      if (!_Messages2.default.isNonTypeMessage(name)) {
        token = _this._getNextToken();
        _this._useToken(name, token);

        return;
      }

      var message = _Messages2.default.wrap(name, _this._sendCounter, params, data, token, onError);

      if (message === null) {
        _logger2.default.error('Could not wrap message', name, params, data);
      }

      if (!_this._cipherStream) {
        _logger2.default.error('Client - sendMessage before READY', { coreID: _this.getHexCoreID() });
        return;
      }

      _this._cipherStream.write(message, null, null);

      return token || 0;
    };

    _this.listenFor = function (name, uri, token, callback, runOnce) {
      var tokenHex = token ? _utilities2.default.toHexString(token) : null;
      var beVerbose = _settings2.default.showVerboseDeviceLogs;

      //TODO: failWatch?  What kind of timeout do we want here?

      //adds a one time event
      var eventName = 'msg_' + name.toLowerCase(),
          handler = function handler(message) {
        if (uri && message.getUriPath().indexOf(uri) !== 0) {
          if (beVerbose) {
            _logger2.default.log('uri filter did not match', uri, msg.getUriPath(), { coreID: _this.getHexCoreID() });
          }
          return;
        }

        if (tokenHex && tokenHex !== message.getTokenString()) {
          if (beVerbose) {
            _logger2.default.log('Tokens did not match ', tokenHex, message.getTokenString(), { coreID: _this.getHexCoreID() });
          }
          return;
        }

        if (runOnce) {
          _this.removeListener(eventName, handler);
        }

        process.nextTick(function () {
          try {
            if (beVerbose) {
              _logger2.default.log('heard ', name, { coreID: _this.coreID });
            }
            callback(message);
          } catch (exception) {
            _logger2.default.error('listenFor ' + name + ' - caught error: ', exception, exception.stack, { coreID: _this.getHexCoreID() });
          }
        });
      };

      //logger.log('listening for ', eventName);
      _this.on(eventName, handler);

      return handler;
    };

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

    _this._getNextToken = function () {
      _this._sendToken = _this._increment(_this._sendToken);
    };

    _this._useToken = function (name, token) {
      var key = _utilities2.default.toHexString(token);

      if (_this._tokens[key]) {
        throw 'Token ${name} ${token} ${key} already in use';
      }

      _this._tokens[key] = name;
    };

    _this._clearToken = function (token) {
      var key = _utilities2.default.toHexString(token);

      if (_this._tokens[key]) {
        delete _this._tokens[key];
      }
    };

    _this._getResponseType = function (tokenString) {
      var request = _this._tokens[tokenString];
      //logger.log('respType for key ', tokenStr, ' is ', request);

      if (!request) {
        return null;
      }

      return (0, _nullthrows2.default)(_Messages2.default.getResponseType(request));
    };

    _this._getVariable = function (name, type, callback) {
      var performRequest = function performRequest() {
        if (!_this._hasParticleVariable(name)) {
          callback(null, null, 'Variable not found');
          return;
        }

        var messageToken = _this.sendMessage('VariableRequest', { name: name });
        var variableTransformer = _this._transformVariableGenerator(name, callback);
        _this.listenFor('VariableValue', null, messageToken, variableTransformer, true);
      };

      if (_this._hasFunctionState()) {
        //slight short-circuit, saves ~5 seconds every 100,000 requests...
        performRequest();
      } else {
        when(_this._ensureWeHaveIntrospectionData()).then(performRequest, function (error) {
          return callback(null, null, 'Problem requesting variable: ' + error);
        });
      }
    };

    _this._setVariable = function (name, data, callback) {

      /*TODO: data type! */
      var payload = _Messages2.default.toBinary(data);
      var token = _this.sendMessage('VariableRequest', { name: name }, payload);

      //are we expecting a response?
      //watches the messages coming back in, listens for a message of this type with
      _this.listenFor('VariableValue', null, token, callback, true);
    };

    _this._callFunction = function (name, args, callback) {
      when(_this._transformArguments(name, args)).then(function (buffer) {
        if (_settings2.default.showVerboseDeviceLogs) {
          _logger2.default.log('sending function call to the core', { coreID: _this.coreID, name: name });
        }

        var writeUrl = function writeUrl(message) {
          message.setUri('f/' + name);
          if (buffer) {
            message.setUriQuery(buffer.toString());
          }
          return message;
        };

        var token = _this.sendMessage('FunctionCall', { name: name, args: buffer, _writeCoapUri: writeUrl }, null);

        //gives us a function that will transform the response, and call the callback with it.
        var resultTransformer = _this._transformFunctionResultGenerator(name, callback);

        //watches the messages coming back in, listens for a message of this type with
        _this.listenFor('FunctionReturn', null, token, resultTransformer, true);
      }, function (error) {
        callback({
          Error: 'Something went wrong calling this function: ' + err
        });
      });
    };

    _this._raiseYourHand = function (showSignal, callback) {
      var timer = setTimeout(function () {
        callback(false);
      }, 30 * 1000);

      //TODO: this.stopListeningFor('_raiseYourHandReturn', listenHandler);
      //TODO:  var listenHandler = this.listenFor('_raiseYourHandReturn',  ... );

      //logger.log('_raiseYourHand: asking core to signal? ' + showSignal);
      var token = _this.sendMessage('_raiseYourHand', { _writeCoapUri: _Messages2.default.raiseYourHandUrlGenerator(showSignal) }, null);
      _this.listenFor('_raiseYourHandReturn', null, token, function () {
        clearTimeout(timer);
        callback(true);
      }, true);
    };

    _this.flashCore = function (binary, sender) {
      if (!binary || binary.length === 0) {
        _logger2.default.log('flash failed! - file is empty! ', { coreID: _this.getHexCoreID() });
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          name: 'Update',
          message: 'Update failed - File was too small!'
        });
        return;
      }

      if (binary && binary.length > MAX_BINARY_SIZE) {
        _logger2.default.log('flash failed! - file is too BIG ' + binary.length, { coreID: _this.getHexCoreID() });
        _this.sendApiResponse(sender, {
          cmd: 'Event',
          name: 'Update',
          message: 'Update failed - File was too big!'
        });
        return;
      }

      var flasher = new _Flasher2.default();
      flasher.startFlashBuffer(binary, _this, function () {
        _logger2.default.log('flash core finished! - sending api event', { coreID: _this.getHexCoreID() });
        global.server.publishSpecialEvents('spark/flash/status', 'success', _this.getHexCoreID());
        _this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update done' });
      }, function (message) {
        _logger2.default.log('flash core failed! - sending api event', { coreID: _this.getHexCoreID(), error: message });
        global.server.publishSpecialEvents('spark/flash/status', 'failed', _this.getHexCoreID());
        _this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed' });
      }, function () {
        _logger2.default.log('flash core started! - sending api event', { coreID: _this.getHexCoreID() });
        global.server.publishSpecialEvents('spark/flash/status', 'started', _this.getHexCoreID());
        _this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update started' });
      });
    };

    _this._isSocketAvailable = function (requester, messageName) {
      if (!_this._owningFlasher || _this._owningFlasher === requester) {
        return true;
      }

      _logger2.default.error('This client has an exclusive lock', {
        coreID: _this.getHexCoreID(),
        cache_key: _this._connectionKey,
        msgName: messageName
      });

      return false;
    };

    _this.takeOwnership = function (flasher) {
      if (_this._owningFlasher) {
        _logger2.default.error('already owned', { coreID: _this.getHexCoreID() });
        return false;
      }
      //only permit the owning object to send messages.
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

    _this._transformArguments = function (name, args) {
      var ready = when.defer();

      when(_this._ensureWeHaveIntrospectionData()).then(function () {
        var buffer = _this._transformArguments(name, args);
        if (buffer) {
          ready.resolve(buffer);
        } else {
          //NOTE! The API looks for 'Unknown Function' in the error response.
          ready.reject('Unknown Function: ' + name);
        }
      }, function (message) {
        ready.reject(message);
      });

      return ready.promise;
    };

    _this._transformFunctionResultGenerator = function (name, callback) {
      return function (message) {
        _this._transformFunctionResult(name, message, callback);
      };
    };

    _this._transformVariableGenerator = function (name, callback) {
      return function (message) {
        _this._transformVariableResult(name, message, callback);
      };
    };

    _this._transformVariableResult = function (name, message, callback) {
      //grab the variable type, if the core doesn't say, assume it's a 'string'
      var variableFunctionState = _this._deviceFunctionState ? _this._deviceFunctionState.v : null;
      var variableType = variableFunctionState && variableFunctionState[name] ? variableFunctionState[name] : 'string';

      var result = null;
      var data = null;
      try {
        if (message && message.getPayload) {
          //leaving raw payload in response message for now, so we don't shock our users.
          data = msg.getPayload();
          result = _Messages2.default.fromBinary(data, variableType);
        }
      } catch (exception) {
        _logger2.default.error('_transformVariableResult - error transforming response ' + exception);
      }

      process.nextTick(function () {
        try {
          callback(result, data);
        } catch (exception) {
          _logger2.default.error('_transformVariableResult - error in callback ' + exception);
        }
      });
    };

    _this._transformFunctionResult = function (name, message, callback) {
      var variableType = 'int32';

      var result = null;
      try {
        if (message && message.getPayload) {
          result = _Messages2.default.fromBinary(message.getPayload(), variableType);
        }
      } catch (exception) {
        _logger2.default.error('_transformFunctionResult - error transforming response ' + exception);
      }

      process.nextTick(function () {
        try {
          callback(result);
        } catch (exception) {
          _logger2.default.error('_transformFunctionResult - error in callback ' + exception);
        }
      });
    };

    _this._transformArguments = function (name, args) {
      //logger.log('transform args', { coreID: this.getHexCoreID() });
      if (!args) {
        return null;
      }

      if (!_this._hasFunctionState()) {
        _logger2.default.error('_transformArguments called without any function state!', { coreID: _this.getHexCoreID() });
        return null;
      }

      //TODO: lowercase function keys on new state format
      name = name.toLowerCase();
      var functionState = _this._deviceFunctionState[name];
      if (!functionState || !functionState.args) {
        //maybe it's the old protocol?
        var oldProtocolFunctionState = _this._deviceFunctionState.f;
        if (oldProtocolFunctionState && _utilities2.default.arrayContainsLower(oldProtocolFunctionState, name)) {
          //logger.log('_transformArguments - using old format', { coreID: this.getHexCoreID() });
          //current / simplified function format (one string arg, int return type)
          functionState = {
            returns: 'int',
            args: [[null, 'string']]
          };
        }
      }

      if (!functionState || !functionState.args) {
        //logger.error('_transformArguments: core doesn't know fn: ', { coreID: this.getHexCoreID(), name: name, state: this._deviceFunctionState });
        return null;
      }

      //  'HelloWorld': { returns: 'string', args: [ {'name': 'string'}, {'adjective': 'string'}  ]} };
      return _Messages2.default.buildArguments(args, functionState.args);
    };

    _this._ensureWeHaveIntrospectionData = function () {
      if (_this._hasFunctionState()) {
        return when.resolve();
      }

      //if we don't have a message pending, send one.
      if (!_this._describeDfd) {
        _this.sendMessage('Describe');
        _this._describeDfd = when.defer();
      }

      //let everybody else queue up on this promise
      return _this._describeDfd.promise;
    };

    _this._onDescribeReturn = function (message) {
      //got a description, is it any good?
      var loaded = _this._loadFunctionState(message.getPayload());

      if (_this._describeDfd) {
        if (loaded) {
          _this._describeDfd.resolve();
        } else {
          _this._describeDfd.reject('something went wrong parsing function state');
        }
      }
      //else { //hmm, unsolicited response, that's okay. }
    };

    _this._onCorePrivateEvent = function (message) {
      _this._onCoreSentEvent(message, false);
    };

    _this._onCorePublicEvent = function (message) {
      _this._onCoreSentEvent(message, true);
    };

    _this._onCoreSentEvent = function (message, isPublic) {
      if (!message) {
        _logger2.default.error('CORE EVENT - msg obj was empty?!');
        return;
      }

      //TODO: if the core is publishing messages too fast:
      //this.sendReply('EventSlowdown', msg.getId());

      //name: '/E/TestEvent', trim the '/e/' or '/E/' off the start of the uri
      var eventData = {
        name: message.getUriPath().substr(3),
        is_public: isPublic,
        ttl: message.getMaxAge(),
        data: message.getPayload().toString(),
        published_by: _this.getHexCoreID(),
        published_at: (0, _moment2.default)().toISOString()
      };

      //snap obj.ttl to the right value.
      eventData.ttl = eventData.ttl > 0 ? eventData.ttl : 60;

      //snap data to not incorrectly default to an empty string.
      if (message.getPayloadLength() === 0) {
        eventData.data = null;
      }

      //logger.log(JSON.stringify(obj));

      //if the event name starts with spark (upper or lower), then eat it.
      var lowername = eventData.name.toLowerCase();
      var coreId = _this.getHexCoreID();

      if (lowername.indexOf('spark/device/claim/code') === 0) {
        var claimCode = message.getPayload().toString();

        var coreAttributes = global.server.getCoreAttributes(coreId);

        if (coreAttributes.claimCode !== claimCode) {
          global.server.setCoreAttribute(coreId, 'claimCode', claimCode);
          //claim device
          if (global.api) {
            global.api.linkDevice(coreId, claimCode, _this._particleProductId);
          }
        }
      }

      if (lowername.indexOf('spark/device/system/version') === 0) {
        global.server.setCoreAttribute(coreId, 'spark_system_version', message.getPayload().toString());
      }

      if (lowername.indexOf('spark/device/safemode') === 0) {
        var token = _this.sendMessage('Describe');
        _this.listenFor('DescribeReturn', null, token, function (systemMessage) {
          //console.log('device '+coreid+' is in safe mode: '+sysmsg.getPayload().toString());
          global.api && global.api.safeMode(coreId, systemMessage.getPayload().toString());
        }, true);
      }

      if (lowername.indexOf('spark') === 0) {
        //allow some kinds of message through.
        var eat_message = true;

        //if we do let these through, make them private.
        isPublic = false;

        //TODO:
        //if the message is 'cc3000-radio-version', save to the core_state collection for this core?
        if (lowername === 'spark/cc3000-patch-version') {
          // set_cc3000_version(this.coreID, obj.data);
          // eat_message = false;
        }

        if (eat_message) {
          //short-circuit
          _this.sendReply('EventAck', message.getId());
          return;
        }
      }

      try {
        if (!global.publisher) {
          return;
        }

        var result = global.publisher.publish(isPublic, eventData.name, eventData.userid, eventData.data, eventData.ttl, eventData.published_at, _this.getHexCoreID());

        if (!result) {
          //this core is over its limit, and that message was not sent.
          //this.sendReply('EventSlowdown', msg.getId());
        }

        if (message.isConfirmable()) {
          //console.log('Event confirmable');
          _this.sendReply('EventAck', message.getId());
        } else {
          //console.log('Event non confirmable');
        }
      } catch (exception) {
        _logger2.default.error('_onCoreSentEvent: failed writing to socket - ' + exception);
      }
    };

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
      var userid = myDevices ? (_this.userID || '').toLowerCase() : null;
      var deviceID = payload ? payload.toString() : null;

      //TODO: filter by a particular deviceID

      _this.sendReply('SubscribeAck', message.getId());

      //modify our filter on the appropriate socket (create the socket if we haven't yet) to let messages through
      //this.eventsSocket.subscribe(isPublic, name, userid);
      global.publisher.subscribe(name, userid, deviceID, _this, _this.onCoreEvent);
    };

    _this._onCorePublicHeard = function (name, data, ttl, published_at, coreid) {
      _this.sendCoreEvent(true, name, data, ttl, published_at, coreid);
    };

    _this._onCorePrivateHeard = function (name, data, ttl, published_at, coreid) {
      _this.sendCoreEvent(false, name, data, ttl, published_at, coreid);
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
      var userID = (_this.userID || '').toLowerCase() + '/';
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
      return _this._deviceFunctionState && _this._deviceFunctionState.v && _this._deviceFunctionState.v[name];
    };

    _this.HasSparkFunction = function (name) {
      //has state, and... the function is an object, or it's in the function array
      return _this._deviceFunctionState && (_this._deviceFunctionState[name] || _this._deviceFunctionState.f && _utilities2.default.arrayContainsLower(_this._deviceFunctionState.f, name));
    };

    _this._loadFunctionState = function (data) {
      var functionState = JSON.parse(data.toString());

      if (functionState && functionState.v) {
        //'v':{'temperature':2}
        functionState.v = _Messages2.default.translateIntTypes(functionState.v);
      }

      _this._deviceFunctionState = functionState;

      return true;
    };

    _this.getHexCoreID = function () {
      return _this.coreID ? _this.coreID.toString('hex') : 'unknown';
    };

    _this.getRemoteIPAddress = function () {
      return _this._socket && _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown';
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
        if (_this._socket) {
          _this._socket.end();
          _this._socket.destroy();
          _this._socket = null;
        }
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
   * @param callback what we should call when we're done
   * @param [once] whether or not we should keep the listener after we've had a match
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
   * makes sure we have our introspection data, then transforms our object into
   * the right coap query string
   * @param name
   * @param args
   * @returns {*}
   */


  /**
   *
   * @param name
   * @param callback -- callback expects (value, buf, err)
   * @returns {Function}
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


  /**
   * On any describe return back from the core
   * @param msg
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


  /**
   * interprets the introspection message from the core containing
   * argument names / types, and function return types, so we can make it easy to call functions
   * on the core.
   * @param data
   */


  return SparkCore;
}(_events2.default);

;
module.exports = SparkCore;