'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _get2 = require('babel-runtime/helpers/get');

var _get3 = _interopRequireDefault(_get2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _FileManager2 = require('./FileManager');

var _FileManager3 = _interopRequireDefault(_FileManager2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var JSONFileManager = function (_FileManager) {
  (0, _inherits3.default)(JSONFileManager, _FileManager);

  function JSONFileManager() {
    (0, _classCallCheck3.default)(this, JSONFileManager);
    return (0, _possibleConstructorReturn3.default)(this, (JSONFileManager.__proto__ || (0, _getPrototypeOf2.default)(JSONFileManager)).apply(this, arguments));
  }

  (0, _createClass3.default)(JSONFileManager, [{
    key: 'createFile',
    value: function createFile(fileName, model) {
      (0, _get3.default)(JSONFileManager.prototype.__proto__ || (0, _getPrototypeOf2.default)(JSONFileManager.prototype), 'writeFile', this).call(this, fileName, (0, _stringify2.default)(model, null, 2));
    }
  }, {
    key: 'getAllData',
    value: function getAllData() {
      return (0, _get3.default)(JSONFileManager.prototype.__proto__ || (0, _getPrototypeOf2.default)(JSONFileManager.prototype), 'getAllData', this).call(this).map(function (data) {
        return JSON.parse(data);
      });
    }
  }, {
    key: 'getFile',
    value: function getFile(fileName) {
      var data = (0, _get3.default)(JSONFileManager.prototype.__proto__ || (0, _getPrototypeOf2.default)(JSONFileManager.prototype), 'getFile', this).call(this, fileName);
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    }
  }, {
    key: 'writeFile',
    value: function writeFile(fileName, model) {
      return (0, _get3.default)(JSONFileManager.prototype.__proto__ || (0, _getPrototypeOf2.default)(JSONFileManager.prototype), 'writeFile', this).call(this, fileName, (0, _stringify2.default)(model, null, 2));
    }
  }]);
  return JSONFileManager;
}(_FileManager3.default);

exports.default = JSONFileManager;