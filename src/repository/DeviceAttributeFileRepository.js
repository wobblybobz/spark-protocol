// @flow

import type { DeviceAttributes } from '../types';

import JSONFileManager from './JSONFileManager';
import uuid from '../lib/uuid';

class DeviceAttributeFileRepository {
  _fileManager: JSONFileManager;

  constructor(path: string) {
    this._fileManager = new JSONFileManager(path);
  }

  create = (model: DeviceAttributes): Promise<DeviceAttributes> => {
    throw new Error('Create device attributes not implemented');
  }

  update = (model: DeviceAttributes): Promise<DeviceAttributes> => {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(`${model.deviceID}.json`, modelToSave);
    return Promise.resolve(modelToSave);
  };

  deleteById = (id: string): Promise<*> => {
    this._fileManager.deleteFile(`${id}.json`);
    return Promise.resolve();
  };

  getAll = (userID?: string): Promise<Array<DeviceAttributes>> => {
    const allData = this._fileManager.getAllData();

    if (userID) {
      return Promise.resolve(
        allData.filter(
          (attributes: DeviceAttributes): boolean =>
            attributes.ownerID === userID,
        )
      );
    }
    return Promise.resolve(allData);
  };

  getById = (id: string, userID?: string): Promise<?DeviceAttributes> => {
    const attributes = this._fileManager.getFile(`${id}.json`);
    if (userID) {
      if (!attributes) {
        return Promise.resolve();
      }

      const ownerID = attributes.ownerID;
      if (!ownerID || ownerID !== userID) {
        return Promise.resolve();
      }
    }

    return Promise.resolve(attributes);
  };
}

export default DeviceAttributeFileRepository;
