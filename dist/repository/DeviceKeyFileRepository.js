'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _FileManager = require('./FileManager');

var _FileManager2 = _interopRequireDefault(_FileManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FILE_EXTENSION = '.pub.pem';

var DeviceKeyFileRepository = function DeviceKeyFileRepository(path) {
  var _this = this;

  (0, _classCallCheck3.default)(this, DeviceKeyFileRepository);

  this.create = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(id, data) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              _this._fileManager.createFile(id + FILE_EXTENSION, data);
              return _context.abrupt('return', data);

            case 2:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this);
    }));

    return function (_x, _x2) {
      return _ref.apply(this, arguments);
    };
  }();

  this.update = function () {
    var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(id, data) {
      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              _this._fileManager.writeFile(id + FILE_EXTENSION, data);
              return _context2.abrupt('return', data);

            case 2:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this);
    }));

    return function (_x3, _x4) {
      return _ref2.apply(this, arguments);
    };
  }();

  this.delete = function () {
    var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(id) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              return _context3.abrupt('return', _this._fileManager.deleteFile(id + FILE_EXTENSION));

            case 1:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this);
    }));

    return function (_x5) {
      return _ref3.apply(this, arguments);
    };
  }();

  this.getAll = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4() {
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            return _context4.abrupt('return', _this._fileManager.getAllData());

          case 1:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, _this);
  }));

  this.getById = function () {
    var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(id) {
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              return _context5.abrupt('return', _this._fileManager.getFile(id + FILE_EXTENSION));

            case 1:
            case 'end':
              return _context5.stop();
          }
        }
      }, _callee5, _this);
    }));

    return function (_x6) {
      return _ref5.apply(this, arguments);
    };
  }();

  this._fileManager = new _FileManager2.default(path);
};

exports.default = DeviceKeyFileRepository;