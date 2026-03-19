import { z } from "zod";
import { ROLES, ROLE_MASKS } from "../types/roles.js";
import { POOL_STATES } from "../types/pool.js";
import { DOC_TYPES } from "../types/document.js";
import { ENCRYPTION_SCHEMES } from "../types/encryption.js";
import { IC_DECISION_TYPES } from "../types/ic-decision.js";
import { REVIEW_STATUS } from "../types/document.js";
import { PAGINATION_CONFIG } from "../constants/config.js";

// ========== Primitives ==========

const suiAddress = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid Sui address");
const hexHash = z.string().regex(/^[a-fA-F0-9]{64}$/, "Invalid SHA-256 hex hash");
const blobId = z.string().min(1, "Blob ID cannot be empty");

// ========== Auth ==========

export const authChallengeResponseSchema = z.object({
  nonce: z.string(),
  timestamp: z.number(),
  expiresAt: z.number(),
});

export const authVerifyRequestSchema = z.object({
  address: suiAddress,
  signature: z.string().min(1),
  nonce: z.string().min(1),
});

export const authRefreshRequestSchema = z.object({
  // Refresh token is sent via httpOnly cookie, body is empty or optional
});

export const verifyZkLoginRequestSchema = z.object({
  jwt: z.string().min(1),
  zkProof: z.object({
    proofPoints: z.object({
      a: z.array(z.string()),
      b: z.array(z.array(z.string())),
      c: z.array(z.string()),
    }),
    issBase64Details: z.object({
      value: z.string(),
      indexMod4: z.number(),
    }),
    headerBase64: z.string(),
  }),
  ephemeralPubKey: z.string().min(1),
  maxEpoch: z.number().int().positive(),
  salt: z.string().min(1),
});

// ========== Pool ==========

export const createPoolRequestSchema = z.object({
  name: z.string().min(1).max(256),
  orgIdHash: hexHash,
  borrowerNameHash: hexHash,
  currency: z.string().min(1).max(10),
  targetNotional: z.string().regex(/^\d+$/, "Must be a numeric string"),
  expectedMaturityDate: z.number().int().positive(),
  encryptionScheme: z.nativeEnum(ENCRYPTION_SCHEMES),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const transitionRequestSchema = z.object({
  targetState: z.nativeEnum(POOL_STATES),
});

// ========== Document ==========

export const uploadDocumentRequestSchema = z.object({
  folderId: z.number().int().min(0),
  docType: z.nativeEnum(DOC_TYPES),
  title: z.string().min(1).max(512),
  requiredFlag: z.boolean().default(false),
  visibleToRoles: z.number().int().min(1).max(ROLES.ALL),
  walrusBlobId: blobId,
  contentHash: hexHash,
  sizeBytes: z.number().int().positive(),
  changeLog: z.string().max(2048).default(""),
});

export const addVersionRequestSchema = z.object({
  walrusBlobId: blobId,
  contentHash: hexHash,
  sizeBytes: z.number().int().positive(),
  changeLog: z.string().max(2048).default(""),
});

// ========== Review ==========

export const submitReviewRequestSchema = z.object({
  status: z.nativeEnum(REVIEW_STATUS),
  commentHash: hexHash.optional(),
});

// ========== IC Decision ==========

export const submitICDecisionRequestSchema = z.object({
  decisionType: z.nativeEnum(IC_DECISION_TYPES),
  decisionText: z.string().min(1).max(10_000),
  pdfBlobId: blobId,
  committee: z.array(suiAddress).min(1),
  votes: z.array(z.number().int().min(0).max(2)),
  relatedDocIds: z.array(z.string()).default([]),
});

// ========== Member ==========

export const addMemberRequestSchema = z.object({
  address: suiAddress,
  role: z.number().int().min(1).max(ROLES.ALL),
  tags: z.array(z.string().max(64)).max(20).default([]),
});

export const updateRoleRequestSchema = z.object({
  newRole: z.number().int().min(1).max(ROLES.ALL),
});

// ========== Pagination ==========

export const paginationParamsSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(PAGINATION_CONFIG.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION_CONFIG.MAX_LIMIT)
    .default(PAGINATION_CONFIG.DEFAULT_LIMIT),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
