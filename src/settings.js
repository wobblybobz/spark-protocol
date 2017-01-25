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

import path from 'path';
/* eslint-disable sorting/sort-object-props */
export default {
  BINARIES_DIRECTORY: path.join(__dirname, '../data/binaries'),
  DEFAULT_EVENT_TTL: 60,
  DEVICE_DIRECTORY: path.join(__dirname, '../data/deviceKeys'),
  SERVER_CONFIG: {
    host: 'localhost',
    port: 5683,
  },
  SERVER_KEY_FILENAME: 'default_key.pem',
  SERVER_KEYS_DIRECTORY: path.join(__dirname, '../data/users'),

  environment: 'prn',
  /**
   * Your server crypto keys!
   */
  cryptoSalt: 'aes-128-cbc',
  serverKeyPassFile: null,
  serverKeyPassEnvVar: null,

  keepaliveTimeout: 15000, // 15 seconds
  socketTimeout: 31000, // 31 seconds

  verboseProtocol: false,
  showVerboseDeviceLogs: false,
  logApiMessages: true,
};
