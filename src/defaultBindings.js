// @flow


import { Container } from 'constitute';

import DeviceAttributeFileRepository from './repository/DeviceAttributeFileRepository';
import DeviceKeyFileRepository from './repository/DeviceKeyFileRepository';
import DeviceServer from './server/DeviceServer';
import EventPublisher from './lib/EventPublisher';
import ClaimCodeManager from './lib/ClaimCodeManager';
import ServerKeyFileRepository from './repository/ServerKeyFileRepository';
import settings from './settings';

export default (container: Container): void => {
  // Settings
  container.bindValue('DEVICE_DIRECTORY', settings.DEVICE_DIRECTORY);
  container.bindValue('SERVER_CONFIG', settings.SERVER_CONFIG);
  container.bindValue('SERVER_KEY_FILENAME', settings.SERVER_KEY_FILENAME);
  container.bindValue('SERVER_KEYS_DIRECTORY', settings.SERVER_KEYS_DIRECTORY);

  // Repository
  container.bindClass(
    'DeviceAttributeRepository',
    DeviceAttributeFileRepository,
    ['DEVICE_DIRECTORY'],
  );
  container.bindClass(
    'DeviceKeyRepository',
    DeviceKeyFileRepository,
    ['DEVICE_DIRECTORY'],
  );
  container.bindClass(
    'ServerKeyRepository',
    ServerKeyFileRepository,
    ['SERVER_KEYS_DIRECTORY', 'SERVER_KEY_FILENAME'],
  );

  // Utils
  container.bindClass('EventPublisher', EventPublisher, []);
  container.bindClass('ClaimCodeManager', ClaimCodeManager, []);

  // Device server
  container.bindClass(
    'DeviceServer',
    DeviceServer,
    [
      'DeviceAttributeRepository',
      'DeviceKeyRepository',
      'ServerKeyRepository',
      'ClaimCodeManager',
      'EventPublisher',
      'SERVER_CONFIG',
    ],
  );
};
