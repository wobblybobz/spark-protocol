// @flow

import FileManager from './FileManager';
import memoizeGet from '../decorators/memoizeGet';
import memoizeSet from '../decorators/memoizeSet';

const FILE_EXTENSION = '.pub.pem';

class DeviceKeyFileRepository {
  _fileManager: FileManager;

  constructor(path: string) {
    this._fileManager = new FileManager(path);
  }

  @memoizeSet(['deviceID'])
  async deleteById(deviceID: string): Promise<void> {
    this._fileManager.deleteFile(deviceID + FILE_EXTENSION);
  }

  @memoizeGet(['deviceID'])
  async getById(deviceID: string): Promise<?string> {
    return this._fileManager.getFile(deviceID + FILE_EXTENSION);
  }

  @memoizeSet()
  async update(deviceID: string, key: string): Promise<string> {
    this._fileManager.writeFile(deviceID + FILE_EXTENSION, key);
    return key;
  }
}

export default DeviceKeyFileRepository;
