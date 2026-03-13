// ========== S2.6: Shamir's Secret Sharing (2-of-3) ==========

/**
 * Lightweight GF(256) Shamir's Secret Sharing implementation.
 * Uses field arithmetic in GF(2^8) with the AES irreducible polynomial x^8 + x^4 + x^3 + x + 1.
 *
 * This implementation operates byte-by-byte: each byte of the secret is independently
 * split into shares using a random degree-1 polynomial in GF(256).
 */

// GF(256) with AES polynomial: x^8 + x^4 + x^3 + x + 1 = 0x11B
const GF_POLY = 0x11b;

/** Multiply two elements in GF(256). */
function gfMul(a: number, b: number): number {
  let result = 0;
  let _a = a;
  let _b = b;
  while (_b > 0) {
    if (_b & 1) result ^= _a;
    _a <<= 1;
    if (_a & 0x100) _a ^= GF_POLY;
    _b >>= 1;
  }
  return result;
}

/** Compute multiplicative inverse in GF(256) using brute force (field is small). */
function gfInv(a: number): number {
  if (a === 0) throw new Error("Cannot invert zero in GF(256)");
  // a^254 = a^(-1) in GF(256) since |GF(256)*| = 255
  let result = 1;
  let base = a;
  let exp = 254;
  while (exp > 0) {
    if (exp & 1) result = gfMul(result, base);
    base = gfMul(base, base);
    exp >>= 1;
  }
  return result;
}

export interface ShamirShare {
  /** Share index (1-based, used as x-coordinate) */
  index: number;
  /** Share data (same length as original secret) */
  data: Uint8Array;
}

/**
 * Split a secret into `n` shares, requiring `threshold` shares to recover.
 *
 * @param secret - The secret bytes to split
 * @param n - Total number of shares (default 3)
 * @param threshold - Minimum shares needed to recover (default 2)
 * @returns Array of `n` shares
 */
export function splitSecret(
  secret: Uint8Array,
  n: number = 3,
  threshold: number = 2,
): ShamirShare[] {
  if (threshold > n) throw new Error("Threshold cannot exceed total shares");
  if (threshold < 2) throw new Error("Threshold must be at least 2");
  if (n > 255) throw new Error("Maximum 255 shares supported");
  if (secret.length === 0) throw new Error("Secret cannot be empty");

  const shares: ShamirShare[] = [];
  for (let i = 0; i < n; i++) {
    shares.push({ index: i + 1, data: new Uint8Array(secret.length) });
  }

  // For each byte of the secret, create a random polynomial of degree (threshold-1)
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // coefficients[0] = secret byte, coefficients[1..threshold-1] = random
    const coefficients = new Uint8Array(threshold);
    coefficients[0] = secret[byteIdx]!;
    crypto.getRandomValues(coefficients.subarray(1));

    // Evaluate polynomial at x = 1, 2, ..., n
    for (let shareIdx = 0; shareIdx < n; shareIdx++) {
      const x = shareIdx + 1;
      let y = 0;
      for (let k = threshold - 1; k >= 0; k--) {
        y = gfMul(y, x) ^ coefficients[k]!;
      }
      shares[shareIdx]!.data[byteIdx] = y;
    }
  }

  return shares;
}

/**
 * Recover the original secret from `threshold` or more shares.
 * Uses Lagrange interpolation in GF(256) to reconstruct the secret.
 *
 * @param shares - Array of shares (at least `threshold` shares needed)
 * @returns The recovered secret bytes
 */
export function recoverSecret(shares: ShamirShare[]): Uint8Array {
  if (shares.length < 2) throw new Error("Need at least 2 shares to recover");

  const secretLen = shares[0]!.data.length;
  for (const share of shares) {
    if (share.data.length !== secretLen) {
      throw new Error("All shares must have the same length");
    }
  }

  const secret = new Uint8Array(secretLen);

  // Lagrange interpolation at x=0
  for (let byteIdx = 0; byteIdx < secretLen; byteIdx++) {
    let result = 0;

    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i]!.index;
      const yi = shares[i]!.data[byteIdx]!;

      // Compute Lagrange basis polynomial L_i(0)
      let numerator = 1;
      let denominator = 1;
      for (let j = 0; j < shares.length; j++) {
        if (i === j) continue;
        const xj = shares[j]!.index;
        // L_i(0) = product of (0 - xj) / (xi - xj) = product of xj / (xi ^ xj)
        numerator = gfMul(numerator, xj);
        denominator = gfMul(denominator, xi ^ xj);
      }

      const lagrange = gfMul(numerator, gfInv(denominator));
      result ^= gfMul(yi, lagrange);
    }

    secret[byteIdx] = result;
  }

  return secret;
}
