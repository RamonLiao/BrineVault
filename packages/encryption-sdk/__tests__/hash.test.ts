import { describe, it, expect } from "vitest";
import { computeHash, verifyHash } from "../src/index.js";

describe("Integrity verification (SHA-256)", () => {
  it("computes hash of known data", async () => {
    // SHA-256 of empty string is well-known
    const hash = await computeHash(new Uint8Array(0).buffer);
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("verifyHash returns true for correct data", async () => {
    const data = new TextEncoder().encode("hello world").buffer;
    const hash = await computeHash(data);
    expect(await verifyHash(data, hash)).toBe(true);
  });

  it("verifyHash returns false for tampered data", async () => {
    const data = new TextEncoder().encode("hello world").buffer;
    const hash = await computeHash(data);
    const tampered = new TextEncoder().encode("hello world!").buffer;
    expect(await verifyHash(tampered, hash)).toBe(false);
  });

  it("verifyHash returns false for wrong hash", async () => {
    const data = new TextEncoder().encode("test").buffer;
    const wrongHash =
      "0000000000000000000000000000000000000000000000000000000000000000";
    expect(await verifyHash(data, wrongHash)).toBe(false);
  });

  it("hash is deterministic", async () => {
    const data = crypto.getRandomValues(new Uint8Array(1024)).buffer;
    const hash1 = await computeHash(data);
    const hash2 = await computeHash(data);
    expect(hash1).toBe(hash2);
  });

  it("different data produces different hashes", async () => {
    const data1 = new Uint8Array([1, 2, 3]).buffer;
    const data2 = new Uint8Array([1, 2, 4]).buffer;
    const hash1 = await computeHash(data1);
    const hash2 = await computeHash(data2);
    expect(hash1).not.toBe(hash2);
  });

  it("hash is 64 hex characters", async () => {
    const data = new Uint8Array(256).buffer;
    const hash = await computeHash(data);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
