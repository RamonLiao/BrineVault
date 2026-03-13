import { generateAESKey, exportAESKey, importAESKey } from "../engines/aes-engine.js";

// ========== S2.4: Key Management ==========

/**
 * Generate a new AES-256 folder key.
 */
export async function generateFolderKey(): Promise<CryptoKey> {
  return generateAESKey();
}

/**
 * Encrypt a folder key for a specific member using RSA-OAEP wrapping.
 *
 * The member's RSA public key is used to wrap (encrypt) the AES folder key.
 * Only the member with the corresponding private key can unwrap it.
 *
 * @param key - The AES-256 folder key to encrypt
 * @param memberPublicKey - The member's RSA-OAEP public key (SPKI DER bytes)
 * @returns The wrapped (encrypted) key bytes
 */
export async function encryptKeyForMember(
  key: CryptoKey,
  memberPublicKey: Uint8Array,
): Promise<Uint8Array> {
  const rsaPubKey = await crypto.subtle.importKey(
    "spki",
    memberPublicKey as BufferSource,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["wrapKey"],
  );

  const wrappedKey = await crypto.subtle.wrapKey("raw", key, rsaPubKey, {
    name: "RSA-OAEP",
  });

  return new Uint8Array(wrappedKey);
}

/**
 * Decrypt a wrapped folder key using the member's RSA-OAEP private key.
 *
 * @param encryptedKey - The wrapped (encrypted) key bytes
 * @param privateKey - The member's RSA-OAEP private key
 * @returns The unwrapped AES-256 CryptoKey
 */
export async function decryptKeyWithKeypair(
  encryptedKey: Uint8Array,
  privateKey: CryptoKey,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    encryptedKey as BufferSource,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Generate an RSA-OAEP keypair for key wrapping.
 * Used for member key management.
 */
export async function generateWrappingKeypair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["wrapKey", "unwrapKey"],
  );
}

/**
 * Export RSA public key as SPKI DER bytes.
 */
export async function exportPublicKey(
  publicKey: CryptoKey,
): Promise<Uint8Array> {
  const spki = await crypto.subtle.exportKey("spki", publicKey);
  return new Uint8Array(spki);
}

export { exportAESKey, importAESKey };
