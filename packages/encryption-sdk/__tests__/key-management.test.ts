import { describe, it, expect } from "vitest";
import {
  AESEngine,
  generateFolderKey,
  encryptKeyForMember,
  decryptKeyWithKeypair,
  generateWrappingKeypair,
  exportPublicKey,
  exportAESKey,
  rotateKey,
} from "../src/index.js";

describe("Key management", () => {
  const engine = new AESEngine();

  it("generateFolderKey creates a valid AES-256 key", async () => {
    const key = await generateFolderKey();
    const raw = await exportAESKey(key);
    expect(raw.byteLength).toBe(32);
  });

  it("encryptKeyForMember + decryptKeyWithKeypair round-trip", async () => {
    const folderKey = await generateFolderKey();
    const keypair = await generateWrappingKeypair();
    const pubKeyBytes = await exportPublicKey(keypair.publicKey);

    const encryptedKey = await encryptKeyForMember(folderKey, pubKeyBytes);
    expect(encryptedKey.byteLength).toBeGreaterThan(0);

    const recovered = await decryptKeyWithKeypair(
      encryptedKey,
      keypair.privateKey,
    );

    // Verify recovered key can decrypt data encrypted with original key
    const plaintext = new Uint8Array([1, 2, 3, 4, 5]).buffer;
    const blob = await engine.encrypt(plaintext, folderKey);
    const decrypted = await engine.decrypt(blob, recovered);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  it("different members get different encrypted keys", async () => {
    const folderKey = await generateFolderKey();
    const kp1 = await generateWrappingKeypair();
    const kp2 = await generateWrappingKeypair();
    const pub1 = await exportPublicKey(kp1.publicKey);
    const pub2 = await exportPublicKey(kp2.publicKey);

    const enc1 = await encryptKeyForMember(folderKey, pub1);
    const enc2 = await encryptKeyForMember(folderKey, pub2);

    // Different members' encrypted keys should differ
    expect(enc1).not.toEqual(enc2);

    // But both decrypt to the same key
    const key1 = await decryptKeyWithKeypair(enc1, kp1.privateKey);
    const key2 = await decryptKeyWithKeypair(enc2, kp2.privateKey);
    const raw1 = await exportAESKey(key1);
    const raw2 = await exportAESKey(key2);
    expect(raw1).toEqual(raw2);
  });

  it("member cannot decrypt with wrong private key", async () => {
    const folderKey = await generateFolderKey();
    const kp1 = await generateWrappingKeypair();
    const kp2 = await generateWrappingKeypair();
    const pub1 = await exportPublicKey(kp1.publicKey);

    const encrypted = await encryptKeyForMember(folderKey, pub1);

    // kp2's private key should fail
    await expect(
      decryptKeyWithKeypair(encrypted, kp2.privateKey),
    ).rejects.toThrow();
  });
});

describe("Key rotation", () => {
  const engine = new AESEngine();

  it("rotateKey generates new key and encrypts for remaining members", async () => {
    const kpA = await generateWrappingKeypair();
    const kpB = await generateWrappingKeypair();
    const kpC = await generateWrappingKeypair();
    const pubA = await exportPublicKey(kpA.publicKey);
    const pubB = await exportPublicKey(kpB.publicKey);
    const pubC = await exportPublicKey(kpC.publicKey);

    // Original key encrypted for A, B, C
    const originalKey = await generateFolderKey();

    // Remove B — rotate for remaining [A, C]
    const result = await rotateKey([pubA, pubC]);
    expect(result.encryptedKeysForMembers).toHaveLength(2);

    // A can decrypt new key
    const keyForA = await decryptKeyWithKeypair(
      result.encryptedKeysForMembers[0]!,
      kpA.privateKey,
    );
    // C can decrypt new key
    const keyForC = await decryptKeyWithKeypair(
      result.encryptedKeysForMembers[1]!,
      kpC.privateKey,
    );

    // Both get same key
    const rawA = await exportAESKey(keyForA);
    const rawC = await exportAESKey(keyForC);
    expect(rawA).toEqual(rawC);

    // New key differs from original
    const rawOriginal = await exportAESKey(originalKey);
    const rawNew = await exportAESKey(result.newKey);
    expect(rawNew).not.toEqual(rawOriginal);

    // B cannot decrypt new key with any of the encrypted keys
    for (const encKey of result.encryptedKeysForMembers) {
      await expect(
        decryptKeyWithKeypair(encKey, kpB.privateKey),
      ).rejects.toThrow();
    }
  });

  it("rotateKey — new key works for encrypt/decrypt", async () => {
    const kp = await generateWrappingKeypair();
    const pub = await exportPublicKey(kp.publicKey);

    const result = await rotateKey([pub]);
    const recoveredKey = await decryptKeyWithKeypair(
      result.encryptedKeysForMembers[0]!,
      kp.privateKey,
    );

    const plaintext = crypto.getRandomValues(new Uint8Array(256)).buffer;
    const blob = await engine.encrypt(plaintext, result.newKey);
    const decrypted = await engine.decrypt(blob, recoveredKey);
    expect(new Uint8Array(decrypted)).toEqual(new Uint8Array(plaintext));
  });

  it("rotateKey with no remaining members throws", async () => {
    await expect(rotateKey([])).rejects.toThrow("no remaining members");
  });
});
