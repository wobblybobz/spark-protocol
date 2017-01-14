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

import type {
  MessageSpecificationType,
  MessageType,
} from './MessageSpecifications';

import fs from 'fs';
import settings from '../settings';
import {Message} from 'h5.coap';
import Option from 'h5.coap/lib/Option';
import logger from '../lib/logger';
import {BufferBuilder, BufferReader} from 'h5.buffers';
import MessageSpecifications from './MessageSpecifications';
import nullthrows from 'nullthrows';

const _getRouteKey = (code: string, path: string): string => {
  var uri = code + path;

  //find the slash.
  var idx = uri.indexOf('/');

  //this assumes all the messages are one character for now.
  //if we wanted to change this, we'd need to find the first non message char, '/' or '?',
  //or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
}

class Messages {
  _specifications: Map<MessageType, MessageSpecificationType> =
    new Map(MessageSpecifications);

  /**
   * Maps CODE + URL to MessageNames as they appear in 'Spec'
   */
  _routes: Map<string, string> = new Map(
    MessageSpecifications
      .filter(([name, value]) => value.uri)
      .map(([name, value]) => {
        //see what it looks like without params
        const uri = value.template ? value.template.render({}) : value.uri;
        const routeKey = _getRouteKey(value.code, '/' + (uri || ''));

        return [routeKey, name];
      },
    ),
  );

  /**
   * does the special URL writing needed directly to the COAP message object,
   * since the URI requires non-text values
   *
   * @param showSignal
   * @returns {Function}
   */
  raiseYourHandUrlGenerator = (
    showSignal: boolean,
  ): (message: Message) => Buffer => {
    return (message: Message): Buffer => {
      const buffer = new Buffer(1);
      buffer.writeUInt8(showSignal ? 1 : 0, 0);

      message.addOption(new Option(Message.Option.URI_PATH, new Buffer('s')));
      message.addOption(new Option(Message.Option.URI_QUERY, buffer));
      return message;
    };
  };

  getRouteKey = _getRouteKey;

  getRequestType = (message: Message): ?string => {
    const uri = this.getRouteKey(message.getCode(), message.getUriPath());
    return this._routes.get(uri);
  };

  getResponseType = (name: MessageType): ?string => {
    const specification = this._specifications.get(name);
    return specification ? specification.Response : null;
  };

  statusIsOkay = (message: Message): boolean => {
    return message.getCode() < Message.Code.BAD_REQUEST;
  };

  isNonTypeMessage = (messageName: MessageType): boolean => {
    const specification = this._specifications.get(messageName);
    if (!specification) {
      return false;
    }

    return specification.type === Message.Type.NON;
  }

  /**
   *
   * @param messageName
   * @param messageCounterId - must be an unsigned 16 bit integer
   * @param params
   * @param data
   * @param token - helps us associate responses w/ requests
   * @param onError
   * @returns {*}
   */
  wrap = (
    messageName: MessageType,
    messageCounterId: number,
    params: ?Object,
    data: ?Buffer,
    token: ?number,
  ): ?Buffer => {
      const specification = this._specifications.get(messageName);
      if (!specification) {
        logger.error('Unknown Message Type');
        return null;
      }

      // Setup the Message
      let message = new Message();

      // Format our url
      let uri = specification.uri;
      if (params && params._writeCoapUri) {
        // for our messages that have nitty gritty urls that require raw bytes
        // and no strings.
        message = params._writeCoapUri(message);
        uri = null;
      } else if (params && specification.template) {
        uri = specification.template.render(params);
      }

      if (uri) {
        message.setUri(uri);
      }

      message.setId(messageCounterId);

      if (token !== null && token !== undefined) {
        const buffer = new Buffer(1);
        buffer.writeUInt8(token, 0);
        message.setToken(buffer);
      }

      message.setCode(specification.code);
      message.setType(specification.type);

      // Set our payload
      if (data) {
        message.setPayload(data);
      }

      if (params && params._raw) {
        params._raw(message);
      }

      return message.toBuffer();
  };

  unwrap = (data: Buffer): ?Message => {
    if (!data) {
      return null;
    }

    try {
      return Message.fromBuffer(data);
    } catch (exception) {
      logger.error('Coap Error: ' + exception);
    }

    return null;
  };


  //http://en.wikipedia.org/wiki/X.690
  //=== TYPES: SUBSET OF ASN.1 TAGS ===
  //
  //1: BOOLEAN (false=0, true=1)
  //2: INTEGER (int32)
  //4: OCTET STRING (arbitrary bytes)
  //5: NULL (void for return value only)
  //9: REAL (double)

  /**
   * Translates the integer variable type enum to user friendly string types
   * @param varState
   * @returns {*}
   * @constructor
   */
  translateIntTypes = (varState: ?Object): ?Object => {
    if (!varState) {
        return null;
    }

    for (let varName in varState) {
      if (!varState.hasOwnProperty(varName)) {
        continue;
      }

      const intType = varState[varName];
      if (typeof intType === 'number') {
        const str = this.getNameFromTypeInt(intType);

        if (str !== null) {
          varState[varName] = str;
        }
      }
    }

    return varState;
  };

  getNameFromTypeInt = (typeInt: number): string => {
    switch (typeInt) {
      case 1: {
        return 'bool';
      }

      case 2: {
        return 'int32';
      }

      case 4: {
        return 'string';
      }

      case 5: {
        return 'null';
      }

      case 9: {
        return 'double';
      }

      default: {
        logger.error('asked for unknown type: ' + typeInt);
        throw 'errror getNameFromTypeInt ' + typeInt;
      }
    }
  };

  tryFromBinary = <TType>(buffer: Buffer, typeName: string): ?TType => {
      let result = null;
      try {
        result = this.fromBinary(buffer, typeName);
      } catch (error) {
        logger.error('Could not parse type: ${typeName} ${buffer}', error);
      }
      return result;
  };

  fromBinary = <TType>(buffer: Buffer, typeName: string): TType => {
    const bufferReader = new BufferReader(buffer);

    switch (typeName) {
      case 'bool': {
        return !!bufferReader.shiftByte();
      }

      case 'byte': {
        return bufferReader.shiftByte();
      }

      case 'crc': {
        return bufferReader.shiftUInt32();
      }

      case 'uint32': {
        return bufferReader.shiftUInt32();
      }

      case 'uint16': {
        return bufferReader.shiftUInt16();
      }

      case 'int32':
      case 'number': {
        return bufferReader.shiftInt32();
      }

      case 'float': {
        return bufferReader.shiftFloat();
      }

      case 'double': {
        //doubles on the core are little-endian
        return bufferReader.shiftDouble(true);
      }

      case 'buffer': {
        return ((bufferReader.buffer: any): TType)
      }

      case 'string':
      default: {
        return bufferReader.buffer.toString();
      }
    }
  };

  toBinary = (
    value: ?(string | number | Buffer),
    typeName?: string,
    bufferBuilder?: BufferBuilder,
  ): Buffer => {
    typeName = typeName || (typeof value);

    bufferBuilder = bufferBuilder || new BufferBuilder();

    if (value === null) {
      return bufferBuilder;
    }

    switch (typeName) {
      case 'uint16': {
        bufferBuilder.pushUInt16(value);
        break;
      }
      case 'uint32':
      case 'crc': {
        bufferBuilder.pushUInt32(value);
        break;
      }

      case 'int32': {
        bufferBuilder.pushInt32(value);
        break;
      }

      case 'number':
      case 'double': {
        bufferBuilder.pushDouble(value);
        break;
      }

      case 'buffer': {
        bufferBuilder.pushBuffer(value);
        break;
      }

      case 'string':
      default: {
        bufferBuilder.pushString(value || '');
        break;
      }
    }

    return bufferBuilder.toBuffer();
  };

  buildArguments = (
    requestArgs: {[key: string]: string},
    args: Array<Array<any>>,
  ): ?Buffer => {
    try {
      const bufferBuilder = new BufferBuilder();
      const requestArgsKey = Object.keys(requestArgs)[0];
      args.filter(arg => arg).forEach((arg, index) => {
        if (index > 0) {
          this.toBinary('&', 'string', bufferBuilder);
        }

        const name = arg[0] || requestArgsKey;
        const type = arg[1];
        const val = requestArgs[name];

        this.toBinary(val, type, bufferBuilder);
      })
      return bufferBuilder.toBuffer();
    } catch (exception) {
      logger.error('buildArguments: ', exception);
    }

    return null;
  };
}

export default new Messages();
