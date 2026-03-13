# RWA Credit Data Room — Implementation Architecture

**Version:** 1.0
**Date:** 2026-03-13
**Purpose:** Module boundaries, dependency DAG, interface contracts, and deployment topology — optimised for parallel AI agent execution.

**Prerequisite reading:** `specs/system-architecture.md` (consolidated spec)

---

## Table of Contents

1. [System Decomposition](#1-system-decomposition)
2. [Dependency DAG](#2-dependency-dag)
3. [Module Specifications](#3-module-specifications)
4. [Interface Contracts](#4-interface-contracts)
5. [Shared Types & Constants](#5-shared-types--constants)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Agent Work Stream Guide](#7-agent-work-stream-guide)

---

## 1. System Decomposition

The system is decomposed into **8 modules** with clearly defined boundaries. Each module has a single owner (one AI agent), well-defined inputs/outputs, and can be developed and tested independently.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Module Dependency DAG                          │
│                                                                  │
│                    ┌──────────────┐                              │
│                    │  M0: Shared  │                              │
│                    │   Types &    │                              │
│                    │  Constants   │                              │
│                    └──────┬───────┘                              │
│                           │                                      │
│            ┌──────────────┼──────────────┐                      │
│            │              │              │                      │
│            ▼              ▼              ▼                      │
│   ┌──────────────┐ ┌──────────┐ ┌──────────────┐              │
│   │ M1: Move     │ │ M2: DB   │ │ M3: Encrypt  │              │
│   │ Contracts    │ │ Schema & │ │ SDK          │              │
│   │ (DONE ✅)    │ │ Indexer  │ │              │              │
│   └──────┬───────┘ └────┬─────┘ └──────┬───────┘              │
│          │              │              │                      │
│          │         ┌────┴────┐         │                      │
│          │         │         │         │                      │
│          ▼         ▼         │         ▼                      │
│   ┌──────────────────┐      │  ┌──────────────┐              │
│   │ M4: Backend API  │      │  │ M5: Walrus   │              │
│   │ (NestJS)         │◄─────┘  │ SDK          │              │
│   └──────┬───────────┘         └──────┬───────┘              │
│          │                            │                      │
│          │         ┌──────────────────┘                      │
│          │         │                                         │
│          ▼         ▼                                         │
│   ┌──────────────────┐                                      │
│   │ M6: Frontend     │                                      │
│   │ (Next.js)        │                                      │
│   └──────┬───────────┘                                      │
│          │                                                   │
│          ▼                                                   │
│   ┌──────────────────┐                                      │
│   │ M7: Integration  │                                      │
│   │ & E2E Tests      │                                      │
│   └──────────────────┘                                      │
│                                                              │
│   ┌──────────────────┐  (independent, parallel throughout)  │
│   │ M8: DevOps &     │                                      │
│   │ Infrastructure   │                                      │
│   └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Dependency DAG

### Build Order (topological sort)

```
Phase 0 (Foundation):     M0 (Shared Types)
Phase 1 (Parallel):       M1 (Move ✅), M2 (DB+Indexer), M3 (Encryption SDK), M5 (Walrus SDK), M8 (DevOps)
Phase 2 (Parallel):       M4 (Backend API — depends on M2)
Phase 3 (Parallel):       M6 (Frontend — depends on M3, M4, M5)
Phase 4 (Sequential):     M7 (Integration — depends on all)
```

### Dependency Matrix

| Module | Depends On | Depended By |
|--------|-----------|-------------|
| M0: Shared Types | — | All modules |
| M1: Move Contracts | M0 | M2 (events), M4 (TX building), M6 (dApp Kit) |
| M2: DB Schema + Indexer | M0, M1 (events) | M4 |
| M3: Encryption SDK | M0 | M5, M6 |
| M4: Backend API | M0, M2 | M6, M7 |
| M5: Walrus SDK | M0, M3 | M6 |
| M6: Frontend | M0, M3, M4, M5 | M7 |
| M7: Integration Tests | All | — |
| M8: DevOps | — | M4, M6 (deployment) |

### Critical Path

```
M0 → M2 → M4 → M6 → M7
```

Modules M3, M5, M8 can run fully in parallel with M2, shortening the overall timeline.

---

## 3. Module Specifications

### M0: Shared Types & Constants

**Owner:** Foundation agent (first to run)
**Location:** `packages/shared/` (TypeScript package)
**Duration:** ~1 session

**Deliverables:**
- TypeScript type definitions shared across frontend, backend, and SDK
- Constants matching Move contract values exactly
- Zod schemas for runtime validation

**Key files:**
```
packages/shared/
├── src/
│   ├── types/
│   │   ├── pool.ts          — PoolState enum, Pool type
│   │   ├── dataroom.ts      — DataRoom, Folder, Member types
│   │   ├── document.ts      — Document, DocVersion, ReviewStatus types
│   │   ├── ic-decision.ts   — ICDecision, DecisionType types
│   │   ├── roles.ts         — Role bitmask constants and helpers
│   │   ├── encryption.ts    — EncryptionScheme enum
│   │   ├── checklist.ts     — ChecklistItem, ChecklistStatus types
│   │   ├── audit.ts         — AuditEventType enum, AuditEvent type
│   │   ├── auth.ts          — JWT payload, session types
│   │   ├── api.ts           — API request/response types, error envelope
│   │   └── index.ts         — Re-exports
│   ├── constants/
│   │   ├── move.ts          — Package ID, module names, function names
│   │   ├── errors.ts        — Error code constants (matching Move)
│   │   ├── events.ts        — Event type strings (matching Move)
│   │   └── config.ts        — Default folders, checklist templates
│   ├── validation/
│   │   └── schemas.ts       — Zod schemas for all API payloads
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Interface contract:**
- All types are pure TypeScript interfaces (no runtime dependencies)
- Constants are `as const` objects
- Zod schemas are optional runtime validators
- Package is published to workspace as `@rwa-dataroom/shared`

---

### M1: Move Smart Contracts ✅ COMPLETED

**Status:** Done — 9 modules, 160 tests, commit `0109d4c`
**Location:** `contracts/rwa_dataroom/`

**What downstream modules need from M1:**
- Event struct definitions (for Indexer event mapping)
- Function signatures (for Backend TX building)
- Object IDs after deployment (for config)
- Error codes (for error handling)

**Generated artefacts for downstream:**
- ABI/move JSON: `contracts/rwa_dataroom/build/rwa_dataroom/`
- Event types: see `sources/events.move`
- Error codes: see `sources/errors.move`
- Constants: see `sources/types.move`

---

### M2: Database Schema + Event Indexer

**Owner:** Backend infrastructure agent
**Location:** `packages/db/` (schema + migrations), `apps/indexer/` (worker)
**Dependencies:** M0 (types), M1 (event definitions)
**Duration:** ~2–3 sessions

**Deliverables:**

1. **PostgreSQL schema migrations** (using Drizzle ORM or Prisma)
   - 20 tables as specified in system-architecture.md §7
   - Migration files in creation order (respecting FK dependencies)
   - Seed data for development (checklist templates, test org)

2. **Event Indexer worker**
   - Standalone Node.js process
   - Connects to Sui Full Node via gRPC or JSON-RPC event subscription
   - Event-to-table mapping (11 event types → corresponding tables)
   - Cursor-based resumption from `indexer_checkpoints`
   - Idempotent processing via `(sui_tx_digest, sui_event_seq)` uniqueness
   - Redis cache invalidation on core table updates
   - Health check endpoint

3. **Database access layer**
   - Repository pattern for each table
   - Read-only repositories for core (on-chain synced) tables
   - Read-write repositories for off-chain tables
   - Connection pooling configuration

**Key files:**
```
packages/db/
├── src/
│   ├── schema/              — Table definitions (Drizzle or Prisma schema)
│   ├── migrations/          — SQL migration files
│   ├── repositories/        — Data access layer
│   ├── seed/                — Development seed data
│   └── index.ts
├── package.json
└── drizzle.config.ts

apps/indexer/
├── src/
│   ├── event-handlers/      — One handler per event type
│   ├── sui-client.ts        — Sui RPC connection
│   ├── cursor-manager.ts    — Checkpoint persistence
│   ├── cache-invalidator.ts — Redis cache invalidation
│   ├── health.ts            — Health check endpoint
│   └── index.ts             — Main entry point
├── package.json
└── Dockerfile
```

**Interface contract:**
- Schema is the contract: column names, types, and constraints are authoritative
- Repositories export typed query functions (not raw SQL)
- Indexer emits structured logs for monitoring
- Health endpoint: `GET /health` → `{ status: "ok", last_event_seq: number, lag_seconds: number }`

**Test criteria:**
- All migrations apply cleanly on empty PostgreSQL
- Indexer correctly processes mock events → correct DB state
- Idempotent: replaying same events produces same DB state
- Cursor recovery: kill and restart → no missed/duplicate events

---

### M3: Encryption SDK

**Owner:** Cryptography agent
**Location:** `packages/encryption-sdk/`
**Dependencies:** M0 (types)
**Duration:** ~2 sessions

**Deliverables:**

1. **EncryptionEngine interface** — Abstract interface for encrypt/decrypt operations
2. **AESEngine** — AES-256-GCM implementation using Web Crypto API
3. **SealEngine** — Seal threshold encryption integration (stub for Phase 1, full for Phase 2)
4. **Key management utilities** — Folder key encrypt/decrypt with user keypair, Shamir's Secret Sharing for recovery
5. **Integrity verification** — SHA-256 hash computation and verification

**Key files:**
```
packages/encryption-sdk/
├── src/
│   ├── engines/
│   │   ├── engine.interface.ts   — EncryptionEngine interface
│   │   ├── aes-engine.ts         — AES-256-GCM implementation
│   │   └── seal-engine.ts        — Seal integration (stub → full)
│   ├── keys/
│   │   ├── folder-key.ts         — Folder key generation, encrypt/decrypt with pubkey
│   │   ├── key-rotation.ts       — Key rotation logic for member removal
│   │   └── recovery.ts           — 2-of-3 Shamir's Secret Sharing
│   ├── integrity/
│   │   └── hash.ts               — SHA-256 computation and verification
│   ├── utils/
│   │   └── iv.ts                 — IV generation (crypto.getRandomValues)
│   └── index.ts                  — Public API exports
├── package.json
└── tsconfig.json
```

**Interface contract:**
```typescript
interface EncryptionEngine {
  encrypt(plaintext: ArrayBuffer, key: CryptoKey): Promise<EncryptedBlob>;
  decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<ArrayBuffer>;
  scheme: EncryptionScheme;  // 'aes' | 'seal'
}

interface EncryptedBlob {
  data: Uint8Array;   // IV (12 bytes) || ciphertext || auth_tag (16 bytes)
  scheme: EncryptionScheme;
}

interface KeyManager {
  generateFolderKey(): Promise<CryptoKey>;
  encryptKeyForMember(key: CryptoKey, memberPublicKey: Uint8Array): Promise<Uint8Array>;
  decryptKeyWithKeypair(encryptedKey: Uint8Array, keypair: CryptoKeyPair): Promise<CryptoKey>;
  rotateKey(oldKey: CryptoKey, removedMemberPubKey: Uint8Array, remainingMemberPubKeys: Uint8Array[]): Promise<KeyRotationResult>;
}

interface IntegrityChecker {
  computeHash(data: ArrayBuffer): Promise<string>;  // hex-encoded SHA-256
  verifyHash(data: ArrayBuffer, expectedHash: string): Promise<boolean>;
}
```

**Test criteria:**
- Encrypt → decrypt round-trip produces identical plaintext
- Different IVs for same plaintext produce different ciphertext
- Hash verification passes for correct data, fails for tampered data
- Key rotation produces new key that can decrypt re-encrypted data
- Removed member's encrypted key cannot decrypt new folder key
- Never reuses (key, IV) pair across any test

---

### M4: Backend API (NestJS)

**Owner:** Backend API agent
**Location:** `apps/api/`
**Dependencies:** M0 (types), M2 (DB + repositories)
**Duration:** ~3–4 sessions

**Deliverables:**

1. **NestJS application** with 12 API modules (50+ endpoints)
2. **Auth module** — Wallet challenge-response, JWT issuance, refresh token rotation, logout
3. **TX Builder** — Constructs unsigned Sui TransactionBlocks for user-signed operations
4. **Sponsored TX** — Signs and submits backend-sponsored transactions
5. **Guards and interceptors** — AuthGuard, RoleGuard, RateLimitGuard, CSRF validation
6. **Background workers** — Walrus renewal, subscription monitor, notification dispatcher, cost tracker

**Key files:**
```
apps/api/
├── src/
│   ├── modules/
│   │   ├── auth/              — Challenge, verify, refresh, logout, CSRF
│   │   ├── organisation/      — CRUD, member management, invite codes
│   │   ├── pool/              — CRUD, state transitions (user-signed TX)
│   │   ├── dataroom/          — Folder management, member management
│   │   ├── document/          — Upload metadata, download, version management
│   │   ├── checklist/         — CRUD, status tracking, templates
│   │   ├── review/            — Per-reviewer operations
│   │   ├── ic-decision/       — Submit, query
│   │   ├── audit/             — Query, export (JSON/CSV)
│   │   ├── notification/      — Preferences, in-app notifications
│   │   ├── billing/           — Subscriptions, invoices
│   │   └── admin/             — Platform admin (pause/unpause)
│   ├── common/
│   │   ├── guards/            — Auth, Role, RateLimit, CSRF guards
│   │   ├── interceptors/      — Logging, error transform
│   │   ├── decorators/        — @RequireRole(), @CurrentUser()
│   │   └── filters/           — Global exception filter
│   ├── sui/
│   │   ├── tx-builder.ts      — TransactionBlock construction
│   │   ├── sponsor.ts         — Sponsored transaction signing
│   │   └── client.ts          — Sui RPC client wrapper
│   ├── workers/
│   │   ├── walrus-renewal.ts  — Blob renewal CronJob
│   │   ├── subscription.ts    — Subscription expiry monitor
│   │   ├── notification.ts    — Email + in-app dispatcher
│   │   └── cost-tracker.ts    — Walrus cost aggregation
│   ├── config/
│   │   ├── app.config.ts
│   │   ├── sui.config.ts
│   │   ├── walrus.config.ts
│   │   └── redis.config.ts
│   └── main.ts
├── test/
│   ├── unit/
│   └── e2e/
├── package.json
├── nest-cli.json
└── Dockerfile
```

**Interface contract (API):**

All endpoints follow the pattern defined in `specs/system-architecture.md` §6.
Standard error envelope: `{ error: { code, message, details } }`
Pagination: `?page=1&limit=20&sort=created_at&order=desc`

Key endpoint signatures:

```typescript
// Auth
GET    /v1/auth/challenge              → { nonce, timestamp, expires_at }
POST   /v1/auth/verify                 → { access_token, user }
POST   /v1/auth/refresh                → { access_token }  (+ Set-Cookie)
POST   /v1/auth/logout                 → 204

// Pool (user-signed TX flow)
POST   /v1/pools                       → { tx_bytes }  // unsigned TX for pool creation
POST   /v1/pools/:id/sign              → { tx_digest } // submit signed TX
GET    /v1/pools                       → { pools[], total, page }
GET    /v1/pools/:id                   → Pool
POST   /v1/pools/:id/transitions       → { tx_bytes }  // unsigned TX for state transition
DELETE /v1/pools/:id                   → { tx_bytes }  // unsigned TX for cancellation

// Document (backend-sponsored)
POST   /v1/pools/:poolId/documents     → Document  // metadata write, sponsored TX
GET    /v1/pools/:poolId/documents     → { documents[], total }
GET    /v1/pools/:poolId/documents/:id → Document
POST   /v1/pools/:poolId/documents/:id/versions → DocVersion  // version add, sponsored TX
DELETE /v1/pools/:poolId/documents/:id → 204

// Review (user-signed TX)
POST   /v1/documents/:docId/reviews    → { tx_bytes }  // submit review
GET    /v1/documents/:docId/reviews    → ReviewRecord[]

// IC Decision (user-signed TX)
POST   /v1/pools/:poolId/ic-decisions  → { tx_bytes }
GET    /v1/pools/:poolId/ic-decisions  → ICDecision[]
```

**Test criteria:**
- Auth flow: challenge → verify → JWT issued → refresh → logout → JWT blacklisted
- Role-based access: each endpoint rejects unauthorised roles with 403
- TX builder: produces valid TransactionBlocks that can be signed
- Sponsored TX: successfully submitted and events emitted
- Rate limiting: returns 429 after threshold exceeded
- CSRF: mutation without token returns 403

---

### M5: Walrus SDK

**Owner:** Storage agent
**Location:** `packages/walrus-sdk/`
**Dependencies:** M0 (types), M3 (encryption — for encrypt before upload)
**Duration:** ~1–2 sessions

**Deliverables:**

1. **WalrusClient** — Upload, download, extend blob lifetime
2. **ChunkedUploader** — Chunked upload for files > 50 MB
3. **ChunkedDownloader** — Parallel chunk download and reassembly
4. **Progress tracking** — Upload/download progress events
5. **Error handling** — Retry with exponential backoff, fallback aggregator

**Key files:**
```
packages/walrus-sdk/
├── src/
│   ├── client.ts             — Core WalrusClient (upload, download, extend)
│   ├── chunked-upload.ts     — Chunked upload logic (>50MB)
│   ├── chunked-download.ts   — Parallel chunk download + reassembly
│   ├── progress.ts           — Progress event emitter
│   ├── retry.ts              — Exponential backoff retry utility
│   ├── config.ts             — Publisher/Aggregator URLs, thresholds
│   └── index.ts
├── package.json
└── tsconfig.json
```

**Interface contract:**
```typescript
interface WalrusClient {
  upload(data: Uint8Array, epochs: number): Promise<WalrusUploadResult>;
  download(blobId: string): Promise<Uint8Array>;
  extend(blobId: string, additionalEpochs: number): Promise<WalrusExtendResult>;
}

interface WalrusUploadResult {
  blobId: string;
  size: number;
  createdEpoch: number;
  expiryEpoch: number;
  cost: { amount: string; currency: string };
}

interface ChunkedUploader {
  upload(
    data: Uint8Array,
    epochs: number,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<ChunkManifest>;
}

interface ChunkedDownloader {
  download(
    manifest: ChunkManifest,
    onProgress?: (progress: DownloadProgress) => void,
  ): Promise<Uint8Array>;
}

interface ChunkManifest {
  type: 'chunked';
  totalSize: number;
  chunkSize: number;
  chunks: Array<{ index: number; blobId: string; size: number }>;
}
```

**Test criteria:**
- Upload → download round-trip produces identical bytes
- Chunked upload produces valid manifest; chunked download reassembles correctly
- Retry logic handles 503 responses correctly
- Fallback aggregator used when primary returns error
- Progress callbacks fire at expected intervals
- Files exactly at 50 MB threshold handled correctly (no chunking)

---

### M6: Frontend (Next.js + React)

**Owner:** Frontend agent
**Location:** `apps/web/`
**Dependencies:** M0 (types), M3 (encryption SDK), M4 (backend API), M5 (Walrus SDK)
**Duration:** ~4–5 sessions

**Deliverables:**

1. **11+ pages/screens** as defined in system-architecture.md §11
2. **Sui dApp Kit integration** — Wallet connect, transaction signing
3. **Encryption SDK integration** — Client-side encrypt/decrypt on upload/download
4. **Walrus SDK integration** — Direct upload/download to Walrus from browser
5. **TanStack Query** — Server state management with cache invalidation
6. **Design system** — Component library matching UI spec

**Key files:**
```
apps/web/
├── src/
│   ├── app/                   — Next.js App Router pages
│   │   ├── (auth)/
│   │   │   ├── login/         — Wallet connect + auth
│   │   │   └── onboarding/    — Create/join org
│   │   ├── (dashboard)/
│   │   │   ├── page.tsx       — Organisation dashboard
│   │   │   ├── pools/
│   │   │   │   ├── page.tsx   — Pool list
│   │   │   │   ├── new/       — Pool creation wizard (5 steps)
│   │   │   │   └── [poolId]/
│   │   │   │       ├── page.tsx       — Pool detail + VDR
│   │   │   │       ├── checklist/     — DD Checklist dashboard
│   │   │   │       ├── ic-decisions/  — IC Decision panel
│   │   │   │       ├── audit/         — Audit trail viewer
│   │   │   │       └── settings/      — Pool settings
│   │   │   └── settings/      — User/org settings
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                — Design system primitives
│   │   ├── pool/              — Pool-specific components
│   │   ├── document/          — Document list, upload, preview, version history
│   │   ├── review/            — Review panel, reviewer status
│   │   ├── checklist/         — Checklist dashboard, gate condition badges
│   │   ├── ic/                — IC decision panel, vote display
│   │   ├── audit/             — Audit timeline
│   │   └── layout/            — Navigation, sidebar, header
│   ├── hooks/
│   │   ├── use-auth.ts        — Auth state management
│   │   ├── use-pool.ts        — Pool queries (TanStack Query)
│   │   ├── use-documents.ts   — Document queries and mutations
│   │   ├── use-encryption.ts  — Encryption SDK wrapper
│   │   ├── use-walrus.ts      — Walrus SDK wrapper
│   │   └── use-sui-tx.ts      — TX signing flow
│   ├── lib/
│   │   ├── api-client.ts      — Typed API client (fetch wrapper)
│   │   ├── auth.ts            — JWT management, refresh logic
│   │   └── query-keys.ts      — TanStack Query key factory
│   ├── providers/
│   │   ├── sui-provider.tsx   — Sui dApp Kit provider
│   │   ├── auth-provider.tsx  — Auth context
│   │   └── query-provider.tsx — TanStack Query provider
│   └── styles/
│       └── globals.css
├── public/
├── package.json
├── next.config.js
└── tailwind.config.ts
```

**Interface contract:**
- All API calls go through `lib/api-client.ts` which uses types from `@rwa-dataroom/shared`
- Encryption happens in hooks (`use-encryption.ts`) before calling Walrus SDK
- TX signing flow: API returns `tx_bytes` → wallet signs → API submits signed TX
- No plaintext or encryption keys ever leave the browser
- No plaintext stored in localStorage or sessionStorage

**Test criteria:**
- Auth flow: connect wallet → challenge → sign → verify → JWT in memory
- Upload flow: select file → encrypt client-side → upload to Walrus → metadata to API
- Download flow: fetch metadata → download from Walrus → decrypt → verify hash → display
- Pool creation wizard: all 5 steps → TX built → signed → submitted
- State transition: button click → TX built → signed → submitted → UI updates
- Role-based UI: unauthorised actions hidden/disabled based on user role

---

### M7: Integration & E2E Tests

**Owner:** QA agent
**Location:** `tests/`
**Dependencies:** All modules
**Duration:** ~2 sessions

**Deliverables:**

1. **Full lifecycle E2E test** — Pool creation → doc upload → review → IC decision → Ready_To_Issue
2. **Cross-module integration tests** — Backend ↔ Indexer ↔ DB, Frontend ↔ Backend ↔ Sui
3. **Monkey tests** — Edge cases, boundary conditions, concurrent operations
4. **Performance benchmarks** — Encryption throughput, upload latency, API response times

**Key files:**
```
tests/
├── e2e/
│   ├── full-lifecycle.spec.ts    — Happy path: Draft → Ready_To_Issue
│   ├── rejection-flow.spec.ts    — IC reject → re-open → re-submit
│   ├── key-rotation.spec.ts      — Member removal → key rotation → re-encryption
│   └── auth-flow.spec.ts         — Full auth lifecycle
├── integration/
│   ├── indexer.spec.ts           — Indexer processes events → correct DB state
│   ├── sponsored-tx.spec.ts      — Backend sponsors TX → event emitted → indexed
│   └── encryption-roundtrip.spec.ts — Encrypt → upload → download → decrypt → verify
├── monkey/
│   ├── concurrent-reviews.spec.ts — Multiple reviewers simultaneously
│   ├── rapid-version-upload.spec.ts — Upload many versions quickly
│   └── permission-edge-cases.spec.ts — Role boundary testing
└── benchmarks/
    ├── encryption-throughput.bench.ts
    └── api-latency.bench.ts
```

---

### M8: DevOps & Infrastructure

**Owner:** DevOps agent (runs in parallel with all phases)
**Location:** `infra/`
**Dependencies:** None (can start immediately)
**Duration:** Ongoing, ~2 sessions

**Deliverables:**

1. **Docker Compose** for local development (API + PostgreSQL + Redis + Indexer)
2. **Dockerfiles** for API, Indexer, Frontend
3. **CI/CD pipeline** (GitHub Actions) — lint, test, build, deploy
4. **Infrastructure as Code** (Terraform or Pulumi) for staging/production
5. **Monitoring stack** configuration (Grafana + Prometheus)
6. **Environment configuration** — .env templates, secrets management

**Key files:**
```
infra/
├── docker/
│   ├── docker-compose.yml       — Full local dev stack
│   ├── Dockerfile.api           — NestJS API
│   ├── Dockerfile.indexer       — Event Indexer
│   └── Dockerfile.web           — Next.js frontend
├── terraform/                   — IaC for cloud deployment
├── monitoring/
│   ├── grafana/                 — Dashboard definitions
│   └── prometheus/              — Alerting rules
├── ci/
│   └── .github/workflows/       — CI/CD pipeline
└── env/
    ├── .env.example              — Template
    ├── .env.development          — Dev defaults (no secrets)
    └── .env.test                 — Test configuration
```

---

## 4. Interface Contracts

### 4.1 Move → Backend (Event Types)

The Indexer must handle these exact event types emitted by the Move contracts:

```typescript
// Generated from contracts/rwa_dataroom/sources/events.move
// These MUST match the Move event struct names exactly

type SuiEventType =
  | `${PACKAGE_ID}::events::PoolCreated`
  | `${PACKAGE_ID}::events::PoolStateChanged`
  | `${PACKAGE_ID}::events::DataRoomCreated`
  | `${PACKAGE_ID}::events::MemberAdded`
  | `${PACKAGE_ID}::events::MemberRemoved`
  | `${PACKAGE_ID}::events::MemberRoleUpdated`
  | `${PACKAGE_ID}::events::DocumentCreated`
  | `${PACKAGE_ID}::events::DocumentVersionAdded`
  | `${PACKAGE_ID}::events::DocumentReviewed`
  | `${PACKAGE_ID}::events::ICDecisionCreated`
  | `${PACKAGE_ID}::events::FolderCreated`
  | `${PACKAGE_ID}::events::AuditEvent`;
```

### 4.2 Backend → Frontend (API Types)

All API request/response types are defined in `@rwa-dataroom/shared` and used by both:
- Backend: NestJS DTOs (validated via class-validator or Zod)
- Frontend: API client (typed fetch wrapper)

### 4.3 Frontend → Walrus (Direct)

Frontend communicates directly with Walrus Publisher/Aggregator. No backend proxy.

```
Upload:   POST {publisherUrl}/v1/blobs?epochs=N  (body: encrypted bytes)
Download: GET  {aggregatorUrl}/v1/blobs/{blobId}  (response: encrypted bytes)
```

### 4.4 Frontend → Sui (via dApp Kit)

Frontend uses Sui dApp Kit for:
- Wallet connection and address retrieval
- Personal message signing (auth challenge)
- Transaction signing (user-signed operations)
- Reading on-chain objects (dynamic fields for encrypted keys)

### 4.5 Backend → Sui (TX Building + Sponsored TX)

Backend uses `@mysten/sui` SDK for:
- Building unsigned TransactionBlocks (returned to frontend for signing)
- Signing and submitting sponsored transactions (platform key)
- Querying on-chain state for authorisation verification fallback

---

## 5. Shared Types & Constants

### 5.1 Role Bitmask Constants

```typescript
export const ROLES = {
  VIEWER:    0b000001,  // 1
  REVIEWER:  0b000010,  // 2
  EDITOR:    0b000100,  // 4
  OWNER:     0b001000,  // 8
  AUDITOR:   0b010000,  // 16
  ORG_ADMIN: 0b100000,  // 32
  ALL:       0b111111,  // 63
} as const;

export function hasRole(userRole: number, requiredRole: number): boolean {
  return (userRole & requiredRole) === requiredRole;
}

export function ownerImplies(userRole: number): number {
  // OWNER implies EDITOR + REVIEWER + VIEWER
  if (hasRole(userRole, ROLES.OWNER)) {
    return userRole | ROLES.EDITOR | ROLES.REVIEWER | ROLES.VIEWER;
  }
  return userRole;
}
```

### 5.2 Pool State Constants

```typescript
export const POOL_STATES = {
  DRAFT: 0,
  DD_IN_PROGRESS: 1,
  IC_REVIEW: 2,
  APPROVED_INTERNAL: 3,
  READY_TO_ISSUE: 4,
  REJECTED: 5,
  CANCELLED: 6,
  ISSUED: 7,     // Phase 2
  CLOSED: 8,     // Phase 2
} as const;

export type PoolState = typeof POOL_STATES[keyof typeof POOL_STATES];
```

### 5.3 Error Codes (Matching Move)

```typescript
// Must match contracts/rwa_dataroom/sources/errors.move exactly
export const MOVE_ERRORS = {
  E_NOT_AUTHORISED: 301,
  E_NOT_MEMBER: 302,
  E_INSUFFICIENT_ROLE: 303,
  E_INVALID_STATE_TRANSITION: 304,
  E_GATE_CONDITION_NOT_MET: 305,
  E_DOCUMENT_NOT_FOUND: 306,
  // ... (complete list derived from errors.move)
} as const;
```

### 5.4 Encryption Schemes

```typescript
export const ENCRYPTION_SCHEMES = {
  AES: 0,
  SEAL: 1,
} as const;

export type EncryptionScheme = typeof ENCRYPTION_SCHEMES[keyof typeof ENCRYPTION_SCHEMES];
```

---

## 6. Data Flow Diagrams

### 6.1 Document Upload Flow

```
User selects file
    │
    ▼
[Encryption SDK]  encrypt(file, folderKey) → EncryptedBlob
    │
    ▼
[Walrus SDK]  upload(encryptedBlob, epochs) → { blobId, expiryEpoch }
    │
    ▼
[API Client]  POST /pools/:id/documents { blobId, contentHash, ... }
    │
    ▼
[Backend]  buildSponsoredTx(document::create_document) → submitTx
    │
    ▼
[Sui Network]  emit DocumentCreated event
    │
    ▼
[Indexer]  process event → INSERT into documents table → DEL Redis cache
    │
    ▼
[Frontend]  TanStack Query invalidation → UI update
```

### 6.2 Pool State Transition Flow

```
User clicks "Submit to IC Review"
    │
    ▼
[API Client]  POST /pools/:id/transitions { target_state: IC_REVIEW }
    │
    ▼
[Backend]  verify gate conditions (DB check) → buildUnsignedTx → return tx_bytes
    │
    ▼
[Frontend]  wallet.signTransaction(tx_bytes) → signedTx
    │
    ▼
[API Client]  POST /pools/:id/sign { signedTx }
    │
    ▼
[Backend]  submitTx(signedTx) → tx_digest
    │
    ▼
[Sui Network]  Move contract verifies gate conditions on-chain → emit PoolStateChanged
    │
    ▼
[Indexer]  UPDATE pools.current_state → DEL Redis cache → trigger notifications
    │
    ▼
[Frontend]  TanStack Query invalidation → UI update (new state badge)
```

### 6.3 Auth Flow

```
User clicks "Connect Wallet"
    │
    ▼
[Sui dApp Kit]  wallet.connect() → address
    │
    ▼
[API Client]  GET /auth/challenge → { nonce, timestamp }
    │
    ▼
[Sui dApp Kit]  wallet.signPersonalMessage(challengeMessage) → signature
    │
    ▼
[API Client]  POST /auth/verify { address, signature, nonce }
    │
    ▼
[Backend]  verifyNonce(Redis) → verifySig(@mysten/sui) → upsertUser(PG)
           → createSession(Redis) → signJWT → setRefreshCookie
    │
    ▼
[Frontend]  store accessToken in memory → redirect to dashboard
```

---

## 7. Agent Work Stream Guide

### 7.1 How to Use This Document

When starting a new chat to implement a module:

```
Read docs/superpowers/plans/2026-03-13-full-implementation.md
and specs/implementation-architecture.md.
Execute Stream N (Module Name).
```

Each stream section in the implementation plan references the corresponding module spec in this document.

### 7.2 Parallelisation Rules

1. **Never modify another module's files** — Each agent owns its module directory
2. **Shared types go in M0** — If two modules need the same type, it belongs in `packages/shared/`
3. **Interface contracts are immutable during a phase** — Once M0 is committed, downstream modules build against it
4. **Test against interfaces, not implementations** — Mock other modules using their interface contracts
5. **Report blocking dependencies** — If you need something from another module, document it and move on to non-blocked work

### 7.3 Module Ownership Map

| Module | Directory | Can Write | Can Read (not write) |
|--------|-----------|-----------|---------------------|
| M0 | `packages/shared/` | ✓ | — |
| M1 | `contracts/rwa_dataroom/` | ✓ (done) | — |
| M2 | `packages/db/`, `apps/indexer/` | ✓ | `contracts/*/sources/events.move` |
| M3 | `packages/encryption-sdk/` | ✓ | — |
| M4 | `apps/api/` | ✓ | `packages/db/`, `packages/shared/` |
| M5 | `packages/walrus-sdk/` | ✓ | `packages/encryption-sdk/` (interface only) |
| M6 | `apps/web/` | ✓ | all `packages/*/`, `apps/api/` (types only) |
| M7 | `tests/` | ✓ | All modules |
| M8 | `infra/` | ✓ | — |

### 7.4 Monorepo Structure

```
RWA_DataRoom/
├── contracts/                 — M1: Sui Move smart contracts (DONE)
│   └── rwa_dataroom/
├── packages/                  — Shared libraries
│   ├── shared/                — M0: Types, constants, Zod schemas
│   ├── db/                    — M2: Schema, migrations, repositories
│   ├── encryption-sdk/        — M3: AES + Seal encryption
│   └── walrus-sdk/            — M5: Walrus upload/download
├── apps/                      — Deployable applications
│   ├── api/                   — M4: NestJS backend API
│   ├── indexer/               — M2: Event indexer worker
│   └── web/                   — M6: Next.js frontend
├── tests/                     — M7: Integration & E2E tests
├── infra/                     — M8: Docker, Terraform, CI/CD
├── specs/                     — Architecture specs (this file)
│   ├── system-architecture.md
│   └── implementation-architecture.md
├── docs/                      — Design documents (reference)
│   ├── design/
│   └── superpowers/plans/
├── tasks/                     — Progress tracking
├── package.json               — Workspace root (npm/pnpm workspaces)
├── pnpm-workspace.yaml
└── turbo.json                 — Turborepo config (build orchestration)
```

### 7.5 Build & Test Commands

```bash
# Workspace-level
pnpm install                  # Install all dependencies
pnpm build                    # Build all packages in dependency order
pnpm test                     # Run all tests
pnpm lint                     # Lint all packages

# Module-level
pnpm --filter @rwa-dataroom/shared build
pnpm --filter @rwa-dataroom/db test
pnpm --filter @rwa-dataroom/encryption-sdk test
pnpm --filter @rwa-dataroom/walrus-sdk test
pnpm --filter @rwa-dataroom/api test
pnpm --filter @rwa-dataroom/web build
pnpm --filter @rwa-dataroom/indexer test

# Move contracts
cd contracts/rwa_dataroom && sui move test
```
