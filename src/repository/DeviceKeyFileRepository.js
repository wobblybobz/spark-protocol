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

  @memoizeSet()
  async create(id: string, data: string): Promise<string> {
    this._fileManager.createFile(id + FILE_EXTENSION, data);
    return data;
  };

  @memoizeSet()
  async update(id: string, data: string): Promise<string> {
    this._fileManager.writeFile(id + FILE_EXTENSION, data);
    return data;
  };

  @memoizeSet(['id'])
  async delete(id: string): Promise<void> {
    this._fileManager.deleteFile(id + FILE_EXTENSION);
  }

  @memoizeGet()
  async getAll(): Promise<Array<string>> {
    return this._fileManager.getAllData();
  }

  @memoizeGet(['id'])
  async getById(id: string): Promise<?string> {
    return this._fileManager.getFile(id + FILE_EXTENSION);
  }
}

export default DeviceKeyFileRepository;
