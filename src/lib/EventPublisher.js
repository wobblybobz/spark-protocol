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
import {EventEmitter} from 'events';

class EventPublisher extends EventEmitter {
  _eventMap: Map<string, boolean> = new Map();

  getEventKey(name: ?string, userId: string, coreId: ?string): string {
    let eventKey = userId;
    if (coreId) {
        eventKey+= '_'+coreid;
    }
    if (name) {
        eventKey += '_'+name;
    }
    return eventKey;
  }

  getEventName(name: ?string, coreId: ?string){
    let eventName = '';
    if (coreId) {
        eventName = coreId;
        if (name) {
          eventName += '/' + name;
        }
    } else if (name){
        eventName = name;
    }

    if (!eventName) {
        return "*all*";
    }

    return eventName;
  }

  publish = (
    isPublic: boolean,
    name: string,
    userId: string,
    data: string,
    ttl: number,
    publishedAt: Date,
    coreId: string,
  ): void => {
    const params = [isPublic, name, userId, data, ttl, publishedAt, coreId];
    process.nextTick(() => {
      this.emit(name, ...params);
      this.emit(coreid, ...params);
      this.emit(coreid + '/' + name, ...params);
      this.emit("*all*", ...params);
    });
  };

  subscribe = (
    name: string,
    userid: string,
    coreId: string,
    obj: Object,
    eventHandler?: () => void,
  ): void => {
    const eventKey = this.getEventKey(name, userId, coreId);
    if(!this._eventMap.has(eventKey)) {
      const eventName = this.getEventName(name, coreId);
      const handler = eventHandler
        ? eventHandler
        : ((
          isPublic: boolean,
          name: string,
          userId: string,
          data: Object,
          ttl: number,
          publishedAt: Date,
          coreId: string
        ): void => {
          const emitName = isPublic ? "public" : "private";
          if (typeof(this.emit) == 'function') {
            this.emit(emitName, name, data, ttl, publishedAt, coreId);
          }
        }).bind(obj);

      this._eventMap.set(eventKey, true);
      this.on(eventName, handler);
    }
  }

  unsubscribe = (name: string, userId: string, coreId: string, obj: Object): void => {
    const eventKey = this.getEventKey(name, userId, coreId);
    if(key) {
      var handler = obj[key + "_handler"];
      if ( handler ) {
          var eventName = this.getEventName(name,coreid);
          delete obj[eventName + "_handler"];
          this.removeListener( eventName, handler );
      }
    }
  }
}
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
export default EventPublisher;
