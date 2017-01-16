'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _class, _temp;

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

var _CryptoStream = require('./CryptoStream');

var _CryptoStream2 = _interopRequireDefault(_CryptoStream);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _ursa = require('ursa');

var _ursa2 = _interopRequireDefault(_ursa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var HASH_TYPE = 'sha1';
var SIGN_TYPE = 'sha256';

var CryptoManager = (_temp = _class = function CryptoManager(deviceKeyRepository, serverKeyRepository) {
  var _this = this;

  (0, _classCallCheck3.default)(this, CryptoManager);

  this._createCryptoStream = function (sessionKey, encrypt) {
    // The first 16 bytes (MSB first) will be the key,
    // the next 16 bytes (MSB first) will be the initialization vector (IV),
    // and the final 8 bytes (MSB first) will be the salt.

    var key = new Buffer(16); //just the key... +8); //key plus salt
    var iv = new Buffer(16); //initialization vector

    sessionKey.copy(key, 0, 0, 16); //copy the key
    sessionKey.copy(iv, 0, 16, 32); //copy the iv

    return new _CryptoStream2.default({ encrypt: encrypt, iv: iv, key: key });
  };

  this._createServerKeys = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
    var privateKey;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            // todo password?
            privateKey = _ursa2.default.generatePrivateKey();
            _context.next = 3;
            return _this._serverKeyRepository.createKeys(privateKey.toPrivatePem('binary'), privateKey.toPublicPem('binary'));

          case 3:
            return _context.abrupt('return', privateKey);

          case 4:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, _this);
  }));
  this._getServerPrivateKey = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
    var privateKeyString;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (_this._privateServerKey) {
              _context2.next = 9;
              break;
            }

            _context2.next = 3;
            return _this._serverKeyRepository.getPrivateKey();

          case 3:
            privateKeyString = _context2.sent;

            if (privateKeyString) {
              _context2.next = 8;
              break;
            }

            _context2.next = 7;
            return _this._createServerKeys();

          case 7:
            return _context2.abrupt('return', _context2.sent);

          case 8:

            _this._privateServerKey = _ursa2.default.createPrivateKey(privateKeyString,
            // todo password?
            /* password */undefined);

          case 9:
            return _context2.abrupt('return', _this._privateServerKey);

          case 10:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, _this);
  }));

  this.createAESCipherStream = function (sessionKey) {
    return _this._createCryptoStream(sessionKey, true);
  };

  this.createAESDecipherStream = function (sessionKey) {
    return _this._createCryptoStream(sessionKey, false);
  };

  this.createHmacDigest = function (ciphertext, sessionKey) {
    var hmac = _crypto2.default.createHmac(HASH_TYPE, sessionKey);
    hmac.update(ciphertext);
    return hmac.digest();
  };

  this.createDevicePublicKey = function () {
    var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(deviceID, publicKeyPem) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _context3.next = 2;
              return _this._deviceKeyRepository.update(deviceID, publicKeyPem);

            case 2:
              return _context3.abrupt('return', _ursa2.default.createPublicKey(publicKeyPem));

            case 3:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this);
    }));

    return function (_x, _x2) {
      return _ref3.apply(this, arguments);
    };
  }();

  this.decrypt = function () {
    var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(data) {
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return _this._getServerPrivateKey();

            case 2:
              _context4.t0 = data;
              _context4.t1 =
              /* input buffer encoding */undefined;
              _context4.t2 =
              /* output buffer encoding*/undefined;
              _context4.t3 = _ursa2.default.RSA_PKCS1_PADDING;
              return _context4.abrupt('return', _context4.sent.decrypt(_context4.t0, _context4.t1, _context4.t2, _context4.t3));

            case 7:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this);
    }));

    return function (_x3) {
      return _ref4.apply(this, arguments);
    };
  }();

  this.encrypt = function (publicKey, data) {
    return publicKey.encrypt(data,
    /* input buffer encoding */undefined,
    /* output buffer encoding*/undefined, _ursa2.default.RSA_PKCS1_PADDING);
  };

  this.getDevicePublicKey = function () {
    var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(deviceID) {
      var publicKeyString;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              _context5.next = 2;
              return _this._deviceKeyRepository.getById(deviceID);

            case 2:
              publicKeyString = _context5.sent;

              if (publicKeyString) {
                _context5.next = 5;
                break;
              }

              return _context5.abrupt('return', null);

            case 5:
              return _context5.abrupt('return', _ursa2.default.createPublicKey(publicKeyString));

            case 6:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this);
    }));

    return function (_x4) {
      return _ref5.apply(this, arguments);
    };
  }();

  this.getRandomBytes = function (size) {
    return new _promise2.default(function (resolve, reject) {
      _crypto2.default.randomBytes(size, function (error, buffer) {
        if (error) {
          reject(error);
          return;
        }

        resolve(buffer);
      });
    });
  };

  this.sign = function () {
    var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(hash) {
      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              _context6.next = 2;
              return _this._getServerPrivateKey();

            case 2:
              _context6.t0 = hash;
              return _context6.abrupt('return', _context6.sent.privateEncrypt(_context6.t0));

            case 4:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this);
    }));

    return function (_x5) {
      return _ref6.apply(this, arguments);
    };
  }();

  this._deviceKeyRepository = deviceKeyRepository;
  this._serverKeyRepository = serverKeyRepository;
}, _class.getRandomUINT16 = function () {
  var uintMax = Math.pow(2, 16) - 1;
  return Math.floor(Math.random() * uintMax + 1);
}, _temp);
exports.default = CryptoManager;