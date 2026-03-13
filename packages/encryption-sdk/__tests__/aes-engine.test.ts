import { describe, it, expect } from "vitest";
import { ENCRYPTION_SCHEMES } from "@rwa-dataroom/shared";
import {
  AESEngine,
  generateAESKey,
  importAESKey,
  exportAESKey,
  IV_LENGTH,
} from "../src/index.js";

/** Fill a large Uint8Array with random bytes (crypto.getRandomValues has 65536 byte limit). */
function fillRandom(buf: Uint8Array): Uint8Array {
  const CHUNK = 65536;
  for (let offset = 0; offset < buf.length; offset += CHUNK) {
    const end = Math.min(offset + CHUNK, buf.length);
    crypto.getRandomValues(buf.subarray(offset, end));
  }
  return buf;
}

describe("AESEngine", () => {
  const engine = new AESEngine();

  it("has correct scheme", () => {
    expect(engine.scheme).toBe(ENCRYPTION_SCHEMES.AES);
  });

  // ---------- Round-trip tests ----------

  it("encrypt/decrypt round-trip — 1KB", async () => {
    const key = await generateAESKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(1024)).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, key);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  it("encrypt/decrypt round-trip — 1MB", async () => {
    const key = await generateAESKey();
    const plaintext = fillRandom(new Uint8Array(1024 * 1024)).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, key);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  it("encrypt/decrypt round-trip — 5MB", async () => {
    const key = await generateAESKey();
    const plaintext = fillRandom(new Uint8Array(5 * 1024 * 1024)).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, key);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  it("encrypt/decrypt round-trip — 50MB", { timeout: 300_000 }, async () => {
    const key = await generateAESKey();
    const plaintext = fillRandom(new Uint8Array(50 * 1024 * 1024)).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, key);
    expect(decrypted.byteLength).toBe(50 * 1024 * 1024);
    // Compare first and last 1KB to avoid massive memory comparison
    const orig = new Uint8Array(plaintext);
    const dec = new Uint8Array(decrypted);
    expect(dec.slice(0, 1024)).toEqual(orig.slice(0, 1024));
    expect(dec.slice(-1024)).toEqual(orig.slice(-1024));
  });

  // ---------- IV uniqueness ----------

  it("different IVs for same plaintext → different ciphertext", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]).buffer;

    const blob1 = await engine.encrypt(plaintext, key);
    const blob2 = await engine.encrypt(plaintext, key);

    // IVs must differ
    const iv1 = blob1.data.slice(0, IV_LENGTH);
    const iv2 = blob2.data.slice(0, IV_LENGTH);
    expect(iv1).not.toEqual(iv2);

    // Ciphertext must differ (because IVs differ)
    expect(blob1.data).not.toEqual(blob2.data);

    // But both decrypt to same plaintext
    const dec1 = await engine.decrypt(blob1, key);
    const dec2 = await engine.decrypt(blob2, key);
    expect(new Uint8Array(dec1)).toEqual(new Uint8Array(plaintext));
    expect(new Uint8Array(dec2)).toEqual(new Uint8Array(plaintext));
  });

  it("never reuses IV across 100 encryptions", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(32).buffer;
    const ivSet = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const blob = await engine.encrypt(plaintext, key);
      const ivHex = Array.from(blob.data.slice(0, IV_LENGTH))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      ivSet.add(ivHex);
    }

    expect(ivSet.size).toBe(100);
  });

  // ---------- Blob format ----------

  it("blob format: IV (12) || ciphertext || tag (16)", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(100).buffer;
    const blob = await engine.encrypt(plaintext, key);

    // AES-GCM: ciphertext length = plaintext length, tag = 16 bytes
    // Total blob = 12 (IV) + 100 (ciphertext) + 16 (tag) = 128
    expect(blob.data.byteLength).toBe(12 + 100 + 16);
    expect(blob.scheme).toBe(ENCRYPTION_SCHEMES.AES);
  });

  // ---------- Error cases ----------

  it("decrypt with wrong key fails", async () => {
    const key1 = await generateAESKey();
    const key2 = await generateAESKey();
    const plaintext = new Uint8Array([42, 43, 44]).buffer;
    const blob = await engine.encrypt(plaintext, key1);

    await expect(engine.decrypt(blob, key2)).rejects.toThrow();
  });

  it("decrypt truncated blob fails", async () => {
    const key = await generateAESKey();
    const blob = { data: new Uint8Array(10), scheme: ENCRYPTION_SCHEMES.AES };

    await expect(engine.decrypt(blob, key)).rejects.toThrow("too short");
  });

  it("decrypt tampered ciphertext fails", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(64).buffer;
    const blob = await engine.encrypt(plaintext, key);

    // Tamper with ciphertext (not IV)
    blob.data[IV_LENGTH + 5] ^= 0xff;

    await expect(engine.decrypt(blob, key)).rejects.toThrow();
  });

  // ---------- Key export/import ----------

  it("export and import key round-trip", async () => {
    const key = await generateAESKey();
    const raw = await exportAESKey(key);
    expect(raw.byteLength).toBe(32); // AES-256 = 32 bytes

    const imported = await importAESKey(raw);
    const plaintext = new Uint8Array([10, 20, 30]).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, imported);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  // ---------- Empty file ----------

  it("encrypt/decrypt empty file", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(0).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const decrypted = await engine.decrypt(blob, key);
    expect(new Uint8Array(decrypted).byteLength).toBe(0);
  });
});
