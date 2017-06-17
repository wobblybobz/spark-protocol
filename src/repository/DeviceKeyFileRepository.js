// @flow

import type { DeviceKeyObject, IDeviceKeyRepository } from '../types';

import FileManager from './FileManager';
import memoizeGet from '../decorators/memoizeGet';
import memoizeSet from '../decorators/memoizeSet';

const FILE_EXTENSION = '.pub.pem';

// getByID, deleteByID and update uses model.deviceID as ID for querying
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
    return key ? { algorithm: 'rsa', deviceID, key } : null;
  }

  @memoizeSet()
  async updateByID(
    deviceID: string,
    props: $Shape<DeviceKeyObject>,
  ): Promise<DeviceKeyObject> {
    const { key } = props;
    this._fileManager.writeFile(deviceID + FILE_EXTENSION, key);
    return { algorithm: 'rsa', deviceID, key };
  }
}

export default DeviceKeyFileRepository;
