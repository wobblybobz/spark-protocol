// @flow

import crypto from 'crypto';

type ClaimCodeObject = {
  claimCode: string,
  userID: string,
}

const CLAIM_CODE_LENGTH = 63;
const CLAIM_CODE_LIVE_TIME = 5000 * 60; // 5 min

class ClaimCodeManager {
  _claimCodes: Array<ClaimCodeObject> = [];

  addClaimCode = (userID: string): string => {
    const claimCode = crypto
      .randomBytes(CLAIM_CODE_LENGTH)
      .toString('base64')
      .substring(0, CLAIM_CODE_LENGTH);

    this._claimCodes.push({
      claimCode, userID,
    });

    setTimeout(() => {
      this.removeClaimCode(claimCode);
    }, CLAIM_CODE_LIVE_TIME);

    return claimCode;
  };

  removeClaimCode = (claimCode: string) => {
    this._claimCodes = this._claimCodes.filter(
      (claimCodeObject: ClaimCodeObject) =>
      claimCodeObject.claimCode !== claimCode,
    );
  };

  getUserIDByClaimCode = (claimCode: string): ?string =>
    this._claimCodes.find(
      (claimCodeObject: ClaimCodeObject) =>
      claimCodeObject.claimCode === claimCode,
    ).userID
}

export default ClaimCodeManager;
