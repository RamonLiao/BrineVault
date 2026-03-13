# RWA Credit Data Room — Full Implementation Plan

**Version:** 1.0
**Date:** 2026-03-13
**Scope:** Phase 1 complete implementation (Move ✅ → Backend → Frontend → Integration)
**Execution model:** Parallel AI agent streams

---

## Prerequisites

Before starting any stream, read these files:
1. `specs/system-architecture.md` — Full system spec (single source of truth)
2. `specs/implementation-architecture.md` — Module boundaries, interface contracts, dependency DAG

---

## Execution Overview

```
Timeline:  ──────────────────────────────────────────────────────────►

Phase 0:   [S0: Foundation]
           ████                                    (~1 session)

Phase 1:   [S1: DB+Indexer] [S2: Encryption] [S3: Walrus] [S4: DevOps]
           ████████████      ████████          ██████        ████████████
           (parallel)        (parallel)        (parallel)    (parallel)

Phase 2:   [S5: Backend API]
           ████████████████████                (~3-4 sessions)
           (depends on S1)

Phase 3:   [S6: Frontend]
           ████████████████████████████        (~4-5 sessions)
           (depends on S2, S3, S5)

Phase 4:   [S7: Integration & E2E]
           ████████████                        (~2 sessions)
           (depends on all)
```

**Total estimated sessions:** 15–20 (but ~10–12 wall-clock due to parallelism)

---

## Stream 0: Foundation (Shared Types & Constants)

**Module:** M0
**Blocks:** S1, S2, S3, S5, S6
**Priority:** CRITICAL — Must complete first

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M0: Shared Types) and §5 (Shared Types & Constants).
Read contracts/rwa_dataroom/sources/types.move, errors.move, events.move to extract exact constants.
```

### Tasks

- [ ] **S0.1** Initialise pnpm workspace monorepo structure
  - Create `package.json` (workspace root), `pnpm-workspace.yaml`, `turbo.json`
  - Create directory structure: `packages/shared/`, `packages/db/`, `packages/encryption-sdk/`, `packages/walrus-sdk/`, `apps/api/`, `apps/indexer/`, `apps/web/`, `tests/`, `infra/`

- [ ] **S0.2** Create `packages/shared/` with TypeScript types
  - All types from `specs/implementation-architecture.md` §5
  - Role bitmask constants + helper functions (`hasRole`, `ownerImplies`)
  - Pool state constants
  - Error codes (matching Move `errors.move` exactly)
  - Event type strings (matching Move `events.move` exactly)
  - Encryption scheme constants
  - API request/response types + standard error envelope
  - Auth types (JWT payload, session)
  - Checklist types + default folder/item definitions

- [ ] **S0.3** Create Zod validation schemas for all API payloads
  - Pool creation, document upload, review submission, IC decision
  - Auth challenge, verify, refresh

- [ ] **S0.4** Verify constants match Move contracts
  - Cross-reference every constant with `sources/types.move` and `sources/errors.move`
  - Ensure event struct field names match exactly

### Acceptance Criteria
- `pnpm build` succeeds from workspace root
- `packages/shared/` exports all types, constants, and schemas
- All constants verified against Move source code
- TypeScript strict mode passes

---

## Stream 1: Database Schema + Event Indexer

**Module:** M2
**Depends on:** S0 (shared types)
**Blocks:** S5 (Backend API)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M2: DB Schema + Indexer).
Read specs/system-architecture.md §7 (Database Architecture).
Read docs/design/db-schema.md for complete CREATE TABLE statements.
Read contracts/rwa_dataroom/sources/events.move for event struct definitions.
```

### Tasks

- [ ] **S1.1** Set up PostgreSQL schema with Drizzle ORM
  - Define all 20 tables from `system-architecture.md` §7.2–7.3
  - Respect FK creation order (§10 of db-schema.md)
  - Create custom enum types (billing_plan, subscription_status, invoice_status, checklist_item_status)
  - All indexes as specified

- [ ] **S1.2** Create migration files
  - Initial migration with all tables
  - Seed migration with development data (test org, checklist templates, test users)

- [ ] **S1.3** Create repository layer
  - Read-only repositories for core tables (pools, datarooms, members, documents, document_versions, document_reviews, ic_decisions, audit_events)
  - Read-write repositories for off-chain tables (organisations, users, comments, notifications, etc.)
  - Connection pool configuration

- [ ] **S1.4** Build Event Indexer worker
  - Sui Full Node connection (gRPC or JSON-RPC event subscription)
  - Event handler for each of the 11 event types (see §4.1 of implementation-architecture.md)
  - Cursor-based checkpoint persistence (indexer_checkpoints table)
  - Idempotent processing via (sui_tx_digest, sui_event_seq) uniqueness
  - Redis cache invalidation on core table updates
  - Health check endpoint: `GET /health`

- [ ] **S1.5** Write tests
  - Migration tests: apply on empty DB, verify schema
  - Repository tests: CRUD operations on all tables
  - Indexer tests: process mock events → verify correct DB state
  - Idempotency tests: replay same events → no duplicates
  - Cursor recovery tests: simulate crash → restart → no missed events

### Acceptance Criteria
- All migrations apply cleanly on PostgreSQL 16
- Indexer correctly maps all 11 event types to DB operations
- `pnpm --filter @rwa-dataroom/db test` passes
- `pnpm --filter @rwa-dataroom/indexer test` passes

---

## Stream 2: Encryption SDK

**Module:** M3
**Depends on:** S0 (shared types)
**Blocks:** S3 (Walrus SDK — needs encryption interface), S6 (Frontend)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M3: Encryption SDK).
Read specs/system-architecture.md §9 (Encryption Architecture).
Read docs/design/walrus-integration.md §2 (Upload Flow) for payload format.
```

### Tasks

- [ ] **S2.1** Define `EncryptionEngine` interface
  - `encrypt(plaintext, key) → EncryptedBlob`
  - `decrypt(blob, key) → ArrayBuffer`
  - `scheme` property

- [ ] **S2.2** Implement `AESEngine`
  - AES-256-GCM using Web Crypto API
  - IV generation: 12 bytes via `crypto.getRandomValues()`
  - Blob format: `IV (12 bytes) || ciphertext || auth_tag (16 bytes)`
  - Never reuse (key, IV) pair

- [ ] **S2.3** Implement `SealEngine` (Phase 1 stub)
  - Same interface as AESEngine
  - Phase 1: throws "Seal engine not yet available" for encrypt/decrypt
  - Structure ready for Phase 2 implementation (Seal key server integration)

- [ ] **S2.4** Implement key management
  - `generateFolderKey()` — generate new AES-256 key
  - `encryptKeyForMember(key, memberPubKey)` — encrypt folder key with member's public key
  - `decryptKeyWithKeypair(encryptedKey, keypair)` — decrypt folder key with user's keypair
  - Key rotation: generate new key → re-encrypt for remaining members

- [ ] **S2.5** Implement integrity verification
  - `computeHash(data)` — SHA-256 of plaintext, hex-encoded
  - `verifyHash(data, expectedHash)` — compare hashes

- [ ] **S2.6** Implement Shamir's Secret Sharing (2-of-3)
  - Split key into 3 shares
  - Recover key from any 2 shares
  - Use a well-tested library (e.g., `shamir` or `secrets.js-grempe`)

- [ ] **S2.7** Write comprehensive tests
  - Encrypt → decrypt round-trip (various file sizes: 1KB, 1MB, 50MB)
  - Different IVs for same plaintext → different ciphertext
  - Hash verification: correct data passes, tampered data fails
  - Key rotation: new key works, removed member's key doesn't
  - Shamir: split → recover with any 2-of-3 → matches original
  - Edge cases: empty file, max size file, concurrent operations

### Acceptance Criteria
- All crypto operations use Web Crypto API (no Node.js-only APIs)
- Works in browser environment (no `Buffer`, use `Uint8Array`)
- `pnpm --filter @rwa-dataroom/encryption-sdk test` passes
- Zero IV reuse across all tests

---

## Stream 3: Walrus SDK

**Module:** M5
**Depends on:** S0 (shared types), S2 (encryption SDK interface — for type imports only)
**Blocks:** S6 (Frontend)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M5: Walrus SDK).
Read specs/system-architecture.md §8 (Storage Architecture).
Read docs/design/walrus-integration.md for complete flow diagrams and API reference.
```

### Tasks

- [ ] **S3.1** Implement `WalrusClient`
  - `upload(data, epochs)` — POST to Publisher, return blob_id + metadata
  - `download(blobId)` — GET from Aggregator, return raw bytes
  - `extend(blobId, additionalEpochs)` — POST to Publisher for renewal
  - Configurable Publisher/Aggregator URLs (testnet/mainnet)
  - Fallback aggregator support

- [ ] **S3.2** Implement `ChunkedUploader`
  - Threshold: > 50 MB triggers chunking
  - Chunk size: 10 MB
  - Parallel upload: 3 concurrent chunks
  - Compose `ChunkManifest` after all chunks uploaded
  - Per-chunk progress tracking
  - Per-chunk retry (max 3 attempts, exponential backoff)

- [ ] **S3.3** Implement `ChunkedDownloader`
  - Parse `ChunkManifest`
  - Parallel download: 3 concurrent chunks
  - Reassemble in order
  - Per-chunk progress tracking

- [ ] **S3.4** Implement retry utility
  - Exponential backoff: base 1s, max 30s, factor 2
  - Configurable max attempts (3 for upload, 5 for renewal)
  - Handle 503 (retry), 404 (don't retry), 413 (switch to chunked)

- [ ] **S3.5** Implement progress event system
  - `UploadProgress`: totalChunks, completedChunks, overallProgress, failedChunks, status
  - `DownloadProgress`: same structure
  - Callback-based progress reporting

- [ ] **S3.6** Write tests
  - Upload → download round-trip (mock Walrus endpoints)
  - Chunked upload: 60 MB file → correct manifest → correct reassembly
  - Retry logic: simulate 503 → retry succeeds
  - Fallback aggregator: primary fails → fallback used
  - 50 MB boundary: exactly 50 MB → no chunking; 50.1 MB → chunking
  - Progress callbacks fire correctly

### Acceptance Criteria
- Works in browser environment (fetch API, not Node.js http)
- Handles files from 1 KB to 200 MB
- `pnpm --filter @rwa-dataroom/walrus-sdk test` passes

---

## Stream 4: DevOps & Infrastructure

**Module:** M8
**Depends on:** None (can start immediately)
**Blocks:** Nothing (enables deployment of other modules)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M8: DevOps) and §7.4 (Monorepo Structure).
Read specs/system-architecture.md §16 (Deployment & Operations).
```

### Tasks

- [ ] **S4.1** Docker Compose for local development
  - PostgreSQL 16 with init script
  - Redis 7
  - Placeholder services for API, Indexer, Frontend (Dockerfiles)
  - Volume mounts for development

- [ ] **S4.2** Dockerfiles
  - `Dockerfile.api` — Multi-stage build for NestJS
  - `Dockerfile.indexer` — Node.js worker
  - `Dockerfile.web` — Multi-stage build for Next.js

- [ ] **S4.3** CI/CD pipeline (GitHub Actions)
  - On PR: lint → type-check → test → build
  - On merge to main: build → deploy to staging
  - On release tag: deploy to production
  - Move contract tests: `sui move test` in CI

- [ ] **S4.4** Environment configuration
  - `.env.example` with all required variables (no secrets)
  - `.env.development` with dev defaults
  - `.env.test` with test configuration
  - Document all env vars with descriptions

- [ ] **S4.5** Monitoring configuration
  - Grafana dashboard definitions (API latency, error rate, indexer lag, Walrus health)
  - Prometheus alerting rules (matching thresholds in system-architecture.md §16.4)

- [ ] **S4.6** Update `.gitignore`
  - Ensure build artefacts, .env files, node_modules, and Move build outputs are properly excluded
  - Never commit secrets

### Acceptance Criteria
- `docker compose up` starts PostgreSQL + Redis + placeholder services
- CI pipeline runs successfully on a test PR
- All env vars documented

---

## Stream 5: Backend API (NestJS)

**Module:** M4
**Depends on:** S0 (shared types), S1 (DB + Indexer)
**Blocks:** S6 (Frontend)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M4: Backend API).
Read specs/system-architecture.md §6 (Backend Architecture), §10 (Auth & Session).
Read docs/design/api-spec.md for endpoint details.
Read docs/design/auth-flow.md for auth sequence.
```

### Tasks

#### Session 1: Auth + Core Setup

- [ ] **S5.1** Initialise NestJS application
  - Set up module structure matching implementation-architecture.md
  - Configure TypeORM/Drizzle connection to PostgreSQL
  - Configure Redis connection (ioredis)
  - Set up global exception filter, logging interceptor
  - Configure CORS, security headers, Helmet

- [ ] **S5.2** Auth module
  - `GET /v1/auth/challenge` — generate nonce, store in Redis (TTL 300s)
  - `POST /v1/auth/verify` — verify nonce + signature + upsert user + create session + issue JWT
  - `POST /v1/auth/refresh` — refresh token rotation with reuse detection
  - `POST /v1/auth/logout` — delete session, blacklist JWT
  - `GET /v1/auth/csrf-token` — issue CSRF token

- [ ] **S5.3** Auth guards and decorators
  - `AuthGuard` — JWT validation, blacklist check, session check
  - `RoleGuard` — Pool membership + role bitmask check
  - `RateLimitGuard` — Redis sliding window counter
  - `CsrfGuard` — X-CSRF-Token header validation for mutations
  - `@CurrentUser()` decorator — inject user from JWT
  - `@RequireRole(role)` decorator — minimum role check

- [ ] **S5.4** Organisation module
  - `POST /v1/orgs` — create org, user becomes org_admin
  - `GET /v1/orgs/:id` — get org details
  - `PATCH /v1/orgs/:id` — update org (org_admin only)
  - `POST /v1/orgs/:id/invite` — generate invite code (org_admin only)
  - `POST /v1/orgs/join` — join org with invite code

#### Session 2: Pool + DataRoom + Document

- [ ] **S5.5** Sui TX builder service
  - Build unsigned TransactionBlocks for user-signed operations
  - Sponsored transaction signing with platform key
  - Sui RPC client wrapper

- [ ] **S5.6** Pool module
  - `POST /v1/pools` — build unsigned TX for pool creation → return tx_bytes
  - `POST /v1/pools/:id/sign` — receive signed TX, submit to Sui
  - `GET /v1/pools` — list pools (paginated, filtered by org)
  - `GET /v1/pools/:id` — get pool details
  - `POST /v1/pools/:id/transitions` — build unsigned TX for state transition
  - `DELETE /v1/pools/:id` — build unsigned TX for cancellation

- [ ] **S5.7** DataRoom module
  - `GET /v1/pools/:poolId/dataroom` — get dataroom with folders and members
  - `POST /v1/pools/:poolId/dataroom/folders` — create folder (build TX)
  - `POST /v1/pools/:poolId/dataroom/members` — add member (build TX)
  - `DELETE /v1/pools/:poolId/dataroom/members/:address` — remove member (build TX)
  - `PATCH /v1/pools/:poolId/dataroom/members/:address` — update role (build TX)

- [ ] **S5.8** Document module
  - `POST /v1/pools/:poolId/documents` — write metadata (sponsored TX)
  - `GET /v1/pools/:poolId/documents` — list documents (paginated)
  - `GET /v1/pools/:poolId/documents/:id` — get document with versions
  - `POST /v1/pools/:poolId/documents/:id/versions` — add version (sponsored TX)
  - `DELETE /v1/pools/:poolId/documents/:id` — mark deleted (sponsored TX)
  - `GET /v1/pools/:poolId/documents/:id/versions` — list versions
  - `GET /v1/pools/:poolId/documents/:id/versions/:v` — get specific version

#### Session 3: Review + IC + Checklist + Remaining

- [ ] **S5.9** Review module
  - `POST /v1/documents/:docId/reviews` — submit review (build TX for user signing)
  - `GET /v1/documents/:docId/reviews` — list review records
  - `GET /v1/documents/:docId/reviews/summary` — aggregated review status
  - `DELETE /v1/documents/:docId/reviews/:reviewerId` — reset review (build TX)

- [ ] **S5.10** IC Decision module
  - `POST /v1/pools/:poolId/ic-decisions` — submit decision (build TX for user signing)
  - `GET /v1/pools/:poolId/ic-decisions` — list decisions
  - `GET /v1/pools/:poolId/ic-decisions/:id` — get decision details

- [ ] **S5.11** Checklist module
  - `GET /v1/pools/:poolId/checklist` — get checklist with completion status
  - `POST /v1/pools/:poolId/checklist` — add checklist item
  - `PATCH /v1/pools/:poolId/checklist/:id` — update item (requirement level, link doc)
  - `DELETE /v1/pools/:poolId/checklist/:id` — remove item
  - `GET /v1/checklist-templates` — list available templates

- [ ] **S5.12** Audit module
  - `GET /v1/pools/:poolId/audit` — list audit events (paginated, filtered)
  - `GET /v1/pools/:poolId/audit/export` — export as JSON or CSV
  - `GET /v1/audit/me` — user's own activity across all pools

- [ ] **S5.13** Notification module
  - `GET /v1/notifications` — list user notifications (paginated)
  - `PATCH /v1/notifications/:id` — mark as read
  - `POST /v1/notifications/read-all` — mark all as read
  - `GET /v1/notification-preferences` — get preferences
  - `PATCH /v1/notification-preferences` — update preferences

- [ ] **S5.14** Billing module
  - `GET /v1/subscriptions` — get current subscription
  - `POST /v1/subscriptions` — create/upgrade subscription
  - `GET /v1/invoices` — list invoices
  - `GET /v1/invoices/:id` — get invoice details
  - `POST /v1/invoices/:id/pay` — mark invoice as paid

- [ ] **S5.15** Background workers
  - Walrus renewal worker (CronJob, daily 00:00 UTC)
  - Subscription monitor (daily check for expiring subscriptions)
  - Notification dispatcher (event-driven, email + in-app)
  - Cost tracker (aggregate Walrus costs per pool per period)

- [ ] **S5.16** Write tests
  - Auth flow E2E: challenge → verify → refresh → logout
  - Role-based access: each endpoint rejects unauthorised roles
  - TX builder: produces valid TransactionBlocks
  - Sponsored TX: mock Sui submission
  - Rate limiting: 429 after threshold
  - CSRF: mutation without token → 403

### Acceptance Criteria
- All 50+ endpoints respond correctly
- Auth flow with refresh token rotation works
- TX builder produces valid Sui TransactionBlocks
- `pnpm --filter @rwa-dataroom/api test` passes
- `npx tsc --noEmit` passes (no type errors)

---

## Stream 6: Frontend (Next.js + React)

**Module:** M6
**Depends on:** S0, S2 (Encryption SDK), S3 (Walrus SDK), S5 (Backend API)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M6: Frontend).
Read specs/system-architecture.md §11 (Frontend Architecture).
Read docs/design/UI設計書.md for detailed screen layouts and design system.
```

### Tasks

#### Session 1: Setup + Auth + Layout

- [ ] **S6.1** Initialise Next.js application
  - App Router structure
  - Tailwind CSS setup
  - Sui dApp Kit provider (wallet connect)
  - TanStack Query provider
  - Auth provider (JWT in memory, refresh logic)

- [ ] **S6.2** Design system primitives
  - Button, Input, Select, Badge, Card, Table, Modal, Toast, Skeleton
  - Colour palette matching UI spec (#007BFF primary, semantic colours)
  - Typography (Inter or Plus Jakarta Sans)
  - WCAG AA accessibility (4.5:1 contrast, focus rings, aria-labels)

- [ ] **S6.3** Auth pages
  - Login page with wallet connect
  - Onboarding page (create org / join org)
  - Auth state management hook (`use-auth.ts`)

- [ ] **S6.4** Layout components
  - Sidebar navigation
  - Header with wallet badge + notification bell
  - Breadcrumbs

#### Session 2: Pool + DataRoom

- [ ] **S6.5** Organisation dashboard
  - Overview cards (total pools, pending reviews, total assets)
  - Pool table with state badges and hover feedback

- [ ] **S6.6** Pool creation wizard (5 steps)
  - Step 1: Basic info form
  - Step 2: Encryption engine selection (AES default, Seal Beta with disclosure)
  - Step 3: DD Checklist configuration (template selection + customisation)
  - Step 4: Initial member invitation (wallet address + role)
  - Step 5: Review & confirm → build TX → sign → submit

- [ ] **S6.7** Pool detail / VDR page
  - Left panel: folder tree
  - Centre panel: document list (drag-drop upload zone)
  - Right panel: document details + review drawer
  - State badge + transition buttons

#### Session 3: Documents + Review

- [ ] **S6.8** Document upload flow
  - File selection → progress indicator
  - Client-side encryption (via Encryption SDK)
  - Direct upload to Walrus (via Walrus SDK)
  - Metadata submission to Backend API
  - Success toast notification

- [ ] **S6.9** Document download + preview
  - Download from Walrus → decrypt → verify hash
  - PDF preview (PDF.js)
  - Image preview (Blob URL)
  - Text preview (pre or Monaco read-only)
  - Watermark overlay (truncated address + timestamp)
  - "Download to view" for unsupported formats

- [ ] **S6.10** Document version history
  - Vertical timeline with v1/v2/... cards
  - Current version highlighted with "Current" badge
  - Click to preview any version

- [ ] **S6.11** Review interface
  - Per-reviewer status panel (aggregate summary + individual rows)
  - Approve / Needs Revision buttons + comment textarea
  - Current user's row highlighted
  - TX signing flow for review submission

#### Session 4: Checklist + IC + Audit + Settings

- [ ] **S6.12** DD Checklist dashboard
  - Two-layer progress (uploaded vs reviewed)
  - Gate Condition badges (Ready / Not Ready)
  - Grouped by folder
  - Status icons (Missing / Uploaded / Reviewed / Needs Revision)
  - State transition button with gate condition validation

- [ ] **S6.13** IC Decision panel
  - Committee vote display (per-member cards with badges)
  - Vote tally (pie/bar chart)
  - Decision history table
  - Submit decision form (approve/reject/request changes + PDF upload)

- [ ] **S6.14** Audit trail viewer
  - Vertical timeline with event type icons
  - Filters by action, actor, date range
  - Export button (JSON/CSV)

- [ ] **S6.15** Settings pages
  - User profile (display name, email)
  - Notification preferences (per-type email/in-app toggles)
  - Organisation management (members, invite codes)
  - Billing & subscription

- [ ] **S6.16** Encryption engine indicator
  - Pool header badge: 🔐 AES-256 or 🧪 Seal Beta
  - No functional UX differences between engines

- [ ] **S6.17** Subscription expiry warnings
  - Graduated banners (30d info blue → 14d warning amber → 7d critical red)
  - Post-expiry overlay red
  - Renew CTA button

### Acceptance Criteria
- All 11+ screens functional and navigable
- Auth flow: wallet connect → sign → JWT → dashboard
- Upload: encrypt → Walrus → metadata → UI update
- Download: fetch → decrypt → verify → preview/download
- State transitions: click → TX → sign → submit → UI update
- WCAG AA compliance (contrast, keyboard navigation, aria-labels)
- Responsive: works on desktop ≥1280px and tablet ≥768px

---

## Stream 7: Integration & E2E Tests

**Module:** M7
**Depends on:** All streams (S0–S6)

### Instructions for Agent

```
Read specs/implementation-architecture.md §3 (M7: Integration Tests).
Read specs/system-architecture.md for expected behaviour at each step.
```

### Tasks

- [ ] **S7.1** Full lifecycle E2E test
  - Create org → create pool (Draft) → upload docs → transition to DD_In_Progress
  - Upload + review all required docs → transition to IC_Review
  - Submit IC Approve decision → transition to Approved_Internal
  - Finalise legal + compliance → transition to Ready_To_Issue
  - Verify all audit events logged correctly

- [ ] **S7.2** Rejection + re-open flow
  - Pool reaches IC_Review → IC Reject → verify Rejected state
  - Re-open to Draft → re-start DD process
  - Pool reaches IC_Review → IC RequestChanges → verify back to DD_In_Progress

- [ ] **S7.3** Key rotation E2E
  - Add 3 members → upload docs → remove member B
  - Verify: new folder key generated, files re-encrypted, member B cannot decrypt

- [ ] **S7.4** Encryption round-trip E2E
  - Upload file (encrypt + Walrus) → download (Walrus + decrypt) → verify hash
  - Test with various file sizes: 1 KB, 10 MB, 60 MB (chunked)

- [ ] **S7.5** Auth lifecycle E2E
  - Connect → challenge → sign → verify → JWT → refresh → refresh → logout
  - Verify refresh token reuse detection

- [ ] **S7.6** Monkey tests
  - Concurrent reviews from multiple reviewers
  - Rapid version uploads (10 versions in quick succession)
  - Permission edge cases (role combinations near boundaries)
  - Gate condition boundary testing (exactly at threshold)
  - State transition attempts from invalid states

- [ ] **S7.7** Performance benchmarks
  - Encryption throughput: AES-256-GCM encrypt/decrypt speed for 1 MB, 10 MB, 100 MB
  - API response times: p50, p95, p99 for key endpoints
  - Indexer processing: events per second throughput

### Acceptance Criteria
- Full lifecycle test passes end-to-end
- All monkey tests pass
- No security vulnerabilities discovered in permission testing
- Performance benchmarks within acceptable thresholds

---

## Completed Streams (Reference)

### Move Smart Contracts ✅

**Status:** COMPLETED — 2026-03-13
**Commits:** `0fb68aa` → `4f467b5` → `cd9f9af` → `580dc03` → `aa540d7` → `0109d4c`
**Location:** `contracts/rwa_dataroom/`
**Tests:** 160/160 pass

Modules implemented:
- types.move, errors.move, events.move, admin.move (Foundation)
- pool.move, dataroom.move, document.move, ic_decision.move (Core)
- dataroom_entry.move, document_entry.move, pool_entry.move (Entry functions)
- seal_policy.move (Seal verification)
- Unit tests, integration tests, monkey tests

---

## Stream Dependencies Quick Reference

| Stream | Can Start After | Must Complete Before |
|--------|----------------|---------------------|
| S0: Foundation | Immediately | S1, S2, S3, S4, S5, S6 |
| S1: DB + Indexer | S0 | S5 |
| S2: Encryption SDK | S0 | S3, S6 |
| S3: Walrus SDK | S0, S2 (interface only) | S6 |
| S4: DevOps | Immediately | — (enables deployment) |
| S5: Backend API | S0, S1 | S6 |
| S6: Frontend | S0, S2, S3, S5 | S7 |
| S7: Integration | All above | — (final) |

## Agent Prompt Templates

### Starting a stream:
```
Read docs/superpowers/plans/2026-03-13-full-implementation.md
and specs/implementation-architecture.md.
Execute Stream N: [Stream Name].
Start from task S{N}.1.
```

### Resuming a stream:
```
Read docs/superpowers/plans/2026-03-13-full-implementation.md
and specs/implementation-architecture.md.
Resume Stream N: [Stream Name].
Last completed task: S{N}.{X}. Continue from S{N}.{X+1}.
```

### Parallel launch (Phase 1):
```
Launch 4 agents in parallel:
- Agent 1: Execute Stream 1 (DB + Indexer)
- Agent 2: Execute Stream 2 (Encryption SDK)
- Agent 3: Execute Stream 3 (Walrus SDK)
- Agent 4: Execute Stream 4 (DevOps)
All depend on Stream 0 being complete. Read the plan and implementation architecture first.
```
