// @flow

import FileManager from './FileManager';

const FILE_EXTENSION = '.pub.pem';

class DeviceKeyFileRepository {
  _fileManager: FileManager;

  constructor(path: string) {
    this._fileManager = new FileManager(path);
  }

  create(id: string, data: string): string {
    this._fileManager.createFile(id + FILE_EXTENSION, data);
    return data;
  }

  update(id: string, data: string): string {
    this._fileManager.writeFile(id + FILE_EXTENSION, data);
    return data;
  }

  delete(id: string): void {
    this._fileManager.deleteFile(id + FILE_EXTENSION);
  }

  getAll(): Array<string> {
    return this._fileManager.getAllData();
  }

  getById(id: string): Promise<?string> {
    return Promise.resolve(this._fileManager.getFile(id + FILE_EXTENSION));
  }
}

export default DeviceKeyFileRepository;
