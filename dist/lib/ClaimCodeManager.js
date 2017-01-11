'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var CLAIM_CODE_LENGTH = 63;

var CLAIM_CODE_LIVE_TIME = 5000 * 60; // 5 min

var ClaimCodeManager = function ClaimCodeManager() {
  var _this = this;

  (0, _classCallCheck3.default)(this, ClaimCodeManager);
  this._claimCodes = [];

  this.addClaimCode = function (userID) {
    var claimCode = _crypto2.default.randomBytes(CLAIM_CODE_LENGTH).toString('base64').substring(0, CLAIM_CODE_LENGTH);

    _this._claimCodes.push({
      claimCode: claimCode, userID: userID
    });

    setTimeout(function () {
      _this.removeClaimCode(claimCode);
    }, CLAIM_CODE_LIVE_TIME);

    return claimCode;
  };

  this.removeClaimCode = function (claimCode) {
    _this._claimCodes = _this._claimCodes.filter(function (claimCodeObject) {
      return claimCodeObject.claimCode !== claimCode;
    });
  };

  this.getUserIDByClaimCode = function (claimCode) {
    return _this._claimCodes.find(function (claimCodeObject) {
      return claimCodeObject.claimCode === claimCode;
    }).userID;
  };
};

exports.default = ClaimCodeManager;