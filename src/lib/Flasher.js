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

import type {ReadStream} from 'fs';

import messages from './Messages';
import logger from '../lib/logger';
import utilities from '../lib/utilities';
import BufferStream from './BufferStream';
import SparkCore from '../clients/SparkCore';

import buffers from 'h5.buffers';
import {Message} from 'h5.coap';
import Option from 'h5.coap/lib/Option';
import crc32 from 'buffer-crc32';
import nullthrows from 'nullthrows';

//
//UpdateBegin — sent by Server to initiate an OTA firmware update
//UpdateReady — sent by Core to indicate readiness to receive firmware chunks
//Chunk — sent by Server to send chunks of a firmware binary to Core
//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
//UpdateDone — sent by Server to indicate all firmware chunks have been sent
//

type FlashingStage =
	'begin_update' |
	'done' |
	'prepare' |
	'send_file' |
	'teardown';

const CHUNK_SIZE = 256;
const MAX_CHUNK_SIZE = 594;
const MAX_MISSED_CHUNKS = 10;

class Flasher {
	_chunk: ?Buffer = null;
	_chunkSize: number = CHUNK_SIZE;
	_chunkIndex: number;
	_client: SparkCore = null;
	_fileBuffer: ?Buffer = null;
	_fileName: ?string = null;
	_fileStream: ?Object = null;  // TODO - Type this correctly
	_lastCrc: ?string = null;
	_protocolVersion: number = 0;
	_numChunksMissed: number = 0;
	_stage: FlashingStage = 'prepare';
	_startTime: ?Date;
	_timeoutsByName: Map<string, number> = new Map();
	_waitForChunksTimer: ?number = null;

	//
	// OTA tweaks
	//
	_fastOtaEnabled: boolean = true;
	_ignoreMissedChunks: boolean = false;

	// callbacks
	_onError: ?Function = null;
	_onSuccess: ?Function = null;
	_onStarted: ?Function = null;
	_chunkReceivedHandler: ?Function = null;

	startFlashFile = (
		filename: string,
		client: Object,
		onSuccess: Function,
		onError: Function,
	): void => {
		this._fileName = filename;
		this._client = client;
		this._onSuccess = onSuccess;
		this._onError = onError;

		this._startTime = new Date();

		if (this.claimConnection()) {
			this._startStep('prepare');
		}
	}

	_startStep = (stage: FlashingStage): void => {
		process.nextTick(() => {

			this._stage = stage;
			switch (stage) {
				case 'prepare': {
					this.prepare();
					break;
				}

				case 'begin_update': {
					this.beginUpdate();
					break;
				}

				case 'send_file': {
					this.sendFile();
					break;
				}

				case 'teardown': {
					this.teardown();
					break;
				}

				case 'done': {
					break;
				}

				default: {
					logger.log('Flasher, what stage was this? ' + this._stage);
					break;
				}
			}
		});
	}

	startFlashBuffer = (
		buffer: Buffer,
		client: Object,
		onSuccess: Function,
		onError: Function,
		onStarted: Function,
	): void => {
		this._fileBuffer = buffer;
		this._client = client;
		this._onSuccess = onSuccess;
		this._onError = onError;
		this._onStarted = onStarted;

		if (this.claimConnection()) {
			this._startStep('prepare');
		}
	}

	setChunkSize = (size: ?number): void => {
		this._chunkSize = size || CHUNK_SIZE;
	}

	claimConnection = (): boolean => {
		//suspend all other messages to the core
		if (!this._client.takeOwnership(this)) {
			this.failed('Flasher: Unable to take ownership');
			return false;
		}

		return true;
	}

	failed = (message: ?string): void => {
		if (message) {
			logger.error('Flasher failed ' + message);
		}

		this.cleanup();
		this._onError && this._onError(message);
	}

	prepare = (): void => {
		//make sure we have a file,
		//  open a stream to our file
		let fileBuffer = this._fileBuffer;
		if (fileBuffer) {
			if (fileBuffer.length === 0) {
				this.failed('Flasher: this.fileBuffer was empty.');
			} else {
				if (!Buffer.isBuffer(fileBuffer)) {
					this._fileBuffer = Buffer.from(fileBuffer);
					fileBuffer = this._fileBuffer;
				}

				this._fileStream = new BufferStream(fileBuffer);
				this._chunkIndex = -1;
				this._startStep('begin_update');
			}
		} else {
			utilities.promiseStreamFile(this._fileName)
				.promise
				.then(
					(readStream: ReadStream): void => {
						this._fileStream = readStream;
						this._chunkIndex = -1;
						this._startStep('send_file');
					},
					this.failed,
				);
		}

		this._chunk = null;
		this._lastCrc = null;

		//start listening for missed chunks before the update fully begins
		this._client.on('msg_chunkmissed', this.onChunkMissed.bind(this));
	}

	teardown = (): void => {
		this.cleanup();

		//we succeeded, short-circuit the error function so we don't count more errors than appropriate.
		this._onError = (error) => {
			logger.log('Flasher - already succeeded, not an error: ' + error);
		};

		const onSuccess = this._onSuccess;
		onSuccess && process.nextTick(() => onSuccess());
	}

	cleanup = (): void => {
		try {
			//resume all other messages to the core
			this._client.releaseOwnership(this);

			//release our file handle
			const fileStream = this._fileStream;
			if (fileStream) {
				if (fileStream.end) {
					fileStream.end();
				}
				if (fileStream.close) {
					fileStream.close();
				}

				this._fileStream = null;
			}

			//release our listeners?
			if (this._chunkReceivedHandler) {
				this._client.removeListener(
					'ChunkReceived',
					this._chunkReceivedHandler,
				);
				this._chunkReceivedHandler = null;
			}

			//cleanup when we're done...
			this.clearWatch('UpdateReady');
			this.clearWatch('CompleteTransfer');
		} catch (exception) {
			logger.error('Flasher: error during cleanup ' + exception);
		}
	}

	beginUpdate = (): void =>{
		let maxTries = 3;
		// NOTE: this is 6 because it's double the ChunkMissed 3 second delay
		const resendDelay = 6;

		// Wait for UpdateReady — sent by Core to indicate readiness to receive
		// firmware chunks
		this._client.listenFor(
			'UpdateReady',
			null,
			null,
			(message: Message): void => {
				this.clearWatch('UpdateReady');
				// we got an ok, stop listening for err
				this._client.removeAllListeners('msg_updateabort');

				let version = 0;
				if (message && (message.getPayloadLength() > 0)) {
					version = messages.fromBinary(message.getPayload(), 'byte');
				}
				this._protocolVersion = version;
				this._startStep('send_file');
				const onStarted = this._onStarted;
				onStarted && process.nextTick((): void => onStarted());
			},
			true,
		);

		//client didn't like what we had to say.
		this._client.listenFor(
			'UpdateAbort',
			/*uri*/ null,
			/*token*/ null,
			(message: Message): void => {
				this.clearWatch('UpdateReady');
				let failReason = '';
				if (message && message.getPayloadLength() > 0) {
					failReason = messages.fromBinary(message.getPayload(), 'byte');
				}

				this.failed('aborted ' + failReason);
			},
			/*once*/ true
		);


		const tryBeginUpdate = () => {
			var sentStatus = true;
			if (maxTries > 0) {
				this.failWatch('UpdateReady', resendDelay, tryBeginUpdate);

				//(MDM Proposal) Optional payload to enable fast OTA and file placement:
				//u8  flags    0x01 - Fast OTA available - when set the server can
				//  provide fast OTA transfer
				//u16 chunk size	Each chunk will be this size apart from the last which
				//  may be smaller.
				//u32 file size		The total size of the file.
				//u8 destination 	Where to store the file
				//	0x00 Firmware update
				//	0x01 External Flash
				//	0x02 User Memory Function
				//u32 destination address (0 for firmware update, otherwise the address
				//  of external flash or user memory.)

				let flags = 0;	//fast ota available
				const chunkSize = this._chunkSize;
				const fileSize = nullthrows(this._fileBuffer).length;
				const destFlag = 0;   //TODO: reserved for later
				const destAddr = 0;   //TODO: reserved for later

				if (this._fastOtaEnabled) {
					logger.log('fast ota enabled! ', this.getLogInfo());
					flags = 1;
				}

				var bufferBuilder = new buffers.BufferBuilder();
				bufferBuilder.pushUInt8(flags);
				bufferBuilder.pushUInt16(chunkSize);
				bufferBuilder.pushUInt32(fileSize);
				bufferBuilder.pushUInt8(destFlag);
				bufferBuilder.pushUInt32(destAddr);


				//UpdateBegin — sent by Server to initiate an OTA firmware update
				sentStatus = this._client.sendMessage(
					'UpdateBegin',
					null,
					bufferBuilder.toBuffer(),
					null,
					this.failed,
					this,
				);
				maxTries--;
			}	else if (maxTries===0) {
				 //give us one last LONG wait, for really really slow connections.
				 this.failWatch('UpdateReady', 90, tryBeginUpdate);
				 sentStatus = this._client.sendMessage(
					 'UpdateBegin',
					 null,
					 null,
					 null,
					 this.failed,
					 this,
				 );
				 maxTries--;
			}	else {
				this.failed('Failed waiting on UpdateReady - out of retries ');
			}

			// did we fail to send out the UpdateBegin message?
			if (sentStatus === false) {
				this.clearWatch('UpdateReady');
				this.failed('UpdateBegin failed - sendMessage failed');
			}
		};

		tryBeginUpdate();
	}

	sendFile = (): void => {
		this._chunk = null;
		this._lastCrc = null;

		//while iterating over our file...
		//Chunk — sent by Server to send chunks of a firmware binary to Core
		//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC
		//  of the received chunk data.  if Server receives CRC that does not match
		//  the chunk just sent, that chunk is sent again

		//send when ready:
		//UpdateDone — sent by Server to indicate all firmware chunks have been sent
		this.failWatch('CompleteTransfer', 600, this.failed);

		if (this._protocolVersion > 0) {
			logger.log(
				'flasher - experimental sendAllChunks!! - ',
				{coreID: this._client.getHexCoreID()},
			);
			this._sendAllChunks();
		}	else {
			this._chunkReceivedHandler = this.onChunkResponse;
			this._client.listenFor(
				'ChunkReceived',
				null,
				null,
				this._chunkReceivedHandler,
				false,
			);

			this.failWatch('CompleteTransfer', 600, this.failed);

			//get it started.
			this.readNextChunk();
			this.sendChunk();
		}
	}

	readNextChunk = (): void => {
		if (!this.fileStream) {
			logger.error('Asked to read a chunk after the update was finished');
		}

		let chunk = this._chunk = this._fileStream
			? this._fileStream.read(this._chunkSize)
			: null;

		//workaround for https://github.com/spark/core-firmware/issues/238
		if (chunk && chunk.length !== this._chunkSize) {
			const buffer = new Buffer(this._chunkSize);
			chunk.copy(buffer, 0, 0, chunk.length);
			buffer.fill(0, chunk.length, this._chunkSize);
			chunk = buffer;
		}
		this._chunkIndex++;
		//end workaround
		this._lastCrc = this._chunk ? crc32.unsigned(chunk) : null;
	}

	sendChunk = (chunkIndex?: number): void => {
		const includeIndex = this._protocolVersion > 0;

		if (this._chunk) {
			const encodedCrc = messages.toBinary(
				nullthrows(this._lastCrc),
				'crc',
			);

			this._client.sendMessage(
				'Chunk',
				{
					crc: encodedCrc,
					_writeCoapUri: (message: Message): Message => {
						message.addOption(
							new Option(Message.Option.URI_PATH, new Buffer('c')),
						);
						message.addOption(new Option(Message.Option.URI_QUERY, encodedCrc));
						if (includeIndex) {
							const indexBinary = messages.toBinary(
								chunkIndex || null, 
								'uint16',
							);
							message.addOption(
								new Option(Message.Option.URI_QUERY, indexBinary),
							);
						}
						return message;
					},
				},
				this._chunk,
				null,
				null,
				this,
			);
		} else {
			this.onAllChunksDone();
		}
	}

	onChunkResponse = (message: Buffer): void => {
		if (this._protocolVersion > 0) {
			// skip normal handling of this during fast ota.
			return;
		}

		//did the device say the CRCs matched?
		if (messages.statusIsOkay(message)) {
			this.readNextChunk();
		}

		if (!this._chunk) {
			this.onAllChunksDone();
		}	else {
			this.sendChunk();
		}
	}

	_sendAllChunks = (): void => {
		this.readNextChunk();
		while (this._chunk) {
			this.sendChunk(this._chunkIndex);
			this.readNextChunk();
		}
		// this is fast ota, let's let them re-request every single chunk at least
		// once. Then they'll get an extra ten misses.
		this._numChunksMissed = -1 * this._chunkIndex;

		//TODO: wait like 5-6 seconds, and 5-6 seconds after the last chunkmissed?
		this.onAllChunksDone();
	}

	onAllChunksDone = (): void => {
		logger.log('on response, no chunk, transfer done!');
		if (this._chunkReceivedHandler) {
			this._client.removeListener(
				'ChunkReceived',
				this._chunkReceivedHandler,
			);
		}

		this._chunkReceivedHandler = null;
		this.clearWatch('CompleteTransfer');

		if (
			!this._client.sendMessage('UpdateDone', null, null, null, null, this)
		) {
			logger.log('Flasher - failed sending updateDone message');
		}

		if (this._protocolVersion > 0) {
			this._chunkReceivedHandler = this._waitForMissedChunks.bind(this, true);
			this._client.listenFor(
				'ChunkReceived',
				null,
				null,
				this._chunkReceivedHandler,
				false,
			);

			// fast ota, lets stick around until 10 seconds after the last chunkmissed
			// message
			this._waitForMissedChunks();
		} else {
			this.clearWatch('CompleteTransfer');
			this._startStep('teardown');
		}
	}

	/**
	 * delay the teardown until at least like 10 seconds after the last
	 * chunkmissed message.
	 * @private
	 */
	_waitForMissedChunks = (wasAck?: boolean): void => {
		if (this._protocolVersion <= 0) {
			//this doesn't apply to normal slow ota
			return;
		}

		if (this._waitForChunksTimer) {
			clearTimeout(this._waitForChunksTimer);
		}

		this._waitForChunksTimer = setTimeout(
			() => this._waitForMissedChunksDone,
			60 * 1000,
		);
	}

	/**
	 * fast ota - done sticking around for missing chunks
	 * @private
	 */
	_waitForMissedChunksDone = (): void => {
		if (this._chunkReceivedHandler) {
			this._client.removeListener('ChunkReceived', this._chunkReceivedHandler);
		}
		this._chunkReceivedHandler = null;

		this.clearWatch('CompleteTransfer');
		this._startStep('teardown');
	}

	getLogInfo = (): {cache_key?: string, coreID: string} => {
		if (this._client) {
			return {
				cache_key: this._client._connectionKey,
				coreID: this._client.getHexCoreID(),
			};
		}	else {
			return { coreID: 'unknown' };
		}
	}

	onChunkMissed = (message: Message): void => {
		this._waitForMissedChunks();

		this._numChunksMissed++;
		if (this._numChunksMissed > MAX_MISSED_CHUNKS) {
			logger.error(
				'flasher - chunk missed - core over limit, killing! ',
				this.getLogInfo(),
			);
			this.failed();
			return;
		}

		// if we're not doing a fast OTA, and ignore missed is turned on, then
		// ignore this missed chunk.
		if (!this._fastOtaEnabled && this._ignoreMissedChunks) {
			logger.log('ignoring missed chunk ', this.getLogInfo());
			return;
		}

		logger.log('flasher - chunk missed - recovering ', this.getLogInfo());

		//kosher if I ack before I've read the payload?
		this._client.sendReply(
			'ChunkMissedAck',
			message.getId(),
			null,
			null,
			null,
			this,
		);


		//the payload should include one or more chunk indexes
		const payload = message.getPayload();
		var bufferReader = new buffers.BufferReader(payload);
		for(let ii = 0; ii < payload.length; ii += 2) {
			try {
				var index = bufferReader.shiftUInt16();
				this._resendChunk(index);
			} catch (exception) {
				logger.error('onChunkMissed error reading payload ' + exception);
			}
		}
	}

	_resendChunk = (index?: number): void => {
		if (typeof index === 'undefined') {
			logger.error('flasher - Got ChunkMissed, index was undefined');
			return;
		}

		const fileStream = this._fileStream;
		if (!fileStream) {
			return this.failed('ChunkMissed, fileStream was empty');
		}

		logger.log('flasher resending chunk ' + index);

		//seek
		const offset = index * this._chunkSize;
		// Super hacky but I don't feel like figuring out when a filestream is a
		// buffer stream and when it's a ReadStream.
		((fileStream: any): BufferStream).seek(offset);
		this._chunkIndex = index;

		//re-send
		this.readNextChunk();
		this.sendChunk(index);
	}

	/**
	 * Helper for managing a set of named timers and failure callbacks
	 * @param name
	 * @param seconds
	 * @param callback
	 */
	failWatch = (name: string, seconds: number, callback: ?Function): void => {
		if (!seconds) {
			clearTimeout(this._timeoutsByName.get(name));
			this._timeoutsByName.delete(name);
		}	else {
			this._timeoutsByName.set(
				name,
				setTimeout(
					(): void => {
						if (callback) {
							callback('failed waiting on ' + name);
						}
					},
					seconds * 1000,
				),
			);
		}
	}

	clearWatch = (name: string): void => {
		this.failWatch(name, 0, null);
	}
}

export default Flasher;
