'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _FileManager = require('./FileManager');

var _FileManager2 = _interopRequireDefault(_FileManager);

var _uuid = require('../lib/uuid');

var _uuid2 = _interopRequireDefault(_uuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var FILE_EXTENSION = '.pub.pem';

var DeviceKeyFileRepository = function () {
  function DeviceKeyFileRepository(path) {
    _classCallCheck(this, DeviceKeyFileRepository);

    this._fileManager = new _FileManager2.default(path);
  }

  _createClass(DeviceKeyFileRepository, [{
    key: 'create',
    value: function create(id, data) {
      this._fileManager.createFile(id + FILE_EXTENSION, data);
      return data;
    }
  }, {
    key: 'update',
    value: function update(id, data) {
      this._fileManager.writeFile(id + FILE_EXTENSION, data);
      return data;
    }
  }, {
    key: 'delete',
    value: function _delete(id) {
      this._fileManager.deleteFile(id + FILE_EXTENSION);
    }
  }, {
    key: 'getAll',
    value: function getAll() {
      return this._fileManager.getAllData();
    }
  }, {
    key: 'getById',
    value: function getById(id) {
      return this._fileManager.getFile(id + FILE_EXTENSION);
    }
  }]);

  return DeviceKeyFileRepository;
}();

exports.default = DeviceKeyFileRepository;