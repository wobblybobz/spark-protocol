'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _CoapMessage = require('./CoapMessage');

var _CoapMessage2 = _interopRequireDefault(_CoapMessage);

var _hogan = require('hogan.js');

var _hogan2 = _interopRequireDefault(_hogan);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MessageSpecifications = [['Hello', {
  code: _CoapMessage2.default.Code.POST,
  response: 'Hello',
  type: _CoapMessage2.default.Type.NON,
  uri: 'h'
}], ['KeyChange', {
  code: _CoapMessage2.default.Code.PUT,
  response: 'KeyChanged',
  type: _CoapMessage2.default.Type.CON,
  uri: 'k'
}], ['UpdateBegin', {
  code: _CoapMessage2.default.Code.POST,
  response: 'UpdateReady',
  type: _CoapMessage2.default.Type.CON,
  uri: 'u'
}], ['UpdateAbort', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  type: _CoapMessage2.default.Type.NON
}], ['Chunk', {
  code: _CoapMessage2.default.Code.POST,
  response: 'ChunkReceived',
  type: _CoapMessage2.default.Type.CON,
  uri: 'c?{{{crc}}}'
}], ['ChunkMissed', {
  code: _CoapMessage2.default.Code.GET,
  response: 'ChunkMissedAck',
  type: _CoapMessage2.default.Type.CON,
  uri: 'c'
}], ['UpdateDone', {
  code: _CoapMessage2.default.Code.PUT,
  response: null,
  type: _CoapMessage2.default.Type.CON,
  uri: 'u'
}], ['FunctionCall', {
  code: _CoapMessage2.default.Code.POST,
  response: 'FunctionReturn',
  type: _CoapMessage2.default.Type.CON,
  uri: 'f/{{name}}?{{{args}}}'
}], ['VariableRequest', {
  code: _CoapMessage2.default.Code.GET,
  response: 'VariableValue',
  type: _CoapMessage2.default.Type.CON,
  uri: 'v/{{name}}'
}], ['PrivateEvent', {
  code: _CoapMessage2.default.Code.POST,
  response: null,
  type: _CoapMessage2.default.Type.NON,
  uri: 'E/{{event_name}}'
}], ['PublicEvent', {
  code: _CoapMessage2.default.Code.POST,
  response: null,
  type: _CoapMessage2.default.Type.NON,
  uri: 'e/{{event_name}}'
}], ['Subscribe', {
  code: _CoapMessage2.default.Code.GET,
  response: null,
  type: _CoapMessage2.default.Type.CON,
  uri: 'e/{{event_name}}'
}], ['Describe', {
  code: _CoapMessage2.default.Code.GET,
  response: 'DescribeReturn',
  type: _CoapMessage2.default.Type.CON,
  uri: 'd'
}], ['GetTime', {
  code: _CoapMessage2.default.Code.GET,
  response: 'GetTimeReturn',
  type: _CoapMessage2.default.Type.CON,
  uri: 't'
}], ['SignalStart', {
  code: _CoapMessage2.default.Code.PUT,
  response: 'SignalStartReturn',
  type: _CoapMessage2.default.Type.CON,
  uri: 's'
}],
// 'PrivateSubscribe': {
//   code: CoapMessage.Code.GET,
//   uri: 'E/{{event_name}}',
//   type: CoapMessage.Type.NON,
//   response: null
// },
['EventAck', {
  code: _CoapMessage2.default.Code.EMPTY,
  response: null,
  type: _CoapMessage2.default.Type.ACK,
  uri: null
}], ['EventSlowdown', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  response: null,
  type: _CoapMessage2.default.Type.ACK,
  uri: null
}], ['SubscribeAck', {
  code: _CoapMessage2.default.Code.EMPTY,
  response: null,
  type: _CoapMessage2.default.Type.ACK,
  uri: null
}], ['SubscribeFail', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  response: null,
  type: _CoapMessage2.default.Type.ACK,
  uri: null
}], ['GetTimeReturn', {
  code: _CoapMessage2.default.Code.CONTENT,
  type: _CoapMessage2.default.Type.ACK
}], ['SignalStartReturn', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.ACK
}], ['ChunkMissedAck', {
  code: _CoapMessage2.default.Code.EMPTY,
  type: _CoapMessage2.default.Type.ACK
}], ['DescribeReturn', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.NON
}], ['KeyChanged', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.NON
}], ['UpdateReady', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.NON
}], ['ChunkReceived', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.NON
}], ['ChunkReceivedError', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  type: _CoapMessage2.default.Type.NON
}], ['FunctionReturn', {
  code: _CoapMessage2.default.Code.CHANGED,
  type: _CoapMessage2.default.Type.NON
}], ['FunctionReturnError', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  type: _CoapMessage2.default.Type.NON
}], ['VariableValue', {
  code: _CoapMessage2.default.Code.CONTENT,
  type: _CoapMessage2.default.Type.ACK
}], ['VariableValueError', {
  code: _CoapMessage2.default.Code.BAD_REQUEST,
  type: _CoapMessage2.default.Type.NON
}], ['Ping', {
  code: _CoapMessage2.default.Code.EMPTY,
  type: _CoapMessage2.default.Type.CON
}], ['PingAck', {
  code: _CoapMessage2.default.Code.EMPTY,
  response: null,
  type: _CoapMessage2.default.Type.ACK,
  uri: null
}], ['SocketPing', {
  code: _CoapMessage2.default.Code.EMPTY,
  type: _CoapMessage2.default.Type.NON
}]].map(function (_ref) {
  var _ref2 = (0, _slicedToArray3.default)(_ref, 2),
      name = _ref2[0],
      value = _ref2[1];

  var template = null;
  if (value && value.uri && value.uri.indexOf('{') >= 0) {
    template = _hogan2.default.compile(value.uri);
  }

  return [name, (0, _extends3.default)({}, value, { template: template })];
}); /*
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

exports.default = MessageSpecifications;