'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _map = require('babel-runtime/core-js/map');

var _map2 = _interopRequireDefault(_map);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var CLAIM_CODE_LENGTH = 63;

var CLAIM_CODE_TTL = 5000 * 60; // 5 min

var ClaimCodeManager = function ClaimCodeManager() {
  var _this = this;

  (0, _classCallCheck3.default)(this, ClaimCodeManager);
  this._userIDByClaimCode = new _map2.default();

  this._generateClaimCode = function () {
    return _crypto2.default.randomBytes(CLAIM_CODE_LENGTH).toString('base64').substring(0, CLAIM_CODE_LENGTH);
  };

  this.createClaimCode = function (userID) {
    var claimCode = _this._generateClaimCode();

    while (_this._userIDByClaimCode.has(claimCode)) {
      claimCode = _this._generateClaimCode();
    }

    _this._userIDByClaimCode.set(claimCode, userID);

    setTimeout(function () {
      return _this.removeClaimCode(claimCode);
    }, CLAIM_CODE_TTL);

    return claimCode;
  };

  this.removeClaimCode = function (claimCode) {
    return _this._userIDByClaimCode.delete(claimCode);
  };

  this.getUserIDByClaimCode = function (claimCode) {
    return _this._userIDByClaimCode.get(claimCode);
  };
};

exports.default = ClaimCodeManager;