'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

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

var EventPublisher = function (_EventEmitter) {
  _inherits(EventPublisher, _EventEmitter);

  function EventPublisher() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, EventPublisher);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = EventPublisher.__proto__ || Object.getPrototypeOf(EventPublisher)).call.apply(_ref, [this].concat(args))), _this), _this._eventHandlerByKey = new Map(), _this.publish = function (isPublic, name, userId, data, ttl, publishedAt, coreId) {
      var params = [isPublic, name, userId, data, ttl, publishedAt, coreId];
      process.nextTick(function () {
        var _this2, _this3, _this4, _this5;

        (_this2 = _this).emit.apply(_this2, [name].concat(params));
        (_this3 = _this).emit.apply(_this3, [coreId].concat(params));
        (_this4 = _this).emit.apply(_this4, [coreId + '/' + name].concat(params));
        (_this5 = _this).emit.apply(_this5, ["*all*"].concat(params));
      });
    }, _this.subscribe = function (name, userId, coreId, obj, eventHandler) {
      var eventKey = _this.getEventKey(name, userId, coreId);
      if (_this._eventHandlerByKey.has(eventKey)) {
        return;
      }

      var eventName = _this.getEventName(name, coreId);
      var handler = eventHandler ? eventHandler : function (isPublic, name, userId, data, ttl, publishedAt, coreId) {
        var emitName = isPublic ? "public" : "private";
        if (typeof obj.emit === 'function') {
          obj.emit(emitName, name, data, ttl, publishedAt, coreId);
        }
      };

      _this._eventHandlerByKey.set(eventKey, handler);
      _this.on(eventName, handler);
    }, _this.unsubscribe = function (name, userId, coreId, obj) {
      var eventKey = _this.getEventKey(name, userId, coreId);
      if (!eventKey) {
        return;
      }

      if (!_this._eventHandlerByKey.has(eventKey)) {
        return;
      }

      var handler = (0, _nullthrows2.default)(_this._eventHandlerByKey.get(eventKey));
      _this.removeListener(eventKey, handler);
      _this._eventHandlerByKey.delete(eventKey);
    }, _this.close = function () {
      try {
        _this.removeAllListeners();
      } catch (exception) {
        _logger2.default.error("EventPublisher: error thrown during close " + exception);
      }
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(EventPublisher, [{
    key: 'getEventKey',
    value: function getEventKey(name, userId, coreId) {
      var eventKey = userId;
      if (coreId) {
        eventKey += '_' + coreId;
      }
      if (name) {
        eventKey += '_' + name;
      }

      return eventKey;
    }
  }, {
    key: 'getEventName',
    value: function getEventName(name, coreId) {
      var eventName = '';
      if (coreId) {
        eventName = coreId;
        if (name) {
          eventName += '/' + name;
        }
      } else if (name) {
        eventName = name;
      }

      if (!eventName) {
        return "*all*";
      }

      return eventName;
    }
  }]);

  return EventPublisher;
}(_events2.default);

exports.default = EventPublisher;