"use strict";

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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

var extend = require("xtend");
var IHandshake = require("./IHandshake");
var CryptoLib = require("./ICrypto");
var utilities = require("../lib/utilities.js");
var ChunkingStream = require("./ChunkingStream").default;
var logger = require('../lib/logger.js');
var buffers = require('h5.buffers');
var ursa = require('ursa');

/*
 Handshake protocol v1

 1.) Socket opens:

 2.) Server responds with 40 bytes of random data as a nonce.
     * Core should read exactly 40 bytes from the socket.
     Timeout: 30 seconds.  If timeout is reached, Core must close TCP socket and retry the connection.

     * Core appends the 12-byte STM32 Unique ID to the nonce, RSA encrypts the 52-byte message with the Server's public key,
     and sends the resulting 256-byte ciphertext to the Server.  The Server's public key is stored on the external flash chip at address TBD.
     The nonce should be repeated in the same byte order it arrived (FIFO) and the STM32 ID should be appended in the
     same byte order as the memory addresses: 0x1FFFF7E8, 0x1FFFF7E9, 0x1FFFF7EA… 0x1FFFF7F2, 0x1FFFF7F3.

 3.) Server should read exactly 256 bytes from the socket.
     Timeout waiting for the encrypted message is 30 seconds.  If the timeout is reached, Server must close the connection.

     * Server RSA decrypts the message with its private key.  If the decryption fails, Server must close the connection.
     * Decrypted message should be 52 bytes, otherwise Server must close the connection.
     * The first 40 bytes of the message must match the previously sent nonce, otherwise Server must close the connection.
     * Remaining 12 bytes of message represent STM32 ID.  Server looks up STM32 ID, retrieving the Core's public RSA key.
     * If the public key is not found, Server must close the connection.

 4.) Server creates secure session key
     * Server generates 40 bytes of secure random data to serve as components of a session key for AES-128-CBC encryption.
     The first 16 bytes (MSB first) will be the key, the next 16 bytes (MSB first) will be the initialization vector (IV), and the final 8 bytes (MSB first) will be the salt.
     Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.
     * Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.
     * Server signs the HMAC with its RSA private key generating a 256-byte signature.
     * Server sends 384 bytes to Core: the ciphertext then the signature.


 5.) Release control back to the SparkCore module

     * Core creates a protobufs Hello with counter set to the uint32 represented by the most significant 4 bytes of the IV, encrypts the protobufs Hello with AES, and sends the ciphertext to Server.
     * Server reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Core must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.

     * Server creates protobufs Hello with counter set to a random uint32, encrypts the protobufs Hello with AES, and sends the ciphertext to Core.
     * Core reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Server must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.
     */

var Handshake = function Handshake(socket) {
    _classCallCheck(this, Handshake);

    this._handshakeStage = 'send-nonce';

    this._socket = socket;
};

//statics


Handshake.stages = { SEND_NONCE: 0, READ_COREID: 1, GET_COREKEY: 2, SEND_SESSIONKEY: 3, GET_HELLO: 4, SEND_HELLO: 5, DONE: 6 };
Handshake.NONCE_BYTES = 40;
Handshake.ID_BYTES = 12;
Handshake.SESSION_BYTES = 40;

/**
 * If we don't finish the handshake in xx seconds, then report a failure
 * @type {number}
 */
Handshake.GLOBAL_TIMEOUT = 120;

Handshake.prototype = extend(IHandshake.prototype, {
    classname: "Handshake",
    socket: null,
    stage: Handshake.stages.SEND_NONCE,

    _async: true,
    nonce: null,
    sessionKey: null,
    coreId: null,

    //The public RSA key for the given coreId from the datastore
    corePublicKey: null,

    useChunkingStream: true,

    handshake: function () {
        var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee(client, onSuccess, onFail) {
            var _this = this;

            var data;
            return regeneratorRuntime.wrap(function _callee$(_context) {
                while (1) {
                    switch (_context.prev = _context.next) {
                        case 0:
                            this.client = client;
                            this.socket = client.socket;
                            this.onSuccess = onSuccess;
                            this.onFail = onFail;

                            this.send_nonce();
                            _context.next = 7;
                            return this.onSocketDataAvailable();

                        case 7:
                            data = _context.sent;

                            this.nextStep(data);

                            this.startGlobalTimeout().catch(function () {
                                return _this.handshakeFail("Handshake did not complete in " + Handshake.GLOBAL_TIMEOUT + " seconds");
                            });

                            //grab and cache this before we disconnect
                            this._ipAddress = this.getRemoteIPAddress();

                        case 11:
                        case "end":
                            return _context.stop();
                    }
                }
            }, _callee, this);
        }));

        function handshake(_x, _x2, _x3) {
            return _ref.apply(this, arguments);
        }

        return handshake;
    }(),

    startGlobalTimeout: function startGlobalTimeout() {
        var _this2 = this;

        return new Promise(function (resolve, reject) {
            // TODO - Don't set this as a variable. We should be using
            // Promise.race instead
            _this2._globalFailResolve = resolve;
            setTimeout(reject, Handshake.GLOBAL_TIMEOUT * 1000);
        });
    },

    clearGlobalTimeout: function clearGlobalTimeout() {
        if (!this._globalFailResolve) {
            return;
        }

        this._globalFailResolve();
        this._globalFailResolve = null;
    },

    getRemoteIPAddress: function getRemoteIPAddress() {
        return this.socket && this.socket.remoteAddress ? this.socket.remoteAddress.toString() : "unknown";
    },

    handshakeFail: function handshakeFail(message) {
        //aww
        this.onFail && this.onFail(message);

        var logInfo = {
            cache_key: this.client && this.client._connection_key,
            ip: this._ipAddress,
            coreId: this.coreId ? this.coreId.toString('hex') : null
        };

        logger.error("Handshake failed: ", message, logInfo);
        this.clearGlobalTimeout();
    },

    routeToClient: function routeToClient(data) {
        var _this3 = this;

        if (!data) {
            return;
        }
        process.nextTick(function () {
            return _this3.client.routeMessage(data);
        });
    },

    nextStep: function nextStep(data) {
        var _this4 = this;

        process.nextTick(_asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
            return regeneratorRuntime.wrap(function _callee2$(_context2) {
                while (1) {
                    switch (_context2.prev = _context2.next) {
                        case 0:
                            _context2.next = 2;
                            return _this4._nextStep(data);

                        case 2:
                            return _context2.abrupt("return", _context2.sent);

                        case 3:
                        case "end":
                            return _context2.stop();
                    }
                }
            }, _callee2, _this4);
        })));
    },

    _nextStep: function () {
        var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(data) {
            return regeneratorRuntime.wrap(function _callee3$(_context3) {
                while (1) {
                    switch (_context3.prev = _context3.next) {
                        case 0:
                            _context3.t0 = this.stage;
                            _context3.next = _context3.t0 === Handshake.stages.SEND_NONCE ? 3 : _context3.t0 === Handshake.stages.READ_COREID ? 6 : _context3.t0 === Handshake.stages.GET_COREKEY ? 9 : _context3.t0 === Handshake.stages.SEND_SESSIONKEY ? 11 : _context3.t0 === Handshake.stages.GET_HELLO ? 14 : _context3.t0 === Handshake.stages.SEND_HELLO ? 16 : _context3.t0 === Handshake.stages.DONE ? 18 : 25;
                            break;

                        case 3:
                            _context3.next = 5;
                            return this.send_nonce();

                        case 5:
                            return _context3.abrupt("break", 27);

                        case 6:
                            //reads back our encrypted nonce and the coreId
                            this.read_coreId(data);
                            this.client.coreId = this.coreId;
                            return _context3.abrupt("break", 27);

                        case 9:
                            //looks up the public rsa key for the given coreId from the datastore
                            this.get_corekey();
                            return _context3.abrupt("break", 27);

                        case 11:
                            _context3.next = 13;
                            return this.send_sessionkey();

                        case 13:
                            return _context3.abrupt("break", 27);

                        case 14:
                            //receive a hello from the client, taking note of the counter
                            this.get_hello(data);
                            return _context3.abrupt("break", 27);

                        case 16:
                            //send a hello to the client, with our new random counter
                            this.send_hello();
                            return _context3.abrupt("break", 27);

                        case 18:
                            this.client.sessionKey = this.sessionKey;
                            this.onSuccess && this.onSuccess();

                            this.clearGlobalTimeout();
                            this.flushEarlyData();
                            console.log('_nextStep DONE ' + this.stage);
                            this.stage++;
                            return _context3.abrupt("break", 27);

                        case 25:
                            this.routeToClient(data);
                            return _context3.abrupt("break", 27);

                        case 27:
                        case "end":
                            return _context3.stop();
                    }
                }
            }, _callee3, this);
        }));

        function _nextStep(_x4) {
            return _ref3.apply(this, arguments);
        }

        return _nextStep;
    }(),

    _pending: null,
    queueEarlyData: function queueEarlyData(name, data) {
        if (!data) {
            return;
        }
        this._pending = this._pending || [];
        this._pending.push(data);
        logger.error("recovering from early data! ", {
            step: name,
            data: data ? data.toString('hex') : data,
            cache_key: this.client._connection_key
        });
    },
    flushEarlyData: function flushEarlyData() {
        var _this5 = this;

        if (!this._pending) {
            return;
        }

        this._pending.map(function (data) {
            return _this5.routeToClient(data);
        });
        this._pending = null;
    },

    onSocketDataAvailable: function onSocketDataAvailable() {
        var _this6 = this;

        return new Promise(function (resolve, reject) {
            _this6.socket.on('readable', function () {
                var data = _this6.socket.read();
                try {
                    if (!data) {
                        logger.log("onSocketData called, but no data sent.");
                        reject();
                    }

                    if (_this6.useChunkingStream && _this6.chunkingIn) {
                        _this6.chunkingIn.write(data);
                    } else if (_this6.secureIn) {
                        _this6.secureIn.write(data);
                    }

                    resolve(data);
                } catch (ex) {
                    logger.log("Handshake: Exception thrown while processing data");
                    logger.error(ex);
                    reject();
                }
            });
        });
    },

    //
    //2.) Server responds with 40 bytes of random data as a nonce.
    // * Core should read exactly 40 bytes from the socket.
    // Timeout: 30 seconds.  If timeout is reached, Core must close TCP socket and retry the connection.
    //


    send_nonce: function () {
        var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
            var buf;
            return regeneratorRuntime.wrap(function _callee4$(_context4) {
                while (1) {
                    switch (_context4.prev = _context4.next) {
                        case 0:

                            this.stage = Handshake.stages.READ_COREID;
                            console.log('send_nonce ' + this.stage);

                            //logger.log('send_nonce called');

                            _context4.next = 4;
                            return CryptoLib.getRandomBytes(Handshake.NONCE_BYTES);

                        case 4:
                            buf = _context4.sent;

                            this.nonce = buf;
                            this.socket.write(buf);

                            //            if (buf) {
                            //                logger.log("sent nonce ", buf.toString('hex'));
                            //            }

                            //a good start
                            this.nextStep();

                        case 8:
                        case "end":
                            return _context4.stop();
                    }
                }
            }, _callee4, this);
        }));

        function send_nonce() {
            return _ref4.apply(this, arguments);
        }

        return send_nonce;
    }(),

    //
    // 3.) Server should read exactly 256 bytes from the socket.
    // Timeout waiting for the encrypted message is 30 seconds.  If the timeout is reached, Server must close the connection.
    //
    // * Server RSA decrypts the message with its private key.  If the decryption fails, Server must close the connection.
    // * Decrypted message should be 52 bytes, otherwise Server must close the connection.
    // * The first 40 bytes of the message must match the previously sent nonce, otherwise Server must close the connection.
    // * Remaining 12 bytes of message represent STM32 ID.  Server looks up STM32 ID, retrieving the Core's public RSA key.
    // * If the public key is not found, Server must close the connection.
    //

    read_coreId: function read_coreId(data) {
        //we're expecting this to be run twice at least
        //once with data, and once without

        var that = this;
        if (!data) {
            if (this._socketTimeout) {
                clearTimeout(this._socketTimeout); //just in case
            }

            //waiting on data.
            this._socketTimeout = setTimeout(function () {
                that.handshakeFail("read_coreId timed out");
            }, 30 * 1000);

            return;
        }
        clearTimeout(this._socketTimeout); // *phew*

        //server should read 256 bytes
        //decrypt msg using server private key

        var plaintext;
        try {
            plaintext = CryptoLib.decrypt(CryptoLib.getServerKeys(), data);
        } catch (ex) {
            logger.error("Handshake decryption error: ", ex);
        }
        if (!plaintext || plaintext == '') {
            that.handshakeFail("decryption failed");
            return;
        }

        //logger.log("read_coreId decrypted to ", plaintext.toString('hex'));

        //success
        //plaintext should be 52 bytes, else fail
        if (plaintext.length < Handshake.NONCE_BYTES + Handshake.ID_BYTES) {
            that.handshakeFail("plaintext was too small: " + plaintext.length);
            return;
        }

        var vNonce = new Buffer(40);
        var vcoreId = new Buffer(12);

        plaintext.copy(vNonce, 0, 0, 40);
        plaintext.copy(vcoreId, 0, 40, 52);

        if (plaintext.length > Handshake.NONCE_BYTES + Handshake.ID_BYTES) {
            var coreKey = new Buffer(plaintext.length - 52);
            plaintext.copy(coreKey, 0, 52, plaintext.length);
            //console.log("got key ", coreKey.toString('hex'));
            this.coreProvidedPem = utilities.convertDERtoPEM(coreKey);
        }

        //nonces should match
        if (!utilities.bufferCompare(vNonce, that.nonce)) {
            that.handshakeFail("nonces didn't match");
            return;
        }

        //sweet!
        that.coreId = vcoreId.toString('hex');
        //logger.log("core reported coreId: " + that.coreId);

        this.stage = Handshake.stages.GET_COREKEY;
        console.log('read_coreId ' + this.stage);
        that.nextStep();
    },

    // * Remaining 12 bytes of message represent STM32 ID.  Server retrieves the Core's public RSA key.
    // * If the public key is not found, Server must close the connection.
    get_corekey: function get_corekey() {
        var that = this;
        utilities.get_core_key(this.coreId, function (public_key) {
            try {
                if (!public_key) {
                    that.handshakeFail("couldn't find key for core: " + this.coreId);
                    if (that.coreProvidedPem) {
                        utilities.save_handshake_key(that.coreId, that.coreProvidedPem);
                    }

                    return;
                }

                this.corePublicKey = public_key;

                //cool!
                this.stage = Handshake.stages.SEND_SESSIONKEY;
                console.log('get_corekey ' + this.stage);
                this.nextStep();
            } catch (ex) {
                logger.error("Error handling get_corekey ", ex);
                this.handshakeFail("Failed handling find key for core: " + this.coreId);
            }
        }.bind(this));
    },

    //  4.) Server creates secure session key
    //  * Server generates 40 bytes of secure random data to serve as components of a session key for AES-128-CBC encryption.
    //      The first 16 bytes (MSB first) will be the key, the next 16 bytes (MSB first) will be the initialization vector (IV), and the final 8 bytes (MSB first) will be the salt.
    //      Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.
    //  * Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.
    //  * Server signs the HMAC with its RSA private key generating a 256-byte signature.
    //  * Server sends 384 bytes to Core: the ciphertext then the signature.

    //creates a session key, encrypts it using the core's public key, and sends it back
    send_sessionkey: function () {
        var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
            var that, buf, ciphertext, hash, signedhmac, msg;
            return regeneratorRuntime.wrap(function _callee5$(_context5) {
                while (1) {
                    switch (_context5.prev = _context5.next) {
                        case 0:
                            that = this;
                            _context5.next = 3;
                            return CryptoLib.getRandomBytes(Handshake.SESSION_BYTES);

                        case 3:
                            buf = _context5.sent;

                            that.sessionKey = buf;

                            //Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.
                            ciphertext = CryptoLib.encrypt(that.corePublicKey, that.sessionKey);

                            //Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.

                            hash = CryptoLib.createHmacDigest(ciphertext, that.sessionKey);

                            //Server signs the HMAC with its RSA private key generating a 256-byte signature.

                            signedhmac = CryptoLib.sign(null, hash);

                            //Server sends ~384 bytes to Core: the ciphertext then the signature.
                            //logger.log("server: ciphertext was :", ciphertext.toString('hex'));
                            //console.log("signature block was: " + signedhmac.toString('hex'));

                            msg = Buffer.concat([ciphertext, signedhmac], ciphertext.length + signedhmac.length);

                            that.socket.write(msg);
                            //logger.log('Handshake: sent encrypted sessionKey');

                            that.secureIn = CryptoLib.CreateAESDecipherStream(that.sessionKey);
                            that.secureOut = CryptoLib.CreateAESCipherStream(that.sessionKey);

                            if (that.useChunkingStream) {

                                that.chunkingIn = new ChunkingStream({ outgoing: false });
                                that.chunkingOut = new ChunkingStream({ outgoing: true });

                                //what I receive gets broken into message chunks, and goes into the decrypter
                                that.socket.pipe(that.chunkingIn);
                                that.chunkingIn.pipe(that.secureIn);

                                //what I send goes into the encrypter, and then gets broken into message chunks
                                that.secureOut.pipe(that.chunkingOut);
                                that.chunkingOut.pipe(that.socket);
                            } else {
                                that.socket.pipe(that.secureIn);
                                that.secureOut.pipe(that.socket);
                            }

                            that.secureIn.on('readable', function () {
                                var chunk = that.secureIn.read();
                                if (that.stage > Handshake.stages.DONE) {
                                    that.routeToClient(chunk);
                                } else if (that.stage >= Handshake.stages.SEND_HELLO) {
                                    that.queueEarlyData(that.stage, chunk);
                                } else {
                                    that.nextStep(chunk);
                                }
                            });

                            //a good start
                            that.stage = Handshake.stages.GET_HELLO;
                            console.log('send_sessionkey ' + that.stage);
                            that.nextStep();

                        case 17:
                        case "end":
                            return _context5.stop();
                    }
                }
            }, _callee5, this);
        }));

        function send_sessionkey() {
            return _ref5.apply(this, arguments);
        }

        return send_sessionkey;
    }(),

    /**
     * receive a hello from the client, taking note of the counter
     */
    get_hello: function get_hello(data) {
        var that = this;
        if (!data) {
            if (this._socketTimeout) {
                clearTimeout(this._socketTimeout); //just in case
            }

            //waiting on data.
            //logger.log("server: waiting on hello");
            this._socketTimeout = setTimeout(function () {
                that.handshakeFail("get_hello timed out");
            }, 30 * 1000);

            return;
        }
        clearTimeout(this._socketTimeout);

        var env = this.client.parseMessage(data);
        var msg = env && env.hello ? env.hello : env;
        if (!msg) {
            this.handshakeFail("failed to parse hello");
            return;
        }
        this.client.recvCounter = msg.getId();
        //logger.log("server: got a good hello! Counter was: " + msg.getId());

        try {
            if (msg.getPayload) {
                var payload = msg.getPayload();
                if (payload.length > 0) {
                    var r = new buffers.BufferReader(payload);
                    this.client.spark_product_id = r.shiftUInt16();
                    this.client.product_firmware_version = r.shiftUInt16();
                    this.client.platform_id = r.shiftUInt16();
                }
            } else {
                logger.log('msg object had no getPayload fn');
            }
        } catch (ex) {
            logger.log('error while parsing hello payload ', ex);
        }

        //        //remind ourselves later that this key worked.
        //        if (that.corePublicKeyWasUncertain) {
        //            process.nextTick(function () {
        //                try {
        //					//set preferred key for device
        //					//that.coreFullPublicKeyObject
        //                }
        //                catch (ex) {
        //                    logger.error("error marking key as valid " + ex);
        //                }
        //            });
        //        }


        this.stage = Handshake.stages.SEND_HELLO;
        console.log('get_hello ' + this.stage);
        this.nextStep();
    },

    /**
     * send a hello to the client, with our new random counter
     */
    send_hello: function send_hello() {
        //client will set the counter property on the message
        //logger.log("server: send hello");
        this.client.secureOut = this.secureOut;
        this.client.sendCounter = CryptoLib.getRandomUINT16();
        this.client.sendMessage("Hello", {}, null, null);

        this.stage = Handshake.stages.DONE;
        console.log('send_hello ' + this.stage);
        this.nextStep();
    }

});
module.exports = Handshake;