// @flow

export type DeviceAttributes = {
  deviceID: string,
  ip: string,
  name: string,
  ownerID: ?string,
  particleProductId: number,
  productFirmwareVersion: string,
  registrar: string,
  timestamp: Date,
};

export type Repository<TModel> = {
  create: (model: TModel) => TModel,
  delete: (id: string) => void,
  getAll: () => Array<TModel>,
  getById: (id: string) => TModel,
  update: (model: TModel) => TModel,
};

export type ServerConfigRepository = {
  setupKeys(): () => void,
};
