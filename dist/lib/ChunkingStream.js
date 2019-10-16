'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _stream = require('stream');

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 *   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
 *
 *   This program is free software; you can redistribute it and/or
 *   modify it under the terms of the GNU Lesser General Public
 *   License as published by the Free Software Foundation, either
 *   version 3 of the License, or (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *   Lesser General Public License for more details.
 *
 *   You should have received a copy of the GNU Lesser General Public
 *   License along with this program; if not, see <http://www.gnu.org/licenses/>.
 *
 * 
 *
 */

var logger = _logger2.default.createModuleLogger(module);

/**
 Our job here is to accept messages in whole chunks, and put their length in front
 as we send them out, and parse them back into those size chunks as we read them in.
 **/
/* eslint-disable no-bitwise */

var MSG_LENGTH_BYTES = 2;
var messageLengthBytes = function messageLengthBytes(message) {
  // assuming a maximum encrypted message length of 65K, lets write an
  // unsigned short int before every message, so we know how much to read out.
  var length = message.length;
  var lengthBuffer = new Buffer(MSG_LENGTH_BYTES);

  lengthBuffer[0] = length >>> 8;
  lengthBuffer[1] = length & 255;

  return lengthBuffer;
};

var ChunkingStream = function (_Transform) {
  (0, _inherits3.default)(ChunkingStream, _Transform);

  function ChunkingStream(options) {
    (0, _classCallCheck3.default)(this, ChunkingStream);

    var _this = (0, _possibleConstructorReturn3.default)(this, (ChunkingStream.__proto__ || (0, _getPrototypeOf2.default)(ChunkingStream)).call(this));

    _this._combinedBuffer = null;
    _this._currentOffset = 0;

    _this._processOutput = function (buffer, encoding, callback) {
      var lengthChunk = messageLengthBytes(buffer);
      _this.push(Buffer.concat(lengthChunk ? [lengthChunk, buffer] : [buffer]));
      process.nextTick(callback);
    };

    _this._processInput = function (buffer, encoding, callback) {
      try {
        var copyStart = 0;
        if (_this._combinedBuffer === null) {
          var expectedLength = (buffer[0] << 8) + buffer[1];
          _this._combinedBuffer = Buffer.alloc(expectedLength);
          _this._currentOffset = 0;
          copyStart = 2;
        }

        var copyEnd = Math.min(buffer.length, _this._combinedBuffer.length - _this._currentOffset + copyStart);

        _this._currentOffset += buffer.copy(_this._combinedBuffer, _this._currentOffset, copyStart, copyEnd);

        if (_this._currentOffset !== _this._combinedBuffer.length) {
          process.nextTick(callback);
          return;
        }

        _this.push(_this._combinedBuffer);
        _this._combinedBuffer = null;

        if (buffer.length <= copyEnd) {
          process.nextTick(callback);
          return;
        }

        var remainder = buffer.slice(copyEnd);
        process.nextTick(function () {
          return _this._processInput(remainder, encoding, callback);
        });
      } catch (error) {
        logger.error({ err: error }, 'ChunkingStream error!');
        process.nextTick(callback);
      }
    };

    _this._transform = options.outgoing === true ? _this._processOutput : _this._processInput;
    return _this;
  }

  return ChunkingStream;
}(_stream.Transform);

exports.default = ChunkingStream;