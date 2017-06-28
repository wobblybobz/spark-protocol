/* eslint-disable */

import test from 'ava';
import sinon from 'sinon';
import TestData from './setup/TestData';

import EventPublisher from '../src/lib/EventPublisher';
import { getRequestEventName } from '../src/lib/EventPublisher';

const TEST_EVENT_NAME = 'testEvent';

test('should subscribe to event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    isPublic: true,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: eventData.userID },
  });

  eventPublisher.publish(eventData);

  process.nextTick(() => {
    t.truthy(handler.called);
  });
});

test('should listen for public event from another owner device', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    isPublic: true,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: TestData.getID() },
  });

  eventPublisher.publish(eventData);
  process.nextTick(() => {
    t.truthy(handler.called);
  });
});

test('should filter private event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    isPublic: false,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { userID: TestData.getID() },
  });

  eventPublisher.publish(eventData);

  process.nextTick(() => {
    t.falsy(handler.called);
  });
});

test('should filter internal event', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const eventData = {
    name: TEST_EVENT_NAME,
    isInternal: true,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { listenToInternalEvents: true },
  });

  eventPublisher.publish(eventData);

  process.nextTick(() => {
    t.falsy(handler.called);
  });
});

test('should filter event by connectionID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const connectionID = '123';
  const eventData = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    isPublic: false,
  };

  eventPublisher.subscribe(eventData.name, handler, {
    filterOptions: { connectionID },
  });

  eventPublisher.publish(eventData);

  process.nextTick(() => {
    t.falsy(handler.called);
  });
});

test('should filter event by deviceID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();
  const deviceEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    isPublic: false,
    deviceID: TestData.getID(),
  };

  // event from api or webhook-response
  const notDeviceEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    isPublic: false,
  };

  eventPublisher.subscribe(deviceEvent.name, handler, {
    filterOptions: {
      deviceID: TestData.getID(),
      userID: deviceEvent.userID,
    },
  });

  eventPublisher.publish(deviceEvent);
  eventPublisher.publish(notDeviceEvent);

  process.nextTick(() => {
    t.falsy(handler.called);
  });
});

test('should filter broadcasted events', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();
  const deviceEvent = {
    broadcasted: true,
    deviceID: TestData.getID(),
    isPublic: false,
    name: TEST_EVENT_NAME,
    userID: ownerID,
  };

  eventPublisher.subscribe(deviceEvent.name, handler, {
    filterOptions: {
      listenToBroadcastedEvents: false,
    },
  });

  eventPublisher.publish(deviceEvent);

  process.nextTick(() => {
    t.falsy(handler.called);
  });
});

test('should listen for mydevices events only', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const ownerID = TestData.getID();

  const myDevicePublicEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    isPublic: true,
    deviceID: TestData.getID(),
  };

  const myDevicesPrivateEvent = {
    name: TEST_EVENT_NAME,
    userID: ownerID,
    isPublic: false,
    deviceID: TestData.getID(),
  };

  const anotherOwnerPublicEvent = {
    name: TEST_EVENT_NAME,
    userID: TestData.getID(),
    isPublic: true,
    deviceID: TestData.getID(),
  };

  eventPublisher.subscribe(TEST_EVENT_NAME, handler, {
    filterOptions: {
      mydevices: true,
      userID: ownerID,
    },
  });

  eventPublisher.publish(myDevicePublicEvent);
  process.nextTick(() => {
    t.is(handler.callCount, 1);
  });

  eventPublisher.publish(myDevicesPrivateEvent);
  process.nextTick(() => {
    t.is(handler.callCount, 2);
  });

  eventPublisher.publish(anotherOwnerPublicEvent);
  process.nextTick(() => {
    t.is(handler.callCount, 2);
  });
});

test('should unsubscribe all subscriptions by subsriberID', t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const subscriberID = TestData.getID();

  const event = {
    name: TEST_EVENT_NAME,
    isPublic: true,
  };

  eventPublisher.subscribe(event, handler, { subscriberID });

  eventPublisher.subscribe(event, handler, { subscriberID });

  eventPublisher.publish(event);
  process.nextTick(() => {
    t.is(handler.callCount, 2);
  });

  eventPublisher.unsubscribeBySubscriberID(subscriberID);

  eventPublisher.publish(event);
  process.nextTick(() => {
    t.is(handler.callCount, 2);
  });
});

test('should publish and listen for response', async t => {
  const eventPublisher = new EventPublisher();
  const handler = sinon.spy();
  const subscriberID = TestData.getID();
  const testContextData = '123';

  const responseHandler = (event: Event) => {
    const { data, responseEventName } = event.context;

    eventPublisher.publish({
      name: responseEventName,
      context: data,
    });
  };

  eventPublisher.subscribe(
    getRequestEventName(TEST_EVENT_NAME),
    responseHandler,
    { subscriberID },
  );

  const response = await eventPublisher.publishAndListenForResponse({
    name: TEST_EVENT_NAME,
    context: { data: testContextData },
  });

  t.is(response, testContextData);
});
