/*
*   Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
*
*   This program is free software; you can redistribute it and/or
*   modify it under the terms of the GNU Lesser General Public
*   License as published by the Free Software Foundation, either
*   version 3 of the License, or (at your option) any later version.
*
*   This program is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
*   Lesser General Public License for more details.
*
*   You should have received a copy of the GNU Lesser General Public
*   License along with this program; if not, see <http://www.gnu.org/licenses/>.
*
* @flow
*
*/

import type { Duplex } from 'stream';

import { Transform } from 'stream';
import crypto from 'crypto';
import logger from '../lib/logger';
import settings from '../settings';

type CrytpoStreamOptions = {
  encrypt?: boolean,
  iv: Buffer,
  key: Buffer,
}

class CryptoStream extends Transform {
  _key: Buffer;
  _iv: Buffer;
  _encrypt: boolean;

  constructor(options: CrytpoStreamOptions) {
    super(options);

    this._key = options.key;
    this._iv = options.iv;
    this._encrypt = !!options.encrypt;
  }

  _getCipher = (callback: Function): Duplex => {
    let cipher = null;
    if (this._encrypt) {
      cipher = crypto.createCipheriv(settings.cryptoSalt, this._key, this._iv);
    } else {
      cipher = crypto.createDecipheriv(
        settings.cryptoSalt,
        this._key,
        this._iv,
      );
    }

    let cipherText = null;

    cipher.on('readable', (): void => {
      const chunk: ?Buffer = (((cipher && cipher.read()): any): Buffer);

      /*
       The crypto stream error was coming from the additional null packet
       before the end of the stream

       IE
       <Buffer a0 4a 2e 8e 2d ce de 12 15 03 7a 42 44 ca 84 88 72 64 77 61 72
        65 2f 6f 74 61 5f 63 68 75 6e 6b>
       <Buffer 5f 73 69 7a 65 ff 35 31 32>
       null
       CryptoStream transform error TypeError: Cannot read property 'length' of
        null
       Coap Error: Error: Invalid CoAP version. Expected 1, got: 3

       The if statement solves (I believe) all of the node version dependency
       issues

       */
      if(chunk) {
        if (!cipherText) {
          cipherText = chunk;
        } else {
          cipherText = Buffer.concat(
            [cipherText, chunk],
            cipherText.length + chunk.length
          );
        }
      }
    });
    cipher.on('end', (): void => {
      this.push(cipherText);

      if (this._encrypt && cipherText) {
          //logger.log("ENCRYPTING WITH ", that.iv.toString('hex'));
          //get new iv for next time.
          this._iv = new Buffer(16);
          cipherText.copy(this._iv, 0, 0, 16);

          //logger.log("ENCRYPTING WITH ", that.iv.toString('hex'));
      }
      cipherText = null;

      callback();
    });

    return cipher;
  }

  _transform = (
    chunk: Buffer | string,
    encoding: string,
    callback: Function,
  ): void => {
    try {
      //assuming it comes in full size pieces
      var cipher = this._getCipher(callback);
      cipher.write(chunk);
      cipher.end();
      cipher = null;

      //ASSERT: we just DECRYPTED an incoming message
      //THEN:
      //  update the initialization vector to the first 16 bytes of the
      //  encrypted message we just got
      if (!this._encrypt && Buffer.isBuffer(chunk)) {
        this._iv = new Buffer(16);
        ((chunk:any): Buffer).copy(this._iv, 0, 0, 16);
      }
    } catch (exception) {
      logger.error("CryptoStream transform error " + exception);
    }
  }
}

export default CryptoStream;
