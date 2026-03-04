import { secp256k1 } from '@noble/curves/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { encode as msgpackEncode } from '@msgpack/msgpack';
import { EXCHANGE_DOMAIN, USER_SIGNED_DOMAIN, NETWORK_SOURCE } from '../constants.mjs';
import { SkillError, ErrorCode } from '../errors.mjs';

// --- EIP-712 type hashing ---

function encodeType(typeName, fields) {
  return `${typeName}(${fields.map(f => `${f.type} ${f.name}`).join(',')})`;
}

function typeHash(typeName, fields) {
  return keccak_256(new TextEncoder().encode(encodeType(typeName, fields)));
}

// Agent type for phantom agent signing
const AGENT_TYPES = [
  { name: 'source', type: 'string' },
  { name: 'connectionId', type: 'bytes32' },
];

// HyperliquidTransaction:ApproveBuilderFee type
const APPROVE_BUILDER_FEE_TYPES = [
  { name: 'hyperliquidChain', type: 'string' },
  { name: 'maxFeeRate', type: 'string' },
  { name: 'builder', type: 'address' },
  { name: 'nonce', type: 'uint64' },
];

const AGENT_TYPE_HASH = typeHash('Agent', AGENT_TYPES);
const APPROVE_BUILDER_FEE_TYPE_HASH = typeHash('HyperliquidTransaction:ApproveBuilderFee', APPROVE_BUILDER_FEE_TYPES);

// --- EIP-712 domain separator ---

function domainSeparator(domain) {
  const DOMAIN_TYPE = 'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)';
  const domainTypeHash = keccak_256(new TextEncoder().encode(DOMAIN_TYPE));

  const parts = [
    domainTypeHash,
    keccak_256(new TextEncoder().encode(domain.name)),
    keccak_256(new TextEncoder().encode(domain.version)),
    padUint256(domain.chainId),
    padAddress(domain.verifyingContract),
  ];

  return keccak_256(concatBytes(...parts));
}

// --- Encoding helpers ---

function padUint256(n) {
  const hex = BigInt(n).toString(16).padStart(64, '0');
  return hexToBytes(hex);
}

function padAddress(addr) {
  const clean = addr.startsWith('0x') ? addr.slice(2) : addr;
  return hexToBytes(clean.padStart(64, '0'));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// --- Action hashing (L1 actions: order, cancel, leverage, etc.) ---

/**
 * Hash an L1 action for phantom agent signing.
 * 1. msgpack encode the action
 * 2. Append nonce (8-byte big-endian uint64)
 * 3. Append vaultAddress flag (0x00 if no vault, 0x01 + address if vault)
 * 4. keccak256 → connectionId
 */
export function hashAction(action, nonce, vaultAddress) {
  const encoded = msgpackEncode(action);
  const nonceBytes = new Uint8Array(8);
  const view = new DataView(nonceBytes.buffer);
  // Write as big-endian uint64
  const big = BigInt(nonce);
  view.setUint32(0, Number(big >> 32n));
  view.setUint32(4, Number(big & 0xffffffffn));

  let payload;
  if (vaultAddress) {
    const vaultBytes = hexToBytes(vaultAddress.startsWith('0x') ? vaultAddress.slice(2) : vaultAddress);
    payload = concatBytes(encoded, nonceBytes, new Uint8Array([0x01]), vaultBytes);
  } else {
    payload = concatBytes(encoded, nonceBytes, new Uint8Array([0x00]));
  }

  return keccak_256(payload);
}

/**
 * Sign an L1 action using phantom agent flow:
 * 1. Hash action → connectionId
 * 2. Build phantom Agent struct { source, connectionId }
 * 3. EIP-712 sign with Exchange domain
 */
export function signL1Action(privateKeyHex, action, nonce, vaultAddress, isTestnet = false) {
  const connectionId = hashAction(action, nonce, vaultAddress);
  const source = isTestnet ? NETWORK_SOURCE.testnet : NETWORK_SOURCE.mainnet;

  // Encode Agent struct hash
  const sourceHash = keccak_256(new TextEncoder().encode(source));
  const structHash = keccak_256(concatBytes(
    AGENT_TYPE_HASH,
    sourceHash,
    connectionId, // already 32 bytes
  ));

  const domainSep = domainSeparator(EXCHANGE_DOMAIN);
  const digest = keccak_256(concatBytes(
    new Uint8Array([0x19, 0x01]),
    domainSep,
    structHash,
  ));

  return signDigest(privateKeyHex, digest);
}

/**
 * Sign a user-signed action (e.g., approveBuilderFee).
 * Uses HyperliquidSignTransaction domain, no phantom agent.
 */
export function signUserAction(privateKeyHex, actionTypeHash, encodedData) {
  const structHash = keccak_256(concatBytes(actionTypeHash, encodedData));
  const domainSep = domainSeparator(USER_SIGNED_DOMAIN);
  const digest = keccak_256(concatBytes(
    new Uint8Array([0x19, 0x01]),
    domainSep,
    structHash,
  ));

  return signDigest(privateKeyHex, digest);
}

/**
 * Sign approveBuilderFee specifically.
 */
export function signApproveBuilderFee(privateKeyHex, chain, maxFeeRate, builder, nonce) {
  const chainHash = keccak_256(new TextEncoder().encode(chain));
  const feeRateHash = keccak_256(new TextEncoder().encode(maxFeeRate));
  const encodedData = concatBytes(
    chainHash,
    feeRateHash,
    padAddress(builder),
    padUint256(nonce),
  );
  return signUserAction(privateKeyHex, APPROVE_BUILDER_FEE_TYPE_HASH, encodedData);
}

// --- Low-level signing ---

function signDigest(privateKeyHex, digest) {
  try {
    const key = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
    const sig = secp256k1.sign(digest, key);

    const r = sig.r.toString(16).padStart(64, '0');
    const s = sig.s.toString(16).padStart(64, '0');
    const v = sig.recovery + 27;

    return { r: '0x' + r, s: '0x' + s, v };
  } catch (err) {
    throw new SkillError(ErrorCode.SIGNATURE_ERROR, `Signing failed: ${err.message}`);
  }
}

/**
 * Derive Ethereum address from private key.
 */
export function privateKeyToAddress(privateKeyHex) {
  const key = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const pubKey = secp256k1.getPublicKey(key, false).slice(1);
  const hash = keccak_256(pubKey);
  return '0x' + bytesToHex(hash.slice(-20));
}
