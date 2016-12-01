'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }(); /*
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

var _h = require('h5.coap');

var _hogan = require('hogan.js');

var _hogan2 = _interopRequireDefault(_hogan);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// TODO: Check firmware and make sure everything is mapped here
var MessageSpecifications = [['Hello', {
  code: _h.Message.Code.POST,
  Response: 'Hello',
  type: _h.Message.Type.NON,
  uri: 'h'
}], ['KeyChange', {
  code: _h.Message.Code.PUT,
  Response: 'KeyChanged',
  type: _h.Message.Type.CON,
  uri: 'k'
}], ['UpdateBegin', {
  code: _h.Message.Code.POST,
  Response: 'UpdateReady',
  type: _h.Message.Type.CON,
  uri: 'u'
}], ['Chunk', {
  code: _h.Message.Code.POST,
  Response: 'ChunkReceived',
  type: _h.Message.Type.CON,
  uri: 'c?{{{crc}}}'
}], ['ChunkMissed', {
  code: _h.Message.Code.GET,
  Response: 'ChunkMissedAck',
  type: _h.Message.Type.CON,
  uri: 'c'
}], ['UpdateDone', {
  code: _h.Message.Code.PUT,
  Response: null,
  type: _h.Message.Type.CON,
  uri: 'u'
}], ['FunctionCall', {
  code: _h.Message.Code.POST,
  Response: 'FunctionReturn',
  type: _h.Message.Type.CON,
  uri: 'f/{{name}}?{{{args}}}'
}], ['VariableRequest', {
  code: _h.Message.Code.GET,
  Response: 'VariableValue',
  type: _h.Message.Type.CON,
  uri: 'v/{{name}}'
}], ['PrivateEvent', {
  code: _h.Message.Code.POST,
  Response: null,
  type: _h.Message.Type.NON,
  uri: 'E/{{event_name}}'
}], ['PublicEvent', {
  code: _h.Message.Code.POST,
  Response: null,
  type: _h.Message.Type.NON,
  uri: 'e/{{event_name}}'
}], ['Subscribe', {
  code: _h.Message.Code.GET,
  Response: null,
  type: _h.Message.Type.CON,
  uri: 'e/{{event_name}}'
}], ['Describe', {
  code: _h.Message.Code.GET,
  Response: 'DescribeReturn',
  type: _h.Message.Type.CON,
  uri: 'd'
}], ['GetTime', {
  code: _h.Message.Code.GET,
  Response: 'GetTimeReturn',
  type: _h.Message.Type.CON,
  uri: 't'
}], ['RaiseYourHand', {
  code: _h.Message.Code.PUT,
  Response: 'RaiseYourHandReturn',
  type: _h.Message.Type.CON,
  uri: 's'
}],

//  'PrivateSubscribe': { code: Message.Code.GET, uri: 'E/{{event_name}}', type: Message.Type.NON, Response: null },

['EventAck', {
  code: _h.Message.Code.EMPTY,
  Response: null,
  type: _h.Message.Type.ACK,
  uri: null
}], ['EventSlowdown', {
  code: _h.Message.Code.BAD_REQUEST,
  Response: null,
  type: _h.Message.Type.ACK,
  uri: null
}], ['SubscribeAck', {
  code: _h.Message.Code.EMPTY,
  Response: null,
  type: _h.Message.Type.ACK,
  uri: null
}], ['SubscribeFail', {
  code: _h.Message.Code.BAD_REQUEST,
  Response: null,
  type: _h.Message.Type.ACK,
  uri: null
}], ['GetTimeReturn', {
  code: _h.Message.Code.CONTENT,
  type: _h.Message.Type.ACK
}], ['RaiseYourHandReturn', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.ACK
}], ['ChunkMissedAck', {
  code: _h.Message.Code.EMPTY,
  type: _h.Message.Type.ACK
}], ['DescribeReturn', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.NON
}], ['KeyChanged', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.NON
}], ['UpdateReady', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.NON
}], ['ChunkReceived', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.NON
}], ['ChunkReceivedError', {
  code: _h.Message.Code.BAD_REQUEST,
  type: _h.Message.Type.NON
}], ['FunctionReturn', {
  code: _h.Message.Code.CHANGED,
  type: _h.Message.Type.NON
}], ['FunctionReturnError', {
  code: _h.Message.Code.BAD_REQUEST,
  type: _h.Message.Type.NON
}], ['VariableValue', {
  code: _h.Message.Code.CONTENT,
  type: _h.Message.Type.ACK
}], ['VariableValueError', {
  code: _h.Message.Code.BAD_REQUEST,
  type: _h.Message.Type.NON
}], ['Ping', {
  code: _h.Message.Code.EMPTY,
  type: _h.Message.Type.CON
}], ['PingAck', {
  code: _h.Message.Code.EMPTY,
  Response: null,
  type: _h.Message.Type.ACK,
  uri: null
}], ['SocketPing', {
  code: _h.Message.Code.EMPTY,
  type: _h.Message.Type.NON
}]].map(function (_ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      name = _ref2[0],
      value = _ref2[1];

  var template = null;
  if (value && value.uri && value.uri.indexOf('{') >= 0) {
    template = _hogan2.default.compile(value.uri);
  }

  return [name, _extends({}, value, { template: template })];
});

exports.default = MessageSpecifications;