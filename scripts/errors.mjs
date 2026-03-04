export const ErrorCode = {
  INPUT_ERROR: 'INPUT_ERROR',
  UNKNOWN_COMMAND: 'UNKNOWN_COMMAND',
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  PRIVATE_KEY_MISSING: 'PRIVATE_KEY_MISSING',
  ASSET_NOT_FOUND: 'ASSET_NOT_FOUND',
  MARKET_NOT_SUPPORTED: 'MARKET_NOT_SUPPORTED',
  NONCE_ERROR: 'NONCE_ERROR',
  SIGNATURE_ERROR: 'SIGNATURE_ERROR',
  API_RATE_LIMIT: 'API_RATE_LIMIT',
  API_REJECTED: 'API_REJECTED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  ENCRYPTION_ERROR: 'ENCRYPTION_ERROR',
};

export class SkillError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'SkillError';
    this.code = code;
    this.details = details;
  }
}

export function inputError(msg, details) {
  return new SkillError(ErrorCode.INPUT_ERROR, msg, details);
}

export function unknownCommand(msg) {
  return new SkillError(ErrorCode.UNKNOWN_COMMAND, msg);
}

export function accountNotFound(alias) {
  return new SkillError(ErrorCode.ACCOUNT_NOT_FOUND, `Account not found: ${alias}`);
}

export function privateKeyMissing(alias) {
  return new SkillError(ErrorCode.PRIVATE_KEY_MISSING, `No private key for account: ${alias}`);
}

export function assetNotFound(coin, hint) {
  const suffix = hint ? ` ${hint}` : '';
  return new SkillError(ErrorCode.ASSET_NOT_FOUND, `Asset not found: ${coin}.${suffix}`.trim());
}

export function nonceError(msg) {
  return new SkillError(ErrorCode.NONCE_ERROR, msg);
}

export function apiRejected(msg, details) {
  return new SkillError(ErrorCode.API_REJECTED, msg, details);
}

export function networkError(msg, details) {
  return new SkillError(ErrorCode.NETWORK_ERROR, msg, details);
}
