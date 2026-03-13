import { describe, it, expect } from "vitest";
import { splitSecret, recoverSecret, exportAESKey, generateFolderKey } from "../src/index.js";

describe("Shamir's Secret Sharing (2-of-3)", () => {
  it("split and recover with shares [1,2]", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 3, 2);
    expect(shares).toHaveLength(3);

    const recovered = recoverSecret([shares[0]!, shares[1]!]);
    expect(recovered).toEqual(secret);
  });

  it("split and recover with shares [1,3]", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 3, 2);

    const recovered = recoverSecret([shares[0]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  it("split and recover with shares [2,3]", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 3, 2);

    const recovered = recoverSecret([shares[1]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  it("recover with all 3 shares", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 3, 2);

    const recovered = recoverSecret(shares);
    expect(recovered).toEqual(secret);
  });

  it("works with actual AES key bytes", async () => {
    const key = await generateFolderKey();
    const raw = await exportAESKey(key);

    const shares = splitSecret(raw, 3, 2);
    const recovered = recoverSecret([shares[0]!, shares[2]!]);
    expect(recovered).toEqual(raw);
  });

  it("shares have same length as secret", () => {
    const secret = new Uint8Array(64);
    crypto.getRandomValues(secret);
    const shares = splitSecret(secret, 3, 2);

    for (const share of shares) {
      expect(share.data.length).toBe(64);
    }
  });

  it("shares have correct 1-based indices", () => {
    const secret = new Uint8Array(16);
    crypto.getRandomValues(secret);
    const shares = splitSecret(secret, 3, 2);

    expect(shares[0]!.index).toBe(1);
    expect(shares[1]!.index).toBe(2);
    expect(shares[2]!.index).toBe(3);
  });

  it("individual shares reveal nothing (differ from secret)", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 3, 2);

    // Each share should differ from the secret (probabilistically guaranteed)
    for (const share of shares) {
      expect(share.data).not.toEqual(secret);
    }
  });

  // ---------- 3-of-5 variant ----------

  it("3-of-5 split and recover", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 5, 3);
    expect(shares).toHaveLength(5);

    // Any 3 of 5 should work
    const recovered = recoverSecret([shares[0]!, shares[2]!, shares[4]!]);
    expect(recovered).toEqual(secret);
  });

  it("3-of-5: 2 shares insufficient (probabilistic check)", () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const shares = splitSecret(secret, 5, 3);

    // 2 shares should NOT recover the secret (with overwhelming probability)
    const attempt = recoverSecret([shares[0]!, shares[1]!]);
    // The Lagrange interpolation with only 2 points for a degree-2 polynomial
    // will almost certainly produce wrong result
    expect(attempt).not.toEqual(secret);
  });

  // ---------- Edge cases ----------

  it("secret of length 1", () => {
    const secret = new Uint8Array([42]);
    const shares = splitSecret(secret, 3, 2);
    const recovered = recoverSecret([shares[0]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  it("large secret (1KB)", () => {
    const secret = crypto.getRandomValues(new Uint8Array(1024));
    const shares = splitSecret(secret, 3, 2);
    const recovered = recoverSecret([shares[1]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  it("throws on empty secret", () => {
    expect(() => splitSecret(new Uint8Array(0), 3, 2)).toThrow(
      "Secret cannot be empty",
    );
  });

  it("throws on threshold > n", () => {
    expect(() =>
      splitSecret(new Uint8Array(16), 2, 3),
    ).toThrow("Threshold cannot exceed");
  });

  it("throws on threshold < 2", () => {
    expect(() =>
      splitSecret(new Uint8Array(16), 3, 1),
    ).toThrow("Threshold must be at least 2");
  });

  it("throws on recover with < 2 shares", () => {
    const secret = crypto.getRandomValues(new Uint8Array(16));
    const shares = splitSecret(secret, 3, 2);
    expect(() => recoverSecret([shares[0]!])).toThrow("at least 2 shares");
  });
});
