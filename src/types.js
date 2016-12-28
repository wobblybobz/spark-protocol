// @flow

export type DeviceAttributes = {
  deviceID: string,
  ip: string,
  name: string,
  ownerID: ?string,
  particleProductId: number,
  productFirmwareVersion: number,
  registrar: string,
  timestamp: Date,
};

export type Event = EventData & {
  publishedAt: Date,
};

export type EventData = {
  data: ?Object,
  deviceID?: ?string,
  isPublic: boolean,
  name: string,
  ttl: number,
  userID?: ?string,
};

export type Repository<TModel> = {
  create: (model: TModel) => Promise<TModel>,
  deleteById: (id: string) => Promise<void>,
  getAll: () => Promise<Array<TModel>>,
  getById: (id: string) => Promise<?TModel>,
  update: (model: TModel) => Promise<TModel>,
};

export type ServerConfigRepository = {
  setupKeys(): void,
};
