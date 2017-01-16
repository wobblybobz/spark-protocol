'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _memoizee = require('memoizee');

var _memoizee2 = _interopRequireDefault(_memoizee);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_MAX_AGE = 3600 * 1000; // 1 hour
var DEFAULT_PARAMETERS = {
  promise: true,
  maxAge: DEFAULT_MAX_AGE
};

/* eslint-disable no-param-reassign */

exports.default = function () {
  var keys = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  return function (target, name, descriptor) {
    var formattedKeys = keys.map(function (key) {
      return key.replace('?', '');
    });
    var keySets = keys.map(function (key, index) {
      if (!key.startsWith('?')) {
        return null;
      }

      return formattedKeys.slice(0, index);
    }).filter(function (item) {
      return item;
    }).concat([formattedKeys]);

    var descriptorFunction = descriptor.value;
    var memoized = (0, _memoizee2.default)(descriptorFunction, (0, _extends3.default)({}, DEFAULT_PARAMETERS, config));
    descriptor.value = memoized;
    if (!target._caches) {
      target._caches = [];
    }
    target._caches.push({
      fnName: descriptorFunction.name,
      memoized: memoized,
      keySets: keySets
    });
    return descriptor;
  };
};