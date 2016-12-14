'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _JSONFileManager = require('./JSONFileManager');

var _JSONFileManager2 = _interopRequireDefault(_JSONFileManager);

var _uuid = require('../lib/uuid');

var _uuid2 = _interopRequireDefault(_uuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DeviceAttributeFileRepository = function DeviceAttributeFileRepository(path) {
  var _this = this;

  _classCallCheck(this, DeviceAttributeFileRepository);

  this.create = function (model) {
    throw new Error('Create device attributes not implemented');
  };

  this.update = function (model) {
    var modelToSave = _extends({}, model, {
      timestamp: new Date()
    });

    _this._fileManager.writeFile(model.deviceID + '.json', modelToSave);
    return Promise.resolve(modelToSave);
  };

  this.deleteById = function (id) {
    _this._fileManager.deleteFile(id + '.json');
    return Promise.resolve();
  };

  this.getAll = function (userID) {
    var allData = _this._fileManager.getAllData();

    if (userID) {
      return Promise.resolve(allData.filter(function (attributes) {
        return attributes.ownerID === userID;
      }));
    }
    return Promise.resolve(allData);
  };

  this.getById = function (id, userID) {
    var attributes = _this._fileManager.getFile(id + '.json');
    if (userID) {
      if (!attributes) {
        return Promise.resolve();
      }

      var ownerID = attributes.ownerID;
      if (!ownerID || ownerID !== userID) {
        return Promise.resolve();
      }
    }

    return Promise.resolve(attributes);
  };

  this._fileManager = new _JSONFileManager2.default(path);
};

exports.default = DeviceAttributeFileRepository;