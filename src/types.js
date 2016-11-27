export type DeviceAttributes = {
  deviceId: string,
  ip: string,
  particleProductId: number,
  productFirmwareVersion: number,
  registrar: string,
  timestamp: Date,
};

export type Repository<TModel> = {
  create(id: string, model: TModel) => TModel,
  delete(id: string) => void,
  getAll() => Array<TModel>,
  getById(id: string) => TModel,
  update(id: string, model: TModel) => TModel,
};
