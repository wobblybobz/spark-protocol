'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _logger = require('./logger.js');

var _logger2 = _interopRequireDefault(_logger);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _xtend = require('xtend');

var _xtend2 = _interopRequireDefault(_xtend);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _settings = require('../settings.js');

var _settings2 = _interopRequireDefault(_settings);

var _ursa = require('ursa');

var _ursa2 = _interopRequireDefault(_ursa);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
*   Copyright (C) 2013-2014 Spark Labs, Inc. All rights reserved. -  https://www.spark.io/
*
*   This file is part of the Spark-protocol module
*
*   This program is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License version 3
*   as published by the Free Software Foundation.
*
*   Spark-protocol is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with Spark-protocol.  If not, see <http://www.gnu.org/licenses/>.
*
*   You can download the source here: https://github.com/spark/spark-protocol
*
* 
*
*/

var utilities = function utilities() {
  (0, _classCallCheck3.default)(this, utilities);
};

utilities.bufferCompare = function (left, right) {
  if (left === null && right === null) {
    return true;
  } else if (left === null || right === null) {
    return false;
  }

  if (!Buffer.isBuffer(left)) {
    left = new Buffer(left);
  }
  if (!Buffer.isBuffer(right)) {
    right = new Buffer(right);
  }

  return Buffer.compare(left, right) == 0;
};

utilities.toHexString = function (value) {
  return (value < 10 ? '0' : '') + value.toString(16);
};

utilities.convertDERtoPEM = function (buffer) {
  if (!buffer || !buffer.length) {
    return null;
  }

  var bufferString = buffer.toString('base64');
  try {
    var lines = ['-----BEGIN PUBLIC KEY-----'].concat((0, _toConsumableArray3.default)(bufferString.match(/.{1,64}/g) || []), ['-----END PUBLIC KEY-----']);
    return lines.join('\n');
  } catch (exception) {
    _logger2.default.error('error converting DER to PEM, was: ' + bufferString + ' ' + exception);
  }
  return null;
};

;

exports.default = utilities;