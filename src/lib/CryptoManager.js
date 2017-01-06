// @flow

import type { Repository, ServerKeyRepository } from '../types';

import crypto from 'crypto';
import CryptoStream from './CryptoStream';
import logger from './logger';
import ursa from 'ursa';
import utilities from './utilities';

const HASH_TYPE = 'sha1';
const SIGN_TYPE = 'sha256';

class CryptoManager {
  _deviceKeyRepository: Repository<string>;
  _serverKeyRepository: ServerKeyRepository;
  _privateServerKey: ?Object;

  constructor(
    deviceKeyRepository: Repository<string>,
    serverKeyRepository: ServerKeyRepository,
  ) {
    this._deviceKeyRepository = deviceKeyRepository;
    this._serverKeyRepository = serverKeyRepository;
  }

  _createCryptoStream = (
    sessionKey: Buffer,
    encrypt: boolean,
  ): CryptoStream => {
    // The first 16 bytes (MSB first) will be the key,
    // the next 16 bytes (MSB first) will be the initialization vector (IV),
    // and the final 8 bytes (MSB first) will be the salt.

    const key = new Buffer(16); //just the key... +8); //key plus salt
    const iv = new Buffer(16); //initialization vector

    sessionKey.copy(key, 0, 0, 16); //copy the key
    sessionKey.copy(iv, 0, 16, 32); //copy the iv

    return new CryptoStream({ encrypt, iv, key, });
  };

  _createServerKeys = async (): Promise<Object> => {
    // todo password?
    const privateKey = ursa.generatePrivateKey();

    await this._serverKeyRepository.createKeys(
      privateKey.toPrivatePem('binary'),
      privateKey.toPublicPem('binary'),
    );

    return privateKey;
  };

  _getServerPrivateKey = async (): Promise<Object> => {
    if (!this._privateServerKey) {
      const privateKeyString =
        await this._serverKeyRepository.getPrivateKey();

      if (!privateKeyString) {
        return await this._createServerKeys();
      }

      this._privateServerKey = ursa.createPrivateKey(
        privateKeyString,
        // todo password?
        /* password */undefined,
      );
    }
    return this._privateServerKey;
  };

  createAESCipherStream = (sessionKey: Buffer): CryptoStream =>
    this._createCryptoStream(sessionKey, true);

  createAESDecipherStream = (sessionKey: Buffer): CryptoStream =>
    this._createCryptoStream(sessionKey, false);

  createHmacDigest = (
    ciphertext: Buffer,
    sessionKey: Buffer,
  ): Buffer => {
    const hmac = crypto.createHmac(HASH_TYPE, sessionKey);
    hmac.update(ciphertext);
    return hmac.digest();
  };

  createDevicePublicKey = async (
    deviceID: string,
    publicKeyPem: string,
  ): Promise<Object> => {
    await this._deviceKeyRepository.update(deviceID, publicKeyPem);
    return ursa.createPublicKey(publicKeyPem);
  };

  decrypt = async (data: Buffer): Promise<Buffer> =>
    (await this._getServerPrivateKey()).decrypt(
      data,
      /* input buffer encoding */undefined,
      /* output buffer encoding*/undefined,
      ursa.RSA_PKCS1_PADDING,
    );

  encrypt = (publicKey: Object, data: Buffer): Buffer =>
    publicKey.encrypt(
      data,
      /* input buffer encoding */undefined,
      /* output buffer encoding*/undefined,
      ursa.RSA_PKCS1_PADDING,
    );

  getDevicePublicKey = async (deviceID: string): Promise<?Object> => {
    const publicKeyString = await this._deviceKeyRepository.getById(deviceID);
    if (!publicKeyString) {
      return null;
    }

    return ursa.createPublicKey(publicKeyString);
  };

  getRandomBytes = (size: number): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      crypto.randomBytes(size, (error, buffer) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(buffer);
      });
    });

  static getRandomUINT16 = (): number => {
    const uintMax = Math.pow(2, 16) - 1;
    return Math.floor((Math.random() * uintMax) + 1);
  };

  sign = async (hash: Buffer): Promise<Buffer> =>
    (await this._getServerPrivateKey()).privateEncrypt(hash);

  verify = (
    publicKey: Object,
    hash: Buffer,
    signature: Buffer,
  ): boolean => {
    try {
      const decryptedSignature = publicKey.publicDecrypt(signature);

      // todo refactor utils?
      return utilities.bufferCompare(hash, decryptedSignature);
    }
    catch (error) {
      logger.error(`hash verify error: ${error.message}`);
    }
    return false;
  };
}

export default CryptoManager;
