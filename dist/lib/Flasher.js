'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _from = require('babel-runtime/core-js/array/from');

var _from2 = _interopRequireDefault(_from);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _set = require('babel-runtime/core-js/set');

var _set2 = _interopRequireDefault(_set);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _Messages = require('./Messages');

var _Messages2 = _interopRequireDefault(_Messages);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _utilities = require('../lib/utilities');

var _utilities2 = _interopRequireDefault(_utilities);

var _BufferStream = require('./BufferStream');

var _BufferStream2 = _interopRequireDefault(_BufferStream);

var _Device = require('../clients/Device');

var _Device2 = _interopRequireDefault(_Device);

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

//
//UpdateBegin — sent by Server to initiate an OTA firmware update
//UpdateReady — sent by Core to indicate readiness to receive firmware chunks
//Chunk — sent by Server to send chunks of a firmware binary to Core
//ChunkReceived — sent by Core to respond to each chunk, indicating the CRC of the received chunk data.  if Server receives CRC that does not match the chunk just sent, that chunk is sent again
//UpdateDone — sent by Server to indicate all firmware chunks have been sent
//

var CHUNK_SIZE = 256; /*
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

var MAX_CHUNK_SIZE = 594;
var MAX_MISSED_CHUNKS = 10;

var Flasher =

//
// OTA tweaks
//
function Flasher(client) {
	var _this = this;

	(0, _classCallCheck3.default)(this, Flasher);
	this._chunk = null;
	this._chunkSize = CHUNK_SIZE;
	this._fileStream = null;
	this._lastCrc = null;
	this._protocolVersion = 0;
	this._missedChunks = new _set2.default();
	this._fastOtaEnabled = false;
	this._ignoreMissedChunks = false;

	this.startFlashBuffer = function () {
		var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(buffer) {
			var address = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '0x0';
			return _regenerator2.default.wrap(function _callee$(_context) {
				while (1) {
					switch (_context.prev = _context.next) {
						case 0:
							_context.prev = 0;

							if (_this._claimConnection()) {
								_context.next = 3;
								break;
							}

							return _context.abrupt('return');

						case 3:

							_this._startTime = new Date();

							_this._prepare(buffer);
							_context.next = 7;
							return _this._beginUpdate(buffer, address);

						case 7:
							_context.next = 9;
							return _promise2.default.race([
							// Fail after 60 of trying to flash
							new _promise2.default(function (resolve, reject) {
								return setTimeout(function () {
									return reject('Update timed out');
								}, 60 * 1000);
							}), _this._sendFile()]);

						case 9:
							_context.next = 11;
							return _this._onAllChunksDone();

						case 11:
							_this._cleanup();
							_context.next = 18;
							break;

						case 14:
							_context.prev = 14;
							_context.t0 = _context['catch'](0);

							_this._cleanup();
							throw _context.t0;

						case 18:
						case 'end':
							return _context.stop();
					}
				}
			}, _callee, _this, [[0, 14]]);
		}));

		return function (_x, _x2) {
			return _ref.apply(this, arguments);
		};
	}();

	this._prepare = function (fileBuffer) {
		//make sure we have a file,
		//  open a stream to our file
		if (!fileBuffer || fileBuffer.length === 0) {
			throw new Error('Flasher: this.fileBuffer was empty.');
		} else {
			_this._fileStream = new _BufferStream2.default(fileBuffer);
		}

		_this._chunk = null;
		_this._lastCrc = null;

		_this._chunkIndex = -1;

		//start listening for missed chunks before the update fully begins
		_this._client.on('msg_chunkmissed', function (message) {
			return _this._onChunkMissed(message);
		});
	};

	this._claimConnection = function () {
		//suspend all other messages to the core
		if (!_this._client.takeOwnership(_this)) {
			throw new Error('Flasher: Unable to take ownership');
		}

		return true;
	};

	this._beginUpdate = function () {
		var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3(buffer, address) {
			var maxTries, tryBeginUpdate;
			return _regenerator2.default.wrap(function _callee3$(_context3) {
				while (1) {
					switch (_context3.prev = _context3.next) {
						case 0:
							maxTries = 3;

							tryBeginUpdate = function () {
								var _ref3 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
									var delay, sentStatus, message, version;
									return _regenerator2.default.wrap(function _callee2$(_context2) {
										while (1) {
											switch (_context2.prev = _context2.next) {
												case 0:
													if (!(maxTries < 0)) {
														_context2.next = 2;
														break;
													}

													throw new Error('Failed waiting on UpdateReady - out of retries ');

												case 2:

													// NOTE: this is 6 because it's double the ChunkMissed 3 second delay
													// The 90 second delay is crazy but try it just in case.
													delay = maxTries > 0 ? 6 : 90;
													sentStatus = _this._sendBeginUpdateMessage(buffer, address);

													maxTries--;

													// did we fail to send out the UpdateBegin message?

													if (!(sentStatus === false)) {
														_context2.next = 7;
														break;
													}

													throw new Error('UpdateBegin failed - sendMessage failed');

												case 7:
													_context2.next = 9;
													return _promise2.default.race([_this._client.listenFor('UpdateReady',
													/*uri*/null,
													/*token*/null), _this._client.listenFor('UpdateAbort',
													/*uri*/null,
													/*token*/null).then(function (message) {
														var failReason = '';
														if (message && message.getPayloadLength() > 0) {
															failReason = _Messages2.default.fromBinary(message.getPayload(), 'byte');
														}

														throw new Error('aborted ' + failReason);
													}),
													// Try to update multiple times
													new _promise2.default(function (resolve, reject) {
														return setTimeout(function () {
															if (maxTries <= 0) {
																return;
															}

															tryBeginUpdate();
															resolve();
														}, delay * 1000);
													})]);

												case 9:
													message = _context2.sent;

													if (message) {
														_context2.next = 12;
														break;
													}

													return _context2.abrupt('return');

												case 12:

													maxTries = 0;

													version = 0;

													if (message && message.getPayloadLength() > 0) {
														version = _Messages2.default.fromBinary(message.getPayload(), 'byte');
													}
													_this._protocolVersion = version;

												case 16:
												case 'end':
													return _context2.stop();
											}
										}
									}, _callee2, _this);
								}));

								return function tryBeginUpdate() {
									return _ref3.apply(this, arguments);
								};
							}();

							_context3.next = 4;
							return tryBeginUpdate();

						case 4:
						case 'end':
							return _context3.stop();
					}
				}
			}, _callee3, _this);
		}));

		return function (_x4, _x5) {
			return _ref2.apply(this, arguments);
		};
	}();

	this._sendBeginUpdateMessage = function (fileBuffer, address) {
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
		var fileSize = fileBuffer.length;
		var destFlag = 0; //TODO: reserved for later
		var destAddr = parseInt(address);

		if (_this._fastOtaEnabled) {
			_logger2.default.log('fast ota enabled! ', _this._getLogInfo());
			flags = 1;
		}

		var bufferBuilder = new _h2.default.BufferBuilder();
		bufferBuilder.pushUInt8(flags);
		bufferBuilder.pushUInt16(chunkSize);
		bufferBuilder.pushUInt32(fileSize);
		bufferBuilder.pushUInt8(destFlag);
		bufferBuilder.pushUInt32(destAddr);

		console.log();
		console.log();
		console.log(bufferBuilder.toBuffer());
		console.log(fileBuffer[0], fileBuffer[1], fileBuffer[2], fileBuffer[3]);
		console.log();
		console.log();

		//UpdateBegin — sent by Server to initiate an OTA firmware update
		return !!_this._client.sendMessage('UpdateBegin', null, bufferBuilder.toBuffer(), _this);
	};

	this._sendFile = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee4() {
		var canUseFastOTA, message, counter;
		return _regenerator2.default.wrap(function _callee4$(_context4) {
			while (1) {
				switch (_context4.prev = _context4.next) {
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

						canUseFastOTA = _this._fastOtaEnabled && _this._protocolVersion > 0;

						if (canUseFastOTA) {
							_logger2.default.log('Starting FastOTA update', { deviceID: _this._client.getID() });
						}

						_this._readNextChunk();

					case 5:
						if (!_this._chunk) {
							_context4.next = 17;
							break;
						}

						_this._sendChunk(_this._chunkIndex);
						_this._readNextChunk();

						// We don't need to wait for the response if using FastOTA.

						if (!canUseFastOTA) {
							_context4.next = 10;
							break;
						}

						return _context4.abrupt('continue', 5);

					case 10:
						_context4.next = 12;
						return _this._client.listenFor('ChunkReceived', null, null);

					case 12:
						message = _context4.sent;

						if (_Messages2.default.statusIsOkay(message)) {
							_context4.next = 15;
							break;
						}

						throw new Error('\'ChunkReceived\' failed.');

					case 15:
						_context4.next = 5;
						break;

					case 17:
						if (!canUseFastOTA) {
							_context4.next = 20;
							break;
						}

						_context4.next = 20;
						return _this._waitForMissedChunks();

					case 20:

						// Handle missed chunks
						counter = 0;

					case 21:
						if (!(_this._missedChunks.size > 0 && counter < 3)) {
							_context4.next = 29;
							break;
						}

						_context4.next = 24;
						return _this._resendChunks();

					case 24:
						_context4.next = 26;
						return _this._waitForMissedChunks();

					case 26:
						counter++;
						_context4.next = 21;
						break;

					case 29:
					case 'end':
						return _context4.stop();
				}
			}
		}, _callee4, _this);
	}));
	this._resendChunks = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee6() {
		var missedChunks, canUseFastOTA;
		return _regenerator2.default.wrap(function _callee6$(_context6) {
			while (1) {
				switch (_context6.prev = _context6.next) {
					case 0:
						missedChunks = (0, _from2.default)(_this._missedChunks);

						_this._missedChunks.clear();

						canUseFastOTA = _this._fastOtaEnabled && _this._protocolVersion > 0;
						_context6.next = 5;
						return _promise2.default.all(missedChunks.map(function () {
							var _ref6 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee5(chunkIndex) {
								var offset, message;
								return _regenerator2.default.wrap(function _callee5$(_context5) {
									while (1) {
										switch (_context5.prev = _context5.next) {
											case 0:
												offset = chunkIndex * _this._chunkSize;

												(0, _nullthrows2.default)(_this._fileStream).seek(offset);
												_this._chunkIndex = chunkIndex;

												_this._readNextChunk();
												_this._sendChunk(chunkIndex);

												// We don't need to wait for the response if using FastOTA.

												if (canUseFastOTA) {
													_context5.next = 7;
													break;
												}

												return _context5.abrupt('return');

											case 7:
												_context5.next = 9;
												return _this._client.listenFor('ChunkReceived', null, null);

											case 9:
												message = _context5.sent;

												if (_Messages2.default.statusIsOkay(message)) {
													_context5.next = 12;
													break;
												}

												throw new Error('\'ChunkReceived\' failed.');

											case 12:
											case 'end':
												return _context5.stop();
										}
									}
								}, _callee5, _this);
							}));

							return function (_x6) {
								return _ref6.apply(this, arguments);
							};
						}()));

					case 5:
					case 'end':
						return _context6.stop();
				}
			}
		}, _callee6, _this);
	}));

	this._readNextChunk = function () {
		if (!_this._fileStream) {
			_logger2.default.error('Asked to read a chunk after the update was finished');
		}

		var chunk = _this._chunk = _this._fileStream ? _this._fileStream.read(_this._chunkSize) : null;

		//workaround for https://github.com/spark/core-firmware/issues/238
		if (chunk && chunk.length !== _this._chunkSize) {
			var buffer = new Buffer(_this._chunkSize);
			chunk.copy(buffer, 0, 0, chunk.length);
			buffer.fill(0, chunk.length, _this._chunkSize);
			_this._chunk = chunk = buffer;
		}
		_this._chunkIndex++;
		//end workaround
		_this._lastCrc = chunk ? _bufferCrc2.default.unsigned(chunk) : null;
	};

	this._sendChunk = function () {
		var _ref7 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee7() {
			var chunkIndex = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
			var encodedCrc, writeCoapUri;
			return _regenerator2.default.wrap(function _callee7$(_context7) {
				while (1) {
					switch (_context7.prev = _context7.next) {
						case 0:
							encodedCrc = _Messages2.default.toBinary((0, _nullthrows2.default)(_this._lastCrc), 'crc');

							writeCoapUri = function writeCoapUri(message) {
								message.addOption(new _Option2.default(_h3.Message.Option.URI_PATH, new Buffer('c')));
								message.addOption(new _Option2.default(_h3.Message.Option.URI_QUERY, encodedCrc));
								if (_this._fastOtaEnabled && _this._protocolVersion > 0) {
									var indexBinary = _Messages2.default.toBinary(chunkIndex, 'uint16');
									message.addOption(new _Option2.default(_h3.Message.Option.URI_QUERY, indexBinary));
								}
								return message;
							};

							_this._client.sendMessage('Chunk', {
								crc: encodedCrc,
								_writeCoapUri: writeCoapUri
							}, _this._chunk, _this);

						case 3:
						case 'end':
							return _context7.stop();
					}
				}
			}, _callee7, _this);
		}));

		return function (_x7) {
			return _ref7.apply(this, arguments);
		};
	}();

	this._onAllChunksDone = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee8() {
		return _regenerator2.default.wrap(function _callee8$(_context8) {
			while (1) {
				switch (_context8.prev = _context8.next) {
					case 0:
						if (_this._client.sendMessage('UpdateDone', null, null, _this)) {
							_context8.next = 2;
							break;
						}

						throw new Error('Flasher - failed sending updateDone message');

					case 2:
					case 'end':
						return _context8.stop();
				}
			}
		}, _callee8, _this);
	}));

	this._cleanup = function () {
		try {
			//resume all other messages to the core
			_this._client.releaseOwnership(_this);

			//release our file handle
			var fileStream = _this._fileStream;
			if (fileStream) {
				fileStream.close();
				_this._fileStream = null;
			}
		} catch (exception) {
			throw new Error('Flasher: error during cleanup ' + exception);
		}
	};

	this._waitForMissedChunks = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee9() {
		return _regenerator2.default.wrap(function _callee9$(_context9) {
			while (1) {
				switch (_context9.prev = _context9.next) {
					case 0:
						if (!(_this._protocolVersion <= 0)) {
							_context9.next = 2;
							break;
						}

						return _context9.abrupt('return');

					case 2:
						return _context9.abrupt('return', new _promise2.default(function (resolve, reject) {
							return setTimeout(function () {
								console.log('finished waiting');
								resolve();
							}, 3 * 1000);
						}));

					case 3:
					case 'end':
						return _context9.stop();
				}
			}
		}, _callee9, _this);
	}));

	this._getLogInfo = function () {
		if (_this._client) {
			return {
				cache_key: _this._client._connectionKey || undefined,
				deviceID: _this._client.getID()
			};
		} else {
			return { deviceID: 'unknown' };
		}
	};

	this._onChunkMissed = function (message) {
		if (_this._missedChunks.size > MAX_MISSED_CHUNKS) {
			var json = (0, _stringify2.default)(_this._getLogInfo());
			throw new Error('flasher - chunk missed - device over limit, killing! ' + json);
		}

		// if we're not doing a fast OTA, and ignore missed is turned on, then
		// ignore this missed chunk.
		if (!_this._fastOtaEnabled && _this._ignoreMissedChunks) {
			_logger2.default.log('ignoring missed chunk ', _this._getLogInfo());
			return;
		}

		_logger2.default.log('flasher - chunk missed - recovering ', _this._getLogInfo());

		//kosher if I ack before I've read the payload?
		_this._client.sendReply('ChunkMissedAck', message.getId(), null, null, _this);

		//the payload should include one or more chunk indexes
		var payload = message.getPayload();
		var bufferReader = new _h2.default.BufferReader(payload);
		for (var ii = 0; ii < payload.length; ii += 2) {
			try {
				_this._missedChunks.add(bufferReader.shiftUInt16());
			} catch (exception) {
				_logger2.default.error('onChunkMissed error reading payload ' + exception);
			}
		}
	};

	this._client = client;
}

/**
 * delay the teardown until at least like 10 seconds after the last
 * chunkmissed message.
 * @private
 */
;

exports.default = Flasher;