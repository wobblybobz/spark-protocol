// @flow

import type { DeviceKeyObject, IDeviceKeyRepository } from '../types';

import FileManager from './FileManager';
import memoizeGet from '../decorators/memoizeGet';
import memoizeSet from '../decorators/memoizeSet';

const FILE_EXTENSION = '.pub.pem';

class DeviceKeyFileRepository implements IDeviceKeyRepository {
  _fileManager: FileManager;

  constructor(path: string) {
    this._fileManager = new FileManager(path);
  }

  @memoizeSet()
  async create(model: DeviceKeyObject): Promise<DeviceKeyObject> {
    this._fileManager.createFile(model.deviceID + FILE_EXTENSION, model.key);
    return model;
  }

  @memoizeSet(['deviceID'])
  async deleteByID(deviceID: string): Promise<void> {
    this._fileManager.deleteFile(deviceID + FILE_EXTENSION);
  }

  // eslint-disable-next-line
  async getAll(): Promise<Array<DeviceKeyObject>> {
    throw new Error('the method is not implemented');
  }

  @memoizeGet(['deviceID'])
  async getByID(deviceID: string): Promise<?DeviceKeyObject> {
    const key = this._fileManager.getFile(deviceID + FILE_EXTENSION);
    return key ? { deviceID, key } : null;
  }

  @memoizeSet()
  async update(model: DeviceKeyObject): Promise<DeviceKeyObject> {
    this._fileManager.writeFile(model.deviceID + FILE_EXTENSION, model.key);
    return model;
  }
}

export default DeviceKeyFileRepository;
