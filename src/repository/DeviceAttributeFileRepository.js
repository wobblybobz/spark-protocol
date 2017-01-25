// @flow

import type { DeviceAttributes } from '../types';

import JSONFileManager from './JSONFileManager';
import memoizeGet from '../decorators/memoizeGet';
import memoizeSet from '../decorators/memoizeSet';

class DeviceAttributeFileRepository {
  _fileManager: JSONFileManager;

  constructor(path: string) {
    this._fileManager = new JSONFileManager(path);
  }

  // eslint-disable-next-line no-unused-vars
  create = async (model: DeviceAttributes): Promise<DeviceAttributes> => {
    throw new Error('Create device attributes not implemented');
  };

  @memoizeSet()
  async update(model: DeviceAttributes): Promise<DeviceAttributes> {
    const modelToSave = {
      ...model,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(`${model.deviceID}.json`, modelToSave);
    return modelToSave;
  }

  @memoizeSet(['deviceID'])
  async deleteById(id: string): Promise<void> {
    this._fileManager.deleteFile(`${id}.json`);
  }

  doesUserHaveAccess = async (
    id: string,
    userID: string,
  ): Promise<boolean> =>
    !!(await this.getById(id, userID));

  getAll = async (userID: ?string = null): Promise<Array<DeviceAttributes>> => {
    const allData = await this._getAll();

    if (userID) {
      return allData.filter(
        (attributes: DeviceAttributes): boolean =>
          attributes.ownerID === userID,
      );
    }
    return allData;
  }

  getById = async (
    id: string,
    userID: ?string = null,
  ): Promise<?DeviceAttributes> => {
    const attributes = await this._getByID(id);
    if (!attributes) {
      return null;
    }

    if (userID) {
      const ownerID = attributes.ownerID;
      if (!ownerID || ownerID !== userID) {
        return null;
      }
    }

    return attributes;
  };

  @memoizeGet(['deviceID'])
  async _getByID(
    id: string,
  ): Promise<?DeviceAttributes> {
    return this._fileManager.getFile(`${id}.json`);
  }

  @memoizeGet()
  async _getAll(): Promise<Array<DeviceAttributes>> {
    return this._fileManager.getAllData();
  }
}

export default DeviceAttributeFileRepository;
