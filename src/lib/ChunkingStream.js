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

import { Transform } from 'stream';
import Logger from '../lib/logger';
const logger = Logger.createModuleLogger(module);

/**
 Our job here is to accept messages in whole chunks, and put their length in front
 as we send them out, and parse them back into those size chunks as we read them in.
 **/
/* eslint-disable no-bitwise */

const MSG_LENGTH_BYTES = 2;
const messageLengthBytes = (message: Buffer | string): ?Buffer => {
  // assuming a maximum encrypted message length of 65K, lets write an
  // unsigned short int before every message, so we know how much to read out.
  const length = message.length;
  const lengthBuffer = Buffer.alloc(MSG_LENGTH_BYTES);

  lengthBuffer[0] = length >>> 8;
  lengthBuffer[1] = length & 255;

  return lengthBuffer;
};

type ChunkingStreamOptions = {
  outgoing?: boolean,
};

class ChunkingStream extends Transform {
  _combinedBuffer: ?Buffer = null;
  _currentOffset: number = 0;

  constructor(options: ChunkingStreamOptions) {
    super();

    this._transform =
      options.outgoing === true ? this._processOutput : this._processInput;
  }

  _processOutput = (buffer: Buffer, encoding: string, callback: () => void) => {
    const lengthChunk = messageLengthBytes(buffer);
    this.push(Buffer.concat(lengthChunk ? [lengthChunk, buffer] : [buffer]));
    process.nextTick(callback);
  };

  _processInput = (buffer: Buffer, encoding: string, callback: () => void) => {
    try {
      let copyStart = 0;
      if (this._combinedBuffer === null) {
        const expectedLength = (buffer[0] << 8) + buffer[1];
        this._combinedBuffer = Buffer.alloc(expectedLength);
        this._currentOffset = 0;
        copyStart = 2;
      }

      const copyEnd = Math.min(
        buffer.length,
        this._combinedBuffer.length - this._currentOffset + copyStart,
      );

      this._currentOffset += buffer.copy(
        this._combinedBuffer,
        this._currentOffset,
        copyStart,
        copyEnd,
      );

      if (this._currentOffset !== this._combinedBuffer.length) {
        process.nextTick(callback);
        return;
      }

      this.push(this._combinedBuffer);
      this._combinedBuffer = null;

      if (buffer.length <= copyEnd) {
        process.nextTick(callback);
        return;
      }

      const remainder = buffer.slice(copyEnd);
      process.nextTick((): void =>
        this._processInput(remainder, encoding, callback),
      );
    } catch (error) {
      logger.error({ err: error }, 'ChunkingStream error!');
      process.nextTick(callback);
    }
  };
}

export default ChunkingStream;
