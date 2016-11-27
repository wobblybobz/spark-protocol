'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _FileManager = require('./FileManager');

var _FileManager2 = _interopRequireDefault(_FileManager);

var _uuid = require('../lib/uuid');

var _uuid2 = _interopRequireDefault(_uuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DeviceFileRepository = function () {
  function DeviceFileRepository(path) {
    _classCallCheck(this, DeviceFileRepository);

    this._fileManager = new _FileManager2.default(path);
  }

  _createClass(DeviceFileRepository, [{
    key: 'create',
    value: function create(id, model) {
      var modelToSave = _extends({}, model, {
        timestamp: new Date()
      });

      this._fileManager.createFile(id + '.json', modelToSave);
      return modelToSave;
    }
  }, {
    key: 'update',
    value: function update(id, model) {
      var modelToSave = _extends({}, model, {
        timestamp: new Date()
      });

      this._fileManager.writeFile(id + '.json', model);
      return modelToSave;
    }
  }, {
    key: 'delete',
    value: function _delete(id) {
      this._fileManager.deleteFile(id + '.json');
    }
  }, {
    key: 'getAll',
    value: function getAll() {
      return this._fileManager.getAllData();
    }
  }, {
    key: 'getById',
    value: function getById(id) {
      return this._fileManager.getFile(id + '.json');
    }
  }]);

  return DeviceFileRepository;
}();

exports.default = DeviceFileRepository;