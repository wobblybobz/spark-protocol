// @flow

import crypto from 'crypto';

const CLAIM_CODE_LENGTH = 63;
const CLAIM_CODE_TTL = 5000 * 60; // 5 min

class ClaimCodeManager {
  _userIDByClaimCode: Map<string, string> = new Map();

  _generateClaimCode = (): string =>
    crypto
      .randomBytes(CLAIM_CODE_LENGTH)
      .toString('base64')
      .substring(0, CLAIM_CODE_LENGTH);

  createClaimCode = (userID: string): string => {
    let claimCode = this._generateClaimCode();

    while (this._userIDByClaimCode.has(claimCode)) {
      claimCode = this._generateClaimCode();
    }

    this._userIDByClaimCode.set(claimCode, userID);

    setTimeout((): boolean => this.removeClaimCode(claimCode), CLAIM_CODE_TTL);

    return claimCode;
  };

  removeClaimCode = (claimCode: string): boolean =>
    this._userIDByClaimCode.delete(claimCode);

  getUserIDByClaimCode = (claimCode: string): ?string =>
    this._userIDByClaimCode.get(claimCode);
}

export default ClaimCodeManager;
