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

import { Message } from 'h5.coap';
import Option from 'h5.coap/lib/Option';
import logger from '../lib/logger';
import { BufferBuilder, BufferReader } from 'h5.buffers';
import MessageSpecifications from './MessageSpecifications';


const _getRouteKey = (code: string, path: string): string => {
  const uri = code + path;
  const idx = uri.indexOf('/');

  // this assumes all the messages are one character for now.
  // if we wanted to change this, we'd need to find the first non message char,
  // '/' or '?', or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
};

class Messages {
  _specifications: Map<MessageType, MessageSpecificationType> =
    new Map(MessageSpecifications);

  // Maps CODE + URL to MessageNames as they appear in 'Spec'
  _routes: Map<string, MessageType> = new Map(
    MessageSpecifications
      .filter(
        // eslint-disable-next-line no-unused-vars
        ([name, value]: [MessageType, MessageSpecificationType]): boolean =>
          !!value.uri,
      )
      .map(
        (
          [name, value]: [MessageType, MessageSpecificationType],
        ): [string, MessageType] => {
          // see what it looks like without params
          const uri = value.template ? value.template.render({}) : value.uri;
          const routeKey = _getRouteKey(value.code, `/${(uri || '')}`);

          return [routeKey, name];
        },
      ),
  );

  /**
   * does the special URL writing needed directly to the COAP message object,
   * since the URI requires non-text values
   */
  raiseYourHandUrlGenerator = (
    showSignal: boolean,
  ): (message: Message) => Buffer =>
    (message: Message): Buffer => {
      const buffer = new Buffer(1);
      buffer.writeUInt8(showSignal ? 1 : 0, 0);

      message.addOption(new Option(Message.Option.URI_PATH, new Buffer('s')));
      message.addOption(new Option(Message.Option.URI_QUERY, buffer));
      return message;
    };

  getRequestType = (message: Message): ?string => {
    const uri = _getRouteKey(message.getCode(), message.getUriPath());
    return this._routes.get(uri);
  };

  getResponseType = (name: MessageType): ?string => {
    const specification = this._specifications.get(name);
    return specification ? specification.Response : null;
  };

  statusIsOkay = (message: Message): boolean =>
    message.getCode() < Message.Code.BAD_REQUEST;

  isNonTypeMessage = (messageName: MessageType): boolean => {
    const specification = this._specifications.get(messageName);
    if (!specification) {
      return false;
    }

    return specification.type === Message.Type.NON;
  };

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
    } catch (error) {
      logger.error(`Coap Error: ${error}`);
    }

    return null;
  };


  // http://en.wikipedia.org/wiki/X.690
  // === TYPES: SUBSET OF ASN.1 TAGS ===
  //
  // 1: BOOLEAN (false=0, true=1)
  // 2: INTEGER (int32)
  // 4: OCTET STRING (arbitrary bytes)
  // 5: NULL (void for return value only)
  // 9: REAL (double)
  // Translates the integer variable type enum to user friendly string types
  translateIntTypes = (varState: ?Object): ?Object => {
    if (!varState) {
      return null;
    }
    const translatedVarState = {};

    Object
      .getOwnPropertyNames(varState)
      .forEach(
        (varName: string) => {
          const intType = varState && varState[varName];
          if (typeof intType === 'number') {
            const str = this.getNameFromTypeInt(intType);

            if (str !== null) {
              translatedVarState[varName] = str;
            }
          }
        },
      );

    return { ...varState, ...translatedVarState };
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
        logger.error(`asked for unknown type: ${typeInt}`);
        throw new Error(`error getNameFromTypeInt: ${typeInt}`);
      }
    }
  };

  // eslint-disable-next-line func-names
  tryFromBinary = function<TType> (buffer: Buffer, typeName: string): ?TType {
    let result = null;
    try {
      result = this.fromBinary(buffer, typeName);
    } catch (error) {
      logger.error(
        `Could not parse type: ${typeName} ${buffer.toString()} ${error}`,
      );
    }
    return result;
  };

  // eslint-disable-next-line func-names
  fromBinary = function<TType> (buffer: Buffer, typeName: string): TType {
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
        // doubles on the device are little-endian
        return bufferReader.shiftDouble(true);
      }

      case 'buffer': {
        return ((bufferReader.buffer: any): TType);
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
    bufferBuilder?: BufferBuilder = new BufferBuilder(),
  ): Buffer => {
    // eslint-disable-next-line no-param-reassign
    typeName = typeName || (typeof value);

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
      args
        .filter((arg: Array<any>): boolean => !!arg)
        .forEach((arg: Array<any>, index: number) => {
          if (index > 0) {
            this.toBinary('&', 'string', bufferBuilder);
          }

          const name = arg[0] || requestArgsKey;
          const type = arg[1];
          const val = requestArgs[name];

          this.toBinary(val, type, bufferBuilder);
        });


      return bufferBuilder.toBuffer();
    } catch (error) {
      logger.error(`buildArguments error: ${error}`);
    }

    return null;
  };
}

export default new Messages();
