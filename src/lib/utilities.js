/*
*   Copyright (C) 2013-2014 Spark Labs, Inc. All rights reserved. -  https://www.spark.io/
*
*   This file is part of the Spark-protocol module
*
*   This program is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License version 3
*   as published by the Free Software Foundation.
*
*   Spark-protocol is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with Spark-protocol.  If not, see <http://www.gnu.org/licenses/>.
*
*   You can download the source here: https://github.com/spark/spark-protocol
*
* @flow
*
*/

import type {ReadStream} from 'fs';

import logger from './logger.js';
import when from 'when';
import extend from 'xtend';
import fs from 'fs';
import path from 'path';
import settings from '../settings.js';
import ursa from 'ursa';

var utilities = {
    /**
     * Surely there is a better way to do this.
     * NOTE! This function does NOT short-circuit when an in-equality is detected.  This is
     * to avoid timing attacks.
     * @param left
     * @param right
     */
    bufferCompare: function (left: Buffer, right: Buffer): boolean {
      if (left === null && right === null) {
          return true;
      } else if (left === null || right === null) {
          return false;
      }

      if (!Buffer.isBuffer(left)) {
          left = new Buffer(left);
      }
      if (!Buffer.isBuffer(right)) {
          right = new Buffer(right);
      }

      //logger.log('left: ', left.toString('hex'), ' right: ', right.toString('hex'));

      return Buffer.compare(left, right) == 0;
    },

    /**
     * Iterates over the properties of the right object, checking to make
     * sure the properties on the left object match.
     * @param left
     * @param right
     */
    leftHasRightFilter: function (
      left: Object,
      right: Object,
    ): boolean {
        if (!left && !right) {
            return true;
        }

        for (var prop in right) {
          if (!right.hasOwnProperty(prop)) {
              continue;
          }
          if (left[prop] !== right[prop]) {
            return false;
          }
        }

        return true;
    },

    promiseStreamFile: function (fileName: string): Promise<ReadStream> {
      return new Promise((resolve, reject) => {
        try {
          fs.exists(fileName, (exists): void => {
            if (!exists) {
              logger.error('File: ' + fileName + ' doesn\'t exist.');
              reject();
            } else {
              resolve(fs.createReadStream(fileName));
            }
          });
        } catch (exception) {
          logger.error('promiseStreamFile: ' + exception);
          reject('promiseStreamFile said ' + exception);
        }
      });
    },

    toHexString: function (value: number) {
      return (value < 10 ? '0' : '') + value.toString(16);
    },

    getFilenameExt: function (fileName: string): string {
      if (!fileName || !fileName.length) {
        return fileName;
      }

      const index = fileName.lastIndexOf('.');
      if (index >= 0) {
        return fileName.substr(index);
      } else {
        return fileName;
      }
    },

    filenameNoExt: function (fileName: string): string {
      if (!fileName || (fileName.length === 0)) {
        return fileName;
      }

      const index = fileName.lastIndexOf('.');
      if (index >= 0) {
        return fileName.substr(0, index);
      } else {
        return fileName;
      }
    },

    get_core_key: function(coreId: string): Object {
      const keyFile = path.join(
        global.settings && global.settings.coreKeysDir || settings.coreKeysDir,
        coreId + '.pub.pem',
      );
      if (!fs.existsSync(keyFile)) {
        throw `Expected to find public key for core ${coreId} at ${keyFile}`;
      }
      const keyStr = fs.readFileSync(keyFile).toString();
      return ursa.createPublicKey(keyStr, 'binary');
    },

  	save_handshake_key: function(coreId: string, pem: string) {
  		const keyFile = path.join(
        global.settings && global.settings.coreKeysDir || settings.coreKeysDir,
        coreId + '_handshake.pub.pem',
      );
  		if (fs.existsSync(keyFile)) {
        return;
      }

  		logger.log(
        'I saved a key given during the handshake, (remove the _handshake ' +
          'from the filename to accept this device)',
        keyFile,
      );
  		fs.writeFileSync(keyFile, pem);
  	},

    /**
	 * base64 encodes raw binary into
	 * "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT1M+s9HTs75DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeejEJQCe6JReTQlq9F6bioK84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0DR7ECODgxc/r5+XFh9wIDAQAB"
	 * then formats into PEM format:
	 *
	 * //-----BEGIN PUBLIC KEY-----
	 * //MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT
	 * //1M+s9HTs75DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeej
	 * //EJQCe6JReTQlq9F6bioK84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0D
	 * //R7ECODgxc/r5+XFh9wIDAQAB
	 * //-----END PUBLIC KEY-----
	 *
	 * @param buf
	 * @returns {*}
	 */
	convertDERtoPEM: function(buffer: ?Buffer): ?string {
		if (!buffer || !buffer.length) {
			return null;
		}

    const bufferString = buffer.toString('base64');
		try {
			const lines = [
        '-----BEGIN PUBLIC KEY-----',
        ...(bufferString.match(/.{1,64}/g) || []),
        '-----END PUBLIC KEY-----',
      ];
			return lines.join('\n');
		} catch(exception) {
			logger.error(
        'error converting DER to PEM, was: ' +
          bufferString +
          ' ' +
          exception,
      );
		}
		return null;
	},

    foo: null
};

export default utilities;
