'use strict';

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _github = require('github');

var _github2 = _interopRequireDefault(_github);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _rmfr = require('rmfr');

var _rmfr2 = _interopRequireDefault(_rmfr);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var GITHUB_USER = 'spark';
var GITHUB_FIRMWARE_REPOSITORY = 'firmware';
var GITHUB_CLI_REPOSITORY = 'particle-cli';
var FILE_GEN_DIRECTORY = _path2.default.join(__dirname, '../../third-party/');
var MAPPING_FILE = FILE_GEN_DIRECTORY + 'versions.json';
var SPECIFICATIONS_FILE = FILE_GEN_DIRECTORY + 'specifications.js';
var SETTINGS_FILE = FILE_GEN_DIRECTORY + 'settings.json';

// This default is here so that the regex will work when updating these files.
var DEFAULT_SETTINGS = {
  knownApps: {
    'deep_update_2014_06': true,
    'cc3000': true,
    'cc3000_1_14': true,
    'tinker': true,
    'voodoo': true
  },
  knownPlatforms: {
    '0': 'Core',
    '6': 'Photon',
    '8': 'P1',
    '10': 'Electron',
    '88': 'Duo',
    '103': 'Bluz'
  },
  updates: {
    '2b04:d006': {
      systemFirmwareOne: 'system-part1-0.6.0-photon.bin',
      systemFirmwareTwo: 'system-part2-0.6.0-photon.bin'
    },
    '2b04:d008': {
      systemFirmwareOne: 'system-part1-0.6.0-p1.bin',
      systemFirmwareTwo: 'system-part2-0.6.0-p1.bin'
    },
    '2b04:d00a': {
      // The bin files MUST be in this order to be flashed to the correct memory locations
      systemFirmwareOne: 'system-part2-0.6.0-electron.bin',
      systemFirmwareTwo: 'system-part3-0.6.0-electron.bin',
      systemFirmwareThree: 'system-part1-0.6.0-electron.bin'
    }
  }
};

var versionTag = '';
var githubAPI = new _github2.default();

var exitWithMessage = function exitWithMessage(message) {
  console.log(message);
  process.exit(0);
};

var exitWithJSON = function exitWithJSON(json) {
  exitWithMessage((0, _stringify2.default)(json, null, 2));
};

var downloadFile = function downloadFile(url) {
  return new _promise2.default(function (resolve, reject) {
    var filename = (0, _nullthrows2.default)(url.match(/.*\/(.*)/))[1];
    console.log('Downloading ' + filename + '...');
    var file = _fs2.default.createWriteStream(_settings2.default.BINARIES_DIRECTORY + '/' + filename);
    file.on('finish', function () {
      return file.close(function () {
        return resolve(filename);
      });
    });
    (0, _request2.default)(url).pipe(file).on('error', exitWithJSON);
  });
};

var downloadFirmwareBinaries = function () {
  var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(assets) {
    var assetFileNames;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.next = 2;
            return _promise2.default.all(assets.map(function (asset) {
              if (asset.name.match(/^system-part/)) {
                return downloadFile(asset.browser_download_url);
              }
              return '';
            }));

          case 2:
            assetFileNames = _context.sent;
            return _context.abrupt('return', assetFileNames.filter(function (item) {
              return item;
            }));

          case 4:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined);
  }));

  return function downloadFirmwareBinaries(_x) {
    return _ref.apply(this, arguments);
  };
}();

var updateSettings = function updateSettings() {
  var versionNumber = versionTag;
  if (versionNumber[0] === 'v') {
    versionNumber = versionNumber.substr(1);
  }

  var settings = (0, _stringify2.default)((0, _extends3.default)({
    versionNumber: versionNumber
  }, DEFAULT_SETTINGS), null, 2);
  var settingsBinaries = [];
  settings = settings.replace(/(system-part\d-).*(-.*.bin)/g, function (filename, part, device) {
    var newFilename = part + versionNumber + device;
    settingsBinaries.push(newFilename);
    return newFilename;
  });

  _fs2.default.writeFileSync(SETTINGS_FILE, settings, { flag: 'wx' });
  console.log('Updated settings');

  return settingsBinaries;
};

var verifyBinariesMatch = function verifyBinariesMatch(downloadedBinaries, settingsBinaries) {
  downloadedBinaries = downloadedBinaries.sort();
  settingsBinaries = settingsBinaries.sort();
  if ((0, _stringify2.default)(downloadedBinaries) !== (0, _stringify2.default)(settingsBinaries)) {
    console.log('\n\nWARNING: the list of downloaded binaries doesn\'t match the list ' + 'of binaries in settings.js');
    console.log('Downloaded:  ', downloadedBinaries);
    console.log('settings.js: ', settingsBinaries);
  }
};

var downloadAppBinaries = function () {
  var _ref2 = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee2() {
    var assets;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return githubAPI.repos.getContent({
              owner: GITHUB_USER,
              repo: GITHUB_CLI_REPOSITORY,
              path: 'binaries'
            });

          case 2:
            assets = _context2.sent;
            _context2.next = 5;
            return _promise2.default.all(assets.map(function (asset) {
              return downloadFile(asset.download_url);
            }));

          case 5:
            return _context2.abrupt('return', _context2.sent);

          case 6:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, undefined);
  }));

  return function downloadAppBinaries() {
    return _ref2.apply(this, arguments);
  };
}();

(0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee3() {
  var tags, release, downloadedBinaries, settingsBinaries, specificationsResponse, versionResponse, versionText, startIndex, endIndex, data, mapping, i;
  return _regenerator2.default.wrap(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          // Start running process. If you pass `0.6.0` it will install that version of
          // the firmware.
          versionTag = process.argv[2];
          if (versionTag && versionTag[0] !== 'v') {
            versionTag = 'v' + versionTag;
          }

          _context3.next = 4;
          return (0, _rmfr2.default)(_settings2.default.BINARIES_DIRECTORY + '/');

        case 4:
          if (!_fs2.default.existsSync(_settings2.default.BINARIES_DIRECTORY)) {
            _mkdirp2.default.sync(_settings2.default.BINARIES_DIRECTORY);
          }
          _context3.next = 7;
          return (0, _rmfr2.default)(FILE_GEN_DIRECTORY);

        case 7:
          if (!_fs2.default.existsSync(FILE_GEN_DIRECTORY)) {
            _mkdirp2.default.sync(FILE_GEN_DIRECTORY);
          }

          // Download app binaries
          _context3.next = 10;
          return downloadAppBinaries();

        case 10:
          if (!(process.argv.length !== 3)) {
            _context3.next = 17;
            break;
          }

          _context3.next = 13;
          return githubAPI.repos.getTags({
            owner: GITHUB_USER,
            page: 0,
            perPage: 30,
            repo: GITHUB_FIRMWARE_REPOSITORY
          });

        case 13:
          tags = _context3.sent;

          tags = tags.filter(function (tag) {
            return (
              // Don't use release candidates.. we only need main releases.
              !tag.name.includes('-rc') && !tag.name.includes('-pi')
            );
          });

          tags.sort(function (a, b) {
            if (a.name < b.name) {
              return 1;
            }
            if (a.name > b.name) {
              return -1;
            }
            return 0;
          });

          versionTag = tags[0].name;

        case 17:
          _context3.next = 19;
          return githubAPI.repos.getReleaseByTag({
            owner: GITHUB_USER,
            repo: GITHUB_FIRMWARE_REPOSITORY,
            tag: versionTag
          });

        case 19:
          release = _context3.sent;
          _context3.next = 22;
          return downloadFirmwareBinaries(release.assets);

        case 22:
          downloadedBinaries = _context3.sent;
          _context3.next = 25;
          return updateSettings();

        case 25:
          settingsBinaries = _context3.sent;

          verifyBinariesMatch(downloadedBinaries, settingsBinaries);

          _context3.next = 29;
          return githubAPI.repos.getContent({
            owner: GITHUB_USER,
            path: 'lib/deviceSpecs/specifications.js',
            repo: GITHUB_CLI_REPOSITORY
          });

        case 29:
          specificationsResponse = _context3.sent;


          _fs2.default.writeFileSync(SPECIFICATIONS_FILE, new Buffer(specificationsResponse.content, 'base64').toString(), { flag: 'wx' });

          _context3.next = 33;
          return githubAPI.repos.getContent({
            owner: GITHUB_USER,
            path: 'system/system-versions.md',
            repo: GITHUB_FIRMWARE_REPOSITORY
          });

        case 33:
          versionResponse = _context3.sent;
          versionText = new Buffer(versionResponse.content, 'base64').toString();
          startIndex = versionText.indexOf('| 0 ');
          endIndex = versionText.indexOf('\n\n', startIndex);
          data = versionText.substring(startIndex, endIndex).replace(/\s/g, '').split('|');
          mapping = [];
          i = 0;

        case 40:
          if (!(i < data.length)) {
            _context3.next = 47;
            break;
          }

          if (data[i + 1]) {
            _context3.next = 43;
            break;
          }

          return _context3.abrupt('continue', 44);

        case 43:
          mapping.push([data[i + 1], data[i + 2]]);

        case 44:
          i += 4;
          _context3.next = 40;
          break;

        case 47:
          _fs2.default.writeFileSync(MAPPING_FILE, (0, _stringify2.default)(mapping, null, 2), { flag: 'wx' });

          console.log('\r\nCompleted Sync');

        case 49:
        case 'end':
          return _context3.stop();
      }
    }
  }, _callee3, undefined);
}))();