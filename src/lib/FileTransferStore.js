// @flow

export type FileTransferStoreType =
  0 |
  1 |
  128;

export default {
  FIRMWARE: 0,
  SYSTEM: 1,          // storage provided by the platform, e.g. external flash
  APPLICATION: 128,
};
