import { ENCRYPTION_SCHEMES } from "@rwa-dataroom/shared";
import type { EncryptionScheme } from "@rwa-dataroom/shared";
import type { EncryptedBlob, EncryptionEngine } from "./engine.interface.js";
import { IV_LENGTH, generateIV } from "../utils/iv.js";

// ========== S2.2: AES-256-GCM Engine ==========

const AES_ALGORITHM = "AES-GCM";
const AES_KEY_LENGTH = 256;

/**
 * AES-256-GCM encryption engine using Web Crypto API.
 *
 * Blob format: IV (12 bytes) || ciphertext || auth_tag (16 bytes)
 * The auth tag is appended to ciphertext by Web Crypto API by default.
 */
export class AESEngine implements EncryptionEngine {
  readonly scheme: EncryptionScheme = ENCRYPTION_SCHEMES.AES;

  async encrypt(plaintext: ArrayBuffer, key: CryptoKey): Promise<EncryptedBlob> {
    const iv = generateIV();

    const ciphertext = await crypto.subtle.encrypt(
      { name: AES_ALGORITHM, iv: iv as BufferSource },
      key,
      plaintext,
    );

    // Compose: IV || ciphertext (includes auth tag)
    const data = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    data.set(iv, 0);
    data.set(new Uint8Array(ciphertext), IV_LENGTH);

    return { data, scheme: this.scheme };
  }

  async decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<ArrayBuffer> {
    if (blob.data.byteLength <= IV_LENGTH) {
      throw new Error("Invalid encrypted blob: too short");
    }

    const iv = blob.data.slice(0, IV_LENGTH);
    const ciphertext = blob.data.slice(IV_LENGTH);

    return crypto.subtle.decrypt(
      { name: AES_ALGORITHM, iv },
      key,
      ciphertext,
    );
  }
}

/**
 * Generate an AES-256-GCM CryptoKey suitable for use with AESEngine.
 * The key is extractable so it can be exported for key wrapping.
 */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true, // extractable — needed for key export/wrap
    ["encrypt", "decrypt"],
  );
}

/**
 * Import raw AES-256 key bytes into a CryptoKey.
 */
export async function importAESKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey as BufferSource,
    { name: AES_ALGORITHM, length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Export a CryptoKey to raw bytes.
 */
export async function exportAESKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}
