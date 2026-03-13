// ========== S2.5: Integrity Verification ==========

/**
 * Compute SHA-256 hash of data, returned as hex-encoded string.
 * Uses Web Crypto API — works in browser and Node.js >=20.
 */
export async function computeHash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return bufferToHex(new Uint8Array(hashBuffer));
}

/**
 * Verify that data matches an expected SHA-256 hex hash.
 * Returns true if hashes match, false otherwise.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyHash(
  data: ArrayBuffer,
  expectedHash: string,
): Promise<boolean> {
  const actualHash = await computeHash(data);
  return constantTimeEqual(actualHash, expectedHash);
}

/** Convert Uint8Array to lowercase hex string. */
function bufferToHex(buffer: Uint8Array): string {
  const hexChars: string[] = [];
  for (let i = 0; i < buffer.length; i++) {
    hexChars.push(buffer[i]!.toString(16).padStart(2, "0"));
  }
  return hexChars.join("");
}

/** Constant-time string comparison to prevent timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
