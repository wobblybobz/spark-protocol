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

import EventEmitter from 'events';
import moment from 'moment';

import { Message } from 'h5.coap';

import settings from '../settings';
import CryptoLib from '../lib/ICrypto';
import Messages from '../lib/Messages';
import Handshake from '../lib/Handshake';
import utilities from '../lib/utilities';
import Flasher from '../lib/Flasher';
import logger from '../lib/logger';
import { BufferReader } from 'h5.buffers';
import nullthrows from 'nullthrows';

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

const COUNTER_MAX = settings.message_counter_max;
const KEEP_ALIVE_TIMEOUT = settings.keepaliveTimeout;
const SOCKET_TIMEOUT = settings.socketTimeout;
const MAX_BINARY_SIZE = 108000; // According to the forums this is the max size.


export const DEVICE_EVENT_NAMES = {
  DISCONNECT: 'disconnect',
  FLASH_FAILED: 'flash/failed',
  FLASH_STARTED: 'flash/started',
  FLASH_SUCCESS: 'flash/success',
  READY: 'ready',
};

// this constants should be consistent with message names in
// MessageSpecifications.js
export const DEVICE_MESSAGE_EVENTS_NAMES = {
  GET_TIME: 'GetTime',
  PRIVATE_EVENT: 'PrivateEvent',
  PUBLIC_EVENT: 'PublicEvent',
  SUBSCRIBE: 'Subscribe',
};

/**
 * Implementation of the Particle messaging protocol
 * @SparkCore
 */
class SparkCore extends EventEmitter {
  _cipherStream: ?Duplex = null;
  _connectionKey: ?string = null;
  _connectionStartTime: ?Date = null;
  _decipherStream: ?Duplex = null;
  _deviceFunctionState: ?Object = null;
  _disconnectCounter: number = 0;
  _id: string = '';
  _lastCorePing: Date = new Date();
  _owningFlasher: ?Flasher;
  _particleProductId: number = 0;
  _platformId: number = 0;
  _productFirmwareVersion: number = 0;
  _recieveCounter: number = 0;
  _sendCounter: number = 0;
  _sendToken: number = 0;
  _socket: Socket;
  _tokens: {[key: string]: string} = {};

  constructor(socket: Socket, connectionKey: string) {
    super();

    this._connectionKey = connectionKey;
    this._socket = socket;
  }

  /**
   * configure our socket and start the handshake
   */
  startupProtocol = async (): Promise<void> => {
    this._socket.setNoDelay(true);
    this._socket.setKeepAlive(true, KEEP_ALIVE_TIMEOUT); // every 15 second(s)
    this._socket.setTimeout(SOCKET_TIMEOUT);

    this._socket.on(
      'error',
      (error: Error): void => this.disconnect(`socket error ${error.message}`),
    );
    this._socket.on(
      'close',
      (error: Error): void => this.disconnect(`socket close ${error.message}`),
    );
    this._socket.on(
      'timeout',
      (error: Error): void => this.disconnect(`socket timeout ${error.message}`),
    );

    await this.handshake();
  };

  handshake = async (): Promise<*> => {
    const handshake = new Handshake(this);

    // when the handshake is done, we can expect two stream properties,
    // '_decipherStream' and '_cipherStream'
    try {
      const {
        cipherStream,
        decipherStream,
        deviceID,
        handshakeBuffer,
        pendingBuffers,
        sessionKey,
      } = await handshake.start();
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
      this._platformId = payloadBuffer.shiftUInt16();
    } catch (exception) {
      logger.log('error while parsing hello payload ', exception);
    }
  };

  _sendHello = (cipherStream: Duplex, decipherStream: Duplex) => {
    this._cipherStream = cipherStream;
    this._decipherStream = decipherStream;

    // client will set the counter property on the message
    this._sendCounter = CryptoLib.getRandomUINT16();
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


  /**
   * @param sender
   * @param response
   */
  sendApiResponse = (sender: string, response: Object): void => {
    try {
      this.emit(sender, sender, response);
    } catch (exception) {
      logger.error('Error during response ', exception);
    }
  };


  /**
   * Handles messages coming from the API over our message queue service
   */
  onApiMessage = async (sender: string, message: Message): Promise<*> => {
    // if we're not the owner, then the socket is busy
    const isBusy = !this._isSocketAvailable(null);
    if (isBusy) {
      this.sendApiResponse(
        sender,
        { error: new Error('This core is locked during the flashing process.') },
      );
      return Promise.reject();
    }

    switch (message.cmd) {
      case 'Describe': {
        if (settings.logApiMessages) {
          logger.log('Describe', { deviceID: this._id });
        }

        try {
          await this._ensureWeHaveIntrospectionData();
          this.sendApiResponse(
            sender,
            {
              cmd: 'DescribeReturn',
              firmware_version: this._productFirmwareVersion,
              name: message.name,
              product_id: this._particleProductId,
              state: this._deviceFunctionState,
            },
          );

          return this._deviceFunctionState;
        } catch (exception) {
          this.sendApiResponse(
            sender,
            {
              cmd: 'DescribeReturn',
              error: 'Error, no device state',
              name: message.name,
            },
          );
        }
        break;
      }

      case 'GetVar': {
        if (settings.logApiMessages) {
          logger.log('GetVar', { deviceID: this._id });
        }
        try {
          const result = await this._getVariable(
            message.name,
            message.type,
          );

          const response = {
            cmd: 'VarReturn',
            name: message.name,
            result,
          };
          this.sendApiResponse(
            sender,
            response,
          );
          return result;
        } catch (error) {
          const response = {
            cmd: 'VarReturn',
            error,
            name: message.name,
          };
          this.sendApiResponse(
            sender,
            response,
          );
          return response;
        }
      }
      case 'SetVar': {
        if (settings.logApiMessages) {
          logger.log('SetVar', { deviceID: this._id });
        }
        const result = await this._setVariable(
          message.name,
          message.value,
        );

        this.sendApiResponse(
          sender,
          {
            cmd: 'VarReturn',
            name: message.name,
            result: result.getPayload().toString(),
          },
        );
        break;
      }

      case 'CallFn': {
        if (settings.logApiMessages) {
          logger.log('FunCall', { deviceID: this._id });
        }

        try {
          const result = await this._callFunction(
            message.name,
            message.args,
          );
          const sendResult = {
            cmd: 'FnReturn',
            name: message.name,
            result,
          };
          this.sendApiResponse(
            sender,
            sendResult,
          );
          return sendResult;
        } catch (error) {
          const sendResult = {
            cmd: 'FnReturn',
            error,
            name: message.name,
          };
          this.sendApiResponse(
            sender,
            sendResult,
          );
          return sendResult;
        }
      }

      case 'UFlash': {
        if (settings.logApiMessages) {
          logger.log('FlashCore', { deviceID: this._id });
        }

        return await this.flashCore(message.args.data, sender);
      }

      case 'RaiseHand': {
        if (settings.logApiMessages) {
          logger.log('SignalCore', { deviceID: this._id });
        }

        const showSignal = message.args && message.args.signal;
        const result = await this._raiseYourHand(showSignal);
        this.sendApiResponse(
          sender,
          { cmd: 'RaiseHandReturn', result },
        );
        break;
      }

      case 'Ping': {
        if (settings.logApiMessages) {
          logger.log('Pinged, replying', { deviceID: this._id });
        }
        const result = {
          cmd: 'Pong',
          connected: this._socket !== null,
          lastPing: this._lastCorePing,
        };
        this.sendApiResponse(
          sender,
          result,
        );

        return result;
      }

      default: {
        this.sendApiResponse(
          sender,
          { error: new Error('unknown message') },
        );
      }
    }
  };

  /**
   * Deals with messages coming from the core over our secure connection
   * @param data
   */
  // TODO figure out and clean this method
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
      // var delta = (this._lastCorePing - this._connectionStartTime) / 1000.0;
      // logger.log('core ping @ ', delta, ' seconds ', { deviceID: this._id });
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
    messageName: string,
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
      id = this._sendCounter;
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
    messageName: string,
    params: ?Object,
    data: ?Buffer,
    requester?: Object,
    ..._:void[]
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

  /**
   * Adds a listener to our secure message stream
   * @param name the message type we're waiting on
   * @param uri - a particular function / variable?
   * @param token - what message does this go with? (should come from
   *  sendMessage)
   */
  listenFor = async (
    eventName: string,
    uri: ?string,
    token: ?number,
    ..._:void[]
  ): Promise<*> => {
    const tokenHex = token ? utilities.toHexString(token) : null;
    const beVerbose = settings.showVerboseDeviceLogs;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => {
          cleanUpListeners();
          reject('Request timed out');
        },
        KEEP_ALIVE_TIMEOUT,
      );

      // adds a one time event
      const handler = (message: Message): void => {
        clearTimeout(timeout);
        if (uri && message.getUriPath().indexOf(uri) !== 0) {
          if (beVerbose) {
            logger.log(
              'uri filter did not match',
              uri,
              message.getUriPath(),
              { deviceID: this._id },
            );
          }
          reject();
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
          reject();
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

  _increment = (counter: number): number => {
    counter++;
    return counter < COUNTER_MAX
      ? counter
      : 0;
  };

  /**
   * Gets or wraps
   * @returns {null}
   */
  _incrementSendCounter = () => {
    this._sendCounter = this._increment(this._sendCounter);
  };

  _incrementReceiveCounter = () => {
    this._recieveCounter = this._increment(this._recieveCounter);
  };

  /**
   * increments or wraps our token value, and makes sure it isn't in use
   */
  _incrementSendToken = (): number => {
    this._sendToken = this._increment(this._sendToken);
    this._clearToken(this._sendToken);
    return this._sendToken;
  };

  /**
   * Associates a particular token with a message we're sending, so we know
   * what we're getting back when we get an ACK
   * @param name
   * @param sendToken
   */
  _useToken = (name: string, sendToken: number) => {
    const key = utilities.toHexString(sendToken);

    if (this._tokens[key]) {
      throw new Error(
        `Token ${name} ${this._tokens[key]} ${key} already in use`,
      );
    }

    this._tokens[key] = name;
  };

  /**
   * Clears the association with a particular token
   * @param sendToken
   */
  _clearToken = (sendToken: number): void => {
    const key = utilities.toHexString(sendToken);

    if (this._tokens[key]) {
      delete this._tokens[key];
    }
  };

  _getResponseType = (tokenString: string): ?string => {
    const request = this._tokens[tokenString];
    // logger.log('respType for key ', tokenStr, ' is ', request);

    if (!request) {
      return '';
    }

    return Messages.getResponseType(request);
  };

  /**
   * Ensures we have introspection data from the core, and then
   * requests a variable value to be sent, when received it transforms
   * the response into the appropriate type
   * @param name
   * @param type
   * @param callback - expects (value, buf, err)
   */
  _getVariable = async (
    name: string,
    type: string,
  ): Promise<*> => {
    await this._ensureWeHaveIntrospectionData();
    if (!this._hasParticleVariable(name)) {
      throw new Error('Variable not found');
    }

    const messageToken = this.sendMessage(
      'VariableRequest', { name },
    );
    const message = await this.listenFor(
      'VariableValue',
      null,
      messageToken,
    );
    return this._transformVariableResult(name, message);
  };

  _setVariable = async (
    name: string,
    data: Buffer,
    ..._:void[]
  ): Promise<*> => {
    // TODO: data type!
    const payload = Messages.toBinary(data);
    const token = this.sendMessage('VariableRequest', { name }, payload);

    // are we expecting a response?
    // watches the messages coming back in, listens for a message of this type
    // with
    return await this.listenFor('VariableValue', null, token);
  };

  _callFunction = async (
    name: string,
    args: Object,
  ): Promise<*> => {
    try {
      const buffer = await this._transformArguments(name, args);
      if (!buffer) {
        throw new Error(`Unknown Function ${name}`);
      }

      if (settings.showVerboseDeviceLogs) {
        logger.log(
          'sending function call to the core',
          { deviceID: this._id, name },
        );
      }

      const writeUrl = (message: Message): Message => {
        message.setUri(`f/${name}`);
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
          name,
        },
        null,
      );

      const message = await this.listenFor('FunctionReturn', null, token);
      return this._transformFunctionResult(name, message);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Asks the core to start or stop its 'raise your hand' signal
   * @param showSignal - whether it should show the signal or not
   * @param callback - what to call when we're done or timed out...
   */
  _raiseYourHand = async (showSignal: boolean, ..._:void[]): Promise<*> => {
    const token = this.sendMessage(
      '_raiseYourHand',
      { _writeCoapUri: Messages.raiseYourHandUrlGenerator(showSignal) },
      null,
    );
    return await this.listenFor(
      '_raiseYourHandReturn',
      null,
      token,
    );
  };

  flashCore = (binary: ?Buffer, sender: string): Object => {
    if (!binary || (binary.length === 0)) {
      logger.log(
        'flash failed! - file is empty! ',
        { deviceID: this._id },
      );
      const result = {
        cmd: 'Event',
        error: new Error('Update failed - File was too small!'),
        name: 'Update',
      };
      this.sendApiResponse(
        sender,
        result,
      );
      return result;
    }

    if (binary && binary.length > MAX_BINARY_SIZE) {
      logger.log(
        `flash failed! - file is too BIG ${binary.length}`,
        { deviceID: this._id },
      );
      const result = {
        cmd: 'Event',
        error: new Error('Update failed - File was too big!'),
        name: 'Update',
      };
      this.sendApiResponse(
        sender,
        result,
      );
      return result;
    }

    const flasher = new Flasher(this);
    try {
      logger.log(
        'flash device started! - sending api event',
        { deviceID: this._id },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_STARTED);

      const result = {
        cmd: 'Event',
        message: 'Update started',
        name: 'Update',
      };
      this.sendApiResponse(
        sender,
        result,
      );

      flasher.startFlashBuffer(binary);

      logger.log(
        'flash device finished! - sending api event',
        { deviceID: this._id },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_SUCCESS);

      this.sendApiResponse(
        sender,
        { cmd: 'Event', name: 'Update', message: 'Update done' },
      );

      return result;
    } catch (error) {
      logger.log(
        'flash device failed! - sending api event',
        { deviceID: this._id, error },
      );

      this.emit(DEVICE_EVENT_NAMES.FLASH_FAILED);

      const result = {
        cmd: 'Event',
        error: new Error('Update failed'),
        name: 'Update',
      };
      this.sendApiResponse(
        sender,
        result,
      );
      return result;
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
  releaseOwnership = (flasher: Flasher): void => {
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


  /**
   *
   * @param name
   * @param message
   * @param callback-- callback expects (value, buf, err)
   * @returns {null}
   */
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
        '_transformVariableResult - error transforming response ' +
        error,
      );
    }

    return result;
  };


  /**
   * Transforms the result from a core function to the correct type.
   * @param name
   * @param msg
   * @param callback
   * @returns {null}
   */
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
        '_transformFunctionResult - error transforming response ' +
        error,
      );
    }

    return result;
  };

  /**
   * transforms our object into a nice coap query string
   * @param name
   * @param args
   * @private
   */
  _transformArguments = async (
    name: string,
    args: ?Object,
  ): Promise<?Buffer> => {
    //logger.log('transform args', { deviceID: this._id });
    if (!args) {
      return null;
    }

    await this._ensureWeHaveIntrospectionData();
    //TODO: lowercase function keys on new state format
    name = name.toLowerCase();
    const deviceFunctionState = nullthrows(this._deviceFunctionState);

    let functionState = deviceFunctionState[name];
    if (!functionState || !functionState.args) {
      //maybe it's the old protocol?
      const oldProtocolFunctionState = deviceFunctionState.f;
      if (
        oldProtocolFunctionState &&
        oldProtocolFunctionState.some(fn => fn.toLowerCase() === name)
      ) {
        //current / simplified function format (one string arg, int return type)
        functionState = {
          returns: 'int',
          args: [
            [null, 'string'],
          ],
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
   * @returns {*}
   */
  _ensureWeHaveIntrospectionData = async (): Promise<*> => {
    if (this._hasFunctionState()) {
      return Promise.resolve();
    }

    try {
      this.sendMessage('Describe');
      const systemMessage = await this.listenFor('DescribeReturn', null, null);

      //got a description, is it any good?
      const data = systemMessage.getPayload();
      const firstFunctionState = JSON.parse(data.toString());

      // In the newer firmware the application data comes in a later message.
      // We run a race to see if the function state comes in the first response.
      const functionState = await Promise.race([
        this.listenFor('DescribeReturn', null, null)
          .then(applicationMessage => {
            //got a description, is it any good?
            const data = applicationMessage.getPayload();
            return JSON.parse(data.toString());
          }),
        new Promise((resolve, reject) => {
          if (firstFunctionState.f && firstFunctionState.v) {
            resolve(firstFunctionState);
          }
        }),
      ])

      if (functionState && functionState.v) {
        //'v':{'temperature':2}
        functionState.v = Messages.translateIntTypes(functionState.v);
      }

      this._deviceFunctionState = functionState;
    } catch (error) {
      throw error;
    }
  };


  //-------------
  // Core Events / Spark.publish / Spark.subscribe
  //-------------
  onCoreEvent = (event: Event) => {
    this.sendCoreEvent(event);
  };
  // TODO rework and figure out how to implement subscription with `MY_DEVICES`
  // right way
  sendCoreEvent = (event: Event) => {
    const { data, isPublic, name, publishedAt, ttl } = event;

    const rawFunction = (message: Message): void => {
      try {
        message.setMaxAge((ttl >= 0) ? ttl : 60);
        if (publishedAt) {
          message.setTimestamp(moment(publishedAt).toDate());
        }
      } catch (error) {
        logger.error(`onCoreHeard - ${error.message}`);
      }

      return message;
    };

    const messageName = isPublic ? 'PublicEvent' : 'PrivateEvent';
    // const userID = (this._userId || '').toLowerCase() + '/';
    // name = name ? name.toString() : name;
    // if (name && name.indexOf && (name.indexOf(userID)===0)) {
    //   name = name.substring(userID.length);
    // }

    this.sendMessage(
      messageName,
      {
        _raw: rawFunction,
        event_name: name.toString(),
      },
      data && data.toString(),
    );
  };

  _hasFunctionState = (): boolean => {
    return !!this._deviceFunctionState;
  };

  _hasParticleVariable = (name: string): boolean => {
    return !!(
      this._deviceFunctionState &&
      this._deviceFunctionState.v &&
      this._deviceFunctionState.v[name]
    );
  };

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
            fn => fn.toLowerCase() === lowercaseName,
          )
        )
      )
    );
  };

  // eslint-disable-next-line no-confusing-arrow
  getID = (): string => this._id;


  // eslint-disable-next-line no-confusing-arrow
  getRemoteIPAddress = (): string =>
    this._socket.remoteAddress
      ? this._socket.remoteAddress.toString()
      : 'unknown';


  disconnect = (message: ?string = '') => {
    // eslint-disable-next-line no-plusplus
    this._disconnectCounter++;

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
      } catch (exception) {
        logger.error('Error cleaning up _decipherStream ', exception);
      }
    }

    if (this._cipherStream) {
      try {
        this._cipherStream.end();
        this._cipherStream = null;
      } catch (exception) {
        logger.error('Error cleaning up _cipherStream ', exception);
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

export default SparkCore;
