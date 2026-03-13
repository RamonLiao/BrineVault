import {
  generateFolderKey,
  encryptKeyForMember,
  exportAESKey,
} from "./folder-key.js";

// ========== S2.4: Key Rotation ==========

export interface KeyRotationResult {
  /** The new folder key */
  newKey: CryptoKey;
  /** New key encrypted for each remaining member (indexed by position) */
  encryptedKeysForMembers: Uint8Array[];
}

/**
 * Rotate the folder key after a member is removed.
 *
 * 1. Generates a brand new AES-256 key
 * 2. Encrypts (wraps) the new key for each remaining member's public key
 *
 * The caller is responsible for:
 * - Re-encrypting all files in affected folders with the new key
 * - Updating on-chain Blob IDs and dynamic fields
 *
 * @param remainingMemberPubKeys - RSA-OAEP SPKI public keys of remaining members
 * @returns The new key and wrapped versions for each member
 */
export async function rotateKey(
  remainingMemberPubKeys: Uint8Array[],
): Promise<KeyRotationResult> {
  if (remainingMemberPubKeys.length === 0) {
    throw new Error("Cannot rotate key: no remaining members");
  }

  const newKey = await generateFolderKey();

  const encryptedKeysForMembers = await Promise.all(
    remainingMemberPubKeys.map((pubKey) =>
      encryptKeyForMember(newKey, pubKey),
    ),
  );

  return { newKey, encryptedKeysForMembers };
}
