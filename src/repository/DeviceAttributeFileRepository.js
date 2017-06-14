// @flow

import type { DeviceAttributes } from '../types';

import JSONFileManager from './JSONFileManager';
import memoizeGet from '../decorators/memoizeGet';
import memoizeSet from '../decorators/memoizeSet';

// getByID, deleteByID and update uses model.deviceID as ID for querying
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
  async updateByID(
    deviceID: string,
    props: $Shape<DeviceAttributes>,
  ): Promise<DeviceAttributes> {
    const currentAttributes = await this.getByID(deviceID);
    const modelToSave = {
      ...(currentAttributes || {}),
      ...props,
      timestamp: new Date(),
    };

    this._fileManager.writeFile(`${deviceID}.json`, modelToSave);
    return modelToSave;
  }

  @memoizeSet(['deviceID'])
  async deleteByID(deviceID: string): Promise<void> {
    this._fileManager.deleteFile(`${deviceID}.json`);
  }

  getAll = async (userID: ?string = null): Promise<Array<DeviceAttributes>> => {
    const allData = await this._getAll();

    if (userID) {
      return allData.filter(
        (attributes: DeviceAttributes): boolean =>
          attributes.ownerID === userID,
      );
    }
    return allData;
  };

  @memoizeGet(['deviceID'])
  async getByID(
    deviceID: string,
  ): Promise<?DeviceAttributes> {
    return this._fileManager.getFile(`${deviceID}.json`);
  }

  @memoizeGet()
  async _getAll(): Promise<Array<DeviceAttributes>> {
    return this._fileManager.getAllData();
  }
}

export default DeviceAttributeFileRepository;
