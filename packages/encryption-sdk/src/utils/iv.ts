// ========== IV Generation Utility ==========

/** AES-GCM nonce size: 12 bytes (96 bits) */
export const IV_LENGTH = 12;

/**
 * Generate a cryptographically random IV for AES-GCM.
 * Uses crypto.getRandomValues() — safe for browser and Node.js (>=20).
 */
export function generateIV(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}
