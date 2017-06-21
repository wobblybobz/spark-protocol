'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _ecKey = require('ec-key');

var _ecKey2 = _interopRequireDefault(_ecKey);

var _nodeRsa = require('node-rsa');

var _nodeRsa2 = _interopRequireDefault(_nodeRsa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DeviceKey = function () {
  function DeviceKey(algorithm, pemString) {
    (0, _classCallCheck3.default)(this, DeviceKey);

    switch (algorithm) {
      case 'ecc':
        {
          this._ecKey = new _ecKey2.default(pemString, 'pem');
          break;
        }

      case 'rsa':
        {
          this._nodeRsa = new _nodeRsa2.default(pemString, 'pkcs8-public-pem', {
            encryptionScheme: 'pkcs1',
            signingScheme: 'pkcs1'
          });
          break;
        }

      default:
        {
          throw new Error('Key not implemented', algorithm);
        }
    }
  }

  (0, _createClass3.default)(DeviceKey, [{
    key: 'encrypt',
    value: function encrypt(data) {
      if (this._nodeRsa) {
        return this._nodeRsa.encrypt(data);
      } else if (this._ecKey) {
        return this._ecKey.createSign('SHA256').update(data).sign();
      }

      throw new Error('Key not implemented', data);
    }
  }, {
    key: 'equals',
    value: function equals(publicKeyPem) {
      if (!publicKeyPem) {
        return false;
      }

      if (this._nodeRsa) {
        console.log(this._nodeRsa.exportKey('pkcs1-public-pem'));
        console.log(this._nodeRsa.exportKey('pkcs8-public-pem'));
        console.log(publicKeyPem);
        return this._nodeRsa.exportKey('pkcs8-public-pem') === publicKeyPem;
      } else if (this._ecKey) {
        return this._ecKey.toString('pem') === publicKeyPem;
      }

      return false;
    }
  }]);
  return DeviceKey;
}();

exports.default = DeviceKey;