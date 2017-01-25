// @flow

import type { Repository, ServerKeyRepository } from '../types';

import crypto from 'crypto';
import CryptoStream from './CryptoStream';
import ursa from 'ursa';

const HASH_TYPE = 'sha1';

class CryptoManager {
  _deviceKeyRepository: Repository<string>;
  _serverKeyRepository: ServerKeyRepository;
  _privateServerKey: ?Object;
  _serverKeyPassword: ?string;

  constructor(
    deviceKeyRepository: Repository<string>,
    serverKeyRepository: ServerKeyRepository,
    serverKeyPassword: ?string,
  ) {
    this._deviceKeyRepository = deviceKeyRepository;
    this._serverKeyRepository = serverKeyRepository;
    this._serverKeyPassword = serverKeyPassword;
  }

  _createCryptoStream = (
    sessionKey: Buffer,
    encrypt: boolean,
  ): CryptoStream => {
    // The first 16 bytes (MSB first) will be the key,
    // the next 16 bytes (MSB first) will be the initialization vector (IV),
    // and the final 8 bytes (MSB first) will be the salt.

    const key = new Buffer(16); // just the key... +8); //key plus salt
    const iv = new Buffer(16); // initialization vector

    sessionKey.copy(key, 0, 0, 16); // copy the key
    sessionKey.copy(iv, 0, 16, 32); // copy the iv

    return new CryptoStream({ encrypt, iv, key });
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
        this._serverKeyPassword || undefined,
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
    new Promise((
      resolve: (buffer: Buffer) => void,
      reject: (error: Error) => void,
    ) => {
      crypto.randomBytes(
        size,
        (error: ?Error, buffer: Buffer) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(buffer);
        },
      );
    });

  static getRandomUINT16 = (): number => {
    // ** - the same as Math.pow()
    const uintMax = 2 ** 16 - 1; // 65535
    return Math.floor((Math.random() * uintMax) + 1);
  };

  sign = async (hash: Buffer): Promise<Buffer> =>
    (await this._getServerPrivateKey()).privateEncrypt(hash);
}

export default CryptoManager;
