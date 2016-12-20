'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FileManager = function () {
  function FileManager(path) {
    var isJSON = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    _classCallCheck(this, FileManager);

    this._path = path;
    this._isJSON = isJSON;
    if (!_fs2.default.existsSync(path)) {
      _mkdirp2.default.sync(path);
    }
  }

  _createClass(FileManager, [{
    key: 'createFile',
    value: function createFile(fileName, data) {
      if (_fs2.default.existsSync(_path2.default.join(this._path, fileName))) {
        return;
      }

      this.writeFile(fileName, data);
    }
  }, {
    key: 'deleteFile',
    value: function deleteFile(fileName) {
      var filePath = _path2.default.join(this._path, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return;
      }

      _fs2.default.unlink(filePath);
    }
  }, {
    key: 'getAllData',
    value: function getAllData() {
      var _this = this;

      return _fs2.default.readdirSync(this._path).filter(function (fileName) {
        return fileName.endsWith('.json');
      }).map(function (fileName) {
        return _fs2.default.readFileSync(_path2.default.join(_this._path, fileName), 'utf8');
      });
    }
  }, {
    key: 'getFile',
    value: function getFile(fileName) {
      var filePath = _path2.default.join(this._path, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return null;
      }

      return _fs2.default.readFileSync(filePath, 'utf8');
    }
  }, {
    key: 'getFileBuffer',
    value: function getFileBuffer(fileName) {
      var filePath = _path2.default.join(this._path, fileName);
      if (!_fs2.default.existsSync(filePath)) {
        return null;
      }

      return _fs2.default.readFileSync(filePath);
    }
  }, {
    key: 'writeFile',
    value: function writeFile(fileName, data) {
      _fs2.default.writeFileSync(_path2.default.join(this._path, fileName), data);
    }
  }]);

  return FileManager;
}();

exports.default = FileManager;