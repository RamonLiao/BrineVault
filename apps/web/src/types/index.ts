// --- Role bitmask (matches Move contract values) ---
export const ROLE = {
  VIEWER: 1,
  REVIEWER: 2,
  EDITOR: 4,
  OWNER: 8,
  AUDITOR: 16,
  ORG_ADMIN: 32,
} as const;

export type RoleBitmask = number;

// --- Pool states (matches Move contract) ---
export type PoolState =
  | 'draft'
  | 'dd_in_progress'
  | 'ic_review'
  | 'approved_internal'
  | 'ready_to_issue'
  | 'rejected'
  | 'cancelled'
  | 'issued'
  | 'closed';

// --- Pool State Labels ---
export const POOL_STATE_LABELS: Record<PoolState, string> = {
  draft: 'Draft',
  dd_in_progress: 'DD In Progress',
  ic_review: 'IC Review',
  approved_internal: 'Approved (Internal)',
  ready_to_issue: 'Ready to Issue',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  issued: 'Issued',
  closed: 'Closed',
};

// --- Encryption scheme ---
export type EncryptionScheme = 'aes256' | 'seal_beta';

// --- Auth ---
export type AuthMethod = 'wallet' | 'zklogin';

export interface User {
  id: string;
  address: string;
  displayName: string | null;
  email: string | null;
  authMethod: AuthMethod;
}

export interface Organisation {
  id: string;
  name: string;
  legalName: string | null;
  billingPlan: 'free_trial' | 'pro' | 'enterprise';
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  authMethod: AuthMethod | null;
  currentOrg: Organisation | null;
  isAuthenticated: boolean;
}

export interface ZkLoginProof {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

// --- Pool ---
export interface Pool {
  id: string;
  name: string;
  borrowerName: string;
  currency: string;
  targetSize: string;
  currentState: PoolState;
  encryptionScheme: EncryptionScheme;
  expectedMaturity: string;
  memberCount: number;
  createdAt: string;
}

// --- Pool Detail Tab ---
export type PoolTab = 'vdr' | 'checklist' | 'reviews' | 'ic' | 'audit' | 'members';

// --- Document ---
export interface Document {
  id: string;
  poolId: string;
  folderId: number;
  title: string;
  docType: number;
  currentVersion: number;
  versionCount: number;
  requiredFlag: boolean;
  isArchived: boolean;
  visibleToRoles: number;
  encryptionScheme: number;
  tags: string[];
  createdBy: string;
  createdAt: string;
  lastUpdatedAt: string;
  approvalCount: number;
}

// --- API Error Envelope ---
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
