'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

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

var utilities = {
  /**
   * Surely there is a better way to do this.
   * NOTE! This function does NOT short-circuit when an in-equality is detected.  This is
   * to avoid timing attacks.
   * @param left
   * @param right
   */
  bufferCompare: function bufferCompare(left, right) {
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

    //logger.log('left: ', left.toString('hex'), ' right: ', right.toString('hex'));

    return Buffer.compare(left, right) == 0;
  },

  /**
   * Iterates over the properties of the right object, checking to make
   * sure the properties on the left object match.
   * @param left
   * @param right
   */
  leftHasRightFilter: function leftHasRightFilter(left, right) {
    if (!left && !right) {
      return true;
    }

    for (var prop in right) {
      if (!right.hasOwnProperty(prop)) {
        continue;
      }
      if (left[prop] !== right[prop]) {
        return false;
      }
    }

    return true;
  },

  readBuffer: function readBuffer(fileName) {
    if (!_fs2.default.existsSync(fileName)) {
      throw Error('File does not exist', fileName);
    }

    return _fs2.default.readFileSync(fileName);
  },

  toHexString: function toHexString(value) {
    return (value < 10 ? '0' : '') + value.toString(16);
  },

  getFilenameExt: function getFilenameExt(fileName) {
    if (!fileName || !fileName.length) {
      return fileName;
    }

    var index = fileName.lastIndexOf('.');
    if (index >= 0) {
      return fileName.substr(index);
    } else {
      return fileName;
    }
  },

  filenameNoExt: function filenameNoExt(fileName) {
    if (!fileName || fileName.length === 0) {
      return fileName;
    }

    var index = fileName.lastIndexOf('.');
    if (index >= 0) {
      return fileName.substr(0, index);
    } else {
      return fileName;
    }
  },

  get_core_key: function get_core_key(coreId) {
    var keyFile = _path2.default.join(global.settings && global.settings.coreKeysDir || _settings2.default.coreKeysDir, coreId + '.pub.pem');
    if (!_fs2.default.existsSync(keyFile)) {
      throw 'Expected to find public key for core ' + coreId + ' at ' + keyFile;
    }
    var keyStr = _fs2.default.readFileSync(keyFile).toString();
    return _ursa2.default.createPublicKey(keyStr, 'binary');
  },

  save_handshake_key: function save_handshake_key(coreId, pem) {
    var keyFile = _path2.default.join(global.settings && global.settings.coreKeysDir || _settings2.default.coreKeysDir, coreId + '_handshake.pub.pem');
    if (_fs2.default.existsSync(keyFile)) {
      return;
    }

    _logger2.default.log('I saved a key given during the handshake, (remove the _handshake ' + 'from the filename to accept this device)', keyFile);
    _fs2.default.writeFileSync(keyFile, pem);
  },

  /**
  * base64 encodes raw binary into
  * "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT1M+s9HTs75DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeejEJQCe6JReTQlq9F6bioK84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0DR7ECODgxc/r5+XFh9wIDAQAB"
  * then formats into PEM format:
  *
  * //-----BEGIN PUBLIC KEY-----
  * //MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT
  * //1M+s9HTs75DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeej
  * //EJQCe6JReTQlq9F6bioK84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0D
  * //R7ECODgxc/r5+XFh9wIDAQAB
  * //-----END PUBLIC KEY-----
  *
  * @param buf
  * @returns {*}
  */
  convertDERtoPEM: function convertDERtoPEM(buffer) {
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
  },

  foo: null
};

exports.default = utilities;