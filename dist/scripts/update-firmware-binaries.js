#! /usr/bin/env node
'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _rest = require('@octokit/rest');

var _pluginRetry = require('@octokit/plugin-retry');

var _pluginThrottling = require('@octokit/plugin-throttling');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

var _binaryVersionReader = require('binary-version-reader');

var _dotenv = require('dotenv');

var _dotenv2 = _interopRequireDefault(_dotenv);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var fileDirectory = _path2.default.resolve(process.cwd());

var filePath = null;

// A counter is a lot safer than a while(true)
var count = 0;
while (count < 20) {
  count += 1;
  filePath = _path2.default.join(fileDirectory, '.env');
  console.log('Checking for .env: ', filePath);
  if (_fs2.default.existsSync(filePath)) {
    break;
  }

  var newFileDirectory = _path2.default.join(fileDirectory, '..');
  if (newFileDirectory === fileDirectory) {
    filePath = null;
    break;
  }
  fileDirectory = newFileDirectory;
}

if (!filePath) {
  _dotenv2.default.config();
} else {
  _dotenv2.default.config({
    path: filePath
  });
}

var GITHUB_USER = 'particle-iot';
var GITHUB_FIRMWARE_REPOSITORY = 'firmware';
var GITHUB_CLI_REPOSITORY = 'particle-cli';
var FILE_GEN_DIRECTORY = _path2.default.join(__dirname, '../../third-party/');
var SETTINGS_FILE = FILE_GEN_DIRECTORY + 'settings.json';

// This default is here so that the regex will work when updating these files.
/* eslint-disable */
var DEFAULT_SETTINGS = {
  knownApps: {
    deep_update_2014_06: true,
    cc3000: true,
    cc3000_1_14: true,
    tinker: true,
    voodoo: true
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

var FIRMWARE_PLATFORMS = (0, _values2.default)(DEFAULT_SETTINGS.knownPlatforms).map(function (platform) {
  return platform.toLowerCase();
});
/* eslint-enable */

var GITHUB_AUTH_TOKEN = process.env.GITHUB_AUTH_TOKEN;


if (!GITHUB_AUTH_TOKEN) {
  throw new Error('OAuth Token Required. You need to set up a .env file with auth credentials');
}

var MyOctokit = _rest.Octokit.plugin(_pluginRetry.retry, _pluginThrottling.throttling);
var githubAPI = new MyOctokit({
  auth: GITHUB_AUTH_TOKEN,
  throttle: {
    onAbuseLimit: function onAbuseLimit(retryAfter, options) {
      // does not retry, only logs a warning
      MyOctokit.log.warn('Abuse detected for request ' + options.method + ' ' + options.url);
    },
    onRateLimit: function onRateLimit(retryAfter, options) {
      githubAPI.log.warn('Request quota exhausted for request ' + options.method + ' ' + options.url);
      // Retry three times after hitting a rate limit error, then give up
      if (options.request.retryCount <= 3) {
        console.log('Retrying after ' + retryAfter + ' seconds!');
        return true;
      }
      return false;
    }
  }
});

var githubAPINoAuth = new MyOctokit({
  throttle: {
    onAbuseLimit: function onAbuseLimit(retryAfter, options) {
      // does not retry, only logs a warning
      MyOctokit.log.warn('Abuse detected for request ' + options.method + ' ' + options.url);
    },
    onRateLimit: function onRateLimit(retryAfter, options) {
      githubAPI.log.warn('Request quota exhausted for request ' + options.method + ' ' + options.url);
      // Retry three times after hitting a rate limit error, then give up
      if (options.request.retryCount <= 3) {
        console.log('Retrying after ' + retryAfter + ' seconds!');
        return true;
      }
      return false;
    }
  }
});

var downloadAssetFile = function () {
  var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(asset) {
    var filename, fileWithPath;
    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            filename = asset.name;
            fileWithPath = _settings2.default.BINARIES_DIRECTORY + '/' + filename;

            if (!_fs2.default.existsSync(fileWithPath)) {
              _context.next = 5;
              break;
            }

            console.log('File Exists: ' + filename);
            return _context.abrupt('return', filename);

          case 5:

            console.log('Downloading ' + filename + '...');

            return _context.abrupt('return', githubAPINoAuth.repos.getReleaseAsset({
              access_token: GITHUB_AUTH_TOKEN,
              asset_id: asset.id,
              headers: {
                accept: 'application/octet-stream'
              },
              owner: GITHUB_USER,
              repo: GITHUB_FIRMWARE_REPOSITORY
            }).then(function (response) {
              _fs2.default.writeFileSync(fileWithPath, Buffer.from(response.data));
              return filename;
            }).catch(function (error) {
              return console.error(asset, error);
            }));

          case 7:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined);
  }));

  return function downloadAssetFile(_x) {
    return _ref.apply(this, arguments);
  };
}();

var downloadBlob = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(asset) {
    var filename, fileWithPath;
    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            filename = asset.name;
            fileWithPath = _settings2.default.BINARIES_DIRECTORY + '/' + filename;

            if (!_fs2.default.existsSync(fileWithPath)) {
              _context2.next = 5;
              break;
            }

            console.log('File Exists: ' + filename);
            return _context2.abrupt('return', filename);

          case 5:

            console.log('Downloading ' + filename + '...');

            return _context2.abrupt('return', githubAPI.git.getBlob({
              file_sha: asset.sha,
              headers: {
                accept: 'application/vnd.github.v3.raw'
              },
              owner: GITHUB_USER,
              repo: GITHUB_CLI_REPOSITORY
            }).then(function (response) {
              _fs2.default.writeFileSync(fileWithPath, Buffer.from(response.data));
              return filename;
            }).catch(function (error) {
              return console.error(error);
            }));

          case 7:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, undefined);
  }));

  return function downloadBlob(_x2) {
    return _ref2.apply(this, arguments);
  };
}();

var downloadFirmwareBinaries = function () {
  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(assets) {
    var CHUNK_SIZE, chunkArray, chunks, assetFileNames;
    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            chunkArray = function chunkArray(input, chunkSize) {
              var index = 0;
              var arrayLength = input.length;
              var tempArray = [];

              for (index = 0; index < arrayLength; index += chunkSize) {
                tempArray.push(input.slice(index, index + chunkSize));
              }

              return tempArray;
            };

            CHUNK_SIZE = 10;
            chunks = chunkArray(assets.filter(function (asset) {
              return asset.name.match(/(system-part|bootloader)/);
            }), CHUNK_SIZE);
            _context3.next = 5;
            return chunks.reduce(function (promise, chunk) {
              return promise.then(function (results) {
                return _promise2.default.all([].concat((0, _toConsumableArray3.default)(results || []), (0, _toConsumableArray3.default)(chunk.map(function (asset) {
                  return downloadAssetFile(asset);
                }))));
              });
            }, _promise2.default.resolve());

          case 5:
            assetFileNames = _context3.sent;
            return _context3.abrupt('return', assetFileNames.filter(function (item) {
              return !!item;
            }));

          case 7:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, undefined);
  }));

  return function downloadFirmwareBinaries(_x3) {
    return _ref3.apply(this, arguments);
  };
}();

var updateSettings = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(binaryFileNames) {
    var parser, moduleInfos, scriptSettings;
    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            parser = new _binaryVersionReader.HalModuleParser();
            _context4.next = 3;
            return _promise2.default.all(binaryFileNames.map(function (filename) {
              return new _promise2.default(function (resolve) {
                return parser.parseFile(_settings2.default.BINARIES_DIRECTORY + '/' + filename, function (result) {
                  // For some reason all the new modules are dependent on
                  // version 204 but these modules don't actually exist
                  // Use 207 as it's close enough (v0.7.0)
                  // https://github.com/Brewskey/spark-protocol/issues/145
                  if (result.prefixInfo.depModuleVersion === 204) {
                    // eslint-disable-next-line no-param-reassign
                    result.prefixInfo.depModuleVersion = 207;
                  }

                  resolve((0, _extends3.default)({}, result, {
                    fileBuffer: undefined,
                    filename: filename
                  }));
                });
              });
            }));

          case 3:
            moduleInfos = _context4.sent;
            scriptSettings = (0, _stringify2.default)(moduleInfos, null, 2);


            _fs2.default.writeFileSync(SETTINGS_FILE, scriptSettings);
            console.log('Updated settings');

          case 7:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, undefined);
  }));

  return function updateSettings(_x4) {
    return _ref4.apply(this, arguments);
  };
}();

var downloadAppBinaries = function () {
  var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5() {
    var assets;
    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            _context5.next = 2;
            return githubAPI.repos.getContent({
              owner: GITHUB_USER,
              path: 'assets/binaries',
              repo: GITHUB_CLI_REPOSITORY
            });

          case 2:
            assets = _context5.sent;
            _context5.next = 5;
            return _promise2.default.all(assets.data.map(function (asset) {
              return downloadBlob(asset);
            }));

          case 5:
            return _context5.abrupt('return', _context5.sent);

          case 6:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, undefined);
  }));

  return function downloadAppBinaries() {
    return _ref5.apply(this, arguments);
  };
}();

(0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee7() {
  return _regenerator2.default.wrap(function _callee7$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;

          if (!_fs2.default.existsSync(_settings2.default.BINARIES_DIRECTORY)) {
            _mkdirp2.default.sync(_settings2.default.BINARIES_DIRECTORY);
          }
          if (!_fs2.default.existsSync(FILE_GEN_DIRECTORY)) {
            _mkdirp2.default.sync(FILE_GEN_DIRECTORY);
          }

          _context7.prev = 3;
          _context7.next = 6;
          return downloadAppBinaries();

        case 6:
          _context7.next = 11;
          break;

        case 8:
          _context7.prev = 8;
          _context7.t0 = _context7['catch'](3);

          console.error(_context7.t0);

        case 11:

          // Download firmware binaries
          githubAPI.paginate(githubAPI.repos.listReleases, {
            owner: GITHUB_USER,
            per_page: 100,
            repo: GITHUB_FIRMWARE_REPOSITORY
          }).then(function () {
            var _ref7 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee6(releases) {
              var _ref8;

              var assets, downloadedBinaries;
              return _regenerator2.default.wrap(function _callee6$(_context6) {
                while (1) {
                  switch (_context6.prev = _context6.next) {
                    case 0:
                      releases.sort(function (a, b) {
                        if (a.tag_name < b.tag_name) {
                          return 1;
                        }
                        if (a.tag_name > b.tag_name) {
                          return -1;
                        }
                        return 0;
                      });

                      assets = (_ref8 = []).concat.apply(_ref8, (0, _toConsumableArray3.default)(releases.map(function (release) {
                        return release.assets;
                      })));
                      _context6.next = 4;
                      return downloadFirmwareBinaries(assets);

                    case 4:
                      downloadedBinaries = _context6.sent;
                      _context6.next = 7;
                      return updateSettings(downloadedBinaries);

                    case 7:

                      console.log('\r\nCompleted Sync');

                    case 8:
                    case 'end':
                      return _context6.stop();
                  }
                }
              }, _callee6, undefined);
            }));

            return function (_x5) {
              return _ref7.apply(this, arguments);
            };
          }());
          _context7.next = 17;
          break;

        case 14:
          _context7.prev = 14;
          _context7.t1 = _context7['catch'](0);

          console.log(_context7.t1);

        case 17:
        case 'end':
          return _context7.stop();
      }
    }
  }, _callee7, undefined, [[0, 14], [3, 8]]);
}))();