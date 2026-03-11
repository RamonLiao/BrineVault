# RWA Credit Data Room — REST API Specification

**Created:** 2026-03-11
**Status:** Draft
**Scope:** Phase 1 (v0–v1)

---

## Base URL

```
Production:  https://api.rwadataroom.io/v1
Development: http://localhost:4000/v1
```

## Authentication

All endpoints except `/auth/*` require:
```
Authorization: Bearer {access_token}
```

Mutation endpoints (POST/PATCH/DELETE) additionally require:
```
X-CSRF-Token: {csrf_token}
```

---

## Common Patterns

### Pagination

Query parameters:
- `page` (integer, default: 1) — page number
- `limit` (integer, default: 20, max: 100) — items per page

Response envelope:
```json
{
  "data": [...],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

### Filtering & Sorting

- Filter: `?state=DD_In_Progress&folder=Legal&doc_type=term_sheet`
- Sort: `?sort=created_at&order=desc` (default: `created_at` desc)
- Multiple sort: `?sort=state,created_at&order=asc,desc`

### Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of the error.",
    "details": {
      "field": "title",
      "reason": "must not be empty"
    }
  }
}
```

### HTTP Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful read or update |
| 201 | Created | Resource successfully created |
| 204 | No Content | Successful delete or logout |
| 400 | Bad Request | Validation error, malformed input |
| 401 | Unauthorized | Invalid or expired token |
| 403 | Forbidden | Insufficient role or permission |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Invalid state transition, duplicate |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server failure |
| 502 | Bad Gateway | Sui RPC or Walrus service unavailable |

### Rate Limits

| Endpoint Category | Limit | Scope |
|---|---|---|
| Auth endpoints | 5 req/min | per IP |
| Read endpoints | 100 req/min | per user |
| Write endpoints | 30 req/min | per user |
| Upload params | 10 req/min | per user |

Rate limit headers on every response:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 97
X-RateLimit-Reset: 1741681200
```

---

## Endpoints

---

### 1. Auth

#### `GET /auth/challenge`

Request a one-time nonce for wallet signature authentication.

**Auth required:** No

**Response `200`:**
```json
{
  "nonce": "a1b2c3d4e5f6789012345678",
  "timestamp": "2026-03-11T08:30:00.000Z",
  "expires_at": "2026-03-11T08:35:00.000Z"
}
```

---

#### `POST /auth/verify`

Verify wallet signature and issue JWT tokens.

**Auth required:** No

**Request:**
```json
{
  "address": "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
  "signature": "base64_encoded_signature_bytes",
  "nonce": "a1b2c3d4e5f6789012345678"
}
```

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJFZDI1NTE5...",
  "user": {
    "id": "01912345-6789-7abc-def0-123456789abc",
    "address": "0x1a2b...7890",
    "org_id": "01912345-0000-7abc-def0-000000000001",
    "org_role": "admin",
    "created_at": "2026-03-11T08:30:05.000Z",
    "last_login_at": "2026-03-11T08:30:05.000Z"
  }
}
```

The `refresh_token` is set via `Set-Cookie` header (httpOnly, Secure, SameSite=Strict), not in the response body.

**Errors:**
- `401 INVALID_SIGNATURE` — signature does not match address
- `401 NONCE_EXPIRED` — nonce expired or already used
- `429` — too many auth attempts

---

#### `POST /auth/refresh`

Refresh access token using refresh token cookie.

**Auth required:** No (uses cookie)

**Request:** Empty body. Refresh token is read from the `refresh_token` cookie.

**Response `200`:**
```json
{
  "access_token": "eyJhbGciOiJFZDI1NTE5..."
}
```

New refresh token set via `Set-Cookie` (rotation).

**Errors:**
- `401 INVALID_REFRESH_TOKEN` — token invalid, expired, or reused

---

#### `POST /auth/logout`

Invalidate current session.

**Auth required:** Yes

**Response:** `204 No Content`

Clears refresh token cookie and invalidates session in Redis.

---

### 2. Organizations

#### `POST /orgs`

Create a new organization. Caller becomes `org_admin`.

**Auth required:** Yes
**Precondition:** User must not already belong to an organization.

**Request:**
```json
{
  "name": "Maple Capital",
  "legal_name": "Maple Capital Pte. Ltd.",
  "jurisdiction": "SG"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | yes | 2–100 chars |
| `legal_name` | string | yes | 2–200 chars |
| `jurisdiction` | string | yes | ISO 3166-1 alpha-2 |

**Response `201`:**
```json
{
  "id": "01912345-0000-7abc-def0-000000000001",
  "name": "Maple Capital",
  "legal_name": "Maple Capital Pte. Ltd.",
  "jurisdiction": "SG",
  "owner_id": "01912345-6789-7abc-def0-123456789abc",
  "created_at": "2026-03-11T09:00:00.000Z"
}
```

**Errors:**
- `409 ALREADY_IN_ORG` — user already belongs to an organization

---

#### `GET /orgs/:orgId`

Get organization details.

**Auth required:** Yes
**Authorization:** Must be a member of the organization.

**Response `200`:**
```json
{
  "id": "01912345-0000-7abc-def0-000000000001",
  "name": "Maple Capital",
  "legal_name": "Maple Capital Pte. Ltd.",
  "jurisdiction": "SG",
  "owner_id": "01912345-6789-7abc-def0-123456789abc",
  "member_count": 8,
  "pool_count": 3,
  "subscription": {
    "plan": "professional",
    "expires_at": "2027-03-11T00:00:00.000Z"
  },
  "created_at": "2026-03-11T09:00:00.000Z"
}
```

---

#### `PATCH /orgs/:orgId`

Update organization metadata.

**Auth required:** Yes
**Authorization:** `org_admin` only.

**Request:**
```json
{
  "name": "Maple Capital Group",
  "legal_name": "Maple Capital Group Pte. Ltd."
}
```

All fields optional. Only provided fields are updated.

**Response `200`:** Updated organization object (same shape as GET).

---

#### `POST /orgs/:orgId/invite`

Generate an invite code for the organization.

**Auth required:** Yes
**Authorization:** `org_admin` only.

**Request:**
```json
{
  "role": "member",
  "max_uses": 5,
  "expires_in_hours": 72
}
```

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `role` | string | no | `member` | `member` or `admin` |
| `max_uses` | integer | no | 1 | 1–50 |
| `expires_in_hours` | integer | no | 48 | 1–720 (30 days) |

**Response `201`:**
```json
{
  "invite_code": "MAPLE-A3X9-K2M7",
  "expires_at": "2026-03-14T09:00:00.000Z",
  "max_uses": 5,
  "used_count": 0
}
```

---

#### `POST /orgs/join`

Join an organization using an invite code.

**Auth required:** Yes
**Precondition:** User must not already belong to an organization.

**Request:**
```json
{
  "invite_code": "MAPLE-A3X9-K2M7"
}
```

**Response `200`:**
```json
{
  "org_id": "01912345-0000-7abc-def0-000000000001",
  "org_name": "Maple Capital",
  "role": "member",
  "joined_at": "2026-03-11T09:05:00.000Z"
}
```

**Errors:**
- `404 INVALID_INVITE_CODE` — code not found, expired, or exhausted
- `409 ALREADY_IN_ORG` — user already belongs to an organization

---

#### `GET /orgs/:orgId/members`

List all members of the organization.

**Auth required:** Yes
**Authorization:** Must be a member of the organization.

**Query params:** Standard pagination.

**Response `200`:**
```json
{
  "data": [
    {
      "user_id": "01912345-6789-7abc-def0-123456789abc",
      "address": "0x1a2b...7890",
      "role": "admin",
      "joined_at": "2026-03-11T09:00:00.000Z",
      "last_active_at": "2026-03-11T10:30:00.000Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### 3. Pools

#### `POST /pools`

Create a new pool. Triggers a Sui transaction (user signs).

**Auth required:** Yes
**Authorization:** `org_admin` or `org_member` with pool creation rights.

**Request:**
```json
{
  "borrower_name": "Acme Corp",
  "currency": "USDC",
  "target_size": 5000000,
  "maturity_date": "2027-06-30",
  "description": "Senior secured term loan for working capital",
  "pool_type": "term_loan"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `borrower_name` | string | yes | 2–200 chars |
| `currency` | string | yes | `USDC`, `USDT`, `SUI` |
| `target_size` | number | yes | > 0 |
| `maturity_date` | string (ISO date) | yes | must be future date |
| `description` | string | no | max 2000 chars |
| `pool_type` | string | yes | `term_loan`, `revolving`, `bridge` |

**Response `201`:**
```json
{
  "id": "pool-uuid-v7",
  "sui_object_id": "0xabc123...def",
  "borrower_name": "Acme Corp",
  "currency": "USDC",
  "target_size": 5000000,
  "maturity_date": "2027-06-30",
  "state": "Draft",
  "encryption_scheme": "aes",
  "dataroom_id": "dr-uuid-v7",
  "org_id": "01912345-0000-7abc-def0-000000000001",
  "created_by": "0x1a2b...7890",
  "created_at": "2026-03-11T10:00:00.000Z",
  "tx_digest": "Abc123...",
  "requires_user_signature": true,
  "tx_bytes": "base64_encoded_transaction_block"
}
```

When `requires_user_signature` is `true`, the Frontend must prompt the user to sign `tx_bytes` with their wallet, then submit the signed transaction via `POST /pools/:poolId/submit-tx`.

---

#### `GET /pools`

List pools for the current user's organization.

**Auth required:** Yes

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `state` | string | Filter by pool state |
| `pool_type` | string | Filter by type |
| `search` | string | Full-text search on borrower_name, description |
| `sort` | string | `created_at`, `updated_at`, `borrower_name` |
| `order` | string | `asc`, `desc` |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "pool-uuid-v7",
      "sui_object_id": "0xabc123...def",
      "borrower_name": "Acme Corp",
      "currency": "USDC",
      "target_size": 5000000,
      "state": "DD_In_Progress",
      "encryption_scheme": "aes",
      "document_count": 12,
      "member_count": 5,
      "created_at": "2026-03-11T10:00:00.000Z",
      "updated_at": "2026-03-12T14:30:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

#### `GET /pools/:poolId`

Get full pool details (from DB cache, refreshed by event indexer).

**Auth required:** Yes
**Authorization:** Must be a member of the pool's dataroom.

**Response `200`:**
```json
{
  "id": "pool-uuid-v7",
  "sui_object_id": "0xabc123...def",
  "borrower_name": "Acme Corp",
  "currency": "USDC",
  "target_size": 5000000,
  "maturity_date": "2027-06-30",
  "description": "Senior secured term loan for working capital",
  "pool_type": "term_loan",
  "state": "DD_In_Progress",
  "encryption_scheme": "aes",
  "dataroom": {
    "id": "dr-uuid-v7",
    "sui_object_id": "0xdef456...789",
    "folder_count": 5,
    "document_count": 12
  },
  "org_id": "01912345-0000-7abc-def0-000000000001",
  "created_by": "0x1a2b...7890",
  "created_at": "2026-03-11T10:00:00.000Z",
  "updated_at": "2026-03-12T14:30:00.000Z"
}
```

---

#### `PATCH /pools/:poolId`

Update pool metadata (off-chain only, e.g., description).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "description": "Updated description",
  "target_size": 6000000
}
```

**Response `200`:** Updated pool object.

---

#### `POST /pools/:poolId/transitions`

Request a pool state transition. Returns transaction bytes for user to sign.

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "target_state": "DD_In_Progress"
}
```

Valid transitions:
```
Draft → DD_In_Progress
DD_In_Progress → IC_Review
IC_Review → Approved_Internal
Approved_Internal → Ready_To_Issue
```

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "current_state": "Draft",
  "target_state": "DD_In_Progress",
  "requires_user_signature": true,
  "checklist_status": {
    "met": true,
    "missing_items": []
  }
}
```

If `checklist_status.met` is `false`, the transition is blocked:
```json
{
  "error": {
    "code": "GATE_CONDITIONS_NOT_MET",
    "message": "Cannot transition to IC_Review. Missing required documents.",
    "details": {
      "missing_items": [
        "Legal/Term Sheet (status: NotReviewed)",
        "Financials/Audited Statements (not uploaded)"
      ]
    }
  }
}
```

After receiving `tx_bytes`, Frontend signs with user wallet and submits:

```
POST /pools/:poolId/submit-tx

{
  "tx_bytes": "base64_signed_transaction",
  "signature": "base64_signature"
}
```

**Response `200`:**
```json
{
  "tx_digest": "Abc123...",
  "new_state": "DD_In_Progress",
  "timestamp": "2026-03-11T10:05:00.000Z"
}
```

---

#### `POST /pools/:poolId/cancel`

Cancel a pool (only from `Draft` state).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Response `200`:**
```json
{
  "id": "pool-uuid-v7",
  "state": "Cancelled",
  "cancelled_at": "2026-03-11T10:10:00.000Z"
}
```

**Errors:**
- `409 INVALID_STATE_TRANSITION` — pool is not in `Draft` state

---

#### `GET /pools/:poolId/audit-log`

Get audit trail events for a pool.

**Auth required:** Yes
**Authorization:** Pool member.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `event_type` | string | `state_change`, `member_change`, `document_upload`, `review`, `decision` |
| `actor` | string | Filter by wallet address |
| `from` | string (ISO datetime) | Start date |
| `to` | string (ISO datetime) | End date |
| `page`, `limit` | integer | Pagination |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "event-uuid-v7",
      "event_type": "state_change",
      "actor": "0x1a2b...7890",
      "description": "Pool state changed from Draft to DD_In_Progress",
      "metadata": {
        "from_state": "Draft",
        "to_state": "DD_In_Progress"
      },
      "tx_digest": "Abc123...",
      "created_at": "2026-03-11T10:05:00.000Z"
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20, "total_pages": 3 }
}
```

---

#### `GET /pools/:poolId/checklist`

Get the DD checklist with completion status.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "pool_id": "pool-uuid-v7",
  "current_state": "DD_In_Progress",
  "items": [
    {
      "id": "cl-item-001",
      "category": "Legal",
      "title": "Term Sheet",
      "required": true,
      "status": "completed",
      "document_id": "doc-uuid-v7",
      "document_state": "Reviewed"
    },
    {
      "id": "cl-item-002",
      "category": "Financials",
      "title": "Audited Financial Statements (3 years)",
      "required": true,
      "status": "pending",
      "document_id": null,
      "document_state": null
    },
    {
      "id": "cl-item-003",
      "category": "Collateral",
      "title": "Collateral Valuation Report",
      "required": false,
      "status": "not_started",
      "document_id": null,
      "document_state": null
    }
  ],
  "summary": {
    "total": 15,
    "completed": 8,
    "pending": 4,
    "not_started": 3,
    "required_completed": 6,
    "required_total": 10
  }
}
```

---

### 4. Data Room Members

#### `POST /pools/:poolId/members`

Add a member to the pool's dataroom. Triggers a Sui transaction (user signs).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "address": "0xnew_member_address...",
  "role": "reviewer",
  "name": "Jane Doe"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `address` | string | yes | Valid Sui address |
| `role` | string | yes | `owner`, `editor`, `reviewer`, `viewer` |
| `name` | string | no | Display name, max 100 chars |

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "requires_user_signature": true,
  "member": {
    "address": "0xnew_member_address...",
    "role": "reviewer",
    "name": "Jane Doe"
  }
}
```

After user signs and submits the transaction, the member is added on-chain and indexed to DB.

---

#### `DELETE /pools/:poolId/members/:address`

Remove a member from the dataroom. Triggers key rotation for affected folders.

**Auth required:** Yes
**Authorization:** Pool Owner.

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "requires_user_signature": true,
  "removed_address": "0xremoved_member...",
  "affected_folders": ["Legal", "Financials"],
  "key_rotation_required": true
}
```

After the member removal tx is confirmed, the Frontend must:
1. Re-generate folder keys for affected folders
2. Re-encrypt folder keys for remaining members
3. Call `POST /pools/:poolId/folders/:folderId/keys` to store updated keys

---

#### `PATCH /pools/:poolId/members/:address`

Update a member's role. Triggers a Sui transaction (user signs).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "role": "editor"
}
```

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "requires_user_signature": true,
  "member": {
    "address": "0xmember_address...",
    "new_role": "editor",
    "previous_role": "viewer"
  }
}
```

---

#### `GET /pools/:poolId/members`

List all dataroom members.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "data": [
    {
      "address": "0x1a2b...7890",
      "role": "owner",
      "name": "John Smith",
      "added_at": "2026-03-11T10:00:00.000Z",
      "added_by": "0x1a2b...7890"
    },
    {
      "address": "0x9f8e...1234",
      "role": "reviewer",
      "name": "Jane Doe",
      "added_at": "2026-03-11T11:00:00.000Z",
      "added_by": "0x1a2b...7890"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### 5. Folders

#### `POST /pools/:poolId/folders`

Create a custom folder in the dataroom.

**Auth required:** Yes
**Authorization:** Pool Owner or Editor.

**Request:**
```json
{
  "name": "Insurance",
  "parent_folder_id": null
}
```

**Response `201`:**
```json
{
  "id": "folder-uuid-v7",
  "name": "Insurance",
  "parent_folder_id": null,
  "pool_id": "pool-uuid-v7",
  "document_count": 0,
  "created_at": "2026-03-11T11:00:00.000Z"
}
```

---

#### `GET /pools/:poolId/folders`

List all folders in the dataroom.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "folder-001",
      "name": "Legal",
      "parent_folder_id": null,
      "is_default": true,
      "document_count": 4,
      "created_at": "2026-03-11T10:00:00.000Z"
    },
    {
      "id": "folder-002",
      "name": "Financials",
      "parent_folder_id": null,
      "is_default": true,
      "document_count": 3,
      "created_at": "2026-03-11T10:00:00.000Z"
    },
    {
      "id": "folder-003",
      "name": "Collateral",
      "parent_folder_id": null,
      "is_default": true,
      "document_count": 2,
      "created_at": "2026-03-11T10:00:00.000Z"
    },
    {
      "id": "folder-004",
      "name": "Reports",
      "parent_folder_id": null,
      "is_default": true,
      "document_count": 1,
      "created_at": "2026-03-11T10:00:00.000Z"
    },
    {
      "id": "folder-005",
      "name": "Misc",
      "parent_folder_id": null,
      "is_default": true,
      "document_count": 2,
      "created_at": "2026-03-11T10:00:00.000Z"
    },
    {
      "id": "folder-006",
      "name": "Insurance",
      "parent_folder_id": null,
      "is_default": false,
      "document_count": 0,
      "created_at": "2026-03-11T11:00:00.000Z"
    }
  ],
  "meta": { "total": 6, "page": 1, "limit": 20, "total_pages": 1 }
}
```

Default folders (created automatically with each pool): `Legal`, `Financials`, `Collateral`, `Reports`, `Misc`.

---

### 6. Documents

#### `POST /pools/:poolId/documents`

Create document metadata on-chain. Backend-sponsored transaction.

**Important:** The file itself is uploaded DIRECTLY to Walrus by the Frontend. This endpoint only records metadata.

**Auth required:** Yes
**Authorization:** Pool Owner or Editor.

**Request:**
```json
{
  "folder_id": "folder-001",
  "doc_type": "term_sheet",
  "title": "Acme Corp Term Sheet v1.0",
  "required_flag": true,
  "walrus_blob_id": "walrus_blob_abc123...",
  "content_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 245760,
  "mime_type": "application/pdf",
  "encryption_scheme": "aes",
  "encrypted_metadata": {
    "original_filename": "term_sheet_acme_v1.pdf"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `folder_id` | string | yes | Target folder |
| `doc_type` | string | yes | `term_sheet`, `financials`, `collateral_report`, `legal_opinion`, `kyc`, `insurance`, `other` |
| `title` | string | yes | Document title, 2–200 chars |
| `required_flag` | boolean | no | Whether this doc is required for DD checklist (default: false) |
| `walrus_blob_id` | string | yes | Blob ID returned by Walrus after upload |
| `content_hash` | string | yes | `sha256:{hex}` — hash of the plaintext file before encryption |
| `size_bytes` | integer | yes | File size in bytes |
| `mime_type` | string | no | MIME type |
| `encryption_scheme` | string | no | `aes` or `seal` (default: pool's scheme) |
| `encrypted_metadata` | object | no | Additional metadata (encrypted at rest) |

**Response `201`:**
```json
{
  "id": "doc-uuid-v7",
  "sui_object_id": "0xdoc123...456",
  "folder_id": "folder-001",
  "doc_type": "term_sheet",
  "title": "Acme Corp Term Sheet v1.0",
  "version": 1,
  "review_state": "NotReviewed",
  "walrus_blob_id": "walrus_blob_abc123...",
  "content_hash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "size_bytes": 245760,
  "uploaded_by": "0x1a2b...7890",
  "tx_digest": "Xyz789...",
  "created_at": "2026-03-11T11:30:00.000Z"
}
```

---

#### `GET /pools/:poolId/documents`

List documents in the dataroom.

**Auth required:** Yes
**Authorization:** Pool member (filtered by role-based folder access).

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `folder_id` | string | Filter by folder |
| `doc_type` | string | Filter by document type |
| `review_state` | string | `NotReviewed`, `InReview`, `Reviewed`, `NeedsRevision` |
| `search` | string | Full-text search on title |
| `sort` | string | `created_at`, `updated_at`, `title` |
| `order` | string | `asc`, `desc` |
| `page`, `limit` | integer | Pagination |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "doc-uuid-v7",
      "sui_object_id": "0xdoc123...456",
      "folder_id": "folder-001",
      "folder_name": "Legal",
      "doc_type": "term_sheet",
      "title": "Acme Corp Term Sheet v1.0",
      "version": 2,
      "review_state": "Reviewed",
      "size_bytes": 245760,
      "mime_type": "application/pdf",
      "uploaded_by": "0x1a2b...7890",
      "reviewed_by": "0x9f8e...1234",
      "created_at": "2026-03-11T11:30:00.000Z",
      "updated_at": "2026-03-12T09:00:00.000Z"
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

#### `GET /pools/:poolId/documents/:docId`

Get document details including version history.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "id": "doc-uuid-v7",
  "sui_object_id": "0xdoc123...456",
  "folder_id": "folder-001",
  "folder_name": "Legal",
  "doc_type": "term_sheet",
  "title": "Acme Corp Term Sheet v1.0",
  "required_flag": true,
  "current_version": 2,
  "review_state": "Reviewed",
  "encryption_scheme": "aes",
  "uploaded_by": "0x1a2b...7890",
  "created_at": "2026-03-11T11:30:00.000Z",
  "updated_at": "2026-03-12T09:00:00.000Z",
  "versions": [
    {
      "version": 2,
      "walrus_blob_id": "walrus_blob_def456...",
      "content_hash": "sha256:abc123...",
      "size_bytes": 256000,
      "uploaded_by": "0x1a2b...7890",
      "tx_digest": "Xyz789...",
      "created_at": "2026-03-12T09:00:00.000Z"
    },
    {
      "version": 1,
      "walrus_blob_id": "walrus_blob_abc123...",
      "content_hash": "sha256:e3b0c4...",
      "size_bytes": 245760,
      "uploaded_by": "0x1a2b...7890",
      "status": "Superseded",
      "tx_digest": "Abc123...",
      "created_at": "2026-03-11T11:30:00.000Z"
    }
  ],
  "reviews": [
    {
      "id": "review-uuid-v7",
      "reviewer": "0x9f8e...1234",
      "decision": "Reviewed",
      "comment": "LGTM. Terms are aligned with the mandate.",
      "version_reviewed": 2,
      "tx_digest": "Rev123...",
      "created_at": "2026-03-12T14:00:00.000Z"
    }
  ]
}
```

---

#### `POST /pools/:poolId/documents/:docId/versions`

Upload a new version of an existing document. Backend-sponsored transaction. File must already be uploaded to Walrus.

**Auth required:** Yes
**Authorization:** Pool Owner or Editor.

**Request:**
```json
{
  "walrus_blob_id": "walrus_blob_def456...",
  "content_hash": "sha256:abc123...",
  "size_bytes": 256000,
  "change_note": "Updated interest rate schedule per IC feedback"
}
```

**Response `201`:**
```json
{
  "id": "doc-uuid-v7",
  "new_version": 3,
  "walrus_blob_id": "walrus_blob_def456...",
  "review_state": "NotReviewed",
  "tx_digest": "NewVer123...",
  "created_at": "2026-03-13T08:00:00.000Z"
}
```

Note: Adding a new version resets `review_state` to `NotReviewed`.

---

#### `POST /pools/:poolId/documents/:docId/reviews`

Submit a review for a document. Triggers a Sui transaction (user signs).

**Auth required:** Yes
**Authorization:** Reviewer or Pool Owner.

**Request:**
```json
{
  "decision": "Reviewed",
  "comment": "Confirmed. All terms are compliant.",
  "version_reviewed": 2
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `decision` | string | yes | `Reviewed`, `NeedsRevision` |
| `comment` | string | no | max 2000 chars |
| `version_reviewed` | integer | yes | Must match current version |

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "requires_user_signature": true,
  "review": {
    "id": "review-uuid-v7",
    "decision": "Reviewed",
    "version_reviewed": 2
  }
}
```

---

#### `POST /pools/:poolId/documents/:docId/archive`

Archive a document (soft delete).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Response `200`:**
```json
{
  "id": "doc-uuid-v7",
  "archived": true,
  "archived_at": "2026-03-13T10:00:00.000Z",
  "archived_by": "0x1a2b...7890"
}
```

---

#### `GET /pools/:poolId/documents/:docId/activity`

Get activity log for a specific document.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "act-uuid-v7",
      "action": "version_added",
      "actor": "0x1a2b...7890",
      "description": "Version 2 uploaded",
      "metadata": { "version": 2, "change_note": "Updated rates" },
      "tx_digest": "Xyz789...",
      "created_at": "2026-03-12T09:00:00.000Z"
    },
    {
      "id": "act-uuid-v8",
      "action": "review_submitted",
      "actor": "0x9f8e...1234",
      "description": "Document reviewed (Reviewed)",
      "metadata": { "decision": "Reviewed", "version": 2 },
      "tx_digest": "Rev123...",
      "created_at": "2026-03-12T14:00:00.000Z"
    }
  ],
  "meta": { "total": 5, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### 7. IC Decisions

#### `POST /pools/:poolId/decisions`

Record an IC (Investment Committee) decision. Triggers a Sui transaction (user signs).

**Auth required:** Yes
**Authorization:** Pool Owner or designated IC member.

**Request:**
```json
{
  "decision_type": "Approve",
  "summary": "IC unanimously approved the transaction. Conditions: quarterly reporting.",
  "decision_document_blob_id": "walrus_blob_decision_001...",
  "decision_document_hash": "sha256:dec1s10n..."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `decision_type` | string | yes | `Approve`, `Reject`, `RequestChanges` |
| `summary` | string | yes | max 5000 chars |
| `decision_document_blob_id` | string | no | Walrus blob ID for signed PDF |
| `decision_document_hash` | string | no | SHA-256 hash of the PDF |

**Response `200`:**
```json
{
  "tx_bytes": "base64_encoded_transaction_block",
  "requires_user_signature": true,
  "decision": {
    "id": "decision-uuid-v7",
    "decision_type": "Approve",
    "summary": "IC unanimously approved the transaction. Conditions: quarterly reporting.",
    "decided_by": "0x1a2b...7890"
  }
}
```

---

#### `GET /pools/:poolId/decisions`

List all IC decisions for a pool.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "decision-uuid-v7",
      "sui_object_id": "0xdecision...",
      "decision_type": "Approve",
      "summary": "IC unanimously approved the transaction.",
      "decided_by": "0x1a2b...7890",
      "decision_document_blob_id": "walrus_blob_decision_001...",
      "tx_digest": "Dec123...",
      "created_at": "2026-03-14T16:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

### 8. DD Checklist

#### `PATCH /pools/:poolId/checklist`

Customize checklist items (add, remove, or modify required status).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "add": [
    {
      "category": "Insurance",
      "title": "Directors & Officers Insurance",
      "required": true
    }
  ],
  "update": [
    {
      "id": "cl-item-003",
      "required": true
    }
  ],
  "remove": ["cl-item-010"]
}
```

**Response `200`:** Full checklist (same format as `GET /pools/:poolId/checklist`).

---

#### `GET /pools/:poolId/checklist/gate-status`

Check if gate conditions are met for the next state transition.

**Auth required:** Yes
**Authorization:** Pool member.

**Response `200`:**
```json
{
  "pool_id": "pool-uuid-v7",
  "current_state": "DD_In_Progress",
  "next_state": "IC_Review",
  "gate_met": false,
  "conditions": [
    {
      "type": "required_documents_reviewed",
      "met": false,
      "detail": "8 of 10 required documents reviewed"
    },
    {
      "type": "no_documents_need_revision",
      "met": true,
      "detail": "No documents in NeedsRevision state"
    },
    {
      "type": "minimum_members",
      "met": true,
      "detail": "5 members (minimum: 2)"
    }
  ]
}
```

---

### 9. Walrus Integration

#### `GET /pools/:poolId/upload-params`

Get parameters for direct upload to Walrus. Frontend uses these to upload files directly.

**Auth required:** Yes
**Authorization:** Pool Owner or Editor.

**Response `200`:**
```json
{
  "publisher_url": "https://walrus-publisher.example.com",
  "namespace": "rwa-dataroom",
  "max_file_size_bytes": 104857600,
  "allowed_mime_types": [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ],
  "upload_instructions": {
    "method": "PUT",
    "url": "https://walrus-publisher.example.com/v1/blobs",
    "headers": {
      "Content-Type": "application/octet-stream"
    },
    "note": "Upload the ENCRYPTED file bytes. Do NOT upload plaintext."
  }
}
```

---

#### `GET /pools/:poolId/download-params/:blobId`

Get download URL for a Walrus blob. Actual decryption happens client-side.

**Auth required:** Yes
**Authorization:** Pool member with folder access.

**Response `200`:**
```json
{
  "blob_id": "walrus_blob_abc123...",
  "download_url": "https://walrus-aggregator.example.com/v1/blobs/walrus_blob_abc123...",
  "encryption_scheme": "aes",
  "expires_at": "2026-03-11T12:30:00.000Z"
}
```

The Frontend must:
1. Fetch the encrypted blob from `download_url`
2. Retrieve the folder's decryption key (see Encryption Keys endpoints)
3. Decrypt client-side using AES-256-GCM (or Seal, depending on `encryption_scheme`)

---

### 10. Encryption Keys

#### `GET /pools/:poolId/folders/:folderId/key`

Get the encrypted folder key for the current user. The AES folder key is encrypted with the requesting user's public key. Backend fetches from Sui dynamic field — it does NOT decrypt it.

**Auth required:** Yes
**Authorization:** Pool member with access to the folder.

**Response `200`:**
```json
{
  "folder_id": "folder-001",
  "encrypted_key": "base64_encrypted_aes_key_for_this_user...",
  "encrypted_with": "user_public_key",
  "key_version": 3,
  "algorithm": "AES-256-GCM"
}
```

**Errors:**
- `403 NO_FOLDER_ACCESS` — user does not have access to this folder

---

#### `POST /pools/:poolId/folders/:folderId/keys`

Store encrypted folder keys for members. Called after key rotation (e.g., when a member is removed).

**Auth required:** Yes
**Authorization:** Pool Owner.

**Request:**
```json
{
  "key_version": 4,
  "member_keys": [
    {
      "address": "0x1a2b...7890",
      "encrypted_key": "base64_key_encrypted_with_member1_pubkey..."
    },
    {
      "address": "0x9f8e...1234",
      "encrypted_key": "base64_key_encrypted_with_member2_pubkey..."
    }
  ]
}
```

**Response `201`:**
```json
{
  "folder_id": "folder-001",
  "key_version": 4,
  "members_updated": 2,
  "tx_digest": "KeyRot123..."
}
```

---

### 11. Notifications

#### `GET /notifications`

List notifications for the current user.

**Auth required:** Yes

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `read` | boolean | Filter by read status |
| `type` | string | `state_change`, `document_uploaded`, `review_requested`, `member_added`, `decision`, `system` |
| `page`, `limit` | integer | Pagination |

**Response `200`:**
```json
{
  "data": [
    {
      "id": "notif-uuid-v7",
      "type": "review_requested",
      "title": "Review requested: Acme Corp Term Sheet",
      "body": "John Smith uploaded a new version of Term Sheet and requested your review.",
      "pool_id": "pool-uuid-v7",
      "document_id": "doc-uuid-v7",
      "read": false,
      "created_at": "2026-03-12T09:05:00.000Z"
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20, "total_pages": 1 },
  "unread_count": 5
}
```

---

#### `PATCH /notifications/:id/read`

Mark a notification as read.

**Auth required:** Yes

**Response `200`:**
```json
{
  "id": "notif-uuid-v7",
  "read": true,
  "read_at": "2026-03-12T10:00:00.000Z"
}
```

---

#### `GET /notifications/preferences`

Get notification preferences.

**Auth required:** Yes

**Response `200`:**
```json
{
  "email_enabled": true,
  "push_enabled": false,
  "preferences": {
    "state_change": { "in_app": true, "email": true },
    "document_uploaded": { "in_app": true, "email": false },
    "review_requested": { "in_app": true, "email": true },
    "member_added": { "in_app": true, "email": false },
    "decision": { "in_app": true, "email": true },
    "system": { "in_app": true, "email": true }
  }
}
```

---

#### `PATCH /notifications/preferences`

Update notification preferences.

**Auth required:** Yes

**Request:**
```json
{
  "preferences": {
    "document_uploaded": { "in_app": true, "email": true }
  }
}
```

**Response `200`:** Full preferences object (same format as GET).

---

#### WebSocket: Real-time Notifications

**URL:** `wss://api.rwadataroom.io/ws`

**Connection:**
```javascript
const ws = new WebSocket('wss://api.rwadataroom.io/ws', {
  headers: { Authorization: `Bearer ${accessToken}` }
});
```

**Message format (server → client):**
```json
{
  "type": "notification",
  "payload": {
    "id": "notif-uuid-v7",
    "type": "review_requested",
    "title": "Review requested: Acme Corp Term Sheet",
    "pool_id": "pool-uuid-v7",
    "created_at": "2026-03-12T09:05:00.000Z"
  }
}
```

**Heartbeat:**
- Server sends `ping` every 30 seconds
- Client must respond with `pong` within 10 seconds
- Connection closed after 3 missed pongs

---

### 12. Subscription & Billing

#### `GET /orgs/:orgId/subscription`

Get current subscription details.

**Auth required:** Yes
**Authorization:** Org member.

**Response `200`:**
```json
{
  "org_id": "01912345-0000-7abc-def0-000000000001",
  "plan": "professional",
  "status": "active",
  "max_pools": 10,
  "max_storage_gb": 50,
  "current_pool_count": 3,
  "current_storage_gb": 8.5,
  "started_at": "2026-03-11T00:00:00.000Z",
  "expires_at": "2027-03-11T00:00:00.000Z",
  "auto_renew": true
}
```

---

#### `POST /orgs/:orgId/subscription/renew`

Renew subscription.

**Auth required:** Yes
**Authorization:** `org_admin` only.

**Request:**
```json
{
  "plan": "professional",
  "duration_months": 12,
  "payment_method": "invoice"
}
```

**Response `200`:**
```json
{
  "org_id": "01912345-0000-7abc-def0-000000000001",
  "plan": "professional",
  "new_expires_at": "2028-03-11T00:00:00.000Z",
  "invoice_id": "inv-uuid-v7",
  "amount": 12000,
  "currency": "USD"
}
```

---

#### `GET /orgs/:orgId/invoices`

Get invoice history.

**Auth required:** Yes
**Authorization:** `org_admin` only.

**Query params:** Standard pagination.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "inv-uuid-v7",
      "amount": 12000,
      "currency": "USD",
      "status": "paid",
      "description": "Professional Plan — 12 months",
      "issued_at": "2026-03-11T00:00:00.000Z",
      "paid_at": "2026-03-11T00:05:00.000Z",
      "pdf_url": "/orgs/01912345.../invoices/inv-uuid-v7/pdf"
    }
  ],
  "meta": { "total": 2, "page": 1, "limit": 20, "total_pages": 1 }
}
```

---

## Appendix A: Endpoint Summary

| Method | Path | Auth | Signer | Description |
|--------|------|------|--------|-------------|
| `GET` | `/auth/challenge` | No | — | Request auth nonce |
| `POST` | `/auth/verify` | No | — | Verify wallet signature |
| `POST` | `/auth/refresh` | Cookie | — | Refresh access token |
| `POST` | `/auth/logout` | Yes | — | Invalidate session |
| `POST` | `/orgs` | Yes | — | Create organization |
| `GET` | `/orgs/:orgId` | Yes | — | Get organization |
| `PATCH` | `/orgs/:orgId` | Yes | — | Update organization |
| `POST` | `/orgs/:orgId/invite` | Yes | — | Generate invite code |
| `POST` | `/orgs/join` | Yes | — | Join organization |
| `GET` | `/orgs/:orgId/members` | Yes | — | List org members |
| `POST` | `/pools` | Yes | User | Create pool |
| `GET` | `/pools` | Yes | — | List pools |
| `GET` | `/pools/:poolId` | Yes | — | Get pool details |
| `PATCH` | `/pools/:poolId` | Yes | — | Update pool metadata |
| `POST` | `/pools/:poolId/transitions` | Yes | User | State transition |
| `POST` | `/pools/:poolId/cancel` | Yes | User | Cancel pool |
| `GET` | `/pools/:poolId/audit-log` | Yes | — | Audit trail |
| `GET` | `/pools/:poolId/checklist` | Yes | — | DD checklist |
| `PATCH` | `/pools/:poolId/checklist` | Yes | — | Customize checklist |
| `GET` | `/pools/:poolId/checklist/gate-status` | Yes | — | Gate check |
| `GET` | `/pools/:poolId/dataroom` | Yes | — | Dataroom details |
| `POST` | `/pools/:poolId/members` | Yes | User | Add member |
| `DELETE` | `/pools/:poolId/members/:address` | Yes | User | Remove member |
| `PATCH` | `/pools/:poolId/members/:address` | Yes | User | Update member role |
| `GET` | `/pools/:poolId/members` | Yes | — | List members |
| `POST` | `/pools/:poolId/documents` | Yes | Backend | Create doc metadata |
| `GET` | `/pools/:poolId/documents` | Yes | — | List documents |
| `GET` | `/pools/:poolId/documents/:docId` | Yes | — | Document details |
| `POST` | `/pools/:poolId/documents/:docId/versions` | Yes | Backend | Add version |
| `POST` | `/pools/:poolId/documents/:docId/reviews` | Yes | User | Submit review |
| `POST` | `/pools/:poolId/documents/:docId/archive` | Yes | — | Archive document |
| `GET` | `/pools/:poolId/documents/:docId/activity` | Yes | — | Document activity |
| `POST` | `/pools/:poolId/folders` | Yes | — | Create folder |
| `GET` | `/pools/:poolId/folders` | Yes | — | List folders |
| `POST` | `/pools/:poolId/decisions` | Yes | User | IC decision |
| `GET` | `/pools/:poolId/decisions` | Yes | — | List decisions |
| `GET` | `/pools/:poolId/upload-params` | Yes | — | Walrus upload params |
| `GET` | `/pools/:poolId/download-params/:blobId` | Yes | — | Walrus download URL |
| `GET` | `/pools/:poolId/folders/:folderId/key` | Yes | — | Get encrypted folder key |
| `POST` | `/pools/:poolId/folders/:folderId/keys` | Yes | — | Store rotated keys |
| `GET` | `/notifications` | Yes | — | List notifications |
| `PATCH` | `/notifications/:id/read` | Yes | — | Mark as read |
| `GET` | `/notifications/preferences` | Yes | — | Get preferences |
| `PATCH` | `/notifications/preferences` | Yes | — | Update preferences |
| `GET` | `/orgs/:orgId/subscription` | Yes | — | Subscription details |
| `POST` | `/orgs/:orgId/subscription/renew` | Yes | — | Renew subscription |
| `GET` | `/orgs/:orgId/invoices` | Yes | — | Invoice history |

---

## Appendix B: Sui Transaction Submission Pattern

For endpoints that return `requires_user_signature: true`, the Frontend follows this pattern:

```
1. Call API endpoint → receive { tx_bytes }
2. Wallet signs tx_bytes → signature
3. POST /pools/:poolId/submit-tx { tx_bytes, signature }
4. Backend submits to Sui RPC → returns { tx_digest }
5. Event indexer picks up on-chain event → updates DB
```

Generic transaction submission endpoint:

```
POST /pools/:poolId/submit-tx

Request:
{
  "tx_bytes": "base64_encoded_signed_transaction",
  "signature": "base64_signature"
}

Response 200:
{
  "tx_digest": "Abc123...",
  "status": "success",
  "timestamp": "2026-03-11T10:05:00.000Z"
}

Errors:
- 400 INVALID_TRANSACTION — malformed or tampered tx
- 502 SUI_EXECUTION_FAILED — on-chain execution failed (includes Move abort code)
```
