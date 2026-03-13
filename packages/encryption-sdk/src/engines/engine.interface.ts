import type { EncryptionScheme } from "@rwa-dataroom/shared";

// ========== S2.1: EncryptionEngine Interface ==========

/**
 * Encrypted blob payload.
 * For AES-256-GCM: data = IV (12 bytes) || ciphertext || auth_tag (16 bytes)
 */
export interface EncryptedBlob {
  data: Uint8Array;
  scheme: EncryptionScheme;
}

/**
 * Abstract encryption engine interface.
 * Both AESEngine and SealEngine implement this contract.
 */
export interface EncryptionEngine {
  /** Encrypt plaintext with the given key */
  encrypt(plaintext: ArrayBuffer, key: CryptoKey): Promise<EncryptedBlob>;

  /** Decrypt an encrypted blob with the given key */
  decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<ArrayBuffer>;

  /** Which encryption scheme this engine uses */
  readonly scheme: EncryptionScheme;
}
