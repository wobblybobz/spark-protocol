'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _ursa = require('ursa');

var _ursa2 = _interopRequireDefault(_ursa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ServerConfigFileRepository = function () {
  function ServerConfigFileRepository(serverKeyFileName) {
    (0, _classCallCheck3.default)(this, ServerConfigFileRepository);

    this._serverKeyFileName = serverKeyFileName;
  }

  (0, _createClass3.default)(ServerConfigFileRepository, [{
    key: 'setupKeys',
    value: function setupKeys() {
      //
      //  Load the provided key, or generate one
      //
      if (!this._serverKeyFileName) {
        console.log('_serverKeyFileName does not exist');
        return;
      }
      if (_fs2.default.existsSync(this._serverKeyFileName)) {
        return;
      }

      console.warn("Creating NEW server key");
      var keys = _ursa2.default.generatePrivateKey();

      var extIdx = this._serverKeyFileName.lastIndexOf(".");
      var derFilename = this._serverKeyFileName.substring(0, extIdx) + ".der";
      var pubPemFilename = this._serverKeyFileName.substring(0, extIdx) + ".pub.pem";

      _fs2.default.writeFileSync(this._serverKeyFileName, keys.toPrivatePem('binary'));
      _fs2.default.writeFileSync(pubPemFilename, keys.toPublicPem('binary'));

      //DER FORMATTED KEY for the core hardware
      //TODO: fs.writeFileSync(derFilename, keys.toPrivatePem('binary'));
    }
  }]);
  return ServerConfigFileRepository;
}();

exports.default = ServerConfigFileRepository;