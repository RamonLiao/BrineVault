// ========== @rwa-dataroom/encryption-sdk ==========
// Public API

// Engine interface and implementations
export type { EncryptionEngine, EncryptedBlob } from "./engines/engine.interface.js";
export { AESEngine, generateAESKey, importAESKey, exportAESKey } from "./engines/aes-engine.js";
export { SealEngine } from "./engines/seal-engine.js";

// Key management
export {
  generateFolderKey,
  encryptKeyForMember,
  decryptKeyWithKeypair,
  generateWrappingKeypair,
  exportPublicKey,
} from "./keys/folder-key.js";
export { rotateKey } from "./keys/key-rotation.js";
export type { KeyRotationResult } from "./keys/key-rotation.js";

// Shamir's Secret Sharing
export { splitSecret, recoverSecret } from "./keys/recovery.js";
export type { ShamirShare } from "./keys/recovery.js";

// Integrity verification
export { computeHash, verifyHash } from "./integrity/hash.js";

// Utilities
export { generateIV, IV_LENGTH } from "./utils/iv.js";
