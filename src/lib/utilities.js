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

class utilities {
  /**
   * Surely there is a better way to do this.
   * NOTE! This function does NOT short-circuit when an in-equality is
     detected.  This is
   * to avoid timing attacks.
   * @param left
   * @param right
   */
  static bufferCompare = (left: Buffer, right: Buffer): boolean => {
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

    return Buffer.compare(left, right) == 0;
  }

  static toHexString = (value: number): string => {
    return (value < 10 ? '0' : '') + value.toString(16);
  };

  /**
   * base64 encodes raw binary into
   * "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDHzg9dPG03Kv4NkS3N0xJfU8lT1M+s9HTs75
      DE1tpwXfU4GkfaLLr04j6jFpMeeggKCgWJsKyIAR9CNlVHC1IUYeejEJQCe6JReTQlq9F6bioK
      84nc9QsFTpiCIqeTAZE4t6Di5pF8qrUgQvREHrl4Nw0DR7ECODgxc/r5+XFh9wIDAQAB"
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
  static convertDERtoPEM = (buffer: ?Buffer): ?string => {
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
  };
};

export default utilities;
