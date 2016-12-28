'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var _nullthrows2 = require('nullthrows');

var _nullthrows3 = _interopRequireDefault(_nullthrows2);

var _uuid = require('./uuid');

var _uuid2 = _interopRequireDefault(_uuid);

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

var getEventName = function getEventName(name, deviceID) {
  var eventName = '';
  if (deviceID) {
    eventName = deviceID;
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
};

var EventPublisher = function (_EventEmitter) {
  _inherits(EventPublisher, _EventEmitter);

  function EventPublisher() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, EventPublisher);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = EventPublisher.__proto__ || Object.getPrototypeOf(EventPublisher)).call.apply(_ref, [this].concat(args))), _this), _this._subscriptionsByID = new Map(), _this.publish = function (eventData) {
      process.nextTick(function () {
        var event = _extends({}, eventData, {
          publishedAt: (0, _moment2.default)().toISOString()
        });

        _this.emit(eventData.name, event);
        if (eventData.deviceID) {
          _this.emit(eventData.deviceID, event);
          _this.emit(eventData.deviceID + '/' + eventData.name, event);
        }
        _this.emit("*all*", event);
      });
    }, _this.subscribe = function (name, eventHandler, deviceID) {
      var subscriptionID = (0, _uuid2.default)();
      var eventName = getEventName(name, deviceID);

      _this._subscriptionsByID.set(subscriptionID, { eventName: eventName, eventHandler: eventHandler });
      _this.on(eventName, eventHandler);

      return subscriptionID;
    }, _this.unsubscribe = function (subscriptionID) {
      var _nullthrows = (0, _nullthrows3.default)(_this._subscriptionsByID.get(subscriptionID)),
          eventName = _nullthrows.eventName,
          eventHandler = _nullthrows.eventHandler;

      _this.removeListener(eventName, eventHandler);
      _this._subscriptionsByID.delete(subscriptionID);
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  return EventPublisher;
}(_events2.default);

exports.default = EventPublisher;