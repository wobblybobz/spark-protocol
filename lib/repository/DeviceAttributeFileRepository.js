'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _JSONFileManager = require('./JSONFileManager');

var _JSONFileManager2 = _interopRequireDefault(_JSONFileManager);

var _uuid = require('../lib/uuid');

var _uuid2 = _interopRequireDefault(_uuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DeviceAttributeFileRepository = function () {
  function DeviceAttributeFileRepository(path) {
    _classCallCheck(this, DeviceAttributeFileRepository);

    this._fileManager = new _JSONFileManager2.default(path);
  }

  _createClass(DeviceAttributeFileRepository, [{
    key: 'create',
    value: function create(model) {
      var modelToSave = _extends({}, model, {
        timestamp: new Date()
      });

      this._fileManager.createFile(model.deviceID + '.json', modelToSave);
      return modelToSave;
    }
  }, {
    key: 'update',
    value: function update(model) {
      var modelToSave = _extends({}, model, {
        timestamp: new Date()
      });

      this._fileManager.writeFile(model.deviceID + '.json', modelToSave);
      return modelToSave;
    }
  }, {
    key: 'delete',
    value: function _delete(id) {
      this._fileManager.deleteFile(id + '.json');
    }
  }, {
    key: 'getAll',
    value: function getAll(userID) {
      var allData = this._fileManager.getAllData();

      if (userID) {
        return allData.filter(function (attributes) {
          return attributes.ownerID === userID;
        });
      }
      return allData;
    }
  }, {
    key: 'getById',
    value: function getById(id, userID) {
      var attributes = this._fileManager.getFile(id + '.json');
      if (userID) {
        return attributes && attributes.ownerID === userID ? attributes : null;
      }
      return attributes;
    }
  }]);

  return DeviceAttributeFileRepository;
}();

exports.default = DeviceAttributeFileRepository;