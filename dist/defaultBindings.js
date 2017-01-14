'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _constitute = require('constitute');

var _DeviceAttributeFileRepository = require('./repository/DeviceAttributeFileRepository');

var _DeviceAttributeFileRepository2 = _interopRequireDefault(_DeviceAttributeFileRepository);

var _DeviceKeyFileRepository = require('./repository/DeviceKeyFileRepository');

var _DeviceKeyFileRepository2 = _interopRequireDefault(_DeviceKeyFileRepository);

var _DeviceServer = require('./server/DeviceServer');

var _DeviceServer2 = _interopRequireDefault(_DeviceServer);

var _EventPublisher = require('./lib/EventPublisher');

var _EventPublisher2 = _interopRequireDefault(_EventPublisher);

var _ClaimCodeManager = require('./lib/ClaimCodeManager');

var _ClaimCodeManager2 = _interopRequireDefault(_ClaimCodeManager);

var _ServerKeyFileRepository = require('./repository/ServerKeyFileRepository');

var _ServerKeyFileRepository2 = _interopRequireDefault(_ServerKeyFileRepository);

var _settings = require('./settings');

var _settings2 = _interopRequireDefault(_settings);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var defaultBindings = function defaultBindings(container) {
  // Settings
  container.bindValue('DEVICE_DIRECTORY', _settings2.default.DEVICE_DIRECTORY);
  container.bindValue('SERVER_CONFIG', _settings2.default.SERVER_CONFIG);
  container.bindValue('SERVER_KEY_FILENAME', _settings2.default.SERVER_KEY_FILENAME);
  container.bindValue('SERVER_KEYS_DIRECTORY', _settings2.default.SERVER_KEYS_DIRECTORY);

  // Repository
  container.bindClass('DeviceAttributeRepository', _DeviceAttributeFileRepository2.default, ['DEVICE_DIRECTORY']);
  container.bindClass('DeviceKeyRepository', _DeviceKeyFileRepository2.default, ['DEVICE_DIRECTORY']);
  container.bindClass('ServerKeyRepository', _ServerKeyFileRepository2.default, ['SERVER_KEYS_DIRECTORY', 'SERVER_KEY_FILENAME']);

  // Utils
  container.bindClass('EventPublisher', _EventPublisher2.default, []);
  container.bindClass('ClaimCodeManager', _ClaimCodeManager2.default, []);

  // Device server
  container.bindClass('DeviceServer', _DeviceServer2.default, ['DeviceAttributeRepository', 'DeviceKeyRepository', 'ServerKeyRepository', 'ClaimCodeManager', 'EventPublisher', 'SERVER_CONFIG']);
};

exports.default = defaultBindings;