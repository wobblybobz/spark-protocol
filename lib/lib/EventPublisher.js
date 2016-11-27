'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
*/

var when = require('when');
var extend = require('xtend');
var settings = require("../settings");
var logger = require('./logger.js');
var utilities = require("./utilities.js");

var EventPublisher = function (_EventEmitter) {
  _inherits(EventPublisher, _EventEmitter);

  function EventPublisher() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, EventPublisher);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = EventPublisher.__proto__ || Object.getPrototypeOf(EventPublisher)).call.apply(_ref, [this].concat(args))), _this), _this._eventMap = new Map(), _this.publish = function (isPublic, name, userId, data, ttl, publishedAt, coreId) {
      var params = [isPublic, name, userId, data, ttl, publishedAt, coreId];
      process.nextTick(function () {
        var _this2, _this3, _this4, _this5;

        (_this2 = _this).emit.apply(_this2, [name].concat(params));
        (_this3 = _this).emit.apply(_this3, [coreid].concat(params));
        (_this4 = _this).emit.apply(_this4, [coreid + '/' + name].concat(params));
        (_this5 = _this).emit.apply(_this5, ["*all*"].concat(params));
      });
    }, _this.subscribe = function (name, userid, coreId, obj, eventHandler) {
      var eventKey = _this.getEventKey(name, userId, coreId);
      if (!_this._eventMap.has(eventKey)) {
        var eventName = _this.getEventName(name, coreId);
        var handler = eventHandler ? eventHandler : function (isPublic, name, userId, data, ttl, publishedAt, coreId) {
          var emitName = isPublic ? "public" : "private";
          if (typeof _this.emit == 'function') {
            _this.emit(emitName, name, data, ttl, publishedAt, coreId);
          }
        }.bind(obj);

        _this._eventMap.set(eventKey, true);
        _this.on(eventName, handler);
      }
    }, _this.unsubscribe = function (name, userId, coreId, obj) {
      var eventKey = _this.getEventKey(name, userId, coreId);
      if (key) {
        var handler = obj[key + "_handler"];
        if (handler) {
          var eventName = _this.getEventName(name, coreid);
          delete obj[eventName + "_handler"];
          _this.removeListener(eventName, handler);
        }
      }
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  _createClass(EventPublisher, [{
    key: 'getEventKey',
    value: function getEventKey(name, userId, coreId) {
      var eventKey = userId;
      if (coreId) {
        eventKey += '_' + coreid;
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
}(_events.EventEmitter);
/*
var EventPublisher = function () {
    EventEmitter.call(this);
};
EventPublisher.prototype = {

    ,

    ,


    close: function () {
        try {
            this.removeAllListeners();
        }
        catch (ex) {
            logger.error("EventPublisher: error thrown during close " + ex);
        }
    }
};
EventPublisher.prototype = extend(EventPublisher.prototype, EventEmitter.prototype);
*/


exports.default = EventPublisher;