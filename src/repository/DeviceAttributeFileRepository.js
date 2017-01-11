// @flow

import type { DeviceAttributes } from '../types';

import JSONFileManager from './JSONFileManager';

class DeviceAttributeFileRepository {
  _fileManager: JSONFileManager;

  constructor(path: string) {
    this._fileManager = new JSONFileManager(path);
  }

  create = async (model: DeviceAttributes): Promise<DeviceAttributes> => {
    throw new Error('Create device attributes not implemented');
  };

  update = async (model: DeviceAttributes): Promise<DeviceAttributes> => {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(`${model.deviceID}.json`, modelToSave);
    return modelToSave;
  };

  deleteById = async (id: string): Promise<void> => {
    this._fileManager.deleteFile(`${id}.json`);
  };

  doesUserHaveAccess = async (
    id: string,
    userID: string,
  ): Promise<boolean> =>
    !!(await this.getById(id, userID));

  getAll = async (userID: ?string = null): Promise<Array<DeviceAttributes>> => {
    const allData = this._fileManager.getAllData();

    if (userID) {
      return allData.filter(
        (attributes: DeviceAttributes): boolean =>
          attributes.ownerID === userID,
      );
    }
    return allData;
  };

  getById = async (
    id: string,
    userID: ?string = null,
  ): Promise<?DeviceAttributes> => {
    const attributes = this._fileManager.getFile(`${id}.json`);
    if (userID) {
      if (!attributes) {
        return null;
      }

      const ownerID = attributes.ownerID;
      if (!ownerID || ownerID !== userID) {
        return null;
      }
    }

    return attributes;
  };
}

export default DeviceAttributeFileRepository;
