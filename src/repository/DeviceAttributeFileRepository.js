// @flow

import type { DeviceAttributes } from '../types';

import JSONFileManager from './JSONFileManager';
import uuid from '../lib/uuid';

class DeviceAttributeFileRepository {
  _fileManager: JSONFileManager;

  constructor(path: string) {
    this._fileManager = new JSONFileManager(path);
  }

  create(model: DeviceAttributes): DeviceAttributes {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.createFile(`${model.deviceID}.json`, modelToSave);
    return modelToSave;
  }

  update(model: DeviceAttributes): DeviceAttributes {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(`${model.deviceID}.json`, modelToSave);
    return modelToSave;
  }

  delete(id: string): void {
    this._fileManager.deleteFile(`${id}.json`);
  }

  getAll(userID?: string): Array<DeviceAttributes> {
    const allData = this._fileManager.getAllData();

    if (userID) {
      return allData.filter(
        (attributes: DeviceAttributes): boolean =>
          attributes.ownerID === userID,
      );
    }
    return allData;
  }

  getById(id: string, userID?: string): ?DeviceAttributes {
    const attributes = this._fileManager.getFile(`${id}.json`);
    if (userID) {
      return attributes && attributes.ownerID === userID ? attributes : null;
    }
    return attributes;
  }
}

export default DeviceAttributeFileRepository;
