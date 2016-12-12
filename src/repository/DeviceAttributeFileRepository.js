// @flow

import type {DeviceAttributes} from '../types';

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

    this._fileManager.createFile(model.deviceID + '.json', modelToSave);
    return modelToSave;
  }

  update(model: DeviceAttributes): DeviceAttributes {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };
console.log(model.deviceID);
    this._fileManager.writeFile(model.deviceID + '.json', modelToSave);
    return modelToSave;
  }

  delete(id: string): void {
    this._fileManager.deleteFile(id + '.json');
  }

  getAll(): Array<DeviceAttributes> {
    return this._fileManager.getAllData();
  }

  getById(id: string): DeviceAttributes {
    return this._fileManager.getFile(id + '.json');
  }
}

export default DeviceAttributeFileRepository;
