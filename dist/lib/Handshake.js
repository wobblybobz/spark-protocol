'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _ICrypto = require('./ICrypto');

var _ICrypto2 = _interopRequireDefault(_ICrypto);

var _utilities = require('./utilities');

var _utilities2 = _interopRequireDefault(_utilities);

var _ChunkingStream = require('./ChunkingStream');

var _ChunkingStream2 = _interopRequireDefault(_ChunkingStream);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _h = require('h5.buffers');

var _h2 = _interopRequireDefault(_h);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//statics


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


 5.) Release control back to the Device module

     * Core creates a protobufs Hello with counter set to the uint32 represented by the most significant 4 bytes of the IV, encrypts the protobufs Hello with AES, and sends the ciphertext to Server.
     * Server reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Core must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.

     * Server creates protobufs Hello with counter set to a random uint32, encrypts the protobufs Hello with AES, and sends the ciphertext to Core.
     * Core reads protobufs Hello from socket, taking note of counter.  Each subsequent message received from Server must have the counter incremented by 1. After the max uint32, the next message should set the counter to zero.
     */

// TODO rename to device?
var NONCE_BYTES = 40; /*
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

var ID_BYTES = 12;
var SESSION_BYTES = 40;
var GLOBAL_TIMEOUT = 10;

// TODO make Handshake module stateless.

var Handshake = function Handshake(deviceKeyRepository) {
  var _this = this;

  (0, _classCallCheck3.default)(this, Handshake);
  this._handshakeStage = 'send-nonce';
  this._pendingBuffers = [];
  this._useChunkingStream = true;

  this.start = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(device) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _this._client = device;
              _this._socket = device._socket;

              return _context.abrupt('return', _promise2.default.race([_this._runHandshake(), _this._startGlobalTimeout(), new _promise2.default(function (resolve, reject) {
                return _this._reject = reject;
              })]).catch(function (error) {
                var logInfo = {
                  cache_key: _this._client && _this._client._connectionKey,
                  ip: _this._socket && _this._socket.remoteAddress ? _this._socket.remoteAddress.toString() : 'unknown',
                  deviceID: _this._deviceID || null
                };

                _logger2.default.error('Handshake failed: ', error, logInfo);

                throw error;
              }));

            case 3:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();

  this._runHandshake = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
    var nonce, data, _readDeviceHandshakeD, deviceID, deviceProvidedPem, publicKey, _ref3, cipherStream, decipherStream, handshakeBuffer;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return _this._sendNonce();

          case 2:
            nonce = _context2.sent;
            _context2.next = 5;
            return _this._onSocketDataAvailable();

          case 5:
            data = _context2.sent;
            _readDeviceHandshakeD = _this._readDeviceHandshakeData(nonce, data), deviceID = _readDeviceHandshakeD.deviceID, deviceProvidedPem = _readDeviceHandshakeD.deviceProvidedPem;

            _this._deviceID = deviceID;

            _context2.next = 10;
            return _this._getDevicePublicKey(deviceID, deviceProvidedPem);

          case 10:
            publicKey = _context2.sent;
            _context2.next = 13;
            return _this._sendSessionKey(publicKey);

          case 13:
            _ref3 = _context2.sent;
            cipherStream = _ref3.cipherStream;
            decipherStream = _ref3.decipherStream;
            _context2.next = 18;
            return _promise2.default.race([_this._onDecipherStreamReadable(decipherStream), _this._onDecipherStreamTimeout()]);

          case 18:
            handshakeBuffer = _context2.sent;


            _this._finished();

            return _context2.abrupt('return', {
              deviceID: deviceID,
              cipherStream: cipherStream,
              decipherStream: decipherStream,
              handshakeBuffer: handshakeBuffer,
              pendingBuffers: [].concat((0, _toConsumableArray3.default)(_this._pendingBuffers))
            });

          case 21:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, _this);
  }));

  this._startGlobalTimeout = function () {
    return new _promise2.default(function (resolve, reject) {
      setTimeout(function () {
        return reject(new Error('Handshake did not complete in ' + GLOBAL_TIMEOUT + ' seconds'));
      }, GLOBAL_TIMEOUT * 1000);
    });
  };

  this._onSocketDataAvailable = function () {
    return new _promise2.default(function (resolve, reject) {
      var onReadable = function onReadable() {
        try {
          var data = _this._socket.read();

          if (!data) {
            _logger2.default.log('onSocketData called, but no data sent.');
            reject(new Error('onSocketData called, but no data sent.'));
          }

          resolve(data);
        } catch (error) {
          _logger2.default.log('Handshake: Exception thrown while processing data');
          _logger2.default.error(error);
          reject(error);
        }

        _this._socket.removeListener('readable', onReadable);
      };
      _this._socket.on('readable', onReadable);
    });
  };

  this._sendNonce = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
    var nonce;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _this._handshakeStage = 'send-nonce';

            _context3.next = 3;
            return _ICrypto2.default.getRandomBytes(NONCE_BYTES);

          case 3:
            nonce = _context3.sent;

            _this._socket.write(nonce);

            return _context3.abrupt('return', nonce);

          case 6:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, _this);
  }));

  this._readDeviceHandshakeData = function (nonce, data) {
    var decryptedHandshakeData = _ICrypto2.default.decrypt(_ICrypto2.default.getServerKeys(), data);

    if (!decryptedHandshakeData) {
      throw new Error('handshake data decryption failed');
    }

    if (decryptedHandshakeData.length < NONCE_BYTES + ID_BYTES) {
      throw new Error('handshake data was too small: ' + decryptedHandshakeData.length);
    }

    var nonceBuffer = new Buffer(NONCE_BYTES);
    var deviceIDBuffer = new Buffer(ID_BYTES);
    var deviceKeyBuffer = new Buffer(decryptedHandshakeData.length - (NONCE_BYTES + ID_BYTES));

    decryptedHandshakeData.copy(nonceBuffer, 0, 0, NONCE_BYTES);
    decryptedHandshakeData.copy(deviceIDBuffer, 0, NONCE_BYTES, NONCE_BYTES + ID_BYTES);
    decryptedHandshakeData.copy(deviceKeyBuffer, 0, NONCE_BYTES + ID_BYTES, decryptedHandshakeData.length);

    if (!_utilities2.default.bufferCompare(nonceBuffer, nonce)) {
      throw new Error('nonces didn\`t match');
    }

    var deviceProvidedPem = _utilities2.default.convertDERtoPEM(deviceKeyBuffer);
    var deviceID = deviceIDBuffer.toString('hex');

    // todo remove stages;
    _this._handshakeStage = 'read-core-id';

    return { deviceID: deviceID, deviceProvidedPem: deviceProvidedPem };
  };

  this._getDevicePublicKey = function () {
    var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(deviceID, deviceProvidedPem) {
      var publicKeyString;
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return _this._deviceKeyRepository.getById(deviceID);

            case 2:
              publicKeyString = _context4.sent;

              if (publicKeyString) {
                _context4.next = 8;
                break;
              }

              if (!deviceProvidedPem) {
                _context4.next = 7;
                break;
              }

              _this._deviceKeyRepository.update(deviceID, deviceProvidedPem);
              return _context4.abrupt('return', _ICrypto2.default.createPublicKey(deviceProvidedPem));

            case 7:
              throw new Error('no public key found for device: ' + deviceID);

            case 8:

              _this._handshakeStage = 'get-core-key';
              return _context4.abrupt('return', _ICrypto2.default.createPublicKey(publicKeyString));

            case 10:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this);
    }));

    return function (_x2, _x3) {
      return _ref5.apply(this, arguments);
    };
  }();

  this._sendSessionKey = function () {
    var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(devicePublicKey) {
      var sessionKey, ciphertext, hash, signedhmac, message, decipherStream, cipherStream, chunkingIn, chunkingOut;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return _ICrypto2.default.getRandomBytes(SESSION_BYTES);

            case 2:
              sessionKey = _context5.sent;


              // Server RSA encrypts this 40-byte message using the Core's public key to
              // create a 128-byte ciphertext.
              ciphertext = _ICrypto2.default.encrypt(devicePublicKey, sessionKey);

              // Server creates a 20-byte HMAC of the ciphertext using SHA1 and the 40
              // bytes generated in the previous step as the HMAC key.

              hash = _ICrypto2.default.createHmacDigest(ciphertext, sessionKey);

              // Server signs the HMAC with its RSA private key generating a 256-byte
              // signature.

              signedhmac = _ICrypto2.default.sign(null, hash);

              //Server sends ~384 bytes to Core: the ciphertext then the signature.

              message = Buffer.concat([ciphertext, signedhmac], ciphertext.length + signedhmac.length);

              _this._socket.write(message);

              decipherStream = _ICrypto2.default.CreateAESDecipherStream(sessionKey);
              cipherStream = _ICrypto2.default.CreateAESCipherStream(sessionKey);


              if (_this._useChunkingStream) {
                chunkingIn = new _ChunkingStream2.default({ outgoing: false });
                chunkingOut = new _ChunkingStream2.default({ outgoing: true });

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

              return _context5.abrupt('return', { cipherStream: cipherStream, decipherStream: decipherStream });

            case 13:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this);
    }));

    return function (_x4) {
      return _ref6.apply(this, arguments);
    };
  }();

  this._onDecipherStreamReadable = function (decipherStream) {
    return new _promise2.default(function (resolve, reject) {
      var callback = function callback() {
        var chunk = decipherStream.read();
        if (_this._handshakeStage === 'send-hello') {
          _this._queueEarlyData(_this._handshakeStage, chunk);
        } else {
          resolve(chunk);
          decipherStream.removeListener('readable', callback);
        }
      };
      decipherStream.on('readable', callback);
    });
  };

  this._queueEarlyData = function (name, data) {
    if (!data) {
      return;
    }
    _this._pendingBuffers.push(data);
    _logger2.default.error('recovering from early data! ', {
      step: name,
      data: data ? data.toString('hex') : data,
      cache_key: _this._client._connectionKey
    });
  };

  this._onDecipherStreamTimeout = function () {
    return new _promise2.default(function (resolve, reject) {
      return setTimeout(function () {
        return reject();
      }, 30 * 1000);
    });
  };

  this._finished = function () {
    _this._handshakeStage = 'done';
  };

  this._handshakeFail = function (message) {
    _this._reject && _this._reject(message);
  };

  this._deviceKeyRepository = deviceKeyRepository;
}

// TODO - Remove this callback once it resolves. When the stream is passed
// into the Device, it should be rebound there to listen for the keep-alive
// pings.

/*
  _flushEarlyData = (): void => {
    if (!this._pendingBuffers) {
      return;
    }

    this._pendingBuffers.map(data => this._routeToClient(data));
    this._pendingBuffers = null;
  }

  _routeToClient = (data: Buffer): void => {
    if (!data) {
      return;
    }
    process.nextTick(() => this._client.routeMessage(data));
  }
*/
;

exports.default = Handshake;