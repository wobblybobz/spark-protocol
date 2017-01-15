'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = function (getDataSelector) {
  return function (target, name, descriptor) {
    var descriptorFunction = descriptor.value;

    descriptor.value = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee() {
      var args,
          data,
          _args = arguments;
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              args = _args;
              data = getDataSelector.apply(undefined, (0, _toConsumableArray3.default)(args));

              target._caches.forEach(function (cache) {
                var _cache$memoized;

                return cache.selectKeys ? (_cache$memoized = cache.memoized).delete.apply(_cache$memoized, (0, _toConsumableArray3.default)(cache.selectKeys(data))) : cache.memoized.delete();
              });
              _context.next = 5;
              return descriptorFunction.call.apply(descriptorFunction, [this].concat((0, _toConsumableArray3.default)(args)));

            case 5:
              return _context.abrupt('return', _context.sent);

            case 6:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, this);
    }));
    return descriptor;
  };
};