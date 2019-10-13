'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _toConsumableArray2 = require('babel-runtime/helpers/toConsumableArray');

var _toConsumableArray3 = _interopRequireDefault(_toConsumableArray2);

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

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var logger = _logger2.default.createModuleLogger(module);

var FirmwareManager = (_temp = _class = function FirmwareManager() {
  (0, _classCallCheck3.default)(this, FirmwareManager);

  this.getKnownAppFileName = function () {
    throw new Error('getKnownAppFileName has not been implemented.');
  };
}, _class.isMissingOTAUpdate = function (systemInformation) {
  return !!FirmwareManager._getMissingModule(systemInformation);
}, _class.getOtaSystemUpdateConfig = function (systemInformation) {
  var firstDependency = FirmwareManager._getMissingModule(systemInformation);
  if (!firstDependency) {
    return null;
  }

  var dependencyPath = _settings2.default.BINARIES_DIRECTORY + '/' + firstDependency.filename;

  if (!_fs2.default.existsSync(dependencyPath)) {
    logger.error({
      dependencyPath: dependencyPath,
      firstDependency: firstDependency
    }, 'Dependency does not exist on disk');
  }

  var systemFile = _fs2.default.readFileSync(dependencyPath);

  return {
    moduleFunction: firstDependency.moduleFunction,
    moduleIndex: firstDependency.moduleIndex,
    systemFile: systemFile
  };
}, _class.getAppModule = function (systemInformation) {
  var parser = new _binaryVersionReader.HalDescribeParser();
  return (0, _nullthrows2.default)(parser.getModules(systemInformation)
  // Filter so we only have the app modules
  .find(function (module) {
    return module.func === 'u';
  }));
}, _class._getMissingModule = function (systemInformation) {
  var platformID = systemInformation.p;

  var modules = systemInformation.m;

  var dr = new _binaryVersionReader.HalDependencyResolver();

  var knownMissingDependencies = dr.findAnyMissingDependencies(systemInformation);

  // This grabs all the dependencies from modules that have them defined.
  // This filters out any dependencies that have already been installed
  // or that are older than the currently installed modules.
  // const knownMissingDependencies = modules
  //   .reduce((deps: Array<any>, module: any): Array<any> => [
  //     ...deps,
  //     ...module.d,
  //   ])
  //   .filter((dep: any): boolean => {
  //     const oldModuleExistsForSlot = modules.some(
  //       (m: any): boolean => m.f === dep.f && m.n === dep.n && m.v < dep.v,
  //     );
  //     // If the new dependency doesn't have an existing module installed.
  //     // If the firmware goes from 2 parts to 3 parts
  //     const moduleNotInstalled = !modules.some(
  //       (m: any): boolean => m.f === dep.f && m.n === dep.n,
  //     );

  //     return oldModuleExistsForSlot || moduleNotInstalled;
  //   }, []);

  if (!knownMissingDependencies.length) {
    return null;
  }

  var numberByFunction = {
    b: 2,
    s: 4,
    u: 5
  };

  // Map dependencies to firmware metadata
  var knownFirmwares = [knownMissingDependencies[0]].map(function (dep) {
    var setting = _settings4.default.find(function (_ref) {
      var prefixInfo = _ref.prefixInfo;
      return prefixInfo.platformID === platformID && prefixInfo.moduleVersion === dep.v && prefixInfo.moduleFunction === numberByFunction[dep.f] && prefixInfo.moduleIndex === parseInt(dep.n, 10);
    });

    if (!setting) {
      logger.error({ dep: dep, platformID: platformID }, 'Missing firmware setting');
    }

    return setting;
  }).filter(Boolean);

  logger.error({
    // knownFirmwares,
    knownMissingDependencies: knownMissingDependencies
    // safeModules,
    // systemInformation,
  }, 'foo');

  if (!knownFirmwares.length) {
    return null;
  }

  // Walk firmware metadata to get all required firmware for the current
  // version.
  var allFirmware = [].concat((0, _toConsumableArray3.default)(knownFirmwares));

  var _loop = function _loop() {
    var current = knownFirmwares.pop();
    var _current$prefixInfo = current.prefixInfo,
        depModuleVersion = _current$prefixInfo.depModuleVersion,
        depModuleFunction = _current$prefixInfo.depModuleFunction,
        depModuleIndex = _current$prefixInfo.depModuleIndex;

    var foundFirmware = _settings4.default.find(function (_ref2) {
      var prefixInfo = _ref2.prefixInfo;
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
  var result = allFirmware.filter(function (firmware) {
    var _firmware$prefixInfo = firmware.prefixInfo,
        moduleVersion = _firmware$prefixInfo.moduleVersion,
        moduleFunction = _firmware$prefixInfo.moduleFunction,
        moduleIndex = _firmware$prefixInfo.moduleIndex;

    var existingModule = modules.find(function (module) {
      return numberByFunction[module.f] === moduleFunction && parseInt(module.n, 10) === moduleIndex;
    });
    return existingModule == null || existingModule.v < moduleVersion;
  }).pop();
  return result;
}, _temp);
exports.default = FirmwareManager;