// ========== Document Types ==========
// Must match contracts/rwa_dataroom/sources/types.move exactly

export const DOC_TYPES = {
  FINANCIAL_STATEMENT: 0,
  LEGAL_AGREEMENT: 1,
  KYC_AML: 2,
  COLLATERAL: 3,
  VALUATION_REPORT: 4,
  INSURANCE: 5,
  CORPORATE_DOC: 6,
  TERM_SHEET: 7,
  IC_MEMO: 8,
  MISC: 9,
} as const;

export type DocType = (typeof DOC_TYPES)[keyof typeof DOC_TYPES];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  [DOC_TYPES.FINANCIAL_STATEMENT]: "Financial Statement",
  [DOC_TYPES.LEGAL_AGREEMENT]: "Legal Agreement",
  [DOC_TYPES.KYC_AML]: "KYC / AML",
  [DOC_TYPES.COLLATERAL]: "Collateral",
  [DOC_TYPES.VALUATION_REPORT]: "Valuation Report",
  [DOC_TYPES.INSURANCE]: "Insurance",
  [DOC_TYPES.CORPORATE_DOC]: "Corporate Document",
  [DOC_TYPES.TERM_SHEET]: "Term Sheet",
  [DOC_TYPES.IC_MEMO]: "IC Memo",
  [DOC_TYPES.MISC]: "Miscellaneous",
};

// ========== Review Status ==========

export const REVIEW_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  NEEDS_REVISION: 2,
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  [REVIEW_STATUS.PENDING]: "Pending",
  [REVIEW_STATUS.APPROVED]: "Approved",
  [REVIEW_STATUS.NEEDS_REVISION]: "Needs Revision",
};

// ========== Interfaces ==========

export interface Document {
  id: string;
  poolId: string;
  folderId: number;
  docType: DocType;
  title: string;
  currentVersion: number;
  versionCount: number;
  requiredFlag: boolean;
  isArchived: boolean;
  visibleToRoles: number;
  encryptionScheme: number;
  tags: string[];
  createdBy: string;
  createdAt: number;
  lastUpdatedAt: number;
  approvalCount: number;
}

export interface DocVersion {
  version: number;
  walrusBlobId: string;
  contentHash: string; // hex-encoded SHA-256
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: number;
  changeLog: string;
}

export interface ReviewRecord {
  reviewer: string;
  status: ReviewStatus;
  commentHash: string | null;
  reviewedAt: number;
}
