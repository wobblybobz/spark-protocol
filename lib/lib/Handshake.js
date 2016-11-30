'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var CryptoLib = require('./ICrypto'); /*
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

//statics
var NONCE_BYTES = 40;
var ID_BYTES = 12;
var SESSION_BYTES = 40;
var GLOBAL_TIMEOUT = 120;

var Handshake = function Handshake(client, onSuccess, onFail) {
  var _this = this;

  _classCallCheck(this, Handshake);

  this._handshakeStage = 'send-nonce';
  this._coreId = '';
  this._useChunkingStream = true;
  this.start = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
    var dataAwaitable, nonce, data, coreProvidedPem, publicKey, _ref2, cipherStream, decipherStream, sessionKey, chunk;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.prev = 0;
            dataAwaitable = _this._onSocketDataAvailable();
            _context.next = 4;
            return _this._sendNonce();

          case 4:
            nonce = _context.sent;
            _context.next = 7;
            return dataAwaitable;

          case 7:
            data = _context.sent;
            coreProvidedPem = _this._readCoreId(nonce, data);

            _this._client.coreID = _this._coreId;
            publicKey = _this._getCoreKey(coreProvidedPem);
            _context.next = 13;
            return _this._sendSessionKey(publicKey);

          case 13:
            _ref2 = _context.sent;
            cipherStream = _ref2.cipherStream;
            decipherStream = _ref2.decipherStream;
            sessionKey = _ref2.sessionKey;
            _context.next = 19;
            return Promise.race([_this._onDecipherStreamReadable(decipherStream), _this._onDecipherStreamTimeout()]);

          case 19:
            chunk = _context.sent;

            _this._getHello(chunk);
            _this._sendHello(cipherStream);
            _this._client.sessionKey = sessionKey;
            _this._finished();
            _context.next = 29;
            break;

          case 26:
            _context.prev = 26;
            _context.t0 = _context['catch'](0);

            logger.error(_context.t0);

          case 29:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, _this, [[0, 26]]);
  }));

  this._onSocketDataAvailable = function () {
    return new Promise(function (resolve, reject) {
      var onReadable = function onReadable() {
        var data = _this._socket.read();
        try {
          if (!data) {
            logger.log('onSocketData called, but no data sent.');
            reject();
          }

          resolve(data);
        } catch (exception) {
          logger.log('Handshake: Exception thrown while processing data');
          logger.error(exception);
          reject();
        }

        _this._socket.removeListener('readable', onReadable);
      };
      _this._socket.on('readable', onReadable);
    });
  };

  this._sendNonce = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
    var nonce;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _this._handshakeStage = 'send-nonce';

            _context2.next = 3;
            return CryptoLib.getRandomBytes(NONCE_BYTES);

          case 3:
            nonce = _context2.sent;

            _this._socket.write(nonce);

            return _context2.abrupt('return', nonce);

          case 6:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, _this);
  }));

  this._readCoreId = function (nonce, data) {
    //server should read 256 bytes
    //decrypt msg using server private key
    var plaintext = void 0;
    try {
      plaintext = CryptoLib.decrypt(CryptoLib.getServerKeys(), data);
    } catch (exception) {
      logger.error('Handshake decryption error: ', exception);
    }

    if (!plaintext) {
      _this._handshakeFail('decryption failed');
      return '';
    }

    //plaintext should be 52 bytes, else fail
    if (plaintext.length < NONCE_BYTES + ID_BYTES) {
      _this._handshakeFail('plaintext was too small: ' + plaintext.length);
      return '';
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
      _this._handshakeFail('nonces didn\'t match');
      return '';
    }

    _this._coreId = coreIdBuffer.toString('hex');

    _this._handshakeStage = 'read-core-id';

    return coreProvidedPem;
  };

  this._getCoreKey = function (coreProvidedPem) {
    var publicKey = utilities.get_core_key(_this._coreId);
    try {
      if (!publicKey) {
        _this._handshakeFail('couldn\'t find key for core: ' + _this._coreId);
        if (coreProvidedPem) {
          utilities.save_handshake_key(_this._coreId, coreProvidedPem);
        }
        return '';
      }
    } catch (exception) {
      logger.error('Error handling get_corekey ', exception);
      _this._handshakeFail('Failed handling find key for core: ' + _this._coreId);
    }

    _this._handshakeStage = 'get-core-key';
    return publicKey;
  };

  this._sendSessionKey = function () {
    var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3(corePublicKey) {
      var sessionKey, ciphertext, hash, signedhmac, message, decipherStream, cipherStream, chunkingIn, chunkingOut;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return CryptoLib.getRandomBytes(SESSION_BYTES);

            case 2:
              sessionKey = _context3.sent;


              // Server RSA encrypts this 40-byte message using the Core's public key to
              // create a 128-byte ciphertext.
              ciphertext = CryptoLib.encrypt(corePublicKey, sessionKey);

              // Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40
              // bytes generated in the previous step as the HMAC key.

              hash = CryptoLib.createHmacDigest(ciphertext, sessionKey);

              // Server signs the HMAC with its RSA private key generating a 256-byte
              // signature.

              signedhmac = CryptoLib.sign(null, hash);

              //Server sends ~384 bytes to Core: the ciphertext then the signature.

              message = Buffer.concat([ciphertext, signedhmac], ciphertext.length + signedhmac.length);

              _this._socket.write(message);

              decipherStream = CryptoLib.CreateAESDecipherStream(sessionKey);
              cipherStream = CryptoLib.CreateAESCipherStream(sessionKey);


              if (_this._useChunkingStream) {
                chunkingIn = new ChunkingStream({ outgoing: false });
                chunkingOut = new ChunkingStream({ outgoing: true });

                // What I receive gets broken into message chunks, and goes into the
                // decrypter

                _this._socket.pipe(chunkingIn);
                chunkingIn.pipe(decipherStream);

                // What I send goes into the encrypter, and then gets broken into message
                // chunks
                cipherStream.pipe(chunkingOut);
                chunkingOut.pipe(_this._socket);
              } else {
                _this._socket.pipe(decipherStream);
                cipherStream.pipe(_this._socket);
              }

              _this._handshakeStage = 'send-session-key';

              return _context3.abrupt('return', {
                cipherStream: cipherStream,
                decipherStream: decipherStream,
                sessionKey: sessionKey
              });

            case 13:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this);
    }));

    return function (_x) {
      return _ref4.apply(this, arguments);
    };
  }();

  this._onDecipherStreamReadable = function (decipherStream) {
    return new Promise(function (resolve, reject) {
      var callback = function callback() {
        var chunk = decipherStream.read();
        if (_this._handshakeStage === 'done') {
          // This line keeps the connection to the core alive
          _this._routeToClient(chunk);
        } else if (_this._handshakeStage === 'send-hello') {
          _this._queueEarlyData(_this._handshakeStage, chunk);
        } else {
          resolve(chunk);
        }
      };
      decipherStream.on('readable', callback);
    });
  };

  this._queueEarlyData = function (name, data) {
    if (!data) {
      return;
    }
    _this._pending = _this._pending || [];
    _this._pending.push(data);
    logger.error('recovering from early data! ', {
      step: name,
      data: data ? data.toString('hex') : data,
      cache_key: _this._client._connection_key
    });
  };

  this._onDecipherStreamTimeout = function () {
    return new Promise(function (resolve, reject) {
      return setTimeout(function () {
        return reject();
      }, 30 * 1000);
    });
  };

  this._getHello = function (data) {
    var env = _this._client.parseMessage(data);
    var msg = env && env.hello ? env.hello : env;
    if (!msg) {
      _this._handshakeFail('failed to parse hello');
      return;
    }
    _this._client.recvCounter = msg.getId();
    try {
      if (msg.getPayload) {
        var payload = msg.getPayload();
        if (payload.length > 0) {
          var r = new buffers.BufferReader(payload);
          _this._client.spark_product_id = r.shiftUInt16();
          _this._client.product_firmware_version = r.shiftUInt16();
          _this._client.platform_id = r.shiftUInt16();
        }
      } else {
        logger.log('msg object had no getPayload fn');
      }
    } catch (ex) {
      logger.log('error while parsing hello payload ', ex);
    }
  };

  this._sendHello = function (cipherStream) {
    _this._handshakeStage = 'send-hello';
    //client will set the counter property on the message
    //logger.log('server: send hello');
    _this._client.secureOut = cipherStream;
    _this._client.sendCounter = CryptoLib.getRandomUINT16();
    _this._client.sendMessage('Hello', {}, null, null);
  };

  this._finished = function () {
    _this._handshakeStage = 'done';
    _this._onSuccess && _this._onSuccess();

    _this._flushEarlyData();
  };

  this._flushEarlyData = function () {
    if (!_this._pending) {
      return;
    }

    _this._pending.map(function (data) {
      return _this._routeToClient(data);
    });
    _this._pending = null;
  };

  this._routeToClient = function (data) {
    if (!data) {
      return;
    }
    process.nextTick(function () {
      return _this._client.routeMessage(data);
    });
  };

  this._handshakeFail = function (message) {
    var _onFail = _this._onFail,
        _reject = _this._reject;

    _onFail && _onFail(message);

    var logInfo = {
      cache_key: _this._client && _this._client._connection_key,
      ip: _this._socket && _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown',
      coreId: _this._coreId ? _this._coreId.toString('hex') : null
    };

    logger.error('Handshake failed: ', message, logInfo);
    _reject && _reject();
  };

  this._client = client;
  this._socket = client.socket;
  this._onSuccess = onSuccess;
  this._onFail = onFail;
}

//
// 1.) Start listening to the socket.  This will be the response from the core
// containing the coreId.
//


//
// 2.) Server responds with 40 bytes of random data as a nonce.
// * Core should read exactly 40 bytes from the socket.
// Timeout: 30 seconds.  If timeout is reached, Core must close TCP socket and
// retry the connection.
//


//
// 3.) Server should read exactly 256 bytes from the socket.
// Timeout waiting for the encrypted message is 30 seconds.  If the timeout is
// reached, Server must close the connection.
//
// * Server RSA decrypts the message with its private key.  If the decryption
//   fails, Server must close the connection.
// * Decrypted message should be 52 bytes, otherwise Server must close the
//   connection.
// * The first 40 bytes of the message must match the previously sent nonce,
//   otherwise Server must close the connection.
// * Remaining 12 bytes of message represent STM32 ID.  Server looks up STM32
//   ID, retrieving the Core's public RSA key.
// * If the public key is not found, Server must close the connection.
//


// 4.) Read the public key from disk for this core


//  4.) Server creates secure session key
//  * Server generates 40 bytes of secure random data to serve as components
//      of a session key for AES-128-CBC encryption.
//      The first 16 bytes (MSB first) will be the key, the next 16 bytes
//      (MSB first) will be the initialization vector (IV), and the final 8
//      bytes (MSB first) will be the salt.
//      Server RSA encrypts this 40-byte message using the Core's public key
//      to create a 128-byte ciphertext.
//  * Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40
//    bytes generated in the previous step as the HMAC key.
//  * Server signs the HMAC with its RSA private key generating a 256-byte
//    signature.
//  * Server sends 384 bytes to Core: the ciphertext then the signature.

// creates a session key, encrypts it using the core's public key, and sends
// it back


/**
 * receive a hello from the client, taking note of the counter
 */


/**
 * send a hello to the client, with our new random counter
 */
;

/*
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

    _useChunkingStream: true,


    handshake: async function (client, onSuccess, onFail) {
        this._client = client;
        this._socket = client.socket;
        this.onSuccess = onSuccess;
        this.onFail = onFail;



        this.startGlobalTimeout()
          .catch(() => this._handshakeFail(
            'Handshake did not complete in ' + Handshake.GLOBAL_TIMEOUT +
              ' seconds'
          ));

        //grab and cache this before we disconnect
        this._ipAddress = this.getRemoteIPAddress();
    },

    startGlobalTimeout: function() {
        return new Promise((resolve, reject) => {
          // TODO - Don't set this as a variable. We should be using
          // Promise.race instead
          this._globalFailResolve = resolve;
          setTimeout(reject, Handshake.GLOBAL_TIMEOUT * 1000);
        });
    },



});
*/


module.exports = Handshake;