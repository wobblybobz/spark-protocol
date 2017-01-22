/* eslint-disable */

import test from 'ava';
import sinon from 'sinon';
import TestData from './setup/TestData';

import EventPublisher from '../src/lib/EventPublisher';

const TEST_EVENT_NAME = 'testEvent';

test(
  'should subscribe to event',
  t => {
    const eventPublisher = new EventPublisher();
    const handler = sinon.spy();
    const eventData = {
      name: TEST_EVENT_NAME,
      userID: TestData.getID(),
      isPublic: true,
    };

    eventPublisher.subscribe(
      eventData.name,
      handler,
      { userID: eventData.userID },
    );

    eventPublisher.publish(eventData);

    t.truthy(handler.called);
  }
);

test(
  'should listen for public event from another owner device',
  t => {

    const eventPublisher = new EventPublisher();
    const handler = sinon.spy();
    const eventData = {
      name: TEST_EVENT_NAME,
      userID: TestData.getID(),
      isPublic: true,
    };

    eventPublisher.subscribe(
      eventData.name,
      handler,
      { userID: TestData.getID() },
    );

    eventPublisher.publish(eventData);

    t.truthy(handler.called);
  }
);

test(
  'should filter private event',
  t => {
    const eventPublisher = new EventPublisher();
    const handler = sinon.spy();
    const eventData = {
      name: TEST_EVENT_NAME,
      userID: TestData.getID(),
      isPublic: false,
    };

    eventPublisher.subscribe(
      eventData.name,
      handler,
      { userID: TestData.getID() },
    );

    eventPublisher.publish(eventData);

    t.falsy(handler.called);
  }
);

test(
  'should filter event by deviceID',
  t => {
    const eventPublisher = new EventPublisher();
    const handler = sinon.spy();
    const ownerID = TestData.getID();
    const deviceEvent = {
      name: TEST_EVENT_NAME,
      userID: ownerID,
      isPublic: false,
      deviceID: TestData.getID()
    };

    // event from api or webhook-response
    const notDeviceEvent = {
      name: TEST_EVENT_NAME,
      userID: ownerID,
      isPublic: false,
    };

    eventPublisher.subscribe(
      deviceEvent.name,
      handler,
      {
        deviceID: TestData.getID(),
        userID: deviceEvent.userID,
      },
    );

    eventPublisher.publish(deviceEvent);
    eventPublisher.publish(notDeviceEvent);
    t.falsy(handler.called);
  }
);

test(
  'should listen for mydevices events only',
  t => {
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

    eventPublisher.subscribe(
      TEST_EVENT_NAME,
      handler,
      {
        mydevices: true,
        userID: ownerID,
      },
    );

    eventPublisher.publish(myDevicePublicEvent);
    t.is(handler.callCount, 1);
    eventPublisher.publish(myDevicesPrivateEvent);
    t.is(handler.callCount, 2);
    eventPublisher.publish(anotherOwnerPublicEvent);
    t.is(handler.callCount, 2);
  }
);
