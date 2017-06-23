// @flow

export type FileTransferStoreType = 0 | 1 | 128;

export default {
  APPLICATION: 128,
  FIRMWARE: 0,
  SYSTEM: 1, // storage provided by the platform, e.g. external flash
};
