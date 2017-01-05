// @flow

import FileManager from './FileManager';

const FILE_EXTENSION = '.pub.pem';

class DeviceKeyFileRepository {
  _fileManager: FileManager;

  constructor(path: string) {
    this._fileManager = new FileManager(path);
  }

  create = async (id: string, data: string): Promise<string> => {
    this._fileManager.createFile(id + FILE_EXTENSION, data);
    return data;
  };

  update = async (id: string, data: string): Promise<string> => {
    this._fileManager.writeFile(id + FILE_EXTENSION, data);
    return data;
  };

  delete = async (id: string): Promise<void> =>
    this._fileManager.deleteFile(id + FILE_EXTENSION);

  getAll = async (): Promise<Array<string>> =>
    this._fileManager.getAllData();

  getById = async (id: string): Promise<?string> =>
    this._fileManager.getFile(id + FILE_EXTENSION);
}

export default DeviceKeyFileRepository;
