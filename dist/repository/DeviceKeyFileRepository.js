'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getOwnPropertyDescriptor = require('babel-runtime/core-js/object/get-own-property-descriptor');

var _getOwnPropertyDescriptor2 = _interopRequireDefault(_getOwnPropertyDescriptor);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _dec, _dec2, _dec3, _dec4, _dec5, _desc, _value, _class;

var _FileManager = require('./FileManager');

var _FileManager2 = _interopRequireDefault(_FileManager);

var _memoizeGet = require('../decorators/memoizeGet');

var _memoizeGet2 = _interopRequireDefault(_memoizeGet);

var _memoizeSet = require('../decorators/memoizeSet');

var _memoizeSet2 = _interopRequireDefault(_memoizeSet);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object['ke' + 'ys'](descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object['define' + 'Property'](target, property, desc);
    desc = null;
  }

  return desc;
}

var FILE_EXTENSION = '.pub.pem';

var DeviceKeyFileRepository = (_dec = (0, _memoizeSet2.default)(), _dec2 = (0, _memoizeSet2.default)(), _dec3 = (0, _memoizeSet2.default)(['id']), _dec4 = (0, _memoizeGet2.default)(), _dec5 = (0, _memoizeGet2.default)(['id']), (_class = function () {
  function DeviceKeyFileRepository(path) {
    (0, _classCallCheck3.default)(this, DeviceKeyFileRepository);

    this._fileManager = new _FileManager2.default(path);
  }

  (0, _createClass3.default)(DeviceKeyFileRepository, [{
    key: 'create',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(id, data) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                this._fileManager.createFile(id + FILE_EXTENSION, data);
                return _context.abrupt('return', data);

              case 2:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function create(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return create;
    }()
  }, {
    key: 'update',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2(id, data) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                this._fileManager.writeFile(id + FILE_EXTENSION, data);
                return _context2.abrupt('return', data);

              case 2:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function update(_x3, _x4) {
        return _ref2.apply(this, arguments);
      }

      return update;
    }()
  }, {
    key: 'delete',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(id) {
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                this._fileManager.deleteFile(id + FILE_EXTENSION);

              case 1:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function _delete(_x5) {
        return _ref3.apply(this, arguments);
      }

      return _delete;
    }()
  }, {
    key: 'getAll',
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4() {
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                return _context4.abrupt('return', this._fileManager.getAllData());

              case 1:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function getAll() {
        return _ref4.apply(this, arguments);
      }

      return getAll;
    }()
  }, {
    key: 'getById',
    value: function () {
      var _ref5 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(id) {
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt('return', this._fileManager.getFile(id + FILE_EXTENSION));

              case 1:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getById(_x6) {
        return _ref5.apply(this, arguments);
      }

      return getById;
    }()
  }]);
  return DeviceKeyFileRepository;
}(), (_applyDecoratedDescriptor(_class.prototype, 'create', [_dec], (0, _getOwnPropertyDescriptor2.default)(_class.prototype, 'create'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'update', [_dec2], (0, _getOwnPropertyDescriptor2.default)(_class.prototype, 'update'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'delete', [_dec3], (0, _getOwnPropertyDescriptor2.default)(_class.prototype, 'delete'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'getAll', [_dec4], (0, _getOwnPropertyDescriptor2.default)(_class.prototype, 'getAll'), _class.prototype), _applyDecoratedDescriptor(_class.prototype, 'getById', [_dec5], (0, _getOwnPropertyDescriptor2.default)(_class.prototype, 'getById'), _class.prototype)), _class));
exports.default = DeviceKeyFileRepository;