'use strict';

var _extend;

var _h = require('h5.buffers');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

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

var EventEmitter = require('events').EventEmitter;
var moment = require('moment');
var extend = require('xtend');
var when = require('when');
var fs = require('fs');

var Message = require('h5.coap').Message;

var settings = require('../settings');
var ISparkCore = require('./ISparkCore');
var CryptoLib = require('../lib/ICrypto');
var Messages = require('../lib/Messages').default;
var Handshake = require('../lib/Handshake').default;
var utilities = require('../lib/utilities.js');
var Flasher = require('../lib/Flasher').default;
var logger = require('../lib/logger.js');


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


/**
 * Implementation of the Spark Core messaging protocol
 * @SparkCore
 */
var SparkCore = function SparkCore(options) {
  if (options) {
    this.options = extend(this.options, options);
  }

  EventEmitter.call(this);
  this._tokens = {};
};

var COUNTER_MAX = settings.message_counter_max;
var KEEP_ALIVE_TIMEOUT = settings.keepaliveTimeout;
var SOCKET_TIMEOUT = settings.socketTimeout;

SparkCore.prototype = extend(ISparkCore.prototype, EventEmitter.prototype, (_extend = {
  classname: 'SparkCore',
  options: {},

  socket: null,
  _decipherStream: null,
  _cipherStream: null,
  _sendCounter: null,
  _sendToken: 0,
  _tokens: null,
  _recieveCounter: 0,

  apiSocket: null,
  eventsSocket: null,

  /**
   * Our state describing which functions take what arguments
   */
  _deviceFunctionState: null,

  _particleProductId: null,
  _productFirmwareVersion: null,
  _platformId: null,

  /**
   * Used to track calls waiting on a description response
   */
  _describeDfd: null,

  /**
   * configure our socket and start the handshake
   */
  startupProtocol: function startupProtocol() {
    var _this = this;

    this._socket.setNoDelay(true);
    this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); //every 15 second(s)
    this._socket.setTimeout(SOCKET_TIMEOUT);

    this._socket.on('error', function (error) {
      return _this.disconnect('socket error ' + error);
    });
    this._socket.on('close', function (error) {
      return _this.disconnect('socket close ' + error);
    });
    this._socket.on('timeout', function (error) {
      return _this.disconnect('socket timeout ' + error);
    });

    this.handshake();
  },

  handshake: function () {
    var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
      var _this2 = this;

      var handshake;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              handshake = new Handshake(this);

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

                        _this2._coreId = coreId;

                        _this2._getHello(handshakeBuffer);
                        _this2._sendHello(cipherStream, decipherStream);

                        _this2.ready();

                        pendingBuffers.map(function (data) {
                          return _this2.routeMessage(data);
                        });
                        _this2._decipherStream.on('readable', function () {
                          var chunk = decipherStream.read();
                          if (!chunk) {
                            return;
                          }
                          _this2.routeMessage(chunk);
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

              this.disconnect(_context2.t1);

            case 8:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, this, [[1, 5]]);
    }));

    function handshake() {
      return _ref.apply(this, arguments);
    }

    return handshake;
  }(),

  _getHello: function _getHello(chunk) {
    var message = Messages.unwrap(chunk);
    if (!message) {
      throw 'failed to parse hello';
    }

    this._recieveCounter = message.getId();

    try {
      var payload = message.getPayload();
      if (payload.length <= 0) {
        return;
      }

      var payloadBuffer = new _h.BufferReader(payload);
      this._particleProductId = payloadBuffer.shiftUInt16();
      this._productFirmwareVersion = payloadBuffer.shiftUInt16();
      this._platformId = payloadBuffer.shiftUInt16();
    } catch (exception) {
      logger.log('error while parsing hello payload ', exception);
    }
  },

  _sendHello: function _sendHello(cipherStream, decipherStream) {
    this._cipherStream = cipherStream;
    this._decipherStream = decipherStream;

    //client will set the counter property on the message
    this._sendCounter = CryptoLib.getRandomUINT16();
    this.sendMessage('Hello', {}, null, null);
  },

  ready: function ready() {
    var _this3 = this;

    this._connectionStartTime = new Date();

    logger.log('on ready', {
      coreID: this.getHexCoreID(),
      ip: this.getRemoteIPAddress(),
      product_id: this._particleProductId,
      firmware_version: this._productFirmwareVersion,
      _platformId: this._platformId,
      cache_key: this._connectionKey
    });

    //catch any and all describe responses
    this.on('msg_describereturn', function (message) {
      return _this3._onDescribeReturn(message);
    });
    this.on('msg_PrivateEvent'.toLowerCase(), function (message) {
      return _this3._onCorePrivateEvent(message);
    });
    this.on('msg_PublicEvent'.toLowerCase(), function (message) {
      return _this3._onCorePublicEvent(message);
    });
    this.on('msg_Subscribe'.toLowerCase(), function (message) {
      return _this3.onCorePublicSubscribe(message);
    });
    this.on('msg_GetTime'.toLowerCase(), function (message) {
      return _this3._onCoreGetTime(message);
    });

    this.emit('ready');
  },

  /**
   * @param sender
   * @param response
   */
  sendApiResponse: function sendApiResponse(sender, response) {
    try {
      this.emit(sender, sender, response);
    } catch (exception) {
      logger.error('Error during response ', exception);
    }
  },

  /**
   * Handles messages coming from the API over our message queue service
   */
  onApiMessage: function onApiMessage(sender, message) {
    var _this4 = this;

    if (!message) {
      logger.log('onApiMessage - no message? got ' + JSON.stringify(arguments), { coreID: this.getHexCoreID() });
      return;
    }

    //if we're not the owner, then the socket is busy
    var isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      this.sendApiResponse(sender, { error: 'This core is locked during the flashing process.' });
      return;
    }

    switch (message.cmd) {
      case 'Describe':
        {
          if (settings.logApiMessages) {
            logger.log('Describe', { coreID: that.coreID });
          }
          when(this._ensureWeHaveIntrospectionData()).then(function () {
            return _this4.sendApiResponse(sender, {
              cmd: 'DescribeReturn',
              firmware_version: _this4._productFirmwareVersion,
              name: msg.name,
              product_id: _this4._particleProductId,
              state: _this4._deviceFunctionState
            });
          }, function (message) {
            return _this4.sendApiResponse(sender, {
              cmd: 'DescribeReturn',
              err: 'Error, no device state',
              name: message.name
            });
          });
          break;
        }

      case 'GetVar':
        {
          if (settings.logApiMessages) {
            logger.log('GetVar', { coreID: that.coreID });
          }
          this._getVariable(message.name, message.type, function (value, buffer, error) {
            that.sendApiResponse(sender, {
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
          if (settings.logApiMessages) {
            logger.log('SetVar', { coreID: this.coreID });
          }
          this._setVariable(message.name, message.value, function (resp) {
            return _this4.sendApiResponse(sender, {
              cmd: 'VarReturn',
              name: message.name,
              result: resp.getPayload().toString()
            });
          });
          break;
        }

      case 'CallFn':
        {
          if (settings.logApiMessages) {
            logger.log('FunCall', { coreID: this.coreID });
          }
          this._callFunction(message.name, message.args, function (functionResult) {
            return _this4.sendApiResponse(sender, {
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
          if (settings.logApiMessages) {
            logger.log('FlashCore', { coreID: this.coreID });
          }

          this.flashCore(message.args.data, sender);
          break;
        }

      case 'FlashKnown':
        {
          if (settings.logApiMessages) {
            logger.log('FlashKnown', { app: message.app, coreID: this.coreID });
          }

          // Responsibility for sanitizing app names lies with API Service
          // This includes only allowing apps whose binaries are deployed and thus exist
          fs.readFile('known_firmware/' + message.app + '_' + settings.environment + '.bin', function (error, buffer) {
            if (!error) {
              that.flashCore(buf, buffer);
              return;
            }

            logger.log('Error flashing known firmware', { coreID: _this4.coreID, err: error });
            _this4.sendApiResponse(sender, {
              cmd: 'Event',
              message: 'Update failed - ' + JSON.stringify(error),
              name: 'Update'
            });
          });
          break;
        }

      case 'RaiseHand':
        {
          if (settings.logApiMessages) {
            logger.log('SignalCore', { coreID: this.coreID });
          }

          var showSignal = message.args && message.args.signal;
          this._raiseYourHand(showSignal, function (result) {
            return _this4.sendApiResponse(sender, { cmd: 'RaiseHandReturn', result: result });
          });
          break;
        }

      case 'Ping':
        {
          if (settings.logApiMessages) {
            logger.log('Pinged, replying', { coreID: that.coreID });
          }

          this.sendApiResponse(sender, {
            cmd: 'Pong',
            lastPing: this._lastCorePing,
            online: this._socket !== null
          });
          break;
        }

      default:
        {
          this.sendApiResponse(sender, { error: 'unknown message' });
        }
    }
  },

  /**
   * Deals with messages coming from the core over our secure connection
   * @param data
   */
  routeMessage: function routeMessage(data) {
    var message = Messages.unwrap(data);
    if (!message) {
      logger.error('routeMessage got a NULL coap message ', { coreID: this.getHexCoreID() });
      return;
    }

    this._lastMessageTime = new Date();

    //should be adequate
    var messageCode = message.getCode();
    var requestType = '';
    if (messageCode > Message.Code.EMPTY && messageCode <= Message.Code.DELETE) {
      //probably a request
      requestType = Messages.getRequestType(message);
    }

    if (!requestType) {
      requestType = this._getResponseType(message.getTokenString());
    }

    console.log('Device got message of type ', requestType, ' with token ', message.getTokenString(), ' ', Messages.getRequestType(message));

    if (message.isAcknowledgement()) {
      if (!requestType) {
        //no type, can't route it.
        requestType = 'PingAck';
      }
      this.emit(('msg_' + requestType).toLowerCase(), message);
      return;
    }

    this._incrementRecieveCounter();
    if (message.isEmpty() && message.isConfirmable()) {
      this._lastCorePing = new Date();
      //var delta = (this._lastCorePing - this._connectionStartTime) / 1000.0;
      //logger.log('core ping @ ', delta, ' seconds ', { coreID: this.getHexCoreID() });
      this.sendReply('PingAck', message.getId());
      return;
    }

    if (!message || message.getId() !== this._recieveCounter) {
      logger.log('got counter ', message.getId(), ' expecting ', this._recieveCounter, { coreID: this.getHexCoreID() });

      if (requestType === 'Ignored') {
        //don't ignore an ignore...
        this.disconnect('Got an Ignore');
        return;
      }

      //this.sendMessage('Ignored', null, {}, null, null);
      this.disconnect('Bad Counter');
      return;
    }

    this.emit(('msg_' + requestType).toLowerCase(), message);
  },

  sendReply: function sendReply(name, id, data, token, onError, requester) {
    if (!this._isSocketAvailable(requester, name)) {
      onError && onError('This client has an exclusive lock.');
      return;
    }

    //if my reply is an acknowledgement to a confirmable message
    //then I need to re-use the message id...

    //set our counter
    if (id < 0) {
      this._incrementSendCounter();
      id = this._sendCounter;
    }

    var message = Messages.wrap(name, id, null, data, token, null);
    if (!this._cipherStream) {
      logger.error('Device - sendReply before READY', { coreID: this.getHexCoreID() });
      return;
    }
    this._cipherStream.write(message, null, null);
  },

  sendMessage: function sendMessage(name, params, data, onResponse, onError, requester) {
    if (!this._isSocketAvailable(requester, name)) {
      onError && onError('This client has an exclusive lock.');
      return false;
    }

    //increment our counter
    this._incrementSendCounter();

    var token = null;
    if (!Messages.isNonTypeMessage(name)) {
      token = this._getNextToken();
      this._useToken(name, token);

      return;
    }

    var message = Messages.wrap(name, this._sendCounter, params, data, token, onError);

    if (message === null) {
      logger.error('Could not wrap message', name, params, data);
    }

    if (!this._cipherStream) {
      logger.error('Client - sendMessage before READY', { coreID: this.getHexCoreID() });
      return;
    }

    this._cipherStream.write(message, null, null);

    return token || 0;
  },

  /**
   * Adds a listener to our secure message stream
   * @param name the message type we're waiting on
   * @param uri - a particular function / variable?
   * @param token - what message does this go with? (should come from sendMessage)
   * @param callback what we should call when we're done
   * @param [once] whether or not we should keep the listener after we've had a match
   */
  listenFor: function listenFor(name, uri, token, callback, runOnce) {
    var _this5 = this;

    var tokenHex = token ? utilities.toHexString(token) : null;
    var beVerbose = settings.showVerboseDeviceLogs;

    //TODO: failWatch?  What kind of timeout do we want here?

    //adds a one time event
    var eventName = 'msg_' + name.toLowerCase(),
        handler = function handler(message) {
      if (uri && message.getUriPath().indexOf(uri) !== 0) {
        if (beVerbose) {
          logger.log('uri filter did not match', uri, msg.getUriPath(), { coreID: _this5.getHexCoreID() });
        }
        return;
      }

      if (tokenHex && tokenHex !== message.getTokenString()) {
        if (beVerbose) {
          logger.log('Tokens did not match ', tokenHex, message.getTokenString(), { coreID: _this5.getHexCoreID() });
        }
        return;
      }

      if (runOnce) {
        _this5.removeListener(eventName, handler);
      }

      process.nextTick(function () {
        try {
          if (beVerbose) {
            logger.log('heard ', name, { coreID: _this5.coreID });
          }
          callback(message);
        } catch (exception) {
          logger.error('listenFor ' + name + ' - caught error: ', exception, exception.stack, { coreID: _this5.getHexCoreID() });
        }
      });
    };

    //logger.log('listening for ', eventName);
    this.on(eventName, handler);

    return handler;
  },

  _increment: function _increment(counter) {
    counter++;
    return counter < COUNTER_MAX ? counter : 0;
  },

  /**
   * Gets or wraps
   * @returns {null}
   */
  _incrementSendCounter: function _incrementSendCounter() {
    this._sendCounter = this._increment(this._sendCounter);
  },

  _incrementRecieveCounter: function _incrementRecieveCounter() {
    this._recieveCounter = this._increment(this._recieveCounter);
  },

  /**
   * increments or wraps our token value, and makes sure it isn't in use
   */
  _getNextToken: function _getNextToken() {
    this._sendToken = this._increment(this._sendToken);
  },

  /**
   * Associates a particular token with a message we're sending, so we know
   * what we're getting back when we get an ACK
   * @param name
   * @param token
   */
  _useToken: function _useToken(name, token) {
    var key = utilities.toHexString(token);

    if (this._tokens[key]) {
      throw 'Token ${name} ${token} ${key} already in use';
    }

    this._tokens[key] = name;
  },

  /**
   * Clears the association with a particular token
   * @param token
   */
  _clearToken: function _clearToken(token) {
    var key = utilities.toHexString(token);

    if (this._tokens[key]) {
      delete this._tokens[key];
    }
  },

  _getResponseType: function _getResponseType(tokenString) {
    var request = this._tokens[tokenString];
    //logger.log('respType for key ', tokenStr, ' is ', request);

    if (!request) {
      return null;
    }

    return Messages.getResponseType(request);
  },

  /**
   * Ensures we have introspection data from the core, and then
   * requests a variable value to be sent, when received it transforms
   * the response into the appropriate type
   * @param name
   * @param type
   * @param callback - expects (value, buf, err)
   */
  _getVariable: function _getVariable(name, type, callback) {
    var _this6 = this;

    var performRequest = function performRequest() {
      if (!_this6._hasParticleVariable(name)) {
        callback(null, null, 'Variable not found');
        return;
      }

      var messageToken = _this6.sendMessage('VariableRequest', { name: name });
      var variableTransformer = _this6._transformVariableGenerator(name, callback);
      _this6.listenFor('VariableValue', null, messageToken, variableTransformer, true);
    };

    if (this._hasFunctionState()) {
      //slight short-circuit, saves ~5 seconds every 100,000 requests...
      performRequest();
    } else {
      when(this._ensureWeHaveIntrospectionData()).then(performRequest, function (error) {
        return callback(null, null, 'Problem requesting variable: ' + error);
      });
    }
  },

  _setVariable: function _setVariable(name, data, callback) {

    /*TODO: data type! */
    var payload = Messages.toBinary(data);
    var token = this.sendMessage('VariableRequest', { name: name }, payload);

    //are we expecting a response?
    //watches the messages coming back in, listens for a message of this type with
    this.listenFor('VariableValue', null, token, callback, true);
  },

  _callFunction: function _callFunction(name, args, callback) {
    var _this7 = this;

    when(this._transformArguments(name, args)).then(function (buffer) {
      if (settings.showVerboseDeviceLogs) {
        logger.log('sending function call to the core', { coreID: _this7.coreID, name: name });
      }

      var writeUrl = function writeUrl(message) {
        message.setUri('f/' + name);
        if (buffer) {
          message.setUriQuery(buffer.toString());
        }
        return message;
      };

      var token = _this7.sendMessage('FunctionCall', { name: name, args: buf, _writeCoapUri: writeUrl }, null);

      //gives us a function that will transform the response, and call the callback with it.
      var resultTransformer = _this7.__transformFunctionResultGenerator(name, callback);

      //watches the messages coming back in, listens for a message of this type with
      _this7.listenFor('FunctionReturn', null, token, resultTransformer, true);
    }, function (error) {
      callback({
        Error: 'Something went wrong calling this function: ' + err
      });
    });
  },

  /**
   * Asks the core to start or stop its 'raise your hand' signal
   * @param showSignal - whether it should show the signal or not
   * @param callback - what to call when we're done or timed out...
   */
  _raiseYourHand: function _raiseYourHand(showSignal, callback) {
    var timer = setTimeout(function () {
      callback(false);
    }, 30 * 1000);

    //TODO: that.stopListeningFor('_raiseYourHandReturn', listenHandler);
    //TODO:  var listenHandler = this.listenFor('_raiseYourHandReturn',  ... );

    //logger.log('_raiseYourHand: asking core to signal? ' + showSignal);
    var token = this.sendMessage('_raiseYourHand', { _writeCoapUri: Messages._raiseYourHandUrlGenerator(showSignal) }, null);
    this.listenFor('_raiseYourHandReturn', null, token, function () {
      clearTimeout(timer);
      callback(true);
    }, true);
  },

  flashCore: function flashCore(binary, sender) {
    var _this8 = this;

    if (!binary || binary.length === 0) {
      logger.log('flash failed! - file is empty! ', { coreID: this.getHexCoreID() });
      this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed - File was too small!' });
      return;
    }

    if (binary && binary.length > settings.MaxCoreBinaryBytes) {
      logger.log('flash failed! - file is too BIG ' + binary.length, { coreID: this.getHexCoreID() });
      this.sendApiResponse(sender, {
        cmd: 'Event',
        name: 'Update',
        message: 'Update failed - File was too big!'
      });
      return;
    }

    var flasher = new Flasher();
    flasher.startFlashBuffer(binary, this, function () {
      logger.log('flash core finished! - sending api event', { coreID: _this8.getHexCoreID() });
      global.server.publishSpecialEvents('spark/flash/status', 'success', _this8.getHexCoreID());
      _this8.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update done' });
    }, function (message) {
      logger.log('flash core failed! - sending api event', { coreID: _this8.getHexCoreID(), error: message });
      global.server.publishSpecialEvents('spark/flash/status', 'failed', _this8.getHexCoreID());
      _this8.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed' });
    }, function () {
      logger.log('flash core started! - sending api event', { coreID: _this8.getHexCoreID() });
      global.server.publishSpecialEvents('spark/flash/status', 'started', _this8.getHexCoreID());
      _this8.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update started' });
    });
  },

  _isSocketAvailable: function _isSocketAvailable(requester, messageName) {
    if (!this._owningFlasher || this._owningFlasher === requester) {
      return true;
    }

    logger.error('This client has an exclusive lock', {
      coreID: this.getHexCoreID(),
      cache_key: this._connectionKey,
      msgName: messageName
    });

    return false;
  },

  takeOwnership: function takeOwnership(flasher) {
    if (this._owningFlasher) {
      logger.error('already owned', { coreID: this.getHexCoreID() });
      return false;
    }
    //only permit the owning object to send messages.
    this._owningFlasher = flasher;
    return true;
  },
  releaseOwnership: function releaseOwnership(flasher) {
    logger.log('releasing flash ownership ', { coreID: this.getHexCoreID() });
    if (this._owningFlasher === flasher) {
      this._owningFlasher = null;
    } else if (this._owningFlasher) {
      logger.error('cannot releaseOwnership, ', flasher, ' isn\'t the current owner ', { coreID: this.getHexCoreID() });
    }
  },

  /**
   * makes sure we have our introspection data, then transforms our object into
   * the right coap query string
   * @param name
   * @param args
   * @returns {*}
   */
  _transformArguments: function _transformArguments(name, args) {
    var _this9 = this;

    var ready = when.defer();

    when(this._ensureWeHaveIntrospectionData()).then(function () {
      var buffer = _this9._transformArguments(name, args);
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
  },

  __transformFunctionResultGenerator: function __transformFunctionResultGenerator(name, callback) {
    var _this10 = this;

    return function (message) {
      _this10._transformFunctionResult(name, message, callback);
    };
  },

  /**
   *
   * @param name
   * @param callback -- callback expects (value, buf, err)
   * @returns {Function}
   */
  _transformVariableGenerator: function _transformVariableGenerator(name, callback) {
    var _this11 = this;

    return function (message) {
      _this11._transformVariableResult(name, message, callback);
    };
  },

  /**
   *
   * @param name
   * @param msg
   * @param callback-- callback expects (value, buf, err)
   * @returns {null}
   */
  _transformVariableResult: function _transformVariableResult(name, message, callback) {
    //grab the variable type, if the core doesn't say, assume it's a 'string'
    var variableFunctionState = this._deviceFunctionState ? this._deviceFunctionState.v : null;
    var variableType = variableFunctionState && variableFunctionState[name] ? variableFunctionState[name] : 'string';

    var result = null;
    var data = null;
    try {
      if (message && message.getPayload) {
        //leaving raw payload in response message for now, so we don't shock our users.
        data = msg.getPayload();
        result = Messages.fromBinary(data, variableType);
      }
    } catch (exception) {
      logger.error('_transformVariableResult - error transforming response ' + exception);
    }

    process.nextTick(function () {
      try {
        callback(result, data);
      } catch (exception) {
        logger.error('_transformVariableResult - error in callback ' + exception);
      }
    });
  },

  /**
   * Transforms the result from a core function to the correct type.
   * @param name
   * @param msg
   * @param callback
   * @returns {null}
   */
  _transformFunctionResult: function _transformFunctionResult(name, message, callback) {
    var variableType = 'int32';

    var result = null;
    try {
      if (message && message.getPayload) {
        result = Messages.fromBinary(message.getPayload(), variableType);
      }
    } catch (exception) {
      logger.error('_transformFunctionResult - error transforming response ' + exception);
    }

    process.nextTick(function () {
      try {
        callback(result);
      } catch (exception) {
        logger.error('_transformFunctionResult - error in callback ' + exception);
      }
    });
  }

}, _defineProperty(_extend, '_transformArguments', function _transformArguments(name, args) {
  //logger.log('transform args', { coreID: this.getHexCoreID() });
  if (!args) {
    return null;
  }

  if (!this._hasFunctionState()) {
    logger.error('_transformArguments called without any function state!', { coreID: this.getHexCoreID() });
    return null;
  }

  //TODO: lowercase function keys on new state format
  name = name.toLowerCase();
  var functionState = this._deviceFunctionState[name];
  if (!functionState || !functionState.args) {
    //maybe it's the old protocol?
    var oldProtocolFunctionState = this._deviceFunctionState.f;
    if (oldProtocolFunctionState && utilities.arrayContainsLower(oldProtocolFunctionState, name)) {
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
  return Messages.buildArguments(args, functionState.args);
}), _defineProperty(_extend, '_ensureWeHaveIntrospectionData', function _ensureWeHaveIntrospectionData() {
  if (this._hasFunctionState()) {
    return when.resolve();
  }

  //if we don't have a message pending, send one.
  if (!this._describeDfd) {
    this.sendMessage('Describe');
    this._describeDfd = when.defer();
  }

  //let everybody else queue up on this promise
  return this._describeDfd.promise;
}), _defineProperty(_extend, '_onDescribeReturn', function _onDescribeReturn(message) {
  //got a description, is it any good?
  var loaded = this._loadFunctionState(message.getPayload());

  if (this._describeDfd) {
    if (loaded) {
      this._describeDfd.resolve();
    } else {
      this._describeDfd.reject('something went wrong parsing function state');
    }
  }
  //else { //hmm, unsolicited response, that's okay. }
}), _defineProperty(_extend, '_onCorePrivateEvent', function _onCorePrivateEvent(message) {
  this._onCoreSentEvent(message, false);
}), _defineProperty(_extend, '_onCorePublicEvent', function _onCorePublicEvent(message) {
  this._onCoreSentEvent(message, true);
}), _defineProperty(_extend, '_onCoreSentEvent', function _onCoreSentEvent(message, isPublic) {
  if (!message) {
    logger.error('CORE EVENT - msg obj was empty?!');
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
    published_by: this.getHexCoreID(),
    published_at: moment().toISOString()
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
  var coreId = this.getHexCoreID();

  if (lowername.indexOf('spark/device/claim/code') === 0) {
    var claimCode = message.getPayload().toString();

    var coreAttributes = global.server.getCoreAttributes(coreId);

    if (coreAttributes.claimCode !== claimCode) {
      global.server.setCoreAttribute(coreId, 'claimCode', claimCode);
      //claim device
      if (global.api) {
        global.api.linkDevice(coreId, claimCode, this._particleProductId);
      }
    }
  }

  if (lowername.indexOf('spark/device/system/version') === 0) {
    global.server.setCoreAttribute(coreId, 'spark_system_version', message.getPayload().toString());
  }

  if (lowername.indexOf('spark/device/safemode') === 0) {
    var token = this.sendMessage('Describe');
    this.listenFor('DescribeReturn', null, token, function (systemMessage) {
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
      this.sendReply('EventAck', message.getId());
      return;
    }
  }

  try {
    if (!global.publisher) {
      return;
    }

    var result = global.publisher.publish(isPublic, eventData.name, eventData.userid, eventData.data, eventData.ttl, eventData.published_at, this.getHexCoreID());

    if (!result) {
      //this core is over its limit, and that message was not sent.
      //this.sendReply('EventSlowdown', msg.getId());
    }

    if (message.isConfirmable()) {
      //console.log('Event confirmable');
      this.sendReply('EventAck', message.getId());
    } else {
      //console.log('Event non confirmable');
    }
  } catch (exception) {
    logger.error('_onCoreSentEvent: failed writing to socket - ' + exception);
  }
}), _defineProperty(_extend, '_onCoreGetTime', function _onCoreGetTime(message) {
  //moment#unix outputs a Unix timestamp (the number of seconds since the Unix Epoch).
  var stamp = moment().utc().unix();
  var binaryValue = Messages.toBinary(stamp, 'uint32');

  this.sendReply('GetTimeReturn', message.getId(), binaryValue, message.getToken());
}), _defineProperty(_extend, 'onCorePublicSubscribe', function onCorePublicSubscribe(message) {
  this.onCoreSubscribe(message, true);
}), _defineProperty(_extend, 'onCoreSubscribe', function onCoreSubscribe(message, isPublic) {
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
    this.sendReply('SubscribeFail', message.getId());
    return;
  }

  var query = message.getUriQuery();
  var payload = message.getPayload();
  var myDevices = query && query.indexOf('u') >= 0;
  var userid = myDevices ? (this.userID || '').toLowerCase() : null;
  var deviceID = payload ? payload.toString() : null;

  //TODO: filter by a particular deviceID

  this.sendReply('SubscribeAck', message.getId());

  //modify our filter on the appropriate socket (create the socket if we haven't yet) to let messages through
  //this.eventsSocket.subscribe(isPublic, name, userid);
  global.publisher.subscribe(name, userid, deviceID, this, this.onCoreEvent);
}), _defineProperty(_extend, '_onCorePublicHeard', function _onCorePublicHeard(name, data, ttl, published_at, coreid) {
  this.sendCoreEvent(true, name, data, ttl, published_at, coreid);
}), _defineProperty(_extend, '_onCorePrivateHeard', function _onCorePrivateHeard(name, data, ttl, published_at, coreid) {
  this.sendCoreEvent(false, name, data, ttl, published_at, coreid);
}), _defineProperty(_extend, 'onCoreEvent', function onCoreEvent(isPublic, name, userid, data, ttl, published_at, coreid) {
  this.sendCoreEvent(isPublic, name, data, ttl, published_at, coreid);
}), _defineProperty(_extend, 'sendCoreEvent', function sendCoreEvent(isPublic, name, data, ttl, published_at, coreid) {
  var rawFunction = function rawFunction(message) {
    try {
      message.setMaxAge(parseInt(ttl && ttl >= 0 ? ttl : 60));
      if (published_at) {
        message.setTimestamp(moment(published_at).toDate());
      }
    } catch (exception) {
      logger.error('onCoreHeard - ' + exception);
    }

    return message;
  };

  var messageName = isPublic ? 'PublicEvent' : 'PrivateEvent';
  var userID = (this.userID || '').toLowerCase() + '/';
  name = name ? name.toString() : name;
  if (name && name.indexOf && name.indexOf(userID) === 0) {
    name = name.substring(userID.length);
  }

  data = data ? data.toString() : data;
  this.sendMessage(messageName, { event_name: name, _raw: rawFunction }, data);
}), _defineProperty(_extend, '_hasFunctionState', function _hasFunctionState() {
  return !!this._deviceFunctionState;
}), _defineProperty(_extend, '_hasParticleVariable', function _hasParticleVariable(name) {
  return this._deviceFunctionState && this._deviceFunctionState.v && this._deviceFunctionState.v[name];
}), _defineProperty(_extend, 'HasSparkFunction', function HasSparkFunction(name) {
  //has state, and... the function is an object, or it's in the function array
  return this._deviceFunctionState && (this._deviceFunctionState[name] || this._deviceFunctionState.f && utilities.arrayContainsLower(this._deviceFunctionState.f, name));
}), _defineProperty(_extend, '_loadFunctionState', function _loadFunctionState(data) {
  var functionState = JSON.parse(data.toString());

  if (functionState && functionState.v) {
    //'v':{'temperature':2}
    functionState.v = Messages.translateIntTypes(functionState.v);
  }

  this._deviceFunctionState = functionState;

  return true;
}), _defineProperty(_extend, 'getHexCoreID', function getHexCoreID() {
  return this.coreID ? this.coreID.toString('hex') : 'unknown';
}), _defineProperty(_extend, 'getRemoteIPAddress', function getRemoteIPAddress() {
  return this._socket && this._socket.remoteAddress ? this._socket.remoteAddress.toString() : 'unknown';
}), _defineProperty(_extend, '_disconnectCounter', 0), _defineProperty(_extend, 'disconnect', function disconnect(message) {
  message = message || '';
  this._disconnectCounter++;

  if (this._disconnectCounter > 1) {
    //don't multi-disconnect
    return;
  }

  try {
    var logInfo = {
      coreID: this.getHexCoreID(),
      cache_key: this._connectionKey,
      duration: this._connectionStartTime ? (new Date() - this._connectionStartTime) / 1000.0 : undefined
    };

    logger.log(this._disconnectCounter + ': Core disconnected: ' + message, logInfo);
  } catch (exception) {
    logger.error('Disconnect log error ' + exception);
  }

  try {
    if (this._socket) {
      this._socket.end();
      this._socket.destroy();
      this._socket = null;
    }
  } catch (exception) {
    logger.error('Disconnect TCPSocket error: ' + exception);
  }

  if (this._decipherStream) {
    try {
      this._decipherStream.end();
      this._decipherStream = null;
    } catch (exception) {
      logger.error('Error cleaning up _decipherStream ', exception);
    }
  }

  if (this._cipherStream) {
    try {
      this._cipherStream.end();
      this._cipherStream = null;
    } catch (exception) {
      logger.error('Error cleaning up _cipherStream ', exception);
    }
  }

  this.emit('disconnect', message);

  //obv, don't do this before emitting disconnect.
  try {
    this.removeAllListeners();
  } catch (ex) {
    logger.error('Problem removing listeners ', ex);
  }
}), _extend));
module.exports = SparkCore;