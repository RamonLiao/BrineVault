// ========== Standard API Envelope ==========

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorResponse {
  error: ApiError;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

// ========== TX Flow Types ==========

export interface UnsignedTxResponse {
  txBytes: string; // base64-encoded TransactionBlock bytes
}

export interface SignedTxRequest {
  signedTx: string; // base64-encoded signed TX
}

export interface TxResultResponse {
  txDigest: string;
}

// ========== Common API Request Types ==========

export interface CreatePoolRequest {
  name: string;
  orgIdHash: string;
  borrowerNameHash: string;
  currency: string;
  targetNotional: string; // string for bigint safety
  expectedMaturityDate: number;
  encryptionScheme: number;
  tags: string[];
}

export interface UploadDocumentRequest {
  folderId: number;
  docType: number;
  title: string;
  requiredFlag: boolean;
  visibleToRoles: number;
  walrusBlobId: string;
  contentHash: string;
  sizeBytes: number;
  changeLog: string;
}

export interface AddVersionRequest {
  walrusBlobId: string;
  contentHash: string;
  sizeBytes: number;
  changeLog: string;
}

export interface SubmitReviewRequest {
  status: number;
  commentHash?: string;
}

export interface SubmitICDecisionRequest {
  decisionType: number;
  decisionText: string;
  pdfBlobId: string;
  committee: string[];
  votes: number[];
  relatedDocIds: string[];
}

export interface AddMemberRequest {
  address: string;
  role: number;
  tags?: string[];
}

export interface UpdateRoleRequest {
  newRole: number;
}

export interface TransitionRequest {
  targetState: number;
}
