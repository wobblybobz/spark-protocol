'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _h = require('h5.buffers');

var _MessageSpecifications = require('./MessageSpecifications');

var _MessageSpecifications2 = _interopRequireDefault(_MessageSpecifications);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs'); /*
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

var settings = require('../settings');
var Message = require('h5.coap').Message;
var Option = require('h5.coap/lib/Option.js');
var logger = require('../lib/logger.js');

/**
 * Interface for the Spark Core Messages
 * @constructor
 */

var _getRouteKey = function _getRouteKey(code, path) {
  var uri = code + path;

  //find the slash.
  var idx = uri.indexOf('/');

  //this assumes all the messages are one character for now.
  //if we wanted to change this, we'd need to find the first non message char, '/' or '?',
  //or use the real coap parsing stuff
  return uri.substr(0, idx + 2);
};

var Messages = function Messages() {
  var _this = this;

  _classCallCheck(this, Messages);

  this._specifications = new Map(_MessageSpecifications2.default);
  this._routes = new Map(_MessageSpecifications2.default.filter(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        name = _ref2[0],
        value = _ref2[1];

    return value.uri;
  }).map(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        name = _ref4[0],
        value = _ref4[1];

    //see what it looks like without params
    var uri = value.template ? value.template.render({}) : value.uri;
    var routeKey = _getRouteKey(value.code, '/' + (uri || ''));

    return [routeKey, name];
  }));

  this.raiseYourHandUrlGenerator = function (showSignal) {
    return function (message) {
      var buffer = new Buffer(1);
      buffer.writeUInt8(showSignal ? 1 : 0, 0);

      message.addOption(new Option(Message.Option.URI_PATH, new Buffer('s')));
      message.addOption(new Option(Message.Option.URI_QUERY, buffer));
      return message;
    };
  };

  this.getRouteKey = _getRouteKey;

  this.getRequestType = function (message) {
    var uri = _this.getRouteKey(message.getCode(), message.getUriPath());
    return _this._routes.get(uri);
  };

  this.getResponseType = function (name) {
    var specification = _this._specifications.get(name);
    return specification ? specification.Response : null;
  };

  this.statusIsOkay = function (message) {
    return message.getCode() < Message.Code.BAD_REQUEST;
  };

  this.wrap = function (specificationName, messageCounterId, params, data, token, onError) {
    var specification = _this._specifications.get(specificationName);
    if (!specification) {
      onError && onError('Unknown Message Type');
      return null;
    }

    // Setup the Message
    var message = new Message();

    // Format our url
    var uri = specification.uri;
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
      var buffer = new Buffer(1);
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

  this.unwrap = function (data) {
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

  this.translateIntTypes = function (varState) {
    if (!varState) {
      return null;
    }

    for (var varName in varState) {
      if (!varState.hasOwnProperty(varName)) {
        continue;
      }

      var intType = varState[varName];
      if (typeof intType === 'number') {
        var str = _this.getNameFromTypeInt(intType);

        if (str != null) {
          varState[varName] = str;
        }
      }
    }

    return varState;
  };

  this.getNameFromTypeInt = function (typeInt) {
    switch (typeInt) {
      case 1:
        {
          return 'bool';
        }

      case 2:
        {
          return 'int32';
        }

      case 4:
        {
          return 'string';
        }

      case 5:
        {
          return 'null';
        }

      case 9:
        {
          return 'double';
        }

      default:
        {
          logger.error('asked for unknown type: ' + typeInt);
          throw 'errror getNameFromTypeInt ' + typeInt;
        }
    }
  };

  this.tryfromBinary = function (buffer, typeName) {
    var result = null;
    try {
      result = _this.fromBinary(buffer, typeName);
    } catch (exception) {
      logger.error('Could not parse type: ${typeName} ${buffer}', exception);
    }
    return result;
  };

  this.fromBinary = function (buffer, typeName) {
    //logger.log('converting a ' + name + ' fromBinary input was ' + buf);

    if (!Buffer.isBuffer(buffer)) {
      buffer = new Buffer(buffer);
    }

    var newBuffer = new _h.BufferReader(buffer);

    switch (typeName) {
      case 'bool':
        {
          return newBuffer.shiftByte() != 0;
        }

      case 'crc':
        {
          return newBuffer.shiftUInt32();
        }

      case 'uint32':
        {
          return newBuffer.shiftUInt32();
        }

      case 'uint16':
        {
          return newBuffer.shiftUInt16();
        }

      case 'int32':
      case 'number':
        {
          return newBuffer.shiftInt32();
        }

      case 'float':
        {
          return newBuffer.shiftFloat();
        }

      case 'double':
        {
          //doubles on the core are little-endian
          return newBuffer.shiftDouble(true);
        }

      case 'buffer':
        {
          return buffer;
        }

      case 'string':
      default:
        {
          return buffer.toString();
        }
    }
  };

  this.toBinary = function (value, typeName, bufferBuilder) {
    typeName = typeName || (typeof value === 'undefined' ? 'undefined' : _typeof(value));

    bufferBuilder = bufferBuilder || new _h.BufferBuilder();

    switch (typeName) {
      case 'uint32':
      case 'crc':
        {
          bufferBuilder.pushUInt32(value);
          break;
        }

      case 'int32':
        {
          bufferBuilder.pushInt32(value);
          break;
        }

      case 'number':
      case 'double':
        {
          bufferBuilder.pushDouble(value);
          break;
        }

      case 'buffer':
        {
          bufferBuilder.pushBuffer(value);
          break;
        }

      case 'string':
      default:
        {
          bufferBuilder.pushString(value || '');
          break;
        }
    }

    return bufferBuilder.toBuffer();
  };

  this.buildArguments = function (value, args) {
    console.log('TODO: Type `buildArguments`');
    try {
      var bufferBuilder = new _h.BufferBuilder();
      args.filter(function (arg) {
        return arg;
      }).forEach(function (arg, index) {
        if (index > 0) {
          _this.toBinary('&', 'string', bufferBuilder);
        }

        var name = arg[0] || Object.keys(value)[0];
        var type = arg[1];
        var val = value[name];

        _this.toBinary(val, type, bufferBuilder);
      });
      return bufferBuilder.toBuffer();
    } catch (exception) {
      logger.error('buildArguments: ', exception);
    }

    return null;
  };

  this.parseArguments = function (args, desc) {
    console.log('TODO: Type `parseArguments`');
    try {
      if (!args || args.length != desc.length) {
        return null;
      }

      var results = [];
      for (var i = 0; i < desc.length; i++) {
        var p = desc[i];
        if (!p) {
          continue;
        }

        //desc -> [ [ name, type ], ... ]
        var type = p[1];
        var val = i < args.length ? args[i] : '';

        results.push(_this.fromBinary(new Buffer(val, 'binary'), type));
      }

      return results;
    } catch (exception) {
      logger.error('parseArguments: ', exception);
    }

    return null;
  };
}

/**
 * Maps CODE + URL to MessageNames as they appear in 'Spec'
 */


/**
 * does the special URL writing needed directly to the COAP message object,
 * since the URI requires non-text values
 *
 * @param showSignal
 * @returns {Function}
 */


/**
 *
 * @param name
 * @param id - must be an unsigned 16 bit integer
 * @param params
 * @param data
 * @param token - helps us associate responses w/ requests
 * @param onError
 * @returns {*}
 */


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
;

exports.default = new Messages();