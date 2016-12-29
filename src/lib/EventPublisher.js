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
*
* @flow
*
*/

import type { Event, EventData } from '../types';

import EventEmitter from 'events';
import moment from 'moment';
import logger from './logger';
import nullthrows from 'nullthrows';
import uuid from './uuid';

const getEventName = (name: ?string, deviceID: ?string): string => {
  let eventName = '';
  if (deviceID) {
    eventName = deviceID;
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
};

type Subscription = {
  eventName: string,
  eventHandler: (event: Event) => void,
}

class EventPublisher extends EventEmitter {
  _subscriptionsByID: Map<string, Subscription> = new Map();

  publish = (
    eventData: EventData,
  ): void => {
    const event: Event = {
      ...eventData,
      publishedAt: moment().toISOString(),
    };

    this.emit(eventData.name, event);
    if (eventData.deviceID) {
      this.emit(eventData.deviceID, event);
      this.emit(`${eventData.deviceID}/${eventData.name}`, event);
    }
    this.emit("*all*", event);
  };


  subscribe = (
    name: ?string,
    eventHandler: (event: Event) => void,
    deviceID: ?string,
  ): void => {
    const subscriptionID = uuid();
    const eventName = getEventName(name, deviceID);

    this._subscriptionsByID.set(subscriptionID, { eventName, eventHandler });
    this.on(eventName, eventHandler);

    return subscriptionID;
  };

  unsubscribe = (subscriptionID: string): void => {
    const {
      eventName,
      eventHandler,
    } = nullthrows(this._subscriptionsByID.get(subscriptionID));

    this.removeListener(eventName, eventHandler);
    this._subscriptionsByID.delete(subscriptionID);
  };
}

export default EventPublisher;
