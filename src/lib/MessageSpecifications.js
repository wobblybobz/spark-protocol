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
* @flow
*
*/

import {Message} from 'h5.coap';
import hogan from 'hogan.js';

export type MessageSpecificationType = {
  code: string,
  Response: ?string,
  template: ?HoganTemplate,
  type: string,
  uri: ?string,
};

type HoganTemplate = {
  buf: string,
  c: Object,
  options: Object,
  partials: Object,
  render: Function,
  text: string,
  r: Function,
  subs: Object,
};

export type MessageType =
  'Hello' |
  'KeyChange' |
  'UpdateBegin' |
  'UpdateAbort' |
  'Chunk' |
  'ChunkMissed' |
  'UpdateDone' |
  'FunctionCall' |
  'VariableRequest' |
  'PrivateEvent' |
  'PublicEvent' |
  'Subscribe' |
  'Describe' |
  'GetTime' |
  'SignalStart' |
  'EventAck' |
  'EventSlowdown' |
  'SubscribeAck' |
  'SubscribeFail' |
  'GetTimeReturn' |
  'SignalStartReturn' |
  'ChunkMissedAck' |
  'DescribeReturn' |
  'KeyChanged' |
  'UpdateReady' |
  'ChunkReceived' |
  'ChunkReceivedError' |
  'FunctionReturn' |
  'FunctionReturnError' |
  'VariableValue' |
  'VariableValueError' |
  'Ping' |
  'PingAck' |
  'SocketPing';

const MessageSpecifications: Array<[MessageType, MessageSpecificationType]> = [
    [
      'Hello',
      {
        code: Message.Code.POST,
        Response: 'Hello',
        type: Message.Type.NON,
        uri: 'h',
      }
    ],
    [
      'KeyChange',
      {
        code: Message.Code.PUT,
        Response: 'KeyChanged',
        type: Message.Type.CON,
        uri: 'k',
      }],
    [
      'UpdateBegin',
      {
        code: Message.Code.POST,
        Response: 'UpdateReady',
        type: Message.Type.CON,
        uri: 'u',
      }
    ],
    [
      'UpdateAbort',
      {
        code: Message.Code.BAD_REQUEST,
        type: Message.Type.NON,
      }
    ],
    [
      'Chunk',
      {
        code: Message.Code.POST,
        Response: 'ChunkReceived',
        type: Message.Type.CON,
        uri: 'c?{{{crc}}}',
      }
    ],
    [
      'ChunkMissed',
      {
        code: Message.Code.GET,
        Response: 'ChunkMissedAck',
        type: Message.Type.CON,
        uri: 'c',
      }
    ],

    [
      'UpdateDone',
      {
        code: Message.Code.PUT,
        Response: null,
        type: Message.Type.CON,
        uri: 'u',
      }
    ],
    [
      'FunctionCall',
      {
        code: Message.Code.POST,
        Response: 'FunctionReturn',
        type: Message.Type.CON,
        uri: 'f/{{name}}?{{{args}}}',
      }
    ],
    [
      'VariableRequest',
      {
        code: Message.Code.GET,
        Response: 'VariableValue',
        type: Message.Type.CON,
        uri: 'v/{{name}}',
      }
    ],

    [
      'PrivateEvent',
      {
        code: Message.Code.POST,
        Response: null,
        type: Message.Type.NON,
        uri: 'E/{{event_name}}',
      }
    ],
    [
      'PublicEvent',
      {
        code: Message.Code.POST,
        Response: null,
        type: Message.Type.NON,
        uri: 'e/{{event_name}}',
      }
    ],

    [
      'Subscribe',
      {
        code: Message.Code.GET,
        Response: null,
        type: Message.Type.CON,
        uri: 'e/{{event_name}}',
      }
    ],
    [
      'Describe',
      {
        code: Message.Code.GET,
        Response: 'DescribeReturn',
        type: Message.Type.CON,
        uri: 'd',
      }
    ],
    [
      'GetTime',
      {
        code: Message.Code.GET,
        Response: 'GetTimeReturn',
        type: Message.Type.CON,
        uri: 't',
      }
    ],
    [
      'SignalStart',
      {
        code: Message.Code.PUT,
        Response: 'SignalStartReturn',
        type: Message.Type.CON,
        uri: 's',
      }
    ],


    //  'PrivateSubscribe': { code: Message.Code.GET, uri: 'E/{{event_name}}', type: Message.Type.NON, Response: null },

    [
      'EventAck',
      {
        code: Message.Code.EMPTY,
        Response: null,
        type: Message.Type.ACK,
        uri: null,
      }
    ],
    [
      'EventSlowdown',
      {
        code: Message.Code.BAD_REQUEST,
        Response: null,
        type: Message.Type.ACK,
        uri: null,
      }
    ],

    [
      'SubscribeAck',
      {
        code: Message.Code.EMPTY,
        Response: null,
        type: Message.Type.ACK,
        uri: null,
      }
    ],
    [
      'SubscribeFail',
      {
        code: Message.Code.BAD_REQUEST,
        Response: null,
        type: Message.Type.ACK,
        uri: null,
      }
    ],
    [
      'GetTimeReturn',
      {
        code: Message.Code.CONTENT,
        type: Message.Type.ACK,
      }
    ],
    [
      'SignalStartReturn',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.ACK,
      }
    ],
    [
      'ChunkMissedAck',
      {
        code: Message.Code.EMPTY,
        type: Message.Type.ACK,
      }
    ],
    [
      'DescribeReturn',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.NON,
      }
    ],
    [
      'KeyChanged',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.NON,
      }
    ],
    [
      'UpdateReady',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.NON,
      }
    ],
    [
      'ChunkReceived',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.NON,
      }
    ],
    [
      'ChunkReceivedError',
      {
        code: Message.Code.BAD_REQUEST,
        type: Message.Type.NON,
      }
    ],
    [
      'FunctionReturn',
      {
        code: Message.Code.CHANGED,
        type: Message.Type.NON,
      }
    ],
    [
      'FunctionReturnError',
      {
        code: Message.Code.BAD_REQUEST,
        type: Message.Type.NON,
      }
    ],
    [
      'VariableValue',
      {
        code: Message.Code.CONTENT,
        type: Message.Type.ACK,
      }
    ],
    [
      'VariableValueError',
      {
        code: Message.Code.BAD_REQUEST,
        type: Message.Type.NON,
      }
    ],
    [
      'Ping',
      {
        code: Message.Code.EMPTY,
        type: Message.Type.CON,
      }
    ],
    [
      'PingAck',
      {
        code: Message.Code.EMPTY,
        Response: null,
        type: Message.Type.ACK,
        uri: null,
      }
    ],
    [
      'SocketPing',
      {
        code: Message.Code.EMPTY,
        type: Message.Type.NON,
      }
    ],
].map(([name, value]) => {
  let template = null;
  if (value && value.uri && (value.uri.indexOf('{') >= 0)) {
    template = hogan.compile(value.uri);
  }

  return [name, {...value, template}];
});

export default MessageSpecifications;
