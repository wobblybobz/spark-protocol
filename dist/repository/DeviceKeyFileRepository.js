'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _FileManager = require('./FileManager');

var _FileManager2 = _interopRequireDefault(_FileManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FILE_EXTENSION = '.pub.pem';

var DeviceKeyFileRepository = function () {
  function DeviceKeyFileRepository(path) {
    (0, _classCallCheck3.default)(this, DeviceKeyFileRepository);

    this._fileManager = new _FileManager2.default(path);
  }

  (0, _createClass3.default)(DeviceKeyFileRepository, [{
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
      return _promise2.default.resolve(this._fileManager.getFile(id + FILE_EXTENSION));
    }
  }]);
  return DeviceKeyFileRepository;
}();

exports.default = DeviceKeyFileRepository;