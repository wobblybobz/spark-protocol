'use strict';

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

var extend = require('xtend');
var IHandshake = require('./IHandshake');
var CryptoLib = require('./ICrypto');
var utilities = require('../lib/utilities.js');
var ChunkingStream = require('./ChunkingStream').default;
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
  classname: 'Handshake',
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

      var noncePromise, data, nonce, _read_coreId, coreId, coreProvidedPem, publicKey, _ref2, chunk, cipherStream;

      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              this.client = client;
              this.socket = client.socket;
              this.onSuccess = onSuccess;
              this.onFail = onFail;

              noncePromise = this.send_nonce();
              _context.next = 7;
              return this.onSocketDataAvailable();

            case 7:
              data = _context.sent;
              _context.next = 10;
              return noncePromise;

            case 10:
              nonce = _context.sent;
              _read_coreId = this.read_coreId(nonce, data), coreId = _read_coreId.coreId, coreProvidedPem = _read_coreId.coreProvidedPem;

              this.client.coreID = coreId;
              _context.next = 15;
              return this.get_corekey(coreId, coreProvidedPem);

            case 15:
              publicKey = _context.sent;
              _context.next = 18;
              return this.send_sessionkey(publicKey);

            case 18:
              _ref2 = _context.sent;
              chunk = _ref2.chunk;
              cipherStream = _ref2.cipherStream;

              this.get_hello(chunk);
              this.send_hello(cipherStream);
              this.finished();

              this.startGlobalTimeout().catch(function () {
                return _this.handshakeFail('Handshake did not complete in ' + Handshake.GLOBAL_TIMEOUT + ' seconds');
              });

              //grab and cache this before we disconnect
              this._ipAddress = this.getRemoteIPAddress();

            case 26:
            case 'end':
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
    return this.socket && this.socket.remoteAddress ? this.socket.remoteAddress.toString() : 'unknown';
  },

  handshakeFail: function handshakeFail(message) {
    //aww
    this.onFail && this.onFail(message);

    var logInfo = {
      cache_key: this.client && this.client._connection_key,
      ip: this._ipAddress,
      coreId: this.coreId ? this.coreId.toString('hex') : null
    };

    logger.error('Handshake failed: ', message, logInfo);
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

  _pending: null,
  queueEarlyData: function queueEarlyData(name, data) {
    if (!data) {
      return;
    }
    this._pending = this._pending || [];
    this._pending.push(data);
    logger.error('recovering from early data! ', {
      step: name,
      data: data ? data.toString('hex') : data,
      cache_key: this.client._connection_key
    });
  },
  flushEarlyData: function flushEarlyData() {
    var _this4 = this;

    if (!this._pending) {
      return;
    }

    this._pending.map(function (data) {
      return _this4.routeToClient(data);
    });
    this._pending = null;
  },

  onSocketDataAvailable: function onSocketDataAvailable() {
    var _this5 = this;

    return new Promise(function (resolve, reject) {
      var onReadable = function onReadable() {
        var data = _this5.socket.read();
        try {
          if (!data) {
            logger.log('onSocketData called, but no data sent.');
            reject();
          }

          resolve(data);
        } catch (exception) {
          logger.log('Handshake: Exception thrown while processing data');
          logger.error(ex);
          reject();
        }

        _this5.socket.removeListener('readable', onReadable);
      };
      _this5.socket.on('readable', onReadable);
    });
  },

  //
  //2.) Server responds with 40 bytes of random data as a nonce.
  // * Core should read exactly 40 bytes from the socket.
  // Timeout: 30 seconds.  If timeout is reached, Core must close TCP socket and retry the connection.
  //


  send_nonce: function () {
    var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
      var nonce;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              console.log('send_nonce');

              _context2.next = 3;
              return CryptoLib.getRandomBytes(Handshake.NONCE_BYTES);

            case 3:
              nonce = _context2.sent;

              this.socket.write(nonce);

              return _context2.abrupt('return', nonce);

            case 6:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    function send_nonce() {
      return _ref3.apply(this, arguments);
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

  read_coreId: function read_coreId(nonce, data) {
    //server should read 256 bytes
    //decrypt msg using server private key
    var plaintext = void 0;
    try {
      plaintext = CryptoLib.decrypt(CryptoLib.getServerKeys(), data);
    } catch (ex) {
      logger.error('Handshake decryption error: ', ex);
    }

    if (!plaintext) {
      that.handshakeFail('decryption failed');
      return;
    }

    //plaintext should be 52 bytes, else fail
    if (plaintext.length < Handshake.NONCE_BYTES + Handshake.ID_BYTES) {
      that.handshakeFail('plaintext was too small: ' + plaintext.length);
      return;
    }

    //success
    var nonceBuffer = new Buffer(40);
    var coreIdBuffer = new Buffer(12);

    plaintext.copy(nonceBuffer, 0, 0, 40);
    plaintext.copy(coreIdBuffer, 0, 40, 52);

    var coreKey = new Buffer(plaintext.length - 52);
    plaintext.copy(coreKey, 0, 52, plaintext.length);
    var coreProvidedPem = utilities.convertDERtoPEM(coreKey);

    //nonces should match
    if (!utilities.bufferCompare(nonceBuffer, nonce)) {
      this.handshakeFail('nonces didn\'t match');
      return;
    }

    var coreId = this.coreId = coreIdBuffer.toString('hex');

    console.log('read_coreId');

    return {
      coreId: coreId,
      coreProvidedPem: coreProvidedPem
    };
  },

  // * Remaining 12 bytes of message represent STM32 ID.  Server retrieves the Core's public RSA key.
  // * If the public key is not found, Server must close the connection.
  get_corekey: function () {
    var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(coreId, coreProvidedPem) {
      var _this6 = this;

      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              return _context3.abrupt('return', new Promise(function (resolve, reject) {
                utilities.get_core_key(coreId, function (publicKey) {
                  try {
                    if (!publicKey) {
                      that.handshakeFail('couldn\'t find key for core: ' + coreId);
                      if (coreProvidedPem) {
                        utilities.save_handshake_key(coreId, coreProvidedPem);
                      }
                      return;
                    }

                    //cool!
                    console.log('get_corekey ' + _this6.stage);

                    resolve(publicKey);
                  } catch (exception) {
                    logger.error('Error handling get_corekey ', exception);
                    _this6.handshakeFail('Failed handling find key for core: ' + coreId);
                  }
                });
              }));

            case 1:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    function get_corekey(_x4, _x5) {
      return _ref4.apply(this, arguments);
    }

    return get_corekey;
  }(),

  //  4.) Server creates secure session key
  //  * Server generates 40 bytes of secure random data to serve as components of a session key for AES-128-CBC encryption.
  //      The first 16 bytes (MSB first) will be the key, the next 16 bytes (MSB first) will be the initialization vector (IV), and the final 8 bytes (MSB first) will be the salt.
  //      Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.
  //  * Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.
  //  * Server signs the HMAC with its RSA private key generating a 256-byte signature.
  //  * Server sends 384 bytes to Core: the ciphertext then the signature.

  //creates a session key, encrypts it using the core's public key, and sends it back
  send_sessionkey: function () {
    var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4(corePublicKey) {
      var buffer, sessionKey, ciphertext, hash, signedhmac, message, decipherStream, cipherStream, chunkingIn, chunkingOut, chunk;
      return regeneratorRuntime.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return CryptoLib.getRandomBytes(Handshake.SESSION_BYTES);

            case 2:
              buffer = _context4.sent;
              sessionKey = buffer;

              //Server RSA encrypts this 40-byte message using the Core's public key to create a 128-byte ciphertext.

              ciphertext = CryptoLib.encrypt(corePublicKey, sessionKey);

              //Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40 bytes generated in the previous step as the HMAC key.

              hash = CryptoLib.createHmacDigest(ciphertext, sessionKey);

              //Server signs the HMAC with its RSA private key generating a 256-byte signature.

              signedhmac = CryptoLib.sign(null, hash);

              //Server sends ~384 bytes to Core: the ciphertext then the signature.
              //logger.log('server: ciphertext was :', ciphertext.toString('hex'));
              //console.log('signature block was: ' + signedhmac.toString('hex'));

              message = Buffer.concat([ciphertext, signedhmac], ciphertext.length + signedhmac.length);

              this.socket.write(message);
              //logger.log('Handshake: sent encrypted sessionKey');

              decipherStream = CryptoLib.CreateAESDecipherStream(sessionKey);
              cipherStream = CryptoLib.CreateAESCipherStream(sessionKey);


              if (this.useChunkingStream) {
                chunkingIn = new ChunkingStream({ outgoing: false });
                chunkingOut = new ChunkingStream({ outgoing: true });

                //what I receive gets broken into message chunks, and goes into the decrypter

                this.socket.pipe(chunkingIn);
                chunkingIn.pipe(decipherStream);

                //what I send goes into the encrypter, and then gets broken into message chunks
                cipherStream.pipe(chunkingOut);
                chunkingOut.pipe(this.socket);
              } else {
                this.socket.pipe(decipherStream);
                cipherStream.pipe(this.socket);
              }

              _context4.next = 14;
              return Promise.race([this.onDecipherStreamReadable(decipherStream), this.onDecipherStreamTimeout()]);

            case 14:
              chunk = _context4.sent;


              console.log('send_sessionkey');

              return _context4.abrupt('return', {
                chunk: chunk,
                cipherStream: cipherStream
              });

            case 17:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, this);
    }));

    function send_sessionkey(_x6) {
      return _ref5.apply(this, arguments);
    }

    return send_sessionkey;
  }(),

  onDecipherStreamReadable: function onDecipherStreamReadable(decipherStream) {
    var _this7 = this;

    return new Promise(function (resolve, reject) {
      var callback = function callback() {
        var chunk = decipherStream.read();
        if (_this7.stage === Handshake.stages.DONE) {
          // This line keeps the connection to the core alive
          _this7.routeToClient(chunk);
        } else if (_this7.stage === Handshake.stages.SEND_HELLO) {
          _this7.queueEarlyData(_this7.stage, chunk);
        } else {
          resolve(chunk);
        }
      };
      decipherStream.on('readable', callback);
    });
  },

  onDecipherStreamTimeout: function onDecipherStreamTimeout() {
    return new Promise(function (resolve, reject) {
      return setTimeout(function () {
        return reject();
      }, 30 * 1000);
    });
  },

  /**
   * receive a hello from the client, taking note of the counter
   */
  get_hello: function get_hello(data) {
    console.log('get_hello');
    var that = this;

    var env = this.client.parseMessage(data);
    var msg = env && env.hello ? env.hello : env;
    if (!msg) {
      this.handshakeFail('failed to parse hello');
      return;
    }
    this.client.recvCounter = msg.getId();

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
  },

  /**
   * send a hello to the client, with our new random counter
   */
  send_hello: function send_hello(cipherStream) {
    this.stage = Handshake.stages.SEND_HELLO;
    //client will set the counter property on the message
    //logger.log('server: send hello');
    this.client.secureOut = cipherStream;
    this.client.sendCounter = CryptoLib.getRandomUINT16();
    this.client.sendMessage('Hello', {}, null, null);

    console.log('send_hello');
  },

  finished: function finished() {
    this.stage = Handshake.stages.DONE;
    this.client.sessionKey = this.sessionKey;
    this.onSuccess && this.onSuccess();

    this.clearGlobalTimeout();
    this.flushEarlyData();
    console.log('DONE');
  }

});
module.exports = Handshake;