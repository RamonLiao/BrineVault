// ========== Move Error Codes ==========
// Must match contracts/rwa_dataroom/sources/errors.move exactly

export const MOVE_ERRORS = {
  // Authorization
  E_NOT_AUTHORIZED: 0,
  E_NOT_OWNER: 1,
  E_NOT_MEMBER: 2,
  E_INSUFFICIENT_ROLE: 3,
  E_MEMBER_NOT_ACTIVE: 4,

  // State Machine
  E_INVALID_STATE_TRANSITION: 100,
  E_POOL_PAUSED: 101,
  E_POOL_NOT_IN_DRAFT: 102,
  E_POOL_NOT_IN_DD: 103,
  E_POOL_NOT_IN_IC_REVIEW: 104,
  E_POOL_NOT_REJECTED: 105,
  E_POOL_CANCELLED: 106,

  // Membership
  E_MEMBER_ALREADY_EXISTS: 200,
  E_MEMBER_NOT_FOUND: 201,
  E_CANNOT_REMOVE_OWNER: 202,
  E_MAX_MEMBERS_REACHED: 203,
  E_MEMBER_ALREADY_REVOKED: 204,

  // Document
  E_DOCUMENT_NOT_FOUND: 300,
  E_MAX_VERSIONS_REACHED: 301,
  E_DOCUMENT_ARCHIVED: 302,
  E_INVALID_DOC_TYPE: 303,
  E_EMPTY_BLOB_ID: 304,
  E_EMPTY_CONTENT_HASH: 305,
  E_INVALID_CONTENT_HASH_LEN: 306,
  E_ALREADY_REVIEWED: 307,

  // Folder
  E_FOLDER_NOT_FOUND: 400,
  E_FOLDER_NAME_EMPTY: 401,
  E_PARENT_FOLDER_NOT_FOUND: 402,

  // Admin
  E_ALREADY_PAUSED: 500,
  E_NOT_PAUSED: 501,
  E_INVALID_CONFIG: 502,

  // Validation
  E_INVALID_ENCRYPTION_SCHEME: 600,
  E_INVALID_ROLE: 601,
  E_EMPTY_NAME: 602,
  E_INVALID_HASH_LENGTH: 603,
  E_EMPTY_COMMITTEE: 604,

  // DD Checklist
  E_REQUIRED_DOCS_NOT_REVIEWED: 700,
  E_COMPLIANCE_CHECK_FAILED: 701,

  // IC Decision (Errata E3)
  E_NO_IC_APPROVAL: 800,

  // Review (Errata E3)
  E_SELF_REVIEW: 801,

  // Role (Errata E3)
  E_CANNOT_DEMOTE_OWNER: 802,
} as const;

export type MoveErrorCode =
  (typeof MOVE_ERRORS)[keyof typeof MOVE_ERRORS];

export const MOVE_ERROR_MESSAGES: Record<MoveErrorCode, string> = {
  [MOVE_ERRORS.E_NOT_AUTHORIZED]: "Not authorised",
  [MOVE_ERRORS.E_NOT_OWNER]: "Not the owner",
  [MOVE_ERRORS.E_NOT_MEMBER]: "Not a member",
  [MOVE_ERRORS.E_INSUFFICIENT_ROLE]: "Insufficient role",
  [MOVE_ERRORS.E_MEMBER_NOT_ACTIVE]: "Member is not active",
  [MOVE_ERRORS.E_INVALID_STATE_TRANSITION]: "Invalid state transition",
  [MOVE_ERRORS.E_POOL_PAUSED]: "Pool is paused",
  [MOVE_ERRORS.E_POOL_NOT_IN_DRAFT]: "Pool is not in Draft state",
  [MOVE_ERRORS.E_POOL_NOT_IN_DD]: "Pool is not in DD In Progress state",
  [MOVE_ERRORS.E_POOL_NOT_IN_IC_REVIEW]: "Pool is not in IC Review state",
  [MOVE_ERRORS.E_POOL_NOT_REJECTED]: "Pool is not in Rejected state",
  [MOVE_ERRORS.E_POOL_CANCELLED]: "Pool has been cancelled",
  [MOVE_ERRORS.E_MEMBER_ALREADY_EXISTS]: "Member already exists",
  [MOVE_ERRORS.E_MEMBER_NOT_FOUND]: "Member not found",
  [MOVE_ERRORS.E_CANNOT_REMOVE_OWNER]: "Cannot remove owner",
  [MOVE_ERRORS.E_MAX_MEMBERS_REACHED]: "Maximum members reached",
  [MOVE_ERRORS.E_MEMBER_ALREADY_REVOKED]: "Member already revoked",
  [MOVE_ERRORS.E_DOCUMENT_NOT_FOUND]: "Document not found",
  [MOVE_ERRORS.E_MAX_VERSIONS_REACHED]: "Maximum versions reached",
  [MOVE_ERRORS.E_DOCUMENT_ARCHIVED]: "Document is archived",
  [MOVE_ERRORS.E_INVALID_DOC_TYPE]: "Invalid document type",
  [MOVE_ERRORS.E_EMPTY_BLOB_ID]: "Blob ID cannot be empty",
  [MOVE_ERRORS.E_EMPTY_CONTENT_HASH]: "Content hash cannot be empty",
  [MOVE_ERRORS.E_INVALID_CONTENT_HASH_LEN]: "Content hash must be 32 bytes",
  [MOVE_ERRORS.E_ALREADY_REVIEWED]: "Already reviewed",
  [MOVE_ERRORS.E_FOLDER_NOT_FOUND]: "Folder not found",
  [MOVE_ERRORS.E_FOLDER_NAME_EMPTY]: "Folder name cannot be empty",
  [MOVE_ERRORS.E_PARENT_FOLDER_NOT_FOUND]: "Parent folder not found",
  [MOVE_ERRORS.E_ALREADY_PAUSED]: "Already paused",
  [MOVE_ERRORS.E_NOT_PAUSED]: "Not paused",
  [MOVE_ERRORS.E_INVALID_CONFIG]: "Invalid configuration",
  [MOVE_ERRORS.E_INVALID_ENCRYPTION_SCHEME]: "Invalid encryption scheme",
  [MOVE_ERRORS.E_INVALID_ROLE]: "Invalid role",
  [MOVE_ERRORS.E_EMPTY_NAME]: "Name cannot be empty",
  [MOVE_ERRORS.E_INVALID_HASH_LENGTH]: "Invalid hash length",
  [MOVE_ERRORS.E_EMPTY_COMMITTEE]: "Committee cannot be empty",
  [MOVE_ERRORS.E_REQUIRED_DOCS_NOT_REVIEWED]: "Required documents not reviewed",
  [MOVE_ERRORS.E_COMPLIANCE_CHECK_FAILED]: "Compliance check failed",
  [MOVE_ERRORS.E_NO_IC_APPROVAL]: "No IC approval found",
  [MOVE_ERRORS.E_SELF_REVIEW]: "Cannot review own document",
  [MOVE_ERRORS.E_CANNOT_DEMOTE_OWNER]: "Cannot demote owner",
};
