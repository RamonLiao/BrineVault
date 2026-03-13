import { ENCRYPTION_SCHEMES } from "@rwa-dataroom/shared";
import type { EncryptionScheme } from "@rwa-dataroom/shared";
import type { EncryptedBlob, EncryptionEngine } from "./engine.interface.js";

// ========== S2.3: Seal Engine Stub (Phase 1) ==========

/**
 * Seal threshold encryption engine — Phase 1 stub.
 *
 * Phase 1: All operations throw "Seal engine not yet available".
 * Phase 2: Will integrate with Seal key servers for threshold decryption.
 *
 * The structure is ready for Phase 2 implementation:
 * - encrypt: will encrypt with Seal threshold scheme
 * - decrypt: will request key shares from Seal key servers,
 *   verify on-chain Move policy, reconstruct key client-side, then decrypt.
 */
export class SealEngine implements EncryptionEngine {
  readonly scheme: EncryptionScheme = ENCRYPTION_SCHEMES.SEAL;

  async encrypt(
    _plaintext: ArrayBuffer,
    _key: CryptoKey,
  ): Promise<EncryptedBlob> {
    throw new Error("Seal engine not yet available");
  }

  async decrypt(
    _blob: EncryptedBlob,
    _key: CryptoKey,
  ): Promise<ArrayBuffer> {
    throw new Error("Seal engine not yet available");
  }
}
