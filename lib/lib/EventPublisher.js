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

var ALL_EVENTS = '*all*';

var EventPublisher = function (_EventEmitter) {
  _inherits(EventPublisher, _EventEmitter);

  function EventPublisher() {
    var _ref;

    var _temp, _this, _ret;

    _classCallCheck(this, EventPublisher);

    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = EventPublisher.__proto__ || Object.getPrototypeOf(EventPublisher)).call.apply(_ref, [this].concat(args))), _this), _this._subscriptionsByID = new Map(), _this._filterEvents = function (eventHandler) {
      var filterOptions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      return function (event) {
        var userID = filterOptions.userID,
            deviceID = filterOptions.deviceID;

        if (event.deviceID && userID && userID !== event.userID) {
          return;
        }

        if (deviceID && deviceID !== event.deviceID) {
          return;
        }

        eventHandler(event);
      };
    }, _this.publish = function (eventData) {
      var event = _extends({}, eventData, {
        publishedAt: (0, _moment2.default)().toISOString()
      });

      _this.emit(eventData.name, event);
      _this.emit(ALL_EVENTS, event);
    }, _this.subscribe = function () {
      var eventName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : ALL_EVENTS;
      var eventHandler = arguments[1];
      var filterOptions = arguments[2];
      var subscriberID = arguments[3];

      var subscriptionID = (0, _uuid2.default)();
      var listener = _this._filterEvents(eventHandler, filterOptions);

      _this._subscriptionsByID.set(subscriptionID, {
        listener: listener,
        eventName: eventName,
        id: subscriptionID,
        subscriberID: subscriberID
      });

      _this.on(eventName, listener);
      return subscriptionID;
    }, _this.unsubscribe = function (subscriptionID) {
      var _nullthrows = (0, _nullthrows3.default)(_this._subscriptionsByID.get(subscriptionID)),
          eventName = _nullthrows.eventName,
          listener = _nullthrows.listener;

      _this.removeListener(eventName, listener);
      _this._subscriptionsByID.delete(subscriptionID);
    }, _this.unsubscribeBySubscriberID = function (subscriberID) {
      _this._subscriptionsByID.forEach(function (subscription) {
        if (subscription.subscriberID === subscriberID) {
          _this.unsubscribe(subscription.id);
        }
      });
    }, _temp), _possibleConstructorReturn(_this, _ret);
  }

  return EventPublisher;
}(_events2.default);

exports.default = EventPublisher;