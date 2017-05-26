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

import cluster from 'cluster';
import EventEmitter from 'events';
import nullthrows from 'nullthrows';
import uuid from 'uuid';
import settings from '../settings';

const ALL_EVENTS = '*all*';

type FilterOptions = {
  connectionID?: ?string,
  deviceID?: string,
  listenToBroadcastedEvents?: boolean,
  mydevices?: boolean,
  userID: string,
};

type Subscription = {
  eventNamePrefix: string,
  id: string,
  listener: (event: Event) => void,
  subscriberID?: string,
};

type BroadcastEvent = {
  processID: string,
} & Event;

class EventPublisher extends EventEmitter {
  _useCluster: boolean;
  _subscriptionsByID: Map<string, Subscription> = new Map();

  constructor(useCluster: boolean) {
    super();
    this._useCluster = useCluster;

    if (!useCluster) {
      return;
    }

    if (cluster.isMaster) {
      (cluster: any).on('message', (eventOwnerWorker: Object, event: BroadcastEvent) => {
        Object.values(cluster.workers).forEach((worker: any) => {
          if (eventOwnerWorker.id === worker.id) {
            return;
          }
          worker.send(event);
        });
        this._publish(event);
      });
    } else {
      process.on('message', (event: BroadcastEvent) => {
        this._publish(event);
      });
    }
  }

  publish = (eventData: EventData) => {
    const ttl = (eventData.ttl && eventData.ttl > 0)
      ? eventData.ttl
      : settings.DEFAULT_EVENT_TTL;

    const event: Event = {
      ...eventData,
      publishedAt: new Date(),
      ttl,
    };

    this._publish(event);
    if (this._useCluster) {
      this._broadcastToCluster(event);
    }
  };

  subscribe = (
    eventNamePrefix: string = ALL_EVENTS,
    eventHandler: (event: Event) => void,
    filterOptions: FilterOptions,
    subscriberID?: string,
  ): void => {
    let subscriptionID = uuid();
    while (this._subscriptionsByID.has(subscriptionID)) {
      subscriptionID = uuid();
    }

    const listener = this._filterEvents(eventHandler, filterOptions);

    this._subscriptionsByID.set(
      subscriptionID,
      {
        eventNamePrefix,
        id: subscriptionID,
        listener,
        subscriberID,
      },
    );

    this.on(eventNamePrefix, listener);
    return subscriptionID;
  };

  unsubscribe = (subscriptionID: string) => {
    const {
      eventNamePrefix,
      listener,
    } = nullthrows(this._subscriptionsByID.get(subscriptionID));

    this.removeListener(eventNamePrefix, listener);
    this._subscriptionsByID.delete(subscriptionID);
  };

  unsubscribeBySubscriberID = (subscriberID: string) => {
    this._subscriptionsByID
      .forEach((subscription: Subscription) => {
        if (subscription.subscriberID === subscriberID) {
          this.unsubscribe(subscription.id);
        }
      });
  };

  _broadcastToCluster = (event: Event) => {
    if (cluster.isMaster) {
      Object.values(cluster.workers).forEach((worker: any): void =>
        worker.send({ ...event, processID: this._getProcessID() }),
      );
    } else {
      (process: any).send({ ...event, processID: this._getProcessID() });
    }
  };

  _emitWithPrefix = (eventName: string, event: Event) => {
    this.eventNames()
      .filter(
        (eventNamePrefix: string): boolean =>
          eventName.startsWith(eventNamePrefix),
      )
      .forEach(
        (eventNamePrefix: string): boolean =>
          this.emit(eventNamePrefix, event),
      );
  };

  _filterEvents = (
    eventHandler: (event: Event) => void,
    filterOptions: FilterOptions,
  ): (event: Event | BroadcastEvent) => void =>
    (event: Event | BroadcastEvent) => {
      // filter private events from another devices
      if (!event.isPublic && filterOptions.userID !== event.userID) {
        return;
      }

      // filter private events with wrong connectionID
      if (
        !event.isPublic &&
        filterOptions.connectionID &&
        event.connectionID !== filterOptions.connectionID
      ) {
        return;
      }

      // filter mydevices events
      if (filterOptions.mydevices && filterOptions.userID !== event.userID) {
        return;
      }

      // filter event by deviceID
      if (
        filterOptions.deviceID &&
        event.deviceID !== filterOptions.deviceID
      ) {
        return;
      }

      const castedEvent: any = event; // hack for flow

      if (
        filterOptions.listenToBroadcastedEvents === false &&
        castedEvent.processID &&
        castedEvent.processID !== this._getProcessID()
      ) {
        return;
      }

      const translatedEvent = castedEvent.processID
        ? this._translateBroadcastEvent(castedEvent)
        : event;

      process.nextTick((): void => eventHandler(translatedEvent));
    };

  _getProcessID = (): string => cluster.isMaster ? 'master' : cluster.worker.id.toString();

  _publish = (event: Event | BroadcastEvent) => {
    this._emitWithPrefix(event.name, event);
    this.emit(ALL_EVENTS, event);
  };

  // eslint-disable-next-line no-unused-vars
  _translateBroadcastEvent = ({ processID, ...otherProps }: BroadcastEvent): Event =>
    (({ ...otherProps }): any);
}

export default EventPublisher;
