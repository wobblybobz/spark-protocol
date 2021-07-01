#! /usr/bin/env node
// @flow

import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import mkdirp from 'mkdirp';
import settings from '../settings';
import { HalModuleParser } from 'binary-version-reader';
import dotenv from 'dotenv';

let fileDirectory = path.resolve(process.cwd());
let filePath = null;

// A counter is a lot safer than a while(true)
let count = 0;
while (count < 20) {
  count += 1;
  filePath = path.join(fileDirectory, '.env');
  console.log('Checking for .env: ', filePath);
  if (fs.existsSync(filePath)) {
    break;
  }

  const newFileDirectory = path.join(fileDirectory, '..');
  if (newFileDirectory === fileDirectory) {
    filePath = null;
    break;
  }
  fileDirectory = newFileDirectory;
}

if (!filePath) {
  dotenv.config();
} else {
  dotenv.config({
    path: filePath,
  });
}

const GITHUB_USER = 'particle-iot';
const GITHUB_FIRMWARE_REPOSITORY = 'firmware';
const GITHUB_CLI_REPOSITORY = 'particle-cli';
const FILE_GEN_DIRECTORY = path.join(__dirname, '../../third-party/');
const SETTINGS_FILE = `${FILE_GEN_DIRECTORY}settings.json`;

type Asset = {
  browser_download_url: string,
  id: string,
  name: string,
};

// This default is here so that the regex will work when updating these files.
/* eslint-disable */
const DEFAULT_SETTINGS = {
  knownApps: {
    deep_update_2014_06: true,
    cc3000: true,
    cc3000_1_14: true,
    tinker: true,
    voodoo: true,
  },
  knownPlatforms: {
    '0': 'Core',
    '6': 'Photon',
    '8': 'P1',
    '10': 'Electron',
    '88': 'Duo',
    '103': 'Bluz',
  },
  updates: {
    '2b04:d006': {
      systemFirmwareOne: 'system-part1-0.6.0-photon.bin',
      systemFirmwareTwo: 'system-part2-0.6.0-photon.bin',
    },
    '2b04:d008': {
      systemFirmwareOne: 'system-part1-0.6.0-p1.bin',
      systemFirmwareTwo: 'system-part2-0.6.0-p1.bin',
    },
    '2b04:d00a': {
      // The bin files MUST be in this order to be flashed to the correct memory locations
      systemFirmwareOne: 'system-part2-0.6.0-electron.bin',
      systemFirmwareTwo: 'system-part3-0.6.0-electron.bin',
      systemFirmwareThree: 'system-part1-0.6.0-electron.bin',
    },
  },
};

const FIRMWARE_PLATFORMS = Object.values(DEFAULT_SETTINGS.knownPlatforms).map(
  platform => (platform: any).toLowerCase(),
);
/* eslint-enable */

const { GITHUB_AUTH_TOKEN } = process.env;

if (!GITHUB_AUTH_TOKEN) {
  throw new Error(
    'OAuth Token Required. You need to set up a .env file with auth credentials',
  );
}

const MyOctokit = Octokit.plugin(retry, throttling);
const githubAPI = new MyOctokit({
  auth: GITHUB_AUTH_TOKEN,
  throttle: {
    onAbuseLimit: (retryAfter: Number, options: Object) => {
      // does not retry, only logs a warning
      MyOctokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`,
      );
    },
    onRateLimit: (retryAfter: Number, options: Object): Boolean => {
      githubAPI.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      );
      // Retry three times after hitting a rate limit error, then give up
      if (options.request.retryCount <= 3) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
      return false;
    },
  },
});

const githubAPINoAuth = new MyOctokit({
  throttle: {
    onAbuseLimit: (retryAfter: Number, options: Object) => {
      // does not retry, only logs a warning
      MyOctokit.log.warn(
        `Abuse detected for request ${options.method} ${options.url}`,
      );
    },
    onRateLimit: (retryAfter: Number, options: Object): Boolean => {
      githubAPI.log.warn(
        `Request quota exhausted for request ${options.method} ${options.url}`,
      );
      // Retry three times after hitting a rate limit error, then give up
      if (options.request.retryCount <= 3) {
        console.log(`Retrying after ${retryAfter} seconds!`);
        return true;
      }
      return false;
    },
  },
});

const downloadAssetFile = async (asset: Asset): Promise<*> => {
  const filename = asset.name;
  const fileWithPath = `${settings.BINARIES_DIRECTORY}/${filename}`;
  if (fs.existsSync(fileWithPath)) {
    console.log(`File Exists: ${filename}`);
    return filename;
  }

  console.log(`Downloading ${filename}...`);

  return githubAPINoAuth.repos
    .getReleaseAsset({
      access_token: GITHUB_AUTH_TOKEN,
      asset_id: asset.id,
      headers: {
        accept: 'application/octet-stream',
      },
      owner: GITHUB_USER,
      repo: GITHUB_FIRMWARE_REPOSITORY,
    })
    .then((response: any): string => {
      fs.writeFileSync(fileWithPath, Buffer.from(response.data));
      return filename;
    })
    .catch((error: Error): void => console.error(asset, error));
};

const downloadBlob = async (asset: any): Promise<*> => {
  const filename = asset.name;
  const fileWithPath = `${settings.BINARIES_DIRECTORY}/${filename}`;
  if (fs.existsSync(fileWithPath)) {
    console.log(`File Exists: ${filename}`);
    return filename;
  }

  console.log(`Downloading ${filename}...`);

  return githubAPI.git
    .getBlob({
      file_sha: asset.sha,
      headers: {
        accept: 'application/vnd.github.v3.raw',
      },
      owner: GITHUB_USER,
      repo: GITHUB_CLI_REPOSITORY,
    })
    .then((response: any): string => {
      fs.writeFileSync(fileWithPath, Buffer.from(response.data));
      return filename;
    })
    .catch((error: Error): void => console.error(error));
};

const downloadFirmwareBinaries = async (
  assets: Array<Asset>,
): Promise<Array<string>> => {
  const CHUNK_SIZE = 10;

  function chunkArray(input: Array, chunkSize: Number): Array {
    let index = 0;
    const arrayLength = input.length;
    const tempArray = [];

    for (index = 0; index < arrayLength; index += chunkSize) {
      tempArray.push(input.slice(index, index + chunkSize));
    }

    return tempArray;
  }

  const chunks = chunkArray(
    assets.filter((asset: Object): Promise<string> =>
      asset.name.match(/(system-part|bootloader)/),
    ),
    CHUNK_SIZE,
  );
  const assetFileNames = await chunks.reduce(
    (promise: Promise, chunk: Array): Array =>
      promise.then((results: Array): Promise =>
        Promise.all([
          ...(results || []),
          ...chunk.map((asset: Object): Promise => downloadAssetFile(asset)),
        ]),
      ),
    Promise.resolve(),
  );

  return assetFileNames.filter((item: ?string): boolean => !!item);
};

const updateSettings = async (
  binaryFileNames: Array<string>,
): Promise<void> => {
  const parser = new HalModuleParser();

  const moduleInfos = await Promise.all(
    binaryFileNames.map(
      (filename: string): Promise<any> =>
        new Promise((resolve: (result: any) => void): void =>
          parser.parseFile(
            `${settings.BINARIES_DIRECTORY}/${filename}`,
            (result: any) => {
              // For some reason all the new modules are dependent on
              // version 204 but these modules don't actually exist
              // Use 207 as it's close enough (v0.7.0)
              // https://github.com/Brewskey/spark-protocol/issues/145
              if (result.prefixInfo.depModuleVersion === 204) {
                // eslint-disable-next-line no-param-reassign
                result.prefixInfo.depModuleVersion = 207;
              }

              resolve({
                ...result,
                fileBuffer: undefined,
                filename,
              });
            },
          ),
        ),
    ),
  );

  const scriptSettings = JSON.stringify(moduleInfos, null, 2);

  fs.writeFileSync(SETTINGS_FILE, scriptSettings);
  console.log('Updated settings');
};

const downloadAppBinaries = async (): Promise<*> => {
  const assets = await githubAPI.repos.getContent({
    owner: GITHUB_USER,
    path: 'assets/binaries',
    repo: GITHUB_CLI_REPOSITORY,
  });
  return await Promise.all(
    assets.data.map((asset: Object): Promise<string> => downloadBlob(asset)),
  );
};

(async (): Promise<*> => {
  try {
    if (!fs.existsSync(settings.BINARIES_DIRECTORY)) {
      mkdirp.sync(settings.BINARIES_DIRECTORY);
    }
    if (!fs.existsSync(FILE_GEN_DIRECTORY)) {
      mkdirp.sync(FILE_GEN_DIRECTORY);
    }

    try {
      // Download app binaries
      await downloadAppBinaries();
    } catch (error) {
      console.error(error);
    }

    // Download firmware binaries
    githubAPI
      .paginate(githubAPI.repos.listReleases, {
        owner: GITHUB_USER,
        per_page: 100,
        repo: GITHUB_FIRMWARE_REPOSITORY,
      })
      .then(async (releases: any): any => {
        releases.sort((a: Object, b: Object): number => {
          if (a.tag_name < b.tag_name) {
            return 1;
          }
          if (a.tag_name > b.tag_name) {
            return -1;
          }
          return 0;
        });

        const assets = [].concat(
          ...releases.map((release: any): Array<any> => release.assets),
        );
        const downloadedBinaries = await downloadFirmwareBinaries(assets);
        await updateSettings(downloadedBinaries);

        console.log('\r\nCompleted Sync');
      });
  } catch (err) {
    console.log(err);
  }
})();
