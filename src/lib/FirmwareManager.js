// @flow

import type Device from '../clients/Device';

import fs from 'fs';
import {HalDescribeParser} from 'binary-version-reader';
import nullthrows from 'nullthrows';
import protocolSettings from '../settings';
import settings from '../../third-party/settings';
import specifications from '../../third-party/specifications';
import versions from '../../third-party/versions';

type OtaUpdate = {
  address: string,
  alt: string,
  binaryFileName: string,
};

type UpdateConfig = {
  moduleIndex: number,
  systemFile: Buffer,
};

const platformSettings = Object.entries(specifications);
const SPECIFICATION_KEY_BY_PLATFORM = new Map(
  Object.values(settings.knownPlatforms).map(
    platform => {
      const spec = platformSettings.find(
        ([key, value]) => (value: any).productName === platform,
      );

      return [platform, spec && spec[0]]
    },
  ).filter(item => item[1]),
);
const FIRMWARE_VERSION =
  versions.find(version => version[1] === settings.versionNumber)[0];

class FirmwareManager {
  static getOtaSystemUpdateConfig = async (
    systemInformation: Object,
  ): Promise<*> => {
    const parser = new HalDescribeParser();
    const platformID = systemInformation.p;
    const systemVersion = parser.getSystemVersion(systemInformation);
    const modules = parser.getModules(systemInformation)
      // Filter so we only have the system modules
      .filter(module => module.func === 's');

    if (!modules) {
      throw new Error('Could not find any system modules for OTA update');
    }
    const moduleToUpdate = modules.find(
      module => module.version < FIRMWARE_VERSION,
    );

    if (!modules) {
      throw new Error('All modules appear to be updated.');
    }

    const otaUpdateConfig = FirmwareManager.getOtaUpdateConfig(platformID);
    if (!otaUpdateConfig) {
      throw new Error('Could not find OTA update config for device');
    }

    const moduleIndex = modules.indexOf(moduleToUpdate);

    const config = otaUpdateConfig[moduleIndex];
    const systemFile = fs.readFileSync(
      protocolSettings.BINARIES_DIRECTORY + '/' + config.binaryFileName,
    );

    return {
      moduleIndex,
      systemFile,
    };
  }

  static getOtaUpdateConfig(platformID: number): ?Array<OtaUpdate> {
    const platform = settings.knownPlatforms[platformID + ''];
    const key = SPECIFICATION_KEY_BY_PLATFORM.get(platform);

    if (!key) {
      return null;
    }

    const firmwareSettings = settings.updates[key];
    if (!key) {
      return null;
    }

    const firmwareKeys = Object.keys(firmwareSettings);
    return firmwareKeys.map(firmwareKey => ({
      ...specifications[key][firmwareKey],
      binaryFileName: firmwareSettings[firmwareKey],
    }));
  }

  static getAppModule = (systemInformation: Object): Object => {
    const parser = new HalDescribeParser();
    return nullthrows(
      parser.getModules(systemInformation)
        // Filter so we only have the app modules
        .find(module => module.func === 'u'),
    );
  }

  getKnownAppFileName(): ?string {
    throw new Error('getKnownAppFileName has not been implemented.')
  }
}

export default FirmwareManager;
