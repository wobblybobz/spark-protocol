'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _class, _temp;

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _binaryVersionReader = require('binary-version-reader');

var _nullthrows = require('nullthrows');

var _nullthrows2 = _interopRequireDefault(_nullthrows);

var _settings = require('../settings');

var _settings2 = _interopRequireDefault(_settings);

var _settings3 = require('../../third-party/settings.json');

var _settings4 = _interopRequireDefault(_settings3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var FirmwareManager = (_temp = _class = function FirmwareManager() {
  (0, _classCallCheck3.default)(this, FirmwareManager);

  this.getKnownAppFileName = function () {
    throw new Error('getKnownAppFileName has not been implemented.');
  };
}, _class.getOtaSystemUpdateConfig = function () {
  var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(systemInformation) {
    var platformID, modules, knownMissingDependencies, numberByFunction, knownFirmwares, allFirmware, _loop, firstDependency, systemFile;

    return _regenerator2.default.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            platformID = systemInformation.p;
            modules = systemInformation.m;

            // This grabs all the dependencies from modules that have them defined.
            // This filters out any dependencies that have already been installed
            // or that are older than the currently installed modules.

            knownMissingDependencies = modules.reduce(function (deps, module) {
              return [].concat((0, _toConsumableArray3.default)(deps), (0, _toConsumableArray3.default)(module.d));
            }).filter(function (dep) {
              var oldModuleExistsForSlot = modules.some(function (m) {
                return m.f === dep.f && m.n === dep.n && m.v < dep.v;
              });
              // If the new dependency doesn't have an existing module installed.
              // If the firmware goes from 2 parts to 3 parts
              var moduleNotInstalled = !modules.some(function (m) {
                return m.f === dep.f && m.n === dep.n;
              });

              return oldModuleExistsForSlot || moduleNotInstalled;
            }, []);

            if (knownMissingDependencies.length) {
              _context.next = 5;
              break;
            }

            return _context.abrupt('return', null);

          case 5:
            numberByFunction = {
              b: 2,
              s: 4,
              u: 5
            };

            // Map dependencies to firmware metadata

            knownFirmwares = knownMissingDependencies.map(function (dep) {
              return _settings4.default.find(function (_ref2) {
                var prefixInfo = _ref2.prefixInfo;
                return prefixInfo.platformID === platformID && prefixInfo.moduleVersion === dep.v && prefixInfo.moduleFunction === numberByFunction[dep.f] && prefixInfo.moduleIndex === parseInt(dep.n, 10);
              });
            });

            if (knownFirmwares.length) {
              _context.next = 9;
              break;
            }

            return _context.abrupt('return', null);

          case 9:

            // Walk firmware metadata to get all required firmware for the current
            // version.
            allFirmware = [].concat((0, _toConsumableArray3.default)(knownFirmwares));

            _loop = function _loop() {
              var current = knownFirmwares.pop();
              var _current$prefixInfo = current.prefixInfo,
                  depModuleVersion = _current$prefixInfo.depModuleVersion,
                  depModuleFunction = _current$prefixInfo.depModuleFunction,
                  depModuleIndex = _current$prefixInfo.depModuleIndex;

              var foundFirmware = _settings4.default.find(function (_ref3) {
                var prefixInfo = _ref3.prefixInfo;
                return prefixInfo.platformID === platformID && prefixInfo.moduleVersion === depModuleVersion && prefixInfo.moduleFunction === depModuleFunction && prefixInfo.moduleIndex === depModuleIndex;
              });

              if (foundFirmware) {
                knownFirmwares.push(foundFirmware);
                allFirmware.push(foundFirmware);
              }
            };

            while (knownFirmwares.length) {
              _loop();
            }

            // Find the first dependency that isn't already installed
            firstDependency = allFirmware.filter(function (firmware) {
              var _firmware$prefixInfo = firmware.prefixInfo,
                  moduleVersion = _firmware$prefixInfo.moduleVersion,
                  moduleFunction = _firmware$prefixInfo.moduleFunction,
                  moduleIndex = _firmware$prefixInfo.moduleIndex;

              return !modules.some(function (module) {
                return module.v === moduleVersion && numberByFunction[module.f] === moduleFunction && parseInt(module.n, 10) === moduleIndex;
              });
            }).pop();

            if (firstDependency) {
              _context.next = 15;
              break;
            }

            return _context.abrupt('return', null);

          case 15:
            systemFile = _fs2.default.readFileSync(_settings2.default.BINARIES_DIRECTORY + '/' + firstDependency.filename);
            return _context.abrupt('return', {
              moduleFunction: firstDependency.moduleFunction,
              moduleIndex: firstDependency.moduleIndex,
              systemFile: systemFile
            });

          case 17:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined);
  }));

  return function (_x) {
    return _ref.apply(this, arguments);
  };
}(), _class.getAppModule = function (systemInformation) {
  var parser = new _binaryVersionReader.HalDescribeParser();
  return (0, _nullthrows2.default)(parser.getModules(systemInformation)
  // Filter so we only have the app modules
  .find(function (module) {
    return module.func === 'u';
  }));
}, _temp);
exports.default = FirmwareManager;