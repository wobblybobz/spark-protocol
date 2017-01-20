// @flow

import uuid from 'uuid';

const uuidSet = new Set();

class TestData {
  static getUser = (): {password: string, username: string} => {
    return {
      password: 'password',
      username: `testUser+${TestData.getID()}@test.com`,
    };
  };

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
