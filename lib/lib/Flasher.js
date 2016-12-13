'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _Messages = require('./Messages');

var _Messages2 = _interopRequireDefault(_Messages);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _utilities = require('../lib/utilities');

var _utilities2 = _interopRequireDefault(_utilities);

var _BufferStream = require('./BufferStream');

var _BufferStream2 = _interopRequireDefault(_BufferStream);

var _SparkCore = require('../clients/SparkCore');

var _SparkCore2 = _interopRequireDefault(_SparkCore);

var _h = require('h5.buffers');

var _h2 = _interopRequireDefault(_h);

var _h3 = require('h5.coap');

var _Option = require('h5.coap/lib/Option');

var _Option2 = _interopRequireDefault(_Option);

var _bufferCrc = require('buffer-crc32');

var _bufferCrc2 = _interopRequireDefault(_bufferCrc);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } } /*
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
                                                                                                                                                          * 
                                                                                                                                                          *
                                                                                                                                                          */

//
//UpdateBegin — sent by Server to initiate an OTA firmware update
//UpdateReady — sent by Core to indicate readiness to receive firmware chunks
//Chunk — sent by Server to send chunks of a firmware binary to Core
//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
//UpdateDone — sent by Server to indicate all firmware chunks have been sent
//

var CHUNK_SIZE = 256;
var MAX_CHUNK_SIZE = 594;
var MAX_MISSED_CHUNKS = 10;

var Flasher =

// callbacks


//
// OTA tweaks
//
function Flasher(client) {
	var _this = this;

	_classCallCheck(this, Flasher);

	this._chunk = null;
	this._chunkSize = CHUNK_SIZE;
	this._fileBuffer = null;
	this._fileName = null;
	this._fileStream = null;
	this._lastCrc = null;
	this._protocolVersion = 0;
	this._numChunksMissed = 0;
	this._stage = 'prepare';
	this._timeoutsByName = new Map();
	this._waitForChunksTimer = null;
	this._fastOtaEnabled = true;
	this._ignoreMissedChunks = false;
	this._onError = null;
	this._onSuccess = null;
	this._onStarted = null;
	this._chunkReceivedHandler = null;

	this.startFlashFile = function (filename, onSuccess, onError) {
		_this._fileName = filename;
		_this._onSuccess = onSuccess;
		_this._onError = onError;

		_this._startTime = new Date();

		if (_this.claimConnection()) {
			_this._startStep('prepare');
		}
	};

	this._startStep = function (stage) {
		process.nextTick(function () {

			_this._stage = stage;
			switch (stage) {
				case 'prepare':
					{
						_this.prepare();
						break;
					}

				case 'begin_update':
					{
						_this.beginUpdate();
						break;
					}

				case 'send_file':
					{
						_this.sendFile();
						break;
					}

				case 'teardown':
					{
						_this.teardown();
						break;
					}

				case 'done':
					{
						break;
					}

				default:
					{
						_logger2.default.log('Flasher, what stage was this? ' + _this._stage);
						break;
					}
			}
		});
	};

	this.startFlashBuffer = function (buffer, onSuccess, onError, onStarted) {
		_this._fileBuffer = buffer;
		_this._onSuccess = onSuccess;
		_this._onError = onError;
		_this._onStarted = onStarted;

		if (_this.claimConnection()) {
			_this._startStep('prepare');
		}
	};

	this.setChunkSize = function (size) {
		_this._chunkSize = size || CHUNK_SIZE;
	};

	this.claimConnection = function () {
		//suspend all other messages to the core
		if (!_this._client.takeOwnership(_this)) {
			_this.failed('Flasher: Unable to take ownership');
			return false;
		}

		return true;
	};

	this.failed = function (message) {
		if (message) {
			_logger2.default.error('Flasher failed ' + message);
		}

		_this.cleanup();
		_this._onError && _this._onError(message || '');
	};

	this.prepare = function () {
		//make sure we have a file,
		//  open a stream to our file
		var fileBuffer = _this._fileBuffer;
		if (fileBuffer) {
			if (fileBuffer.length === 0) {
				_this.failed('Flasher: this.fileBuffer was empty.');
			} else {
				if (!Buffer.isBuffer(fileBuffer)) {
					_this._fileBuffer = Buffer.from(fileBuffer);
					fileBuffer = _this._fileBuffer;
				}

				console.log('FILE BUFFER', fileBuffer);

				_this._fileStream = new _BufferStream2.default(fileBuffer);
				_this._chunkIndex = -1;
				_this._startStep('begin_update');
			}
		} else {
			_utilities2.default.promiseStreamFile((0, _nullthrows2.default)(_this._fileName)).then(function (readStream) {
				_this._fileStream = readStream;
				_this._chunkIndex = -1;
				_this._startStep('send_file');
			}, _this.failed);
		}

		_this._chunk = null;
		_this._lastCrc = null;

		//start listening for missed chunks before the update fully begins
		_this._client.on('msg_chunkmissed', _this.onChunkMissed.bind(_this));
	};

	this.teardown = function () {
		_this.cleanup();

		//we succeeded, short-circuit the error function so we don't count more errors than appropriate.
		_this._onError = function (error) {
			_logger2.default.log('Flasher - already succeeded, not an error: ' + error);
		};

		var onSuccess = _this._onSuccess;
		onSuccess && process.nextTick(function () {
			return onSuccess();
		});
	};

	this.cleanup = function () {
		try {
			//resume all other messages to the core
			_this._client.releaseOwnership(_this);

			//release our file handle
			var fileStream = _this._fileStream;
			if (fileStream) {
				fileStream.close();
				_this._fileStream = null;
			}

			//release our listeners?
			if (_this._chunkReceivedHandler) {
				_this._client.removeListener('ChunkReceived', _this._chunkReceivedHandler);
				_this._chunkReceivedHandler = null;
			}

			//cleanup when we're done...
			_this.clearWatch('UpdateReady');
			_this.clearWatch('CompleteTransfer');
		} catch (exception) {
			_logger2.default.error('Flasher: error during cleanup ' + exception);
		}
	};

	this.beginUpdate = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
		var maxTries, resendDelay, message, version, onStarted, tryBeginUpdate;
		return regeneratorRuntime.wrap(function _callee$(_context) {
			while (1) {
				switch (_context.prev = _context.next) {
					case 0:
						maxTries = 3;
						// NOTE: this is 6 because it's double the ChunkMissed 3 second delay

						resendDelay = 6;

						// Wait for UpdateReady — sent by Core to indicate readiness to receive
						// firmware chunks

						_context.next = 4;
						return Promise.race([_this._client.listenFor('UpdateReady',
						/*uri*/null,
						/*token*/null).then(function (message) {
							_this.clearWatch('UpdateReady');
							_this._client.removeAllListeners('msg_updateabort');
							return message;
						}), _this._client.listenFor('UpdateAbort',
						/*uri*/null,
						/*token*/null).then(function (message) {
							_this.clearWatch('UpdateReady');
							var failReason = '';
							if (message && message.getPayloadLength() > 0) {
								failReason = _Messages2.default.fromBinary(message.getPayload(), 'byte');
							}

							_this.failed('aborted ' + failReason);
							return message;
						})]);

					case 4:
						message = _context.sent;
						version = 0;

						if (message && message.getPayloadLength() > 0) {
							version = _Messages2.default.fromBinary(message.getPayload(), 'byte');
						}
						_this._protocolVersion = version;
						_this._startStep('send_file');
						onStarted = _this._onStarted;

						onStarted && process.nextTick(function () {
							return onStarted();
						});

						tryBeginUpdate = function tryBeginUpdate() {
							var sentStatus = true;
							if (maxTries > 0) {
								_this.failWatch('UpdateReady', resendDelay, tryBeginUpdate);

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

								var flags = 0; //fast ota available
								var chunkSize = _this._chunkSize;
								var fileSize = (0, _nullthrows2.default)(_this._fileBuffer).length;
								var destFlag = 0; //TODO: reserved for later
								var destAddr = 0; //TODO: reserved for later

								if (_this._fastOtaEnabled) {
									_logger2.default.log('fast ota enabled! ', _this.getLogInfo());
									flags = 1;
								}

								var bufferBuilder = new _h2.default.BufferBuilder();
								bufferBuilder.pushUInt8(flags);
								bufferBuilder.pushUInt16(chunkSize);
								bufferBuilder.pushUInt32(fileSize);
								bufferBuilder.pushUInt8(destFlag);
								bufferBuilder.pushUInt32(destAddr);

								//UpdateBegin — sent by Server to initiate an OTA firmware update
								sentStatus = _this._client.sendMessage('UpdateBegin', null, bufferBuilder.toBuffer(), _this);
								maxTries--;
							} else if (maxTries === 0) {
								//give us one last LONG wait, for really really slow connections.
								_this.failWatch('UpdateReady', 90, tryBeginUpdate);
								sentStatus = _this._client.sendMessage('UpdateBegin', null, null, _this);
								maxTries--;
							} else {
								_this.failed('Failed waiting on UpdateReady - out of retries ');
							}

							// did we fail to send out the UpdateBegin message?
							if (sentStatus === false) {
								_this.clearWatch('UpdateReady');
								_this.failed('UpdateBegin failed - sendMessage failed');
							}
						};

						tryBeginUpdate();

					case 13:
					case 'end':
						return _context.stop();
				}
			}
		}, _callee, _this);
	}));
	this.sendFile = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
		var result;
		return regeneratorRuntime.wrap(function _callee2$(_context2) {
			while (1) {
				switch (_context2.prev = _context2.next) {
					case 0:
						_this._chunk = null;
						_this._lastCrc = null;

						//while iterating over our file...
						//Chunk — sent by Server to send chunks of a firmware binary to Core
						//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC
						//  of the received chunk data.  if Server receives CRC that does not match
						//  the chunk just sent, that chunk is sent again

						//send when ready:
						//UpdateDone — sent by Server to indicate all firmware chunks have been sent
						_this.failWatch('CompleteTransfer', 600, _this.failed);

						if (!(_this._protocolVersion > 0)) {
							_context2.next = 8;
							break;
						}

						_logger2.default.log('flasher - experimental sendAllChunks!! - ', { coreID: _this._client.getHexCoreID() });
						_this._sendAllChunks();
						_context2.next = 15;
						break;

					case 8:
						_context2.next = 10;
						return _this._client.listenFor('ChunkReceived', null, null);

					case 10:
						result = _context2.sent;


						_this.onChunkResponse(result);

						_this.failWatch('CompleteTransfer', 600, _this.failed);

						//get it started.
						_this.readNextChunk();
						_this.sendChunk();

					case 15:
					case 'end':
						return _context2.stop();
				}
			}
		}, _callee2, _this);
	}));

	this.readNextChunk = function () {
		if (!_this.fileStream) {
			_logger2.default.error('Asked to read a chunk after the update was finished');
		}

		var chunk = _this._chunk = _this._fileStream ? new Buffer(_this._fileStream.read(_this._chunkSize) || '') : null;

		//workaround for https://github.com/spark/core-firmware/issues/238
		if (chunk && chunk.length !== _this._chunkSize) {
			var buffer = new Buffer(_this._chunkSize);
			chunk.copy(buffer, 0, 0, chunk.length);
			buffer.fill(0, chunk.length, _this._chunkSize);
			chunk = buffer;
		}
		_this._chunkIndex++;
		//end workaround
		_this._lastCrc = chunk ? _bufferCrc2.default.unsigned(chunk) : null;
	};

	this.sendChunk = function () {
		var _ref3 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
			var chunkIndex = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
			var includeIndex, encodedCrc;
			return regeneratorRuntime.wrap(function _callee3$(_context3) {
				while (1) {
					switch (_context3.prev = _context3.next) {
						case 0:
							includeIndex = _this._protocolVersion > 0;

							if (_this._chunk) {
								_context3.next = 5;
								break;
							}

							_context3.next = 4;
							return _this.onAllChunksDone();

						case 4:
							return _context3.abrupt('return');

						case 5:
							encodedCrc = _Messages2.default.toBinary((0, _nullthrows2.default)(_this._lastCrc), 'crc');


							_this._client.sendMessage('Chunk', {
								crc: encodedCrc,
								_writeCoapUri: function _writeCoapUri(message) {
									message.addOption(new _Option2.default(_h3.Message.Option.URI_PATH, new Buffer('c')));
									message.addOption(new _Option2.default(_h3.Message.Option.URI_QUERY, encodedCrc));
									if (includeIndex) {
										var indexBinary = _Messages2.default.toBinary(chunkIndex || null, 'uint16');
										message.addOption(new _Option2.default(_h3.Message.Option.URI_QUERY, indexBinary));
									}
									return message;
								}
							}, _this._chunk, _this);

						case 7:
						case 'end':
							return _context3.stop();
					}
				}
			}, _callee3, _this);
		}));

		return function (_x) {
			return _ref3.apply(this, arguments);
		};
	}();

	this.onChunkResponse = function (message) {
		if (_this._protocolVersion > 0) {
			// skip normal handling of this during fast ota.
			return;
		}

		//did the device say the CRCs matched?
		if (_Messages2.default.statusIsOkay(message)) {
			_this.readNextChunk();
		}

		if (!_this._chunk) {
			_this.onAllChunksDone();
		} else {
			_this.sendChunk();
		}
	};

	this._sendAllChunks = function () {
		_this.readNextChunk();
		while (_this._chunk) {
			_this.sendChunk(_this._chunkIndex);
			_this.readNextChunk();
		}
		// this is fast ota, let's let them re-request every single chunk at least
		// once. Then they'll get an extra ten misses.
		_this._numChunksMissed = -1 * _this._chunkIndex;

		//TODO: wait like 5-6 seconds, and 5-6 seconds after the last chunkmissed?
		_this.onAllChunksDone();
	};

	this.onAllChunksDone = _asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
		var result;
		return regeneratorRuntime.wrap(function _callee4$(_context4) {
			while (1) {
				switch (_context4.prev = _context4.next) {
					case 0:
						_logger2.default.log('on response, no chunk, transfer done!');
						if (_this._chunkReceivedHandler) {
							_this._client.removeListener('ChunkReceived', _this._chunkReceivedHandler);
						}

						_this._chunkReceivedHandler = null;
						_this.clearWatch('CompleteTransfer');

						if (!_this._client.sendMessage('UpdateDone', null, null, _this)) {
							_logger2.default.log('Flasher - failed sending updateDone message');
						}

						if (!(_this._protocolVersion > 0)) {
							_context4.next = 12;
							break;
						}

						_context4.next = 8;
						return _this._client.listenFor('ChunkReceived', null, null);

					case 8:
						result = _context4.sent;


						// fast ota, lets stick around until 10 seconds after the last chunkmissed
						// message
						_this._waitForMissedChunks(true);
						_context4.next = 14;
						break;

					case 12:
						_this.clearWatch('CompleteTransfer');
						_this._startStep('teardown');

					case 14:
					case 'end':
						return _context4.stop();
				}
			}
		}, _callee4, _this);
	}));
	this._waitForMissedChunks = _asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
		return regeneratorRuntime.wrap(function _callee5$(_context5) {
			while (1) {
				switch (_context5.prev = _context5.next) {
					case 0:
						if (!(_this._protocolVersion <= 0)) {
							_context5.next = 2;
							break;
						}

						return _context5.abrupt('return');

					case 2:

						if (_this._waitForChunksTimer) {
							clearTimeout(_this._waitForChunksTimer);
						}

						_this._waitForChunksTimer = setTimeout(function () {
							return _this._waitForMissedChunksDone;
						}, 60 * 1000);

					case 4:
					case 'end':
						return _context5.stop();
				}
			}
		}, _callee5, _this);
	}));

	this._waitForMissedChunksDone = function () {
		if (_this._chunkReceivedHandler) {
			_this._client.removeListener('ChunkReceived', _this._chunkReceivedHandler);
		}
		_this._chunkReceivedHandler = null;

		_this.clearWatch('CompleteTransfer');
		_this._startStep('teardown');
	};

	this.getLogInfo = function () {
		if (_this._client) {
			return {
				cache_key: _this._client._connectionKey || undefined,
				coreID: _this._client.getHexCoreID()
			};
		} else {
			return { coreID: 'unknown' };
		}
	};

	this.onChunkMissed = function (message) {
		_this._waitForMissedChunks();

		_this._numChunksMissed++;
		if (_this._numChunksMissed > MAX_MISSED_CHUNKS) {
			_logger2.default.error('flasher - chunk missed - core over limit, killing! ', _this.getLogInfo());
			_this.failed();
			return;
		}

		// if we're not doing a fast OTA, and ignore missed is turned on, then
		// ignore this missed chunk.
		if (!_this._fastOtaEnabled && _this._ignoreMissedChunks) {
			_logger2.default.log('ignoring missed chunk ', _this.getLogInfo());
			return;
		}

		_logger2.default.log('flasher - chunk missed - recovering ', _this.getLogInfo());

		//kosher if I ack before I've read the payload?
		_this._client.sendReply('ChunkMissedAck', message.getId(), null, null, _this);

		//the payload should include one or more chunk indexes
		var payload = message.getPayload();
		var bufferReader = new _h2.default.BufferReader(payload);
		for (var ii = 0; ii < payload.length; ii += 2) {
			try {
				var index = bufferReader.shiftUInt16();
				_this._resendChunk(index);
			} catch (exception) {
				_logger2.default.error('onChunkMissed error reading payload ' + exception);
			}
		}
	};

	this._resendChunk = function (index) {
		if (typeof index === 'undefined') {
			_logger2.default.error('flasher - Got ChunkMissed, index was undefined');
			return;
		}

		var fileStream = _this._fileStream;
		if (!fileStream) {
			return _this.failed('ChunkMissed, fileStream was empty');
		}

		_logger2.default.log('flasher resending chunk ' + index);

		//seek
		var offset = index * _this._chunkSize;
		// Super hacky but I don't feel like figuring out when a filestream is a
		// buffer stream and when it's a ReadStream.
		fileStream.seek(offset);
		_this._chunkIndex = index;

		//re-send
		_this.readNextChunk();
		_this.sendChunk(index);
	};

	this.failWatch = function (name, seconds, callback) {
		if (!seconds) {
			clearTimeout(_this._timeoutsByName.get(name));
			_this._timeoutsByName.delete(name);
		} else {
			_this._timeoutsByName.set(name, setTimeout(function () {
				if (callback) {
					callback('failed waiting on ' + name);
				}
			}, seconds * 1000));
		}
	};

	this.clearWatch = function (name) {
		_this.failWatch(name, 0, null);
	};

	this._client = client;
}

/**
 * delay the teardown until at least like 10 seconds after the last
 * chunkmissed message.
 * @private
 */


/**
 * fast ota - done sticking around for missing chunks
 * @private
 */


/**
 * Helper for managing a set of named timers and failure callbacks
 * @param name
 * @param seconds
 * @param callback
 */
;

exports.default = Flasher;