// @flow

export type DeviceAttributes = {
  deviceID: string,
  ip: string,
  name: string,
  claimCode: ?string,
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
  data: ?Object | string,
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

export type ServerKeyRepository = {
  createKeys: (privateKeyPem: Buffer, publicKeyPem: Buffer)=> Promise<{
    privateKeyPem: Buffer,
    publicKeyPem: Buffer,
  }>,
  getPrivateKey: () => Promise<?string>,
};

export type TokenObject = {
  accessToken: string,
  accessTokenExpiresAt: Date,
  refreshToken: string,
  refreshTokenExpiresAt: Date,
  scope: string,
};

export type User = {
  accessTokens: Array<TokenObject>,
  claimCodes: Array<string>,
  created_at: Date,
  id: string,
  passwordHash: string,
  salt: string,
  username: string,
};

export type UserRepository = {
  addClaimCode(userID: string, claimCode: string): Promise<User>,
  getByClaimCode(claimCode: string): Promise<?User>,
  removeClaimCode(userID: string, claimCode: string): Promise<?User>,
};
