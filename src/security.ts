import type { Profile } from './economy';

const APP_SALT = 'Tyche::Lounge::SecureVault::2026::IntegritySalt';
const KEY_PASSPHRASE = 'TycheVault@SecureArcadeCipher#2026';

/**
 * Pure-JS synchronous standard SHA-256 implementation
 * Guarantees zero-dependency, fast, synchronous hashing in both browser and Node.js.
 */
function rawSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  const hash = (rawSha256 as unknown as { h: number[] }).h || [];
  const k = (rawSha256 as unknown as { k: number[] }).k || [];
  let primeCounter = k[lengthProperty] || 0;
  const isComposite: Record<number, number> = {};

  if (!hash.length) {
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    (rawSha256 as unknown as { h: number[] }).h = hash;
    (rawSha256 as unknown as { k: number[] }).k = k;
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  const h = hash.slice();
  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = h.slice();
    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const a = h[0],
        e = h[4];
      const temp1 =
        h[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & h[5]) ^ (~e & h[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & h[1]) ^ (a & h[2]) ^ (h[1] & h[2]));
      h[7] = h[6];
      h[6] = h[5];
      h[5] = h[4];
      h[4] = (h[3] + temp1) | 0;
      h[3] = h[2];
      h[2] = h[1];
      h[1] = a;
      h[0] = (temp1 + temp2) | 0;
    }
    for (i = 0; i < 8; i++) h[i] = (h[i] + oldHash[i]) | 0;
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (h[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export function sha256(str: string): string {
  return rawSha256(unescape(encodeURIComponent(str)));
}

/**
 * Computes a salted cryptographic checksum over the core economic fields of a profile.
 */
export function computeProfileChecksum(p: Partial<Profile>): string {
  const claimedList = Array.isArray(p.claimed) ? [...p.claimed].sort().join(',') : '';
  const achList = Array.isArray(p.achievementsClaimed) ? [...p.achievementsClaimed].sort().join(',') : '';
  const payload = [
    p.balance ?? 0,
    p.rounds ?? 0,
    p.wagered ?? 0,
    p.earned ?? 0,
    p.best ?? 0,
    p.savedAt ?? 0,
    p.lastRelief ?? 0,
    p.lastWheelSpin ?? 0,
    p.lastAttendance ?? 0,
    p.dailyRounds ?? 0,
    p.dailyMaxMult ?? 0,
    p.weeklyRounds ?? 0,
    p.weeklyMaxMult ?? 0,
    claimedList,
    achList,
    APP_SALT,
  ].join('::');

  return sha256(payload);
}

/**
 * Verifies whether a profile has a valid, untampered checksum.
 */
export function verifyProfileChecksum(p: Partial<Profile>): boolean {
  if (!p.checksum) return true; // Legacy profile without checksum allowed on initial upgrade
  return p.checksum === computeProfileChecksum(p);
}

// ----------------- Web Crypto AES-256-GCM Backup Encryption -----------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('올바른 16진수 데이터가 아닙니다.');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function getAesGcmKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(KEY_PASSPHRASE));
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export type EncryptedSaveEnvelope = {
  app: 'tyche-lounge';
  version: 2;
  format: 'aes-gcm';
  exportedAt: string;
  iv: string;
  data: string;
  sig: string;
};

/**
 * Encrypts a profile object into an authenticated AES-256-GCM envelope.
 * When exported to a file, user cannot read coins or modify the data in Notepad.
 */
export async function encryptSaveData(profile: Profile): Promise<string> {
  const enc = new TextEncoder();
  const key = await getAesGcmKey();

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const innerPayload = JSON.stringify({
    app: 'tyche-lounge',
    exportedAt: new Date().toISOString(),
    profile,
    checksum: computeProfileChecksum(profile),
  });

  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(innerPayload));
  const dataHex = bytesToHex(new Uint8Array(cipherBuffer));
  const ivHex = bytesToHex(iv);
  const sig = sha256(dataHex + ivHex + APP_SALT);

  const envelope: EncryptedSaveEnvelope = {
    app: 'tyche-lounge',
    version: 2,
    format: 'aes-gcm',
    exportedAt: new Date().toISOString(),
    iv: ivHex,
    data: dataHex,
    sig,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * Decrypts and authenticates a save file.
 * Rejects modified bytes, tampered signatures, or unauthorized alterations.
 * Supports legacy v1 unencrypted JSON files with validation.
 */
export async function decryptSaveData(
  fileText: string,
  validateFn: (raw: unknown, backup: boolean) => Profile
): Promise<Profile> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error('올바른 JSON 백업 파일이 아닙니다.');
  }

  // Case 1: Encrypted v2 envelope
  if (parsed.format === 'aes-gcm' && typeof parsed.data === 'string' && typeof parsed.iv === 'string') {
    const dataHex = parsed.data;
    const ivHex = parsed.iv;
    const sig = typeof parsed.sig === 'string' ? parsed.sig : '';

    // Step 1: Signature check
    const expectedSig = sha256(dataHex + ivHex + APP_SALT);
    if (sig !== expectedSig) {
      throw new Error('변조되었거나 손상된 세이브 파일입니다. (무결성 서명 불일치)');
    }

    // Step 2: AES-GCM Decryption (Auth Tag automatically checked)
    try {
      const key = await getAesGcmKey();
      const iv = hexToBytes(ivHex);
      const cipherBytes = hexToBytes(dataHex);
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
        key,
        cipherBytes.buffer as ArrayBuffer
      );
      const dec = new TextDecoder();
      const innerJson = JSON.parse(dec.decode(decryptedBuffer));

      if (!innerJson.profile) {
        throw new Error('세이브 데이터 구조가 올바르지 않습니다.');
      }

      const profile = validateFn(innerJson.profile, true);

      // Verify internal profile checksum
      if (innerJson.checksum && innerJson.checksum !== computeProfileChecksum(profile)) {
        throw new Error('변조되었거나 손상된 세이브 파일입니다. (내부 체크섬 오류)');
      }

      profile.checksum = computeProfileChecksum(profile);
      return profile;
    } catch (e) {
      if ((e as Error).message.includes('변조')) throw e;
      throw new Error('변조되었거나 손상된 세이브 파일입니다. (암호 해독 실패)');
    }
  }

  // Case 2: Legacy v1 unencrypted backup compatibility
  if (parsed.app === 'tyche-lounge' || parsed.app === 'orbit-arcade') {
    if (!parsed.profile) throw new Error('세이브 데이터가 존재하지 않습니다.');
    const profile = validateFn(parsed.profile, true);
    profile.checksum = computeProfileChecksum(profile);
    return profile;
  }

  throw new Error('티케 라운지 백업 파일을 선택해 주세요.');
}
