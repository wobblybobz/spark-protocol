// @flow

import uuid from 'uuid';

const uuidSet = new Set();

class TestData {
  static getID = (): string => {
    let newID = uuid();
    while (uuidSet.has(newID)) {
      newID = uuid();
    }

    uuidSet.add(newID);
    return newID;
  };
}

export default TestData;
