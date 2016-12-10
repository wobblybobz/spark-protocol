'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _fs = require('fs');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
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

var BufferStream = function (_ReadStream) {
  _inherits(BufferStream, _ReadStream);

  function BufferStream(buffer) {
    _classCallCheck(this, BufferStream);

    var _this = _possibleConstructorReturn(this, (BufferStream.__proto__ || Object.getPrototypeOf(BufferStream)).call(this));

    _this._index = 0;

    _this.seek = function (index) {
      _this._index = index;
    };

    _this.read = function (size) {
      if (!_this._buffer) {
        return null;
      }

      var index = _this._index;
      var endIndex = index + size;

      if (endIndex >= _this._buffer.length) {
        endIndex = _this._buffer.length;
      }

      var result = null;
      if (endIndex - index > 0) {
        result = _this._buffer.slice(index, endIndex);
        _this._index = endIndex;
      }

      return result;
    };

    _this.close = function () {
      _this._buffer = null;
    };

    _this._buffer = buffer;
    return _this;
  }

  return BufferStream;
}(_fs.ReadStream);

exports.default = BufferStream;