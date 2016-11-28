'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _ursa = require('ursa');

var _ursa2 = _interopRequireDefault(_ursa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ServerConfigFileRepository = function () {
  function ServerConfigFileRepository(serverKeyFileName) {
    _classCallCheck(this, ServerConfigFileRepository);

    this._serverKeyFileName = serverKeyFileName;
  }

  _createClass(ServerConfigFileRepository, [{
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