// @flow

export type DeviceAttributes = {
  appHash: ?string,
  claimCode: ?string,
  currentBuildTarget: string,
  deviceID: string,
  imei?: string,
  ip: string,
  isCellular: boolean,
  last_iccid?: string,
  lastHeard: Date,
  name: string,
  ownerID: ?string,
  particleProductId: number,
  productFirmwareVersion: number,
  registrar: string,
  timestamp: Date,
};

export type DeviceKeyObject = {
  deviceID: string,
  key: string,
};

export type Event = EventData & {
  publishedAt: Date,
};

export type EventData = {
  connectionID?: ?string,
  context?: ?Object,
  data?: string,
  deviceID?: ?string,
  isPublic: boolean,
  name: string,
  ttl?: number,
  userID?: string,
};

export type ServerKeyRepository = {
  createKeys: (privateKeyPem: Buffer, publicKeyPem: Buffer)=> Promise<{
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  }>,
  getPrivateKey: () => Promise<?string>,
};

export interface IBaseRepository<TModel> {
  create(model: TModel | $Shape<TModel>): Promise<TModel>;
  deleteByID(id: string): Promise<void>;
  getAll(): Promise<Array<TModel>>;
  getByID(id: string): Promise<?TModel>;
  updateByID(id: string, props: $Shape<TModel>): Promise<TModel>;
}

export interface IDeviceAttributeRepository extends IBaseRepository<DeviceAttributes> {}

export interface IDeviceKeyRepository extends IBaseRepository<DeviceKeyObject> {}
