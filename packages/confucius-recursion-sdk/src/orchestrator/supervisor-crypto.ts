/**
 * Supervisor Cryptographic Primitives
 * 
 * Provides HMAC signing, verification, and deterministic hashing
 * for non-spoofable recursion proof traces.
 */

import crypto from 'crypto';

/**
 * Load supervisor secret from environment or generate dev fallback
 * 
 * Production: Set CONFUCIUS_SUPERVISOR_SECRET env var
 * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function loadSupervisorSecret(): Buffer {
  const fromEnv = process.env.CONFUCIUS_SUPERVISOR_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    return Buffer.from(fromEnv, 'base64');
  }

  // Dev fallback. Do not use in production.
  console.warn('⚠️  Using ephemeral supervisor secret. Set CONFUCIUS_SUPERVISOR_SECRET in production.');
  return crypto.randomBytes(32);
}

/**
 * Deterministic JSON stringify for stable hashes and signatures
 * Sorts object keys recursively, detects cycles
 */
export function stableStringify(obj: any): string {
  const seen = new WeakSet();
  const sorter = (value: any): any => {
    if (value && typeof value === 'object') {
      if (seen.has(value)) throw new Error('Cyclic object in stableStringify');
      seen.add(value);

      if (Array.isArray(value)) return value.map(sorter);

      const keys = Object.keys(value).sort();
      const out: Record<string, any> = {};
      for (const k of keys) out[k] = sorter(value[k]);
      return out;
    }
    return value;
  };
  return JSON.stringify(sorter(obj));
}

/**
 * SHA-256 hash as hex string
 */
export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * HMAC-SHA256 as hex string
 */
export function hmacHex(secret: Buffer, input: string): string {
  return crypto.createHmac('sha256', secret).update(input).digest('hex');
}

/**
 * Sign event payload with HMAC
 * 
 * CRITICAL: Do not include supervisorSig in the payload being signed
 */
export function signEvent(secret: Buffer, eventPayload: any): string {
  const canon = stableStringify(eventPayload);
  return hmacHex(secret, canon);
}

/**
 * Verify event signature using timing-safe comparison
 */
export function verifyEventSig(secret: Buffer, eventPayload: any, supervisorSig: string): boolean {
  const expected = signEvent(secret, eventPayload);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(supervisorSig, 'hex')
  );
}
