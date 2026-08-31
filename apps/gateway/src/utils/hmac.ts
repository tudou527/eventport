/**
 * Shared HMAC helpers used by every source-specific webhook verifier.
 *
 * Why a shared module: every provider (GitHub, Linear, Stripe, ...) computes an
 * HMAC-SHA256 over some payload and compares it to a header value. The only
 * things that differ are (a) what's signed, (b) the encoding of the digest
 * (hex vs base64), and (c) the header name/format. Centralizing the crypto +
 * comparison here removes ~8x duplication and guarantees every verifier uses
 * constant-time comparison and the Web Crypto API (Cloudflare Workers
 * compatible — no node:crypto dependency).
 *
 * Docs for each provider's exact signing scheme live in the per-source files.
 */

/** Encode a UTF-8 string into a fresh Uint8Array. */
function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

/**
 * Compute HMAC-SHA256(key, message) and return the raw digest bytes.
 *
 * Uses SubtleCrypto (async-only in Workers), so callers must `await` this.
 */
export async function computeHmacSha256(key: string, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    utf8(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, utf8(message)));
}

/** Hex-encode an HMAC-SHA256(key, message) digest as a lowercase string. */
export async function hexDigest(key: string, message: string): Promise<string> {
  return bytesToHex(await computeHmacSha256(key, message));
}

/** Base64-encode an HMAC-SHA256(key, message) digest. */
export async function base64Digest(key: string, message: string): Promise<string> {
  return bytesToBase64(await computeHmacSha256(key, message));
}

/** Convert a byte array to a lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Convert a byte array to a base64 string (standard alphabet, with padding). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Compare two equal-length strings in constant time.
 *
 * Walks every character even after the first mismatch so that timing does not
 * leak how much of the signature matched. Callers MUST guard length equality
 * (or accept that differing lengths short-circuit, which only leaks the length
 * — never secret material).
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Parse a `key1=val1,key2=val2,...` header (Stripe / Calendly style) into a
 * Map. Trims whitespace around keys/values. Splits only on the first `=` so
 * values may themselves contain `=`. Items without `=` are skipped.
 */
export function parseSignatureParams(header: string): Map<string, string> {
  const params = new Map<string, string>();
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      params.set(key, value);
    }
  }
  return params;
}

/**
 * Reject if the given timestamp (seconds since epoch) is further than
 * `toleranceSeconds` from now, in either direction. Used for replay
 * protection by providers that sign a timestamp (Stripe, Slack, Calendly).
 *
 * Returns an error `reason` string when stale, or `null` when fresh.
 */
export function checkTimestampFreshness(
  timestampSeconds: number,
  toleranceSeconds: number
): string | null {
  if (!Number.isFinite(timestampSeconds)) {
    return 'invalid timestamp';
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return 'timestamp outside tolerance';
  }
  return null;
}
