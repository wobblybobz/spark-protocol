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
*   Lesser General Public License for more .
*
*   You should have received a copy of the GNU Lesser General Public
*   License along with this program; if not, see <http://www.gnu.org/licenses/>.
*
* @flow
*
*/

import type { Socket } from 'net';
import type { Duplex } from 'stream';
import type { Event } from '../types';
import type Handshake from '../lib/Handshake';
import type { MessageType } from '../lib/MessageSpecifications';
import type { FileTransferStoreType } from '../lib/FileTransferStore';

import EventEmitter from 'events';
import moment from 'moment';

import { Message } from 'h5.coap';

import settings from '../settings';
import CryptoManager from '../lib/CryptoManager';
import Messages from '../lib/Messages';
import FileTransferStore from '../lib/FileTransferStore';

import Flasher from '../lib/Flasher';
import logger from '../lib/logger';
import { BufferReader } from 'h5.buffers';
import nullthrows from 'nullthrows';


type DeviceDescription = {|
  firmwareVersion: number,
  productID: number,
  state: Object,
  systemInformation: Object,
|};

// Hello — sent first by Core then by Server immediately after handshake, never again
// Ignored — sent by either side to respond to a message with a bad counter value.
// The receiver of an Ignored message can optionally decide to resend a previous message
// if the indicated bad counter value matches a recently sent message.

// package flasher
// Chunk — sent by Server to send chunks of a firmware binary to Core
// ChunkReceived — sent by Core to respond to each chunk,
// indicating the CRC of the received chunk data.
// if Server receives CRC that does not match the chunk just sent, that chunk is sent again
// UpdateBegin — sent by Server to initiate an OTA firmware update
// UpdateReady — sent by Core to indicate readiness to receive firmware chunks
// UpdateDone — sent by Server to indicate all firmware chunks have been sent

// FunctionCall — sent by Server to tell Core to call a user-exposed function
// FunctionReturn — sent by Core in response to FunctionCall to indicate return value.
// void functions will not send this message
// VariableRequest — sent by Server to request the value of a user-exposed variable
// VariableValue — sent by Core in response to VariableRequest to indicate the value

// Event — sent by Core to initiate a Server Sent Event and optionally
// an HTTP callback to a 3rd party
// KeyChange — sent by Server to change the AES credentials

/**
 * How high do our counters go before we wrap around to 0?
 * (CoAP maxes out at a 16 bit int)
 */
const COUNTER_MAX = 65536;
/**
 * How big can our tokens be in CoAP messages?
 */
const TOKEN_COUNTER_MAX = 256;
const KEEP_ALIVE_TIMEOUT = settings.keepaliveTimeout;
const SOCKET_TIMEOUT = settings.socketTimeout;

export const DEVICE_EVENT_NAMES = {
  DISCONNECT: 'disconnect',
  FLASH_FAILED: 'flash/failed',
  FLASH_STARTED: 'flash/started',
  FLASH_SUCCESS: 'flash/success',
  READY: 'ready',
};

export const SYSTEM_EVENT_NAMES = {
  APP_HASH: 'spark/device/app-hash',
  CLAIM_CODE: 'spark/device/claim/code',
  FLASH_AVAILABLE: 'spark/flash/available',
  FLASH_PROGRESS: 'spark/flash/progress',
  FLASH_STATUS: 'spark/flash/status',
  GET_IP: 'spark/device/ip',
  GET_NAME: 'spark/device/name',
  GET_RANDOM_BUFFER: 'spark/device/random',
  IDENTITY: 'spark/device/ident/0',
  LAST_RESET: 'spark/device/last_reset', // This should just have a friendly string in its payload.
  MAX_BINARY: 'spark/hardware/max_binary',
  OTA_CHUNK_SIZE: 'spark/hardware/ota_chunk_size',
  RESET: 'spark/device/reset',  // send this to reset passing "safe mode"/"dfu"/"reboot"
  SAFE_MODE: 'spark/device/safemode',
  SAFE_MODE_UPDATING: 'spark/safe-mode-updater/updating',
  SPARK_STATUS: 'spark/status',
  SPARK_SUBSYSTEM: 'spark/cc3000-patch-version',
};

// These constants should be consistent with message names in
// MessageSpecifications.js
export const DEVICE_MESSAGE_EVENTS_NAMES = {
  GET_TIME: 'GetTime',
  PRIVATE_EVENT: 'PrivateEvent',
  PUBLIC_EVENT: 'PublicEvent',
  SUBSCRIBE: 'Subscribe',
};

/**
 * Implementation of the Particle messaging protocol
 * @Device
 */
class Device extends EventEmitter {
  _cipherStream: ?Duplex = null;
  _connectionKey: ?string = null;
  _connectionStartTime: ?Date = null;
  _decipherStream: ?Duplex = null;
  _deviceFunctionState: ?Object = null;
  _disconnectCounter: number = 0;
  _id: string = '';
  _lastCorePing: Date = new Date();
  _maxBinarySize: ?number = null;
  _otaChunkSize: ?number = null;
  _owningFlasher: ?Flasher;
  _particleProductId: number = 0;
  _platformId: number = 0;
  _productFirmwareVersion: number = 0;
  _recieveCounter: number = 0;
  _reservedFlags: number = 0;
  _sendCounter: number = 0;
  _sendToken: number = 0;
  _socket: Socket;
  _systemInformation: ?Object;
  _tokens: {[key: string]: MessageType} = {};
  _handshake: Handshake;

  constructor(
    socket: Socket,
    connectionKey: string,
    handshake: Handshake,
  ) {
    super();

    this._connectionKey = connectionKey;
    this._socket = socket;
    this._handshake = handshake;
  }

  setMaxBinarySize = (maxBinarySize: number) => {
    this._maxBinarySize = maxBinarySize;
  };

  setOtaChunkSize = (maxBinarySize: number) => {
    this._otaChunkSize = maxBinarySize;
  };

  /**
   * configure our socket and start the handshake
   */
  startupProtocol = async (): Promise<void> => {
    this._socket.setNoDelay(true);
    this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); // every 15 second(s)
    this._socket.setTimeout(SOCKET_TIMEOUT);

    this._socket.on(
      'error',
      (error: Error): void => this.disconnect(`socket error: ${error.message}`),
    );
    this._socket.on(
      'close',
      (): void => this.disconnect('socket close'),
    );
    this._socket.on(
      'timeout',
      (): void => this.disconnect('socket timeout'),
    );

    await this.startHandshake();
  };

  startHandshake = async (): Promise<*> => {
    // when the handshake is done, we can expect two stream properties,
    // '_decipherStream' and '_cipherStream'
    try {
      const {
        cipherStream,
        decipherStream,
        deviceID,
        handshakeBuffer,
        pendingBuffers,
      } = await this._handshake.start(this);
      this._id = deviceID;

      this._getHello(handshakeBuffer);
      this._sendHello(cipherStream, decipherStream);

      this.ready();

      pendingBuffers.map((data: Buffer): void => this.routeMessage(data));
      decipherStream.on('readable', () => {
        const chunk = ((decipherStream.read(): any): Buffer);
        if (!chunk) {
          return;
        }
        this.routeMessage(chunk);
      });
    } catch (error) {
      this.disconnect(error);
    }
  };

  _getHello = (chunk: Buffer) => {
    const message = Messages.unwrap(chunk);
    if (!message) {
      throw new Error('failed to parse hello');
    }

    this._recieveCounter = message.getId();

    try {
      const payload = message.getPayload();
      if (payload.length <= 0) {
        return;
      }

      const payloadBuffer = new BufferReader(payload);
      this._particleProductId = payloadBuffer.shiftUInt16();
      this._productFirmwareVersion = payloadBuffer.shiftUInt16();
      this._reservedFlags = payloadBuffer.shiftUInt16();
      this._platformId = payloadBuffer.shiftUInt16();
    } catch (exception) {
      logger.log('error while parsing hello payload ', exception);
    }
  };

  _sendHello = (cipherStream: Duplex, decipherStream: Duplex) => {
    this._cipherStream = cipherStream;
    this._decipherStream = decipherStream;

    // client will set the counter property on the message
    this._sendCounter = CryptoManager.getRandomUINT16();
    this.sendMessage('Hello', {}, null);
  };

  ready = () => {
    this._connectionStartTime = new Date();

    logger.log(
      'On Device Ready:\r\n',
      {
        cache_key: this._connectionKey,
        deviceID: this._id,
        firmwareVersion: this._productFirmwareVersion,
        ip: this.getRemoteIPAddress(),
        platformID: this._platformId,
        productID: this._particleProductId,
      },
    );

    this.emit(DEVICE_EVENT_NAMES.READY);
  };

  ping = (): {
    connected: boolean,
    lastPing: Date,
  } => {
    if (settings.logApiMessages) {
      logger.log('Pinged, replying', { deviceID: this._id });
    }

    return {
      connected: this._socket !== null,
      lastPing: this._lastCorePing,
    };
  };

  /**
   * Deals with messages coming from the core over our secure connection
   * @param data
   */
  routeMessage = (data: Buffer) => {
    const message = Messages.unwrap(data);
    if (!message) {
      logger.error(
        'routeMessage got a NULL coap message ',
        { deviceID: this._id },
      );
      return;
    }

    // should be adequate
    const messageCode = message.getCode();
    let requestType = '';
    if (
      messageCode > Message.Code.EMPTY &&
      messageCode <= Message.Code.DELETE
    ) {
      // probably a request
      requestType = Messages.getRequestType(message);
    }

    if (!requestType) {
      requestType = this._getResponseType(message.getTokenString());
    }

    if (message.isAcknowledgement()) {
      if (!requestType) {
        // no type, can't route it.
        requestType = 'PingAck';
      }

      this.emit(requestType, message);
      return;
    }


    this._incrementReceiveCounter();
    if (message.isEmpty() && message.isConfirmable()) {
      this._lastCorePing = new Date();
      this.sendReply('PingAck', message.getId());
      return;
    }

    if (!message || message.getId() !== this._recieveCounter) {
      logger.log(
        'got counter ',
        message.getId(),
        ' expecting ',
        this._recieveCounter,
        { deviceID: this._id },
      );

      if (requestType === 'Ignored') {
        // don't ignore an ignore...
        this.disconnect('Got an Ignore');
        return;
      }

      // this.sendMessage('Ignored', null, {}, null, null);
      this.disconnect('Bad Counter');
      return;
    }

    this.emit(requestType || '', message);
  };

  sendReply = (
    messageName: MessageType,
    id: number,
    data: ?Buffer,
    token: ?number,
    requester: ?Object,
  ) => {
    if (!this._isSocketAvailable(requester || null, messageName)) {
      logger.error('This client has an exclusive lock.');
      return;
    }

    // if my reply is an acknowledgement to a confirmable message
    // then I need to re-use the message id...

    // set our counter
    if (id < 0) {
      this._incrementSendCounter();
      id = this._sendCounter; // eslint-disable-line no-param-reassign
    }


    const message = Messages.wrap(messageName, id, null, data, token, null);
    if (!message) {
      logger.error(
        'Device - could not unwrap message',
        { deviceID: this._id },
      );
      return;
    }

    if (!this._cipherStream) {
      logger.error(
        'Device - sendReply before READY',
        { deviceID: this._id },
      );
      return;
    }
    this._cipherStream.write(message);
  };


  sendMessage = (
    messageName: MessageType,
    params: ?Object,
    data: ?Buffer,
    requester?: Object,
  ): number => {
    if (!this._isSocketAvailable(requester, messageName)) {
      logger.error('This client has an exclusive lock.');
      return -1;
    }

    // increment our counter
    this._incrementSendCounter();

    let token = null;
    if (!Messages.isNonTypeMessage(messageName)) {
      this._incrementSendToken();
      this._useToken(messageName, this._sendToken);
      token = this._sendToken;
    }

    const message = Messages.wrap(
      messageName,
      this._sendCounter,
      params,
      data,
      token,
    );

    if (!message) {
      logger.error('Could not wrap message', messageName, params, data);
      return -1;
    }

    if (!this._cipherStream) {
      logger.error(
        'Client - sendMessage before READY',
        { deviceID: this._id, messageName },
      );
      return -1;
    }

    this._cipherStream.write(message);

    return token || 0;
  };

  // Adds a listener to our secure message stream
  listenFor = async (
    eventName: MessageType,
    uri: ?string,
    token: ?number,
  ): Promise<*> => {
    const tokenHex = token ? this._toHexString(token) : null;
    const beVerbose = settings.showVerboseDeviceLogs;

    return new Promise((
      resolve: (message: Message) => void,
      reject: (error?: Error) => void,
    ) => {
      const timeout = setTimeout(
        () => {
          cleanUpListeners();
          reject(new Error('Request timed out'));
        },
        KEEP_ALIVE_TIMEOUT,
      );

      // adds a one time event
      const handler = (message: Message) => {
        clearTimeout(timeout);
        if (uri && message.getUriPath().indexOf(uri) !== 0) {
          if (beVerbose) {
            logger.log(
              'URI filter did not match',
              uri,
              message.getUriPath(),
              { deviceID: this._id },
            );
          }
          return;
        }

        if (tokenHex && tokenHex !== message.getTokenString()) {
          if (beVerbose) {
            logger.log(
              'Tokens did not match ',
               tokenHex,
               message.getTokenString(),
               { deviceID: this._id },
             );
          }
          return;
        }

        cleanUpListeners();
        resolve(message);
      };

      const disconnectHandler = () => {
        cleanUpListeners();
        reject();
      };

      const cleanUpListeners = () => {
        this.removeListener(eventName, handler);
        this.removeListener('disconnect', disconnectHandler);
      };

      this.on(eventName, handler);
      this.on('disconnect', disconnectHandler);
    });
  };

  _increment = (counter: number, maxSize: number): number => {
    const resultCounter = counter + 1;
    return resultCounter < maxSize ? resultCounter : 0;
  };

  _incrementSendCounter = () => {
    this._sendCounter = this._increment(this._sendCounter, COUNTER_MAX);
  };

  _incrementReceiveCounter = () => {
    this._recieveCounter = this._increment(this._recieveCounter, COUNTER_MAX);
  };

  // increments or wraps our token value, and makes sure it isn't in use
  _incrementSendToken = (): number => {
    this._sendToken = this._increment(this._sendToken, TOKEN_COUNTER_MAX);
    this._clearToken(this._sendToken);
    return this._sendToken;
  };

  /**
   * Associates a particular token with a message we're sending, so we know
   * what we're getting back when we get an ACK
   */
  _useToken = (name: MessageType, sendToken: number) => {
    const key = this._toHexString(sendToken);

    if (this._tokens[key]) {
      throw new Error(
        `Token ${name} ${this._tokens[key]} ${key} already in use`,
      );
    }

    this._tokens[key] = name;
  };

  // clears the association with a particular token
  _clearToken = (sendToken: number) => {
    const key = this._toHexString(sendToken);

    if (this._tokens[key]) {
      delete this._tokens[key];
    }
  };

  _getResponseType = (tokenString: string): ?string => {
    const request = this._tokens[tokenString];
    if (!request) {
      return '';
    }

    return Messages.getResponseType(request);
  };

  getDescription = async (): Promise<DeviceDescription> => {
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      throw new Error('This device is locked during the flashing process.');
    }

    try {
      await this._ensureWeHaveIntrospectionData();

      return {
        firmwareVersion: this._productFirmwareVersion,
        productID: this._particleProductId,
        state: nullthrows(this._deviceFunctionState),
        systemInformation: nullthrows(this._systemInformation),
      };
    } catch (error) {
      throw new Error(`No device state!: ${error.message}`);
    }
  };

  /**
   * Ensures we have introspection data from the core, and then
   * requests a variable value to be sent, when received it transforms
   * the response into the appropriate type
   **/
  getVariableValue = async (
    name: string,
  ): Promise<*> => {
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      throw new Error('This device is locked during the flashing process.');
    }

    await this._ensureWeHaveIntrospectionData();
    if (!this._hasParticleVariable(name)) {
      throw new Error('Variable not found');
    }

    const messageToken = this.sendMessage(
      'VariableRequest',
      { name },
    );
    const message = await this.listenFor(
      'VariableValue',
      null,
      messageToken,
    );

    return this._transformVariableResult(name, message);
  };

  // call function on device firmware
  callFunction = async (
    functionName: string,
    functionArguments: {[key: string]: string},
  ): Promise<*> => {
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      throw new Error('This device is locked during the flashing process.');
    }

    const buffer = await this._transformArguments(
      functionName,
      functionArguments,
    );

    if (!buffer) {
      throw new Error(`Unknown Function ${functionName}`);
    }

    if (settings.showVerboseDeviceLogs) {
      logger.log(
        'sending function call to the core',
        { deviceID: this._id, functionName },
      );
    }

    const writeUrl = (message: Message): Message => {
      message.setUri(`f/${functionName}`);
      if (buffer) {
        message.setUriQuery(buffer.toString());
      }

      return message;
    };

    const token = this.sendMessage(
      'FunctionCall',
      {
        _writeCoapUri: writeUrl,
        args: buffer,
        name: functionName,
      },
      null,
    );

    const message = await this.listenFor('FunctionReturn', null, token);
    return this._transformFunctionResult(functionName, message);
  };

  /**
   * Asks the core to start or stop its 'raise your hand' signal.
   * This will turn `nyan` mode on or off which just flashes the LED a bunch of
   * colors.
   */
  raiseYourHand = async (shouldShowSignal: boolean): Promise<*> => {
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      throw new Error('This device is locked during the flashing process.');
    }

    const token = this.sendMessage(
      'SignalStart',
      { _writeCoapUri: Messages.raiseYourHandUrlGenerator(shouldShowSignal) },
      null,
    );
    return await this.listenFor(
      'SignalStartReturn',
      null,
      token,
    );
  };

  flash = async (
    binary: ?Buffer,
    fileTransferStore: FileTransferStoreType = FileTransferStore.FIRMWARE,
    address: string = '0x0',
  ): Promise<string> => {
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      throw new Error('This device is locked during the flashing process.');
    }

    const flasher = new Flasher(this, this._maxBinarySize, this._otaChunkSize);
    try {
      logger.log(
        'flash device started! - sending api event',
        { deviceID: this._id },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_STARTED);

      await flasher.startFlashBuffer(binary, fileTransferStore, address);

      logger.log(
        'flash device finished! - sending api event',
        { deviceID: this._id },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_SUCCESS);

      return 'Update finished';
    } catch (error) {
      logger.log(
        'flash device failed! - sending api event',
        { deviceID: this._id, error },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_FAILED);
      throw new Error(`Update failed: ${error.message}`);
    }
  };

  _isSocketAvailable = (
    requester: ?Object,
    messageName?: string,
  ): boolean => {
    if (!this._owningFlasher || this._owningFlasher === requester) {
      return true;
    }

    logger.error(
      'This client has an exclusive lock',
      {
        cache_key: this._connectionKey,
        deviceID: this._id,
        messageName,
      },
    );

    return false;
  };

  takeOwnership = (flasher: Flasher): boolean => {
    if (this._owningFlasher) {
      logger.error('already owned', { deviceID: this._id });
      return false;
    }
    // only permit the owning object to send messages.
    this._owningFlasher = flasher;
    return true;
  };

  releaseOwnership = (flasher: Flasher) => {
    logger.log('releasing flash ownership ', { coreID: this._id });
    if (this._owningFlasher === flasher) {
      this._owningFlasher = null;
    } else if (this._owningFlasher) {
      logger.error(
        'cannot releaseOwnership, ',
        flasher,
        ' isn\'t the current owner ',
        { deviceID: this._id },
      );
    }
  };

  _transformVariableResult = (
    name: string,
    message: Message,
  ): ?Buffer => {
    // grab the variable type, if the core doesn't say, assume it's a 'string'
    const variableFunctionState = this._deviceFunctionState
      ? this._deviceFunctionState.v
      : null;
    const variableType = variableFunctionState && variableFunctionState[name]
      ? variableFunctionState[name]
      : 'string';

    let result = null;
    let data = null;
    try {
      if (message && message.getPayload) {
        // leaving raw payload in response message for now, so we don't shock
        // our users.
        data = message.getPayload();
        result = Messages.fromBinary(data, variableType);
      }
    } catch (error) {
      logger.error(
        `_transformVariableResult - error transforming response: ${error}`,
      );
    }

    return result;
  };

  // Transforms the result from a core function to the correct type.
  _transformFunctionResult = (
    name: string,
    message: Message,
  ): ?Buffer => {
    const variableType = 'int32';

    let result = null;
    try {
      if (message && message.getPayload) {
        result = Messages.fromBinary(message.getPayload(), variableType);
      }
    } catch (error) {
      logger.error(
        `_transformFunctionResult - error transforming response: ${error}`,
      );
      throw error;
    }

    return result;
  };

  // transforms our object into a nice coap query string
  _transformArguments = async (
    name: string,
    args: {[key: string]: string},
  ): Promise<?Buffer> => {
    if (!args) {
      return null;
    }

    await this._ensureWeHaveIntrospectionData();
    const lowercaseName = name.toLowerCase();
    const deviceFunctionState = nullthrows(this._deviceFunctionState);

    let functionState = deviceFunctionState[lowercaseName];
    if (!functionState || !functionState.args) {
      // maybe it's the old protocol?
      const oldProtocolFunctionState = deviceFunctionState.f;
      if (
        oldProtocolFunctionState &&
        oldProtocolFunctionState.some(
          (fn: string): boolean => fn.toLowerCase() === lowercaseName,
        )
      ) {
        // current/simplified function format (one string arg, int return type)
        functionState = {
          args: [
            [null, 'string'],
          ],
          returns: 'int',
        };
      }
    }

    if (!functionState || !functionState.args) {
      return null;
    }
    return Messages.buildArguments(args, functionState.args);
  };

  /**
   * Checks our cache to see if we have the function state, otherwise requests
   * it from the core, listens for it, and resolves our deferred on success
   */
  _ensureWeHaveIntrospectionData = async (counter: number = 0): Promise<*> => {
    if (this._hasFunctionState()) {
      return;
    }

    try {
      const token = this.sendMessage('Describe');
      const systemMessage = await this.listenFor(
        'DescribeReturn',
        null,
        token,
      );

      // Sometimes this listener will
      const functionStateAwaitable = this.listenFor(
        'DescribeReturn',
        null,
        token,
      );

      // got a description, is it any good?
      const data = systemMessage.getPayload();
      const systemInformation = JSON.parse(data.toString());

      // In the newer firmware the application data comes in a later message.
      // We run a race to see if the function state comes in the first response.
      let gotFunctionState = false;
      const functionState = await Promise.race([
        functionStateAwaitable.then((applicationMessage: Message): Object => {
          gotFunctionState = true;
          // got a description, is it any good?
          const applicationMessageData = applicationMessage.getPayload();
          return JSON.parse(applicationMessageData.toString());
        }),
        new Promise((resolve: (systemInformation: Object) => void) => {
          if (systemInformation.f && systemInformation.v) {
            gotFunctionState = true;
            resolve(systemInformation);
          }
        }),
      ]);

      // only retry 3 times
      if (!gotFunctionState && counter && counter < 3) {
        await this._ensureWeHaveIntrospectionData((counter || 0) + 1);
        return;
      }

      if (functionState && functionState.v) {
        // 'v':{'temperature':2}
        functionState.v = Messages.translateIntTypes(functionState.v);
      }

      this._systemInformation = systemInformation;
      this._deviceFunctionState = functionState;
    } catch (error) {
      throw error;
    }
  };

  getSystemInformation = async (): ?Object => {
    await this._ensureWeHaveIntrospectionData();
    return this._systemInformation;
  };

  //-------------
  // Core Events / Spark.publish / Spark.subscribe
  //-------------
  onCoreEvent = (event: Event) => {
    this.sendCoreEvent(event);
  };

  sendCoreEvent = (event: Event) => {
    const { data, isPublic, name, publishedAt, ttl } = event;

    const rawFunction = (message: Message): void => {
      try {
        message.setMaxAge(ttl);
        message.setTimestamp(moment(publishedAt).toDate());
      } catch (error) {
        logger.error(`onCoreHeard - ${error.message}`);
      }

      return message;
    };

    const messageName = isPublic
      ? DEVICE_MESSAGE_EVENTS_NAMES.PUBLIC_EVENT
      : DEVICE_MESSAGE_EVENTS_NAMES.PRIVATE_EVENT;

    this.sendMessage(
      messageName,
      {
        _raw: rawFunction,
        event_name: name.toString(),
      },
      data && new Buffer(data) || null,
    );
  };

  _hasFunctionState = (): boolean =>
    !!this._deviceFunctionState;

  _hasParticleVariable = (name: string): boolean =>
    !!(
      this._deviceFunctionState &&
      this._deviceFunctionState.v &&
      this._deviceFunctionState.v[name]
    );

  _hasSparkFunction = (name: string): boolean => {
    // has state, and... the function is an object, or it's in the function array
    const lowercaseName = name.toLowerCase();
    return !!(
      this._deviceFunctionState &&
      (
        this._deviceFunctionState[name] ||
        (
          this._deviceFunctionState.f &&
          this._deviceFunctionState.f.some(
            (fn: string): boolean => fn.toLowerCase() === lowercaseName,
          )
        )
      )
    );
  };

  _toHexString = (value: number): string =>
    (value < 10 ? '0' : '') + value.toString(16);

  getID = (): string => this._id;

  getRemoteIPAddress = (): string =>
    this._socket.remoteAddress
      ? this._socket.remoteAddress.toString()
      : 'unknown';

  disconnect = (message: ?string = '') => {
    this._disconnectCounter += 1;

    if (this._disconnectCounter > 1) {
      // don't multi-disconnect
      return;
    }

    try {
      const logInfo = {
        cache_key: this._connectionKey,
        deviceID: this._id,
        duration: this._connectionStartTime
         ? ((new Date()) - this._connectionStartTime) / 1000.0
         : undefined,
      };

      logger.log(
        `${this._disconnectCounter} : Core disconnected: ${message || ''}`,
         logInfo,
      );
    } catch (error) {
      logger.error(`Disconnect log error ${error}`);
    }

    try {
      this._socket.end();
      this._socket.destroy();
    } catch (error) {
      logger.error(`Disconnect TCPSocket error: ${error}`);
    }

    if (this._decipherStream) {
      try {
        this._decipherStream.end();
        this._decipherStream = null;
      } catch (error) {
        logger.error(`Error cleaning up decipherStream: ${error}`);
      }
    }

    if (this._cipherStream) {
      try {
        this._cipherStream.end();
        this._cipherStream = null;
      } catch (error) {
        logger.error(`Error cleaning up cipherStream: ${error}`);
      }
    }

    this.emit(DEVICE_EVENT_NAMES.DISCONNECT, message);

    // obv, don't do this before emitting disconnect.
    try {
      this.removeAllListeners();
    } catch (error) {
      logger.error(`Problem removing listeners ${error}`);
    }
  }
}

export default Device;
