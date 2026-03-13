// ========== Encryption Scheme ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const ENCRYPTION_SCHEMES = {
  AES: 0,
  SEAL: 1,
} as const;

export type EncryptionScheme =
  (typeof ENCRYPTION_SCHEMES)[keyof typeof ENCRYPTION_SCHEMES];

export const ENCRYPTION_SCHEME_LABELS: Record<EncryptionScheme, string> = {
  [ENCRYPTION_SCHEMES.AES]: "AES-256-GCM",
  [ENCRYPTION_SCHEMES.SEAL]: "Seal (Threshold Encryption)",
};
