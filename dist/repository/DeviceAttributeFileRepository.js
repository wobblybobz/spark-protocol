'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _JSONFileManager = require('./JSONFileManager');

var _JSONFileManager2 = _interopRequireDefault(_JSONFileManager);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DeviceAttributeFileRepository = function DeviceAttributeFileRepository(path) {
  var _this = this;

  (0, _classCallCheck3.default)(this, DeviceAttributeFileRepository);

  this.create = function () {
    var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(model) {
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              throw new Error('Create device attributes not implemented');

            case 1:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, _this);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();

  this.update = function () {
    var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(model) {
      var modelToSave;
      return _regenerator2.default.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              modelToSave = (0, _extends3.default)({}, model, {
                timestamp: new Date()
              });


              _this._fileManager.writeFile(model.deviceID + '.json', modelToSave);
              return _context2.abrupt('return', modelToSave);

            case 3:
            case 'end':
              return _context2.stop();
          }
        }
      }, _callee2, _this);
    }));

    return function (_x2) {
      return _ref2.apply(this, arguments);
    };
  }();

  this.deleteById = function () {
    var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(id) {
      return _regenerator2.default.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              _this._fileManager.deleteFile(id + '.json');

            case 1:
            case 'end':
              return _context3.stop();
          }
        }
      }, _callee3, _this);
    }));

    return function (_x3) {
      return _ref3.apply(this, arguments);
    };
  }();

  this.doesUserHaveAccess = function () {
    var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4(id, userID) {
      return _regenerator2.default.wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              _context4.next = 2;
              return _this.getById(id, userID);

            case 2:
              return _context4.abrupt('return', !!_context4.sent);

            case 3:
            case 'end':
              return _context4.stop();
          }
        }
      }, _callee4, _this);
    }));

    return function (_x4, _x5) {
      return _ref4.apply(this, arguments);
    };
  }();

  this.getAll = function () {
    var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5() {
      var userID = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
      var allData;
      return _regenerator2.default.wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              allData = _this._fileManager.getAllData();

              if (!userID) {
                _context5.next = 3;
                break;
              }

              return _context5.abrupt('return', _promise2.default.resolve(allData.filter(function (attributes) {
                return attributes.ownerID === userID;
              })));

            case 3:
              return _context5.abrupt('return', allData);

            case 4:
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

  this.getById = function () {
    var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6(id) {
      var userID = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      var attributes, ownerID;
      return _regenerator2.default.wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              attributes = _this._fileManager.getFile(id + '.json');

              if (!userID) {
                _context6.next = 7;
                break;
              }

              if (attributes) {
                _context6.next = 4;
                break;
              }

              return _context6.abrupt('return', null);

            case 4:
              ownerID = attributes.ownerID;

              if (!(!ownerID || ownerID !== userID)) {
                _context6.next = 7;
                break;
              }

              return _context6.abrupt('return', null);

            case 7:
              return _context6.abrupt('return', attributes);

            case 8:
            case 'end':
              return _context6.stop();
          }
        }
      }, _callee6, _this);
    }));

    return function (_x8, _x9) {
      return _ref6.apply(this, arguments);
    };
  }();

  this._fileManager = new _JSONFileManager2.default(path);
};

exports.default = DeviceAttributeFileRepository;