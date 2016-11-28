/*
*	Copyright (c) 2015 Particle Industries, Inc.  All rights reserved.
*
*	This program is free software; you can redistribute it and/or
*	modify it under the terms of the GNU Lesser General Public
*	License as published by the Free Software Foundation, either
*	version 3 of the License, or (at your option) any later version.
*
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
*	Lesser General Public License for more details.
*
*	You should have received a copy of the GNU Lesser General Public
*	License along with this program; if not, see <http://www.gnu.org/licenses/>.
*
* @flow
*
*/

import DeviceAttributeFileRepository from '../repository/DeviceAttributeFileRepository'
import DeviceServer from './DeviceServer_v2';
import ServerConfigFileRepository from '../repository/ServerConfigFileRepository'
import logger from '../lib/logger';
import path from 'path';
import settings from '../settings';

//
//  Not the best way to deal with errors I'm told, but should be fine on a home server
//
process.on('uncaughtException', function (ex) {
    var stack = (ex && ex.stack) ? ex.stack : "";
    logger.error('Caught exception: ' + ex + ' stack: ' + stack);
});


const server = new DeviceServer({
  deviceAttributeRepository: new DeviceAttributeFileRepository(
    path.join(__dirname, 'device_keys'),
  ),
  host: settings.HOST,
  port: settings.PORT,
  serverConfigRepository: new ServerConfigFileRepository(
    settings.serverKeyFile,
  ),
  serverKeyFile: settings.serverKeyFile,
  serverKeyPassFile: settings.serverKeyPassFile,
  serverKeyPassEnvVar: settings.serverKeyPassEnvVar,
});
server.start();
