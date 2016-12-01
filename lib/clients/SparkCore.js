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

var EventEmitter = require('events').EventEmitter;
var moment = require('moment');
var extend = require('xtend');
var when = require('when');
var fs = require('fs');

var Message = require('h5.coap').Message;

var settings = require('../settings');
var ISparkCore = require('./ISparkCore');
var CryptoLib = require('../lib/ICrypto');
var messages = require('../lib/Messages').default;
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
var TOKEN_MAX = settings.message_token_max;
var KEEP_ALIVE_TIMEOUT = settings.keepaliveTimeout;
var SOCKET_TIMEOUT = settings.socketTimeout;

SparkCore.prototype = extend(ISparkCore.prototype, EventEmitter.prototype, {
    classname: 'SparkCore',
    options: {},

    socket: null,
    secureIn: null,
    secureOut: null,
    sendCounter: null,
    sendToken: 0,
    _tokens: null,
    recvCounter: null,

    apiSocket: null,
    eventsSocket: null,

    /**
     * Our state describing which functions take what arguments
     */
    coreFnState: null,

    spark_product_id: null,
    product_firmware_version: null,
    platform_id: null,

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

    handshake: function handshake() {
        var _this2 = this;

        var handshake = new Handshake(this, function () {
            return _this2.ready();
        }, function (message) {
            return _this2.disconnect(message);
        });

        //when the handshake is done, we can expect two stream properties, 'secureIn' and 'secureOut'
        handshake.start();
    },

    ready: function ready() {
        var _this3 = this;

        this._connStartTime = new Date();

        logger.log('on ready', {
            coreID: this.getHexCoreID(),
            ip: this.getRemoteIPAddress(),
            product_id: this.spark_product_id,
            firmware_version: this.product_firmware_version,
            platform_id: this.platform_id,
            cache_key: this._connection_key
        });

        //catch any and all describe responses
        this.on('msg_describereturn', function (message) {
            return _this3.onDescribeReturn(message);
        });
        this.on('msg_PrivateEvent'.toLowerCase(), function (message) {
            return _this3.onCorePrivateEvent(message);
        });
        this.on('msg_PublicEvent'.toLowerCase(), function (message) {
            return _this3.onCorePublicEvent(message);
        });
        this.on('msg_Subscribe'.toLowerCase(), function (message) {
            return _this3.onCorePublicSubscribe(message);
        });
        this.on('msg_GetTime'.toLowerCase(), function (message) {
            return _this3.onCoreGetTime(message);
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

        if (!msg) {
            logger.log('onApiMessage - no message? got ' + JSON.stringify(arguments), { coreID: this.getHexCoreID() });
            return;
        }

        //if we're not the owner, then the socket is busy
        var isBusy = !this._isSocketAvailable(null, function (error) {
            logger.error(error + ': ' + msg.cmd, { coreID: _this4.getHexCoreID() });
        });
        if (isBusy) {
            this.sendApiResponse(sender, { error: 'This core is locked during the flashing process.' });
            return;
        }

        //TODO: simplify this more?
        var that = this;
        switch (message.cmd) {
            case 'Describe':
                {
                    if (settings.logApiMessages) {
                        logger.log('Describe', { coreID: that.coreID });
                    }
                    when(this.ensureWeHaveIntrospectionData()).then(function () {
                        return _this4.sendApiResponse(sender, {
                            cmd: 'DescribeReturn',
                            name: msg.name,
                            state: _this4.coreFnState,
                            product_id: _this4.spark_product_id,
                            firmware_version: _this4.product_firmware_version
                        });
                    }, function (message) {
                        return _this4.sendApiResponse(sender, {
                            cmd: 'DescribeReturn',
                            name: message.name,
                            err: 'Error, no device state'
                        });
                    });
                    break;
                }

            case 'GetVar':
                {
                    if (settings.logApiMessages) {
                        logger.log('GetVar', { coreID: that.coreID });
                    }
                    this.getVariable(message.name, message.type, function (value, buffer, error) {
                        that.sendApiResponse(sender, {
                            cmd: 'VarReturn',
                            name: message.name,
                            error: error,
                            result: value
                        });
                    });
                    break;
                }
            case 'SetVar':
                if (settings.logApiMessages) {
                    logger.log('SetVar', { coreID: that.coreID });
                }
                this.setVariable(msg.name, msg.value, function (resp) {

                    //that.sendApiResponse(sender, resp);

                    var response = {
                        cmd: 'VarReturn',
                        name: msg.name,
                        result: resp.getPayload().toString()
                    };
                    that.sendApiResponse(sender, response);
                });
                break;
            case 'CallFn':
                if (settings.logApiMessages) {
                    logger.log('FunCall', { coreID: that.coreID });
                }
                this.callFunction(msg.name, msg.args, function (fnResult) {
                    var response = {
                        cmd: 'FnReturn',
                        name: msg.name,
                        result: fnResult,
                        error: fnResult.Error
                    };

                    that.sendApiResponse(sender, response);
                });
                break;
            case 'UFlash':
                if (settings.logApiMessages) {
                    logger.log('FlashCore', { coreID: that.coreID });
                }

                this.flashCore(msg.args.data, sender);
                break;

            case 'FlashKnown':
                if (settings.logApiMessages) {
                    logger.log('FlashKnown', { coreID: that.coreID, app: msg.app });
                }

                // Responsibility for sanitizing app names lies with API Service
                // This includes only allowing apps whose binaries are deployed and thus exist
                fs.readFile('known_firmware/' + msg.app + '_' + settings.environment + '.bin', function (err, buf) {
                    if (err) {
                        logger.log('Error flashing known firmware', { coreID: that.coreID, err: err });
                        that.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed - ' + JSON.stringify(err) });
                        return;
                    }

                    that.flashCore(buf, sender);
                });
                break;

            case 'RaiseHand':
                if (isBusy) {
                    if (settings.logApiMessages) {
                        logger.log('SignalCore - flashing', { coreID: that.coreID });
                    }
                    that.sendApiResponse(sender, { cmd: 'RaiseHandReturn', result: true });
                } else {
                    if (settings.logApiMessages) {
                        logger.log('SignalCore', { coreID: that.coreID });
                    }

                    var showSignal = msg.args && msg.args.signal;
                    this.raiseYourHand(showSignal, function (result) {
                        that.sendApiResponse(sender, {
                            cmd: 'RaiseHandReturn',
                            result: result
                        });
                    });
                }

                break;
            case 'Ping':
                if (settings.logApiMessages) {
                    logger.log('Pinged, replying', { coreID: that.coreID });
                }

                this.sendApiResponse(sender, { cmd: 'Pong', online: this._socket != null, lastPing: this._lastCorePing });
                break;
            default:
                this.sendApiResponse(sender, { error: 'unknown message' });
        }
    },

    /**
     * Deals with messages coming from the core over our secure connection
     * @param data
     */
    routeMessage: function routeMessage(data) {
        var msg = messages.unwrap(data);
        if (!msg) {
            logger.error('routeMessage got a NULL coap message ', { coreID: this.getHexCoreID() });
            return;
        }

        this._lastMessageTime = new Date();

        //should be adequate
        var msgCode = msg.getCode();
        if (msgCode > Message.Code.EMPTY && msgCode <= Message.Code.DELETE) {
            //probably a request
            msg._type = messages.getRequestType(msg);
        }

        if (!msg._type) {
            msg._type = this.getResponseType(msg.getTokenString());
        }

        //console.log('core got message of type ' + msg._type + ' with token ' + msg.getTokenString() + ' ' + messages.getRequestType(msg));

        if (msg.isAcknowledgement()) {
            if (!msg._type) {
                //no type, can't route it.
                msg._type = 'PingAck';
            }
            this.emit(('msg_' + msg._type).toLowerCase(), msg);
            return;
        }

        var nextPeerCounter = ++this.recvCounter;
        if (nextPeerCounter > 65535) {
            //TODO: clean me up! (I need settings, and maybe belong elsewhere)
            this.recvCounter = nextPeerCounter = 0;
        }

        if (msg.isEmpty() && msg.isConfirmable()) {
            this._lastCorePing = new Date();
            //var delta = (this._lastCorePing - this._connStartTime) / 1000.0;
            //logger.log('core ping @ ', delta, ' seconds ', { coreID: this.getHexCoreID() });
            this.sendReply('PingAck', msg.getId());
            return;
        }

        if (!msg || msg.getId() != nextPeerCounter) {
            logger.log('got counter ', msg.getId(), ' expecting ', nextPeerCounter, { coreID: this.getHexCoreID() });

            if (msg._type == 'Ignored') {
                //don't ignore an ignore...
                this.disconnect('Got an Ignore');
                return;
            }

            //this.sendMessage('Ignored', null, {}, null, null);
            this.disconnect('Bad Counter');
            return;
        }

        this.emit(('msg_' + msg._type).toLowerCase(), msg);
    },

    sendReply: function sendReply(name, id, data, token, onError, requester) {
        if (!this._isSocketAvailable(requester, onError, name)) {
            return;
        }

        //if my reply is an acknowledgement to a confirmable message
        //then I need to re-use the message id...

        //set our counter
        if (id < 0) {
            id = this.getIncrSendCounter();
        }

        var msg = messages.wrap(name, id, null, data, token, null);
        if (!this.secureOut) {
            logger.error('SparkCore - sendReply before READY', { coreID: this.getHexCoreID() });
            return;
        }
        this.secureOut.write(msg, null, null);
        //logger.log('Replied with message of type: ', name, ' containing ', data);
    },

    sendMessage: function sendMessage(name, params, data, onResponse, onError, requester) {
        if (!this._isSocketAvailable(requester, onError, name)) {
            return false;
        }

        //increment our counter
        var id = this.getIncrSendCounter();

        //TODO: messages of type 'NON' don't really need a token // alternatively: 'no response type == no token'
        var token = this.getNextToken();
        this.useToken(name, token);

        var msg = messages.wrap(name, id, params, data, token, onError);
        if (!this.secureOut) {
            logger.error('SparkCore - sendMessage before READY', { coreID: this.getHexCoreID() });
            return;
        }
        this.secureOut.write(msg, null, null);
        //        logger.log('Sent message of type: ', name, ' containing ', data,
        //            'BYTES: ' + msg.toString('hex'));

        return token;
    },

    /**
     * Same as 'sendMessage', but sometimes the core can't handle Tokens on certain message types.
     *
     * Somewhat rare / special case, so this seems like a better option at the moment, should converge these
     * back at some point
     */
    sendNONTypeMessage: function sendNONTypeMessage(name, params, data, onResponse, onError, requester) {
        if (!this._isSocketAvailable(requester, onError, name)) {
            return;
        }

        //increment our counter
        var id = this.getIncrSendCounter();
        var msg = messages.wrap(name, id, params, data, null, onError);
        if (!this.secureOut) {
            logger.error('SparkCore - sendMessage before READY', { coreID: this.getHexCoreID() });
            return;
        }
        this.secureOut.write(msg, null, null);
        //logger.log('Sent message of type: ', name, ' containing ', data,
        //        'BYTES: ' + msg.toString('hex'));
    },

    parseMessage: function parseMessage(data) {
        //we're assuming data is a serialized CoAP message
        return messages.unwrap(data);
    },

    /**
     * Adds a listener to our secure message stream
     * @param name the message type we're waiting on
     * @param uri - a particular function / variable?
     * @param token - what message does this go with? (should come from sendMessage)
     * @param callback what we should call when we're done
     * @param [once] whether or not we should keep the listener after we've had a match
     */
    listenFor: function listenFor(name, uri, token, callback, once) {
        var tokenHex = token ? utilities.toHexString(token) : null;
        var beVerbose = settings.showVerboseCoreLogs;

        //TODO: failWatch?  What kind of timeout do we want here?

        //adds a one time event
        var that = this,
            evtName = ('msg_' + name).toLowerCase(),
            handler = function handler(msg) {

            if (uri && msg.getUriPath().indexOf(uri) != 0) {
                if (beVerbose) {
                    logger.log('uri filter did not match', uri, msg.getUriPath(), { coreID: that.getHexCoreID() });
                }
                return;
            }

            if (tokenHex && tokenHex != msg.getTokenString()) {
                if (beVerbose) {
                    logger.log('Tokens did not match ', tokenHex, msg.getTokenString(), { coreID: that.getHexCoreID() });
                }
                return;
            }

            if (once) {
                that.removeListener(evtName, handler);
            }

            process.nextTick(function () {
                try {
                    if (beVerbose) {
                        logger.log('heard ', name, { coreID: that.coreID });
                    }
                    callback(msg);
                } catch (ex) {
                    logger.error('listenFor - caught error: ', ex, ex.stack, { coreID: that.getHexCoreID() });
                }
            });
        };

        //logger.log('listening for ', evtName);
        this.on(evtName, handler);

        return handler;
    },

    /**
     * Gets or wraps
     * @returns {null}
     */
    getIncrSendCounter: function getIncrSendCounter() {
        this.sendCounter++;

        if (this.sendCounter >= COUNTER_MAX) {
            this.sendCounter = 0;
        }

        return this.sendCounter;
    },

    /**
     * increments or wraps our token value, and makes sure it isn't in use
     */
    getNextToken: function getNextToken() {
        this.sendToken++;
        if (this.sendToken >= TOKEN_MAX) {
            this.sendToken = 0;
        }

        this.clearToken(this.sendToken);

        return this.sendToken;
    },

    /**
     * Associates a particular token with a message we're sending, so we know
     * what we're getting back when we get an ACK
     * @param name
     * @param token
     */
    useToken: function useToken(name, token) {
        var key = utilities.toHexString(token);
        this._tokens[key] = name;
    },

    /**
     * Clears the association with a particular token
     * @param token
     */
    clearToken: function clearToken(token) {
        var key = utilities.toHexString(token);

        if (this._tokens[key]) {
            delete this._tokens[key];
        }
    },

    getResponseType: function getResponseType(tokenStr) {
        var request = this._tokens[tokenStr];
        //logger.log('respType for key ', tokenStr, ' is ', request);

        if (!request) {
            return null;
        }
        return messages.getResponseType(request);
    },

    /**
     * Ensures we have introspection data from the core, and then
     * requests a variable value to be sent, when received it transforms
     * the response into the appropriate type
     * @param name
     * @param type
     * @param callback - expects (value, buf, err)
     */
    getVariable: function getVariable(name, type, callback) {
        var that = this;
        var performRequest = function () {
            if (!that.HasSparkVariable(name)) {
                callback(null, null, 'Variable not found');
                return;
            }

            var token = this.sendMessage('VariableRequest', { name: name });
            var varTransformer = this.transformVariableGenerator(name, callback);
            this.listenFor('VariableValue', null, token, varTransformer, true);
        }.bind(this);

        if (this.hasFnState()) {
            //slight short-circuit, saves ~5 seconds every 100,000 requests...
            performRequest();
        } else {
            when(this.ensureWeHaveIntrospectionData()).then(performRequest, function (err) {
                callback(null, null, 'Problem requesting variable: ' + err);
            });
        }
    },

    setVariable: function setVariable(name, data, callback) {

        /*TODO: data type! */
        var payload = messages.toBinary(data);
        var token = this.sendMessage('VariableRequest', { name: name }, payload);

        //are we expecting a response?
        //watches the messages coming back in, listens for a message of this type with
        this.listenFor('VariableValue', null, token, callback, true);
    },

    callFunction: function callFunction(name, args, callback) {
        var that = this;
        when(this.transformArguments(name, args)).then(function (buf) {
            if (settings.showVerboseCoreLogs) {
                logger.log('sending function call to the core', { coreID: that.coreID, name: name });
            }

            var writeUrl = function writeUrl(msg) {
                msg.setUri('f/' + name);
                if (buf) {
                    msg.setUriQuery(buf.toString());
                }
                return msg;
            };

            var token = that.sendMessage('FunctionCall', { name: name, args: buf, _writeCoapUri: writeUrl }, null);

            //gives us a function that will transform the response, and call the callback with it.
            var resultTransformer = that.transformFunctionResultGenerator(name, callback);

            //watches the messages coming back in, listens for a message of this type with
            that.listenFor('FunctionReturn', null, token, resultTransformer, true);
        }, function (err) {
            callback({ Error: 'Something went wrong calling this function: ' + err });
        });
    },

    /**
     * Asks the core to start or stop its 'raise your hand' signal
     * @param showSignal - whether it should show the signal or not
     * @param callback - what to call when we're done or timed out...
     */
    raiseYourHand: function raiseYourHand(showSignal, callback) {
        var timer = setTimeout(function () {
            callback(false);
        }, 30 * 1000);

        //TODO: that.stopListeningFor('RaiseYourHandReturn', listenHandler);
        //TODO:  var listenHandler = this.listenFor('RaiseYourHandReturn',  ... );

        //logger.log('RaiseYourHand: asking core to signal? ' + showSignal);
        var token = this.sendMessage('RaiseYourHand', { _writeCoapUri: messages.raiseYourHandUrlGenerator(showSignal) }, null);
        this.listenFor('RaiseYourHandReturn', null, token, function () {
            clearTimeout(timer);
            callback(true);
        }, true);
    },

    flashCore: function flashCore(binary, sender) {
        var that = this;

        if (!binary || binary.length == 0) {
            logger.log('flash failed! - file is empty! ', { coreID: this.getHexCoreID() });
            this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed - File was too small!' });
            return;
        }

        if (binary && binary.length > settings.MaxCoreBinaryBytes) {
            logger.log('flash failed! - file is too BIG ' + binary.length, { coreID: this.getHexCoreID() });
            this.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed - File was too big!' });
            return;
        }

        var flasher = new Flasher();
        flasher.startFlashBuffer(binary, this, function () {
            logger.log('flash core finished! - sending api event', { coreID: that.getHexCoreID() });
            global.server.publishSpecialEvents('spark/flash/status', 'success', that.getHexCoreID());
            that.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update done' });
        }, function (msg) {
            logger.log('flash core failed! - sending api event', { coreID: that.getHexCoreID(), error: msg });
            global.server.publishSpecialEvents('spark/flash/status', 'failed', that.getHexCoreID());
            that.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update failed' });
        }, function () {
            logger.log('flash core started! - sending api event', { coreID: that.getHexCoreID() });
            global.server.publishSpecialEvents('spark/flash/status', 'started', that.getHexCoreID());
            that.sendApiResponse(sender, { cmd: 'Event', name: 'Update', message: 'Update started' });
        });
    },

    _isSocketAvailable: function _isSocketAvailable(requester, onError, messageName) {
        if (!this._owner || this._owner == requester) {
            return true;
        } else {
            //either call their callback, or log the error
            var msg = 'this client has an exclusive lock';
            if (onError) {
                process.nextTick(function () {
                    onError(msg);
                });
            } else {
                logger.error(msg, { coreID: this.getHexCoreID(), cache_key: this._connection_key, msgName: messageName });
            }

            return false;
        }
    },

    takeOwnership: function takeOwnership(obj, onError) {
        if (this._owner) {
            logger.error('already owned', { coreID: this.getHexCoreID() });
            if (onError) {
                onError('Already owned');
            }
            return false;
        } else {
            //only permit 'obj' to send messages
            this._owner = obj;
            return true;
        }
    },
    releaseOwnership: function releaseOwnership(obj) {
        logger.log('releasing flash ownership ', { coreID: this.getHexCoreID() });
        if (this._owner == obj) {
            this._owner = null;
        } else if (this._owner) {
            logger.error('cannot releaseOwnership, ', obj, ' isn\'t the current owner ', { coreID: this.getHexCoreID() });
        }
    },

    /**
     * makes sure we have our introspection data, then transforms our object into
     * the right coap query string
     * @param name
     * @param args
     * @returns {*}
     */
    transformArguments: function transformArguments(name, args) {
        var ready = when.defer();
        var that = this;

        when(this.ensureWeHaveIntrospectionData()).then(function () {
            var buf = that._transformArguments(name, args);
            if (buf) {
                ready.resolve(buf);
            } else {
                //NOTE! The API looks for 'Unknown Function' in the error response.
                ready.reject('Unknown Function: ' + name);
            }
        }, function (msg) {
            ready.reject(msg);
        });

        return ready.promise;
    },

    transformFunctionResultGenerator: function transformFunctionResultGenerator(name, callback) {
        var that = this;
        return function (msg) {
            that.transformFunctionResult(name, msg, callback);
        };
    },

    /**
     *
     * @param name
     * @param callback -- callback expects (value, buf, err)
     * @returns {Function}
     */
    transformVariableGenerator: function transformVariableGenerator(name, callback) {
        var that = this;
        return function (msg) {
            that.transformVariableResult(name, msg, callback);
        };
    },

    /**
     *
     * @param name
     * @param msg
     * @param callback-- callback expects (value, buf, err)
     * @returns {null}
     */
    transformVariableResult: function transformVariableResult(name, msg, callback) {

        //grab the variable type, if the core doesn't say, assume it's a 'string'
        var fnState = this.coreFnState ? this.coreFnState.v : null;
        var varType = fnState && fnState[name] ? fnState[name] : 'string';

        var niceResult = null,
            data = null;
        try {
            if (msg && msg.getPayload) {
                //leaving raw payload in response message for now, so we don't shock our users.
                data = msg.getPayload();
                niceResult = messages.fromBinary(data, varType);
            }
        } catch (ex) {
            logger.error('transformVariableResult - error transforming response ' + ex);
        }

        process.nextTick(function () {
            try {
                callback(niceResult, data);
            } catch (ex) {
                logger.error('transformVariableResult - error in callback ' + ex);
            }
        });

        return null;
    },

    /**
     * Transforms the result from a core function to the correct type.
     * @param name
     * @param msg
     * @param callback
     * @returns {null}
     */
    transformFunctionResult: function transformFunctionResult(name, msg, callback) {
        var varType = 'int32'; //if the core doesn't specify, assume it's a 'uint32'
        //var fnState = (this.coreFnState) ? this.coreFnState.f : null;
        //if (fnState && fnState[name] && fnState[name].returns) {
        //    varType = fnState[name].returns;
        //}

        var niceResult = null;
        try {
            if (msg && msg.getPayload) {
                niceResult = messages.fromBinary(msg.getPayload(), varType);
            }
        } catch (ex) {
            logger.error('transformFunctionResult - error transforming response ' + ex);
        }

        process.nextTick(function () {
            try {
                callback(niceResult);
            } catch (ex) {
                logger.error('transformFunctionResult - error in callback ' + ex);
            }
        });

        return null;
    },

    /**
     * transforms our object into a nice coap query string
     * @param name
     * @param args
     * @private
     */
    _transformArguments: function _transformArguments(name, args) {
        //logger.log('transform args', { coreID: this.getHexCoreID() });
        if (!args) {
            return null;
        }

        if (!this.hasFnState()) {
            logger.error('_transformArguments called without any function state!', { coreID: this.getHexCoreID() });
            return null;
        }

        //TODO: lowercase function keys on new state format
        name = name.toLowerCase();
        var fn = this.coreFnState[name];
        if (!fn || !fn.args) {
            //maybe it's the old protocol?
            var f = this.coreFnState.f;
            if (f && utilities.arrayContainsLower(f, name)) {
                //logger.log('_transformArguments - using old format', { coreID: this.getHexCoreID() });
                //current / simplified function format (one string arg, int return type)
                fn = {
                    returns: 'int',
                    args: [[null, 'string']]
                };
            }
        }

        if (!fn || !fn.args) {
            //logger.error('_transformArguments: core doesn't know fn: ', { coreID: this.getHexCoreID(), name: name, state: this.coreFnState });
            return null;
        }

        //  'HelloWorld': { returns: 'string', args: [ {'name': 'string'}, {'adjective': 'string'}  ]} };
        return messages.buildArguments(args, fn.args);
    },

    /**
     * Checks our cache to see if we have the function state, otherwise requests it from the core,
     * listens for it, and resolves our deferred on success
     * @returns {*}
     */
    ensureWeHaveIntrospectionData: function ensureWeHaveIntrospectionData() {
        if (this.hasFnState()) {
            return when.resolve();
        }

        //if we don't have a message pending, send one.
        if (!this._describeDfd) {
            this.sendMessage('Describe');
            this._describeDfd = when.defer();
        }

        //let everybody else queue up on this promise
        return this._describeDfd.promise;
    },

    /**
     * On any describe return back from the core
     * @param msg
     */
    onDescribeReturn: function onDescribeReturn(msg) {
        //got a description, is it any good?
        var loaded = this.loadFnState(msg.getPayload());

        if (this._describeDfd) {
            if (loaded) {
                this._describeDfd.resolve();
            } else {
                this._describeDfd.reject('something went wrong parsing function state');
            }
        }
        //else { //hmm, unsolicited response, that's okay. }
    },

    //-------------
    // Core Events / Spark.publish / Spark.subscribe
    //-------------

    onCorePrivateEvent: function onCorePrivateEvent(msg) {
        this.onCoreSentEvent(msg, false);
    },
    onCorePublicEvent: function onCorePublicEvent(msg) {
        this.onCoreSentEvent(msg, true);
    },

    onCoreSentEvent: function onCoreSentEvent(msg, isPublic) {
        if (!msg) {
            logger.error('CORE EVENT - msg obj was empty?!');
            return;
        }

        //TODO: if the core is publishing messages too fast:
        //this.sendReply('EventSlowdown', msg.getId());

        //name: '/E/TestEvent', trim the '/e/' or '/E/' off the start of the uri path
        var obj = {
            name: msg.getUriPath().substr(3),
            is_public: isPublic,
            ttl: msg.getMaxAge(),
            data: msg.getPayload().toString(),
            published_by: this.getHexCoreID(),
            published_at: moment().toISOString()
        };

        //snap obj.ttl to the right value.
        obj.ttl = obj.ttl > 0 ? obj.ttl : 60;

        //snap data to not incorrectly default to an empty string.
        if (msg.getPayloadLength() == 0) {
            obj.data = null;
        }

        //logger.log(JSON.stringify(obj));

        //if the event name starts with spark (upper or lower), then eat it.
        var lowername = obj.name.toLowerCase();

        if (lowername.indexOf('spark/device/claim/code') == 0) {

            var claimCode = msg.getPayload().toString();

            var coreid = this.getHexCoreID();
            var core = global.server.getCoreAttributes(coreid);

            if (core.claimCode != claimCode) {
                global.server.setCoreAttribute(coreid, 'claimCode', claimCode);
                //claim device
                if (global.api) {
                    global.api.linkDevice(coreid, claimCode, this.spark_product_id);
                }
            }
        }

        if (lowername.indexOf('spark/device/system/version') == 0) {

            var system_version = msg.getPayload().toString();

            var coreid = this.getHexCoreID();
            global.server.setCoreAttribute(coreid, 'spark_system_version', system_version);
        }

        if (lowername.indexOf('spark/device/safemode') == 0) {

            var coreid = this.getHexCoreID();

            var token = this.sendMessage('Describe');
            this.listenFor('DescribeReturn', null, token, function (sysmsg) {
                //console.log('device '+coreid+' is in safe mode: '+sysmsg.getPayload().toString());
                if (global.api) {
                    global.api.safeMode(coreid, sysmsg.getPayload().toString());
                }
            }, true);
        }

        if (lowername.indexOf('spark') == 0) {
            //allow some kinds of message through.
            var eat_message = true;

            //if we do let these through, make them private.
            isPublic = false;

            //TODO:
            //            //if the message is 'cc3000-radio-version', save to the core_state collection for this core?
            if (lowername == 'spark/cc3000-patch-version') {
                //                set_cc3000_version(this.coreID, obj.data);
                //                eat_message = false;
            }

            if (eat_message) {
                //short-circuit
                this.sendReply('EventAck', msg.getId());
                return;
            }
        }

        try {
            if (!global.publisher) {
                return;
            }

            if (!global.publisher.publish(isPublic, obj.name, obj.userid, obj.data, obj.ttl, obj.published_at, this.getHexCoreID())) {
                //this core is over its limit, and that message was not sent.
                //this.sendReply('EventSlowdown', msg.getId());
            }
            if (msg.isConfirmable()) {
                //console.log('Event confirmable');
                this.sendReply('EventAck', msg.getId());
            } else {
                //console.log('Event non confirmable');
            }
        } catch (ex) {
            logger.error('onCoreSentEvent: failed writing to socket - ' + ex);
        }
    },

    /**
     * The core asked us for the time!
     * @param msg
     */
    onCoreGetTime: function onCoreGetTime(msg) {

        //moment#unix outputs a Unix timestamp (the number of seconds since the Unix Epoch).
        var stamp = moment().utc().unix();
        var binVal = messages.toBinary(stamp, 'uint32');

        this.sendReply('GetTimeReturn', msg.getId(), binVal, msg.getToken());
    },

    onCorePublicSubscribe: function onCorePublicSubscribe(msg) {
        this.onCoreSubscribe(msg, true);
    },
    onCoreSubscribe: function onCoreSubscribe(msg, isPublic) {
        var name = msg.getUriPath().substr(3);

        //var body = resp.getPayload().toString();
        //logger.log('Got subscribe request from core, path was \'' + name + '\'');
        //uri -> /e/?u    --> firehose for all my devices
        //uri -> /e/ (deviceid in body)   --> allowed
        //uri -> /e/    --> not allowed (no global firehose for cores, kthxplox)
        //uri -> /e/event_name?u    --> all my devices
        //uri -> /e/event_name?u (deviceid)    --> deviceid?

        if (!name) {
            //no firehose for cores
            this.sendReply('SubscribeFail', msg.getId());
            return;
        }

        var query = msg.getUriQuery(),
            payload = msg.getPayload(),
            myDevices = query && query.indexOf('u') >= 0,
            userid = myDevices ? (this.userID || '').toLowerCase() : null,
            deviceID = payload ? payload.toString() : null;

        //TODO: filter by a particular deviceID

        this.sendReply('SubscribeAck', msg.getId());

        //modify our filter on the appropriate socket (create the socket if we haven't yet) to let messages through
        //this.eventsSocket.subscribe(isPublic, name, userid);
        global.publisher.subscribe(name, userid, deviceID, this, this.onCoreEvent);
    },

    onCorePubHeard: function onCorePubHeard(name, data, ttl, published_at, coreid) {
        this.sendCoreEvent(true, name, data, ttl, published_at, coreid);
    },
    onCorePrivHeard: function onCorePrivHeard(name, data, ttl, published_at, coreid) {
        this.sendCoreEvent(false, name, data, ttl, published_at, coreid);
    },
    // isPublic, name, userid, data, ttl, published_at, coreid);
    onCoreEvent: function onCoreEvent(isPublic, name, userid, data, ttl, published_at, coreid) {
        this.sendCoreEvent(isPublic, name, data, ttl, published_at, coreid);
    },

    /**
     * sends a received event down to a core
     * @param isPublic
     * @param name
     * @param data
     * @param ttl
     * @param published_at
     */
    sendCoreEvent: function sendCoreEvent(isPublic, name, data, ttl, published_at, coreid) {
        var rawFn = function rawFn(msg) {
            try {
                msg.setMaxAge(parseInt(ttl && ttl >= 0 ? ttl : 60));
                if (published_at) {
                    msg.setTimestamp(moment(published_at).toDate());
                }
            } catch (ex) {
                logger.error('onCoreHeard - ' + ex);
            }
            return msg;
        };

        var msgName = isPublic ? 'PublicEvent' : 'PrivateEvent';
        var userID = (this.userID || '').toLowerCase() + '/';
        name = name ? name.toString() : name;
        if (name && name.indexOf && name.indexOf(userID) == 0) {
            name = name.substring(userID.length);
        }

        data = data ? data.toString() : data;
        this.sendNONTypeMessage(msgName, { event_name: name, _raw: rawFn }, data);
    },

    //    _wifiScan: null,
    //    handleFindMe: function (data) {
    //        if (!this._wifiScan) {
    //            this._wifiScan = [];
    //        }
    //
    //        if (!data || (data.indexOf('00:00:00:00:00:00') >= 0)) {
    //            this.requestLocation(this._wifiScan);
    //            this._wifiScan = [];
    //        }
    //
    //        try {
    //            this._wifiScan.push(JSON.parse(data));
    //        }
    //        catch(ex) {}
    //    },
    //
    //    requestLocation: function (arr) {
    //
    //        logger.log('Making geolocation request');
    //        var that = this;
    //        request({
    //            uri:  'https://location.services.mozilla.com/v1/search?key=0010230303020102030223',
    //            method: 'POST',
    //            body: JSON.stringify({
    //                'wifi': arr
    //            }),
    //            'content-type': 'application/json',
    //            json: true
    //        },
    //            function (error, response, body) {
    //            if (error) {
    //                logger.log('geolocation Error! ', error);
    //            }
    //            else {
    //                logger.log('geolocation success! ', body);
    //                that.sendCoreEvent(false, 'Spark/Location', body, 60, new Date(), that.getHexCoreID());
    //            }
    //        });
    //    },


    hasFnState: function hasFnState() {
        return !!this.coreFnState;
    },

    HasSparkVariable: function HasSparkVariable(name) {
        return this.coreFnState && this.coreFnState.v && this.coreFnState.v[name];
    },

    HasSparkFunction: function HasSparkFunction(name) {
        //has state, and... the function is an object, or it's in the function array
        return this.coreFnState && (this.coreFnState[name] || this.coreFnState.f && utilities.arrayContainsLower(this.coreFnState.f, name));
    },

    /**
     * interprets the introspection message from the core containing
     * argument names / types, and function return types, so we can make it easy to call functions
     * on the core.
     * @param data
     */
    loadFnState: function loadFnState(data) {
        var fnState = JSON.parse(data.toString());

        if (fnState && fnState.v) {
            //'v':{'temperature':2}
            fnState.v = messages.translateIntTypes(fnState.v);
        }

        this.coreFnState = fnState;

        //logger.log('got describe return ', this.coreFnState, { coreID: this.getHexCoreID() });

        //an example:
        //        this.coreFnState = {
        //            'HelloWorld': {
        //                returns: 'string',
        //                args: [
        //                    ['name', 'string'],
        //                    ['adjective', 'string']
        //                ]}
        //        };
        return true;
    },

    getHexCoreID: function getHexCoreID() {
        return this.coreID ? this.coreID.toString('hex') : 'unknown';
    },

    getRemoteIPAddress: function getRemoteIPAddress() {
        return this._socket && this._socket.remoteAddress ? this._socket.remoteAddress.toString() : 'unknown';
    },

    //    _idleTimer: null,
    //    _lastMessageTime: null,
    //
    //    idleChecker: function() {
    //        if (!this._socket) {
    //            //disconnected
    //            return;
    //        }
    //
    //        clearTimeout(this._idleTimer);
    //        this._idleTimer = setTimeout(this.idleChecker.bind(this), 30000);
    //
    //        if (!this._lastMessageTime) {
    //            this._lastMessageTime = new Date();
    //        }
    //
    //        var elapsed = ((new Date()) - this._lastMessageTime) / 1000;
    //        if (elapsed > 30) {
    //            //we don't expect a response, but by trying to send anything, the socket should blow up if disconnected.
    //            logger.log('Socket seems quiet, checking...', { coreID: this.getHexCoreID(), elapsed: elapsed,  cache_key: this._connection_key });
    //            this.sendMessage('SocketPing');
    //            this._lastMessageTime = new Date(); //don't check for another 30 seconds.
    //        }
    //    },


    _disconnectCtr: 0,
    disconnect: function disconnect(msg) {
        msg = msg || '';
        this._disconnectCtr++;

        if (this._disconnectCtr > 1) {
            //don't multi-disconnect
            return;
        }

        try {
            var logInfo = { coreID: this.getHexCoreID(), cache_key: this._connection_key };
            if (this._connStartTime) {
                var delta = (new Date() - this._connStartTime) / 1000.0;
                logInfo['duration'] = delta;
            }

            logger.log(this._disconnectCtr + ': Core disconnected: ' + msg, logInfo);
        } catch (ex) {
            logger.error('Disconnect log error ' + ex);
        }

        try {
            if (this._socket) {
                this._socket.end();
                this._socket.destroy();
                this._socket = null;
            }
        } catch (ex) {
            logger.error('Disconnect TCPSocket error: ' + ex);
        }

        if (this.secureIn) {
            try {
                this.secureIn.end();
                this.secureIn = null;
            } catch (ex) {
                logger.error('Error cleaning up secureIn ', ex);
            }
        }
        if (this.secureOut) {
            try {
                this.secureOut.end();
                this.secureOut = null;
            } catch (ex) {
                logger.error('Error cleaning up secureOut ', ex);
            }
        }

        //        clearTimeout(this._idleTimer);

        this.emit('disconnect', msg);

        //obv, don't do this before emitting disconnect.
        try {
            this.removeAllListeners();
        } catch (ex) {
            logger.error('Problem removing listeners ', ex);
        }
    }

});
module.exports = SparkCore;