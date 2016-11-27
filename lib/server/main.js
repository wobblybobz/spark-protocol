'use strict';

var _DeviceFileRepository = require('../repository/DeviceFileRepository');

var _DeviceFileRepository2 = _interopRequireDefault(_DeviceFileRepository);

var _DeviceServer_v = require('./DeviceServer_v2');

var _DeviceServer_v2 = _interopRequireDefault(_DeviceServer_v);

var _ServerConfigFileRepository = require('../repository/ServerConfigFileRepository');

var _ServerConfigFileRepository2 = _interopRequireDefault(_ServerConfigFileRepository);

var _logger = require('../lib/logger');

var _logger2 = _interopRequireDefault(_logger);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//
//  Not the best way to deal with errors I'm told, but should be fine on a home server
//
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
* 
*
*/

process.on('uncaughtException', function (ex) {
  var stack = ex && ex.stack ? ex.stack : "";
  _logger2.default.error('Caught exception: ' + ex + ' stack: ' + stack);
});

var server = new _DeviceServer_v2.default({
  deviceAttributeRepository: new _DeviceFileRepository2.default(_path2.default.join(__dirname, 'device_keys')),
  host: _settings2.default.HOST,
  port: _settings2.default.PORT,
  serverConfigRepository: new _ServerConfigFileRepository2.default(_settings2.default.serverKeyFile),
  serverKeyFile: _settings2.default.serverKeyFile,
  serverKeyPassFile: _settings2.default.serverKeyPassFile,
  serverKeyPassEnvVar: _settings2.default.serverKeyPassEnvVar
});
server.start();