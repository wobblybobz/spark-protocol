// @flow

import type {DeviceAttributes} from '../types';

import FileManager from './FileManager';
import uuid from '../lib/uuid';

class DeviceFileRepository {
  _fileManager: FileManager;

  constructor(path: string) {
    this._fileManager = new FileManager(path);
  }

  create(id: string, model: DeviceAttributes): DeviceAttributes {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.createFile(id + '.json', modelToSave);
    return modelToSave;
  }

  update(id: string, model: DeviceAttributes): DeviceAttributes {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(id + '.json', model);
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

export default DeviceFileRepository;
