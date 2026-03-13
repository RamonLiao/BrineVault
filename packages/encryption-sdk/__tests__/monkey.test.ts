import { describe, it, expect } from "vitest";
import {
  AESEngine,
  generateAESKey,
  computeHash,
  verifyHash,
  splitSecret,
  recoverSecret,
  generateFolderKey,
  encryptKeyForMember,
  decryptKeyWithKeypair,
  generateWrappingKeypair,
  exportPublicKey,
  exportAESKey,
  rotateKey,
} from "../src/index.js";

describe("Monkey tests — edge cases & stress", () => {
  const engine = new AESEngine();

  // ---------- Concurrent operations ----------

  it("concurrent encryptions with same key produce unique IVs", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(64).buffer;

    const blobs = await Promise.all(
      Array.from({ length: 50 }, () => engine.encrypt(plaintext, key)),
    );

    const ivs = new Set(
      blobs.map((b) =>
        Array.from(b.data.slice(0, 12))
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
      ),
    );
    expect(ivs.size).toBe(50);
  });

  it("concurrent encrypt/decrypt round-trips", async () => {
    const key = await generateAESKey();
    const tasks = Array.from({ length: 20 }, async (_, i) => {
      const data = new Uint8Array(100 + i * 10);
      crypto.getRandomValues(data);
      const blob = await engine.encrypt(data.buffer, key);
      const dec = await engine.decrypt(blob, key);
      expect(new Uint8Array(dec)).toEqual(data);
    });
    await Promise.all(tasks);
  });

  // ---------- Boundary sizes ----------

  it("encrypt/decrypt 1 byte", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array([0xff]).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const dec = await engine.decrypt(blob, key);
    expect(new Uint8Array(dec)).toEqual(new Uint8Array([0xff]));
  });

  it("encrypt/decrypt max single-byte variants (0x00..0xFF)", async () => {
    const key = await generateAESKey();
    for (let b = 0; b < 256; b++) {
      const plaintext = new Uint8Array([b]).buffer;
      const blob = await engine.encrypt(plaintext, key);
      const dec = await engine.decrypt(blob, key);
      expect(new Uint8Array(dec)[0]).toBe(b);
    }
  });

  // ---------- All-zeros and all-ones ----------

  it("encrypt/decrypt all-zeros payload", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(1024).buffer; // all zeros
    const blob = await engine.encrypt(plaintext, key);
    const dec = await engine.decrypt(blob, key);
    expect(new Uint8Array(dec)).toEqual(new Uint8Array(1024));
  });

  it("encrypt/decrypt all-0xFF payload", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(1024).fill(0xff).buffer;
    const blob = await engine.encrypt(plaintext, key);
    const dec = await engine.decrypt(blob, key);
    expect(new Uint8Array(dec)).toEqual(new Uint8Array(1024).fill(0xff));
  });

  // ---------- Hash integrity under stress ----------

  it("hash verification survives single-bit tamper", async () => {
    const data = crypto.getRandomValues(new Uint8Array(512));
    const hash = await computeHash(data.buffer);

    // Flip one bit
    const tampered = new Uint8Array(data);
    tampered[256]! ^= 0x01;

    expect(await verifyHash(tampered.buffer, hash)).toBe(false);
  });

  it("hash of sequential data blocks all differ", async () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const data = new Uint8Array(32);
      data[0] = i;
      const hash = await computeHash(data.buffer);
      hashes.add(hash);
    }
    expect(hashes.size).toBe(100);
  });

  // ---------- Shamir edge stress ----------

  it("Shamir: split+recover 100 times, always correct", () => {
    for (let i = 0; i < 100; i++) {
      const secret = crypto.getRandomValues(new Uint8Array(32));
      const shares = splitSecret(secret, 3, 2);
      // Pick random 2-of-3
      const pick = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2);
      const recovered = recoverSecret([shares[pick[0]!]!, shares[pick[1]!]!]);
      expect(recovered).toEqual(secret);
    }
  });

  it("Shamir: secret with all-zeros", () => {
    const secret = new Uint8Array(32); // all zeros
    const shares = splitSecret(secret, 3, 2);
    const recovered = recoverSecret([shares[0]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  it("Shamir: secret with all-0xFF", () => {
    const secret = new Uint8Array(32).fill(0xff);
    const shares = splitSecret(secret, 3, 2);
    const recovered = recoverSecret([shares[1]!, shares[2]!]);
    expect(recovered).toEqual(secret);
  });

  // ---------- Key rotation stress ----------

  it("key rotation: encrypt with old key, re-encrypt with new key", async () => {
    const kpA = await generateWrappingKeypair();
    const kpB = await generateWrappingKeypair();
    const pubA = await exportPublicKey(kpA.publicKey);
    const pubB = await exportPublicKey(kpB.publicKey);

    const oldKey = await generateFolderKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(1024)).buffer;

    // Encrypt with old key
    const oldBlob = await engine.encrypt(plaintext, oldKey);

    // Rotate (remove B, keep A)
    const { newKey } = await rotateKey([pubA]);

    // Re-encrypt: decrypt old → encrypt new
    const decrypted = await engine.decrypt(oldBlob, oldKey);
    const newBlob = await engine.encrypt(decrypted, newKey);

    // Verify new blob decrypts correctly
    const final = await engine.decrypt(newBlob, newKey);
    expect(new Uint8Array(final)).toEqual(new Uint8Array(plaintext));

    // Old key cannot decrypt new blob
    await expect(engine.decrypt(newBlob, oldKey)).rejects.toThrow();
  });

  // ---------- Double encrypt/decrypt ----------

  it("double encrypt then double decrypt", async () => {
    const key1 = await generateAESKey();
    const key2 = await generateAESKey();
    const plaintext = crypto.getRandomValues(new Uint8Array(256)).buffer;

    // Encrypt twice
    const blob1 = await engine.encrypt(plaintext, key1);
    const blob2 = await engine.encrypt(blob1.data.buffer, key2);

    // Decrypt twice (reverse order)
    const dec2 = await engine.decrypt(blob2, key2);
    const innerBlob = { data: new Uint8Array(dec2), scheme: engine.scheme };
    const dec1 = await engine.decrypt(innerBlob, key1);

    expect(new Uint8Array(dec1)).toEqual(new Uint8Array(plaintext));
  });
});
