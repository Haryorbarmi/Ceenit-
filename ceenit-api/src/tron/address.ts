import { createHash } from 'node:crypto';

// TRON addresses are base58 text with a built-in checksum. A wrong or mistyped address almost always fails this check.
// That matters because a payment to a wrong wallet cannot be recovered.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest();

function base58Decode(s: string): Buffer | null {
  let n = 0n;
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const body = Buffer.from(hex, 'hex');
  const zeros = s.length - s.replace(/^1+/, '').length;
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

function base58Encode(buf: Buffer): string {
  let n = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  const zeros = buf.findIndex((b) => b !== 0);
  return '1'.repeat(zeros === -1 ? buf.length : zeros) + out;
}

/** True only for a real TRON address: starts with T, 34 characters, correct checksum. */
export function isValidTronAddress(address: string): boolean {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const raw = base58Decode(address);
  if (!raw || raw.length !== 25 || raw[0] !== 0x41) return false;
  const payload = raw.subarray(0, 21);
  const checksum = raw.subarray(21);
  return sha256(sha256(payload)).subarray(0, 4).equals(checksum);
}

/** The 20-byte account part of an address as lowercase hex (no 41 prefix). This is how addresses appear inside on-chain logs. */
export function addressToHex20(address: string): string {
  const raw = base58Decode(address);
  if (!raw || raw.length !== 25) throw new Error('invalid_address');
  return raw.subarray(1, 21).toString('hex');
}

export function hex20ToAddress(hex20: string): string {
  const payload = Buffer.concat([Buffer.from([0x41]), Buffer.from(hex20, 'hex')]);
  const checksum = sha256(sha256(payload)).subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}
