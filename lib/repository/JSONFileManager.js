'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _FileManager2 = require('./FileManager');

var _FileManager3 = _interopRequireDefault(_FileManager2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var JSONFileManager = function (_FileManager) {
  _inherits(JSONFileManager, _FileManager);

  function JSONFileManager() {
    _classCallCheck(this, JSONFileManager);

    return _possibleConstructorReturn(this, (JSONFileManager.__proto__ || Object.getPrototypeOf(JSONFileManager)).apply(this, arguments));
  }

  _createClass(JSONFileManager, [{
    key: 'createFile',
    value: function createFile(fileName, model) {
      _get(JSONFileManager.prototype.__proto__ || Object.getPrototypeOf(JSONFileManager.prototype), 'writeFile', this).call(this, fileName, JSON.stringify(model, null, 2));
    }
  }, {
    key: 'getAllData',
    value: function getAllData() {
      return _get(JSONFileManager.prototype.__proto__ || Object.getPrototypeOf(JSONFileManager.prototype), 'getAllData', this).call(this).map(function (data) {
        return JSON.parse(data);
      });
    }
  }, {
    key: 'getFile',
    value: function getFile(fileName) {
      var data = _get(JSONFileManager.prototype.__proto__ || Object.getPrototypeOf(JSONFileManager.prototype), 'getFile', this).call(this, fileName);
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    }
  }, {
    key: 'writeFile',
    value: function writeFile(fileName, model) {
      return _get(JSONFileManager.prototype.__proto__ || Object.getPrototypeOf(JSONFileManager.prototype), 'writeFile', this).call(this, fileName, JSON.stringify(model, null, 2));
    }
  }]);

  return JSONFileManager;
}(_FileManager3.default);

exports.default = JSONFileManager;