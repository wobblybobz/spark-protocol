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
import uuid from 'uuid';

const ALL_EVENTS = '*all*';

type FilterOptions = {
  deviceID?: string,
  userID?: string,
};

type Subscription = {
  eventName: string,
  id: string,
  listener: (event: Event) => void,
  subscriberID?: string,
};

class EventPublisher extends EventEmitter {
  _subscriptionsByID: Map<string, Subscription> = new Map();

  _filterEvents = (
    eventHandler: (event: Event) => void,
    filterOptions: FilterOptions,
  ): (event: Event) => void =>
    (event: Event) => {
      const { userID, deviceID } = filterOptions;
      if (
        event.deviceID &&
        userID && userID !== event.userID
      ) {
        return;
      }

      if (deviceID && deviceID !== event.deviceID) {
        return;
      }

      eventHandler(event);
    };

  publish = (
    eventData: EventData,
  ): void => {
    const event: Event = {
      ...eventData,
      publishedAt: moment().toISOString(),
    };

    this.emit(eventData.name, event);
    this.emit(ALL_EVENTS, event);
  };


  subscribe = (
    eventName: string = ALL_EVENTS,
    eventHandler: (event: Event) => void,
    filterOptions?: FilterOptions = {},
    subscriberID?: string,
  ): void => {
    let subscriptionID = uuid();
    while(this._subscriptionsByID.has(subscriptionID)) {
      subscriptionID = uuid();
    }

    const listener = this._filterEvents(eventHandler, filterOptions);

    this._subscriptionsByID.set(
      subscriptionID,
      {
        listener,
        eventName,
        id: subscriptionID,
        subscriberID,
      },
    );

    this.on(eventName, listener);
    return subscriptionID;
  };

  unsubscribe = (subscriptionID: string): void => {
    const {
      eventName,
      listener,
    } = nullthrows(this._subscriptionsByID.get(subscriptionID));

    this.removeListener(eventName, listener);
    this._subscriptionsByID.delete(subscriptionID);
  };

  unsubscribeBySubscriberID = (subscriberID: string): void => {
    this._subscriptionsByID
      .forEach((subscription) => {
          if(subscription.subscriberID === subscriberID) {
            this.unsubscribe(subscription.id)
          }
      });
  }
}

export default EventPublisher;
