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
  | 'cancelled';

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

// --- API Error Envelope ---
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
