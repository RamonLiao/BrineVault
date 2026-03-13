# RWA Credit Data Room — Consolidated System Architecture

**Version:** 1.0
**Date:** 2026-03-13
**Status:** Approved
**Scope:** All Phases (Phase 1–3)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Market Context](#2-product-vision--market-context)
3. [Architecture Principles](#3-architecture-principles)
4. [Technology Stack](#4-technology-stack)
5. [On-Chain Architecture (Sui Move)](#5-on-chain-architecture-sui-move)
6. [Backend Architecture (NestJS)](#6-backend-architecture-nestjs)
7. [Database Architecture](#7-database-architecture)
8. [Storage Architecture (Walrus)](#8-storage-architecture-walrus)
9. [Encryption Architecture (Dual-Engine)](#9-encryption-architecture-dual-engine)
10. [Authentication & Session Management](#10-authentication--session-management)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Phase 2: Investor Onboarding & KYC](#12-phase-2-investor-onboarding--kyc)
13. [Phase 3: Post-Issuance Lifecycle](#13-phase-3-post-issuance-lifecycle)
14. [Security & Compliance](#14-security--compliance)
15. [Architecture Decision Records](#15-architecture-decision-records)
16. [Deployment & Operations](#16-deployment--operations)
17. [Glossary](#17-glossary)

---

## 1. Executive Summary

RWA Credit Data Room is a compliance-grade, on-chain Virtual Data Room (VDR) and Deal Hub purpose-built for tokenised private credit. It leverages Sui blockchain, Walrus decentralised storage, and Seal threshold encryption to deliver secure document management, permission-controlled access, and immutable audit trails — all with a Web2-grade user experience.

**Core differentiator:** This is not a file store. It is a Deal Hub — driven by DD Checklists, Gate Conditions, and a full state machine that governs the lifecycle of credit assets from draft to issuance to post-issuance servicing.

**Market context:**
- Tokenised private credit ≈ USD 140B (65% of total RWA market), growing 30%+ YoY
- Existing VDRs (Firmex, Datasite, iDeals) are Web2-based with no on-chain integration
- RWA infrastructure projects (Centrifuge, Goldfinch) lack structured document/compliance layers
- No competitor binds document state + contract state + on-chain compliance in a single platform

**Three-phase roadmap:**
- **Phase 1 (0–6 months):** Due diligence data room & state machine
- **Phase 2 (6–12 months):** Investor onboarding, KYC/AML, Seal graduated rollout, tokenisation bridge
- **Phase 3 (12–24 months):** Post-issuance lifecycle management, servicing events, open API/SDK

---

## 2. Product Vision & Market Context

### 2.1 Target Users

| Role | Description |
|------|-------------|
| **Originator / Asset Manager** | Creates and manages asset pools, drives DD and state progression |
| **Internal Risk / IC** | Reviews documents, assesses risk, issues approve/reject/request-changes decisions |
| **Legal / Structuring** | Drafts loan terms, reviews contracts, ensures legal compliance |
| **Compliance Officer** | Oversees end-to-end compliance, final sign-off before issuance |
| **External Auditor** | Independently verifies audit trails and document hashes |
| **Investor** (Phase 2) | Completes KYC, signs subscription agreements, accesses investor data room |

### 2.2 Target Jurisdictions

| Priority | Jurisdiction | Rationale |
|----------|-------------|-----------|
| **Primary** | Singapore (MAS) | Most active RWA tokenisation market in Asia; PDPA allows encrypted cross-border transfer |
| **Secondary** | EU (MiCA) | Most complete regulatory framework; higher compliance cost; Phase 2 entry |
| **Deferred** | US (SEC) | Highest regulatory uncertainty; not entering until clarity improves |

### 2.3 Competitive Positioning

| Aspect | RWA Credit Data Room | Web2 VDRs | RWA Infrastructure |
|--------|---------------------|-----------|-------------------|
| Document + contract binding | On-chain state machine tied to docs | No on-chain integration | Minimal doc layer |
| UX quality | Web2-grade (like Datasite/Firmex) | Mature | Raw blockchain UX |
| Compliance automation | Policy-as-code via Seal from day 1 | Manual workflows | Varies |
| Encryption | Client-side, zero-trust | Server-side | Varies |
| Audit trail | Immutable, on-chain events | Proprietary logs | On-chain but unstructured |

### 2.4 Business Model

| Item | Detail |
|------|--------|
| Free trial | 7 days, full features, no limitations |
| Post-trial | Account frozen; data retained 30 days; then purged |
| Pricing | Per-pool + storage capacity SaaS subscription |
| Freemium | None — targets institutional customers only |
| Walrus costs | Platform pays; included in subscription |
| Grace period | 14 days at 1.3× penalty rate after subscription expiry |
| Seal Beta | 10% discount; Invited Beta: free 3 months |

---

## 3. Architecture Principles

1. **Zero-Trust Client-Side Encryption** — The backend never touches plaintext files or encryption keys. All encryption/decryption occurs in the browser.
2. **On-Chain SSOT** — Sui smart contracts are the single source of truth for permissions, pool state, document metadata, and audit events.
3. **Eventual Consistency** — PostgreSQL is a read-optimised cache populated by the Indexer from on-chain events. When DB and chain diverge, chain wins.
4. **Dual-Engine Encryption** — AES-256-GCM (production) and Seal threshold encryption (beta) run in parallel behind an Encryption Abstraction Layer, transparent to users.
5. **Hybrid Signing** — High-privilege operations require user wallet signatures (non-repudiation); routine metadata writes are backend-sponsored (UX).
6. **Deal Hub, Not File Store** — DD Checklists, Gate Conditions, and the state machine drive structured workflows, not ad-hoc file sharing.

---

## 4. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Smart Contract | Sui Move | Package `rwa_dataroom`, 9+ modules |
| Backend | NestJS (Node.js / TypeScript) | REST API + gRPC indexer + cron workers |
| Frontend | Next.js + React + Sui dApp Kit | Client-side encryption SDK |
| Primary DB | PostgreSQL 16+ | Read cache / index; on-chain synced via Indexer |
| Cache / Session | Redis 7+ | Session store, rate limiting, cache invalidation |
| Storage | Walrus | Decentralised blob storage for encrypted files |
| Encryption | AES-256-GCM (production) + Seal (beta) | Dual-engine via abstraction layer |
| Indexer | Sui event indexer → PostgreSQL via gRPC | Event-driven, cursor-based, idempotent |
| Auth | Wallet signature + JWT session | Ed25519 challenge-response + httpOnly refresh cookie |
| Monitoring | Grafana + Prometheus + PagerDuty | Latency, error rate, Walrus health, SUI reserve |

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Client (Browser)                               │
│                                                                         │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  React/Next  │  │  Sui dApp Kit    │  │  Encryption SDK           │  │
│  │  UI Layer    │  │  (Wallet, TX)    │  │  ┌─────────┐ ┌─────────┐ │  │
│  │              │  │                  │  │  │AESEngine│ │SealEngine│ │  │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬────────────────┘  │
│         │                   │                       │                   │
└─────────┼───────────────────┼───────────────────────┼───────────────────┘
          │                   │                       │
          │ REST/WS           │ Sign TX               │ Upload/Download
          │                   │                       │ encrypted blobs
          ▼                   ▼                       ▼
┌──────────────────┐  ┌──────────────┐  ┌────────────────────────────────┐
│  API Gateway     │  │  Sui Network │  │  Walrus                        │
│  (NestJS)        │  │              │  │  ┌───────────┐ ┌────────────┐  │
│                  │  │  Move Modules│  │  │ Publisher │ │ Aggregator │  │
│  - Auth (JWT)    │  │  - Pool      │  │  └───────────┘ └────────────┘  │
│  - REST API      │  │  - DataRoom  │  │                                │
│  - TX Builder    │  │  - Document  │  │  ┌───────────────────────────┐  │
│  - Sponsored TX  │  │  - IC Dec.   │  │  │ Seal Key Servers         │  │
│                  │  │  - Seal Pol. │  │  │ (threshold encryption)   │  │
│  ┌────────────┐  │  │              │  │  └───────────────────────────┘  │
│  │ Indexer    │  │  │              │  │                                │
│  │ (gRPC sub) │  │  │              │  └────────────────────────────────┘
│  └─────┬──────┘  │  └──────────────┘
│        │         │
│        ▼         │
│  ┌────────────┐  │  ┌────────────────┐
│  │ PostgreSQL │  │  │  Redis         │
│  │ (read idx) │  │  │  (session/cache)│
│  └────────────┘  │  └────────────────┘
└──────────────────┘
```

---

## 5. On-Chain Architecture (Sui Move)

### 5.1 Module Layout

```
rwa_dataroom/sources/
  types.move          — Role bitmasks, state enums, doc types, encryption schemes
  errors.move         — Error constants (all E_ prefixed, numeric abort codes)
  events.move         — All event struct definitions
  admin.move          — AdminConfig shared object, AdminCap, pause/unpause
  pool.move           — Pool object, state machine, IC decision storage
  dataroom.move       — DataRoom, membership Table, folder management, encrypted keys
  document.move       — Document, DocVersion (dynamic fields), ReviewRecord
  ic_decision.move    — ICDecision struct creation and validation
  seal_policy.move    — Seal key server verification entry point

rwa_dataroom/sources/entry/
  dataroom_entry.move — Entry functions for dataroom operations
  document_entry.move — Entry functions for document operations
  pool_entry.move     — Entry functions for pool state transitions

rwa_dataroom/tests/
  *_tests.move        — Unit, integration, and monkey tests (160 total)
```

### 5.2 Object Ownership Model

```
AdminCap (transfer)
  └── held by deployer

AdminConfig (shared)
  └── global pause/unpause

Pool (owned by creator)
  ├── state: u8 (Draft → ... → Ready_To_Issue / Rejected / Cancelled)
  ├── encryption_scheme: u8
  ├── Dynamic Fields:
  │   ├── ic_decision_0: ICDecision
  │   ├── ic_decision_1: ICDecision
  │   └── ...
  └── dataroom_id: ID

DataRoom (owned object)
  ├── pool_id: ID
  ├── folders: vector<Folder>
  ├── members: Table<address, u8>  (address → role bitmask)
  └── Dynamic Fields:
      ├── encrypted_keys per folder per member
      └── ...

Document (owned object)
  ├── dataroom_id: ID, pool_id: ID
  ├── folder_id: u64
  ├── current_version: u64
  ├── approval_count: u64  (tracks approved reviews; DFs cannot be iterated)
  ├── Dynamic Fields:
  │   ├── version_1: DocVersion { walrus_blob_id, content_hash, ... }
  │   ├── version_2: DocVersion
  │   └── ...
  └── ReviewRecords as DFs: reviewer_address → ReviewRecord
```

### 5.3 Role Bitmask System

Independent bits, not hierarchical. Use bitwise AND to check permissions.

| Role | Value | Binary | Permissions |
|------|-------|--------|-------------|
| VIEWER | 1 | `000001` | Read authorised documents |
| REVIEWER | 2 | `000010` | View + mark review status + comment |
| EDITOR | 4 | `000100` | Upload/update documents + comment |
| OWNER | 8 | `001000` | Full pool management (includes EDITOR + REVIEWER) |
| AUDITOR | 16 | `010000` | Read-only metadata + audit trail (no plaintext access) |
| ORG_ADMIN | 32 | `100000` | Cross-pool management |
| ALL | 63 | `111111` | All roles combined |

**Permission inheritance:**
- OWNER implicitly includes EDITOR + REVIEWER + VIEWER permissions
- ORG_ADMIN implicitly includes OWNER on all pools within the organisation
- Bitmask composition: e.g., `VIEWER | REVIEWER = 3`
- Roles are assigned per-pool; a user may hold different roles across pools

**Permission matrix:**

| Operation | VIEWER | REVIEWER | EDITOR | OWNER | AUDITOR | ORG_ADMIN |
|-----------|--------|----------|--------|-------|---------|-----------|
| View authorised documents | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| View document metadata/hash | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Comment | — | ✓ | ✓ | ✓ | — | ✓ |
| Mark review status | — | ✓ | — | ✓ | — | ✓ |
| Upload/update documents | — | — | ✓ | ✓ | — | ✓ |
| Manage members | — | — | — | ✓ | — | ✓ |
| Transition pool state | — | — | — | ✓ | — | ✓ |
| View audit trail | — | — | — | ✓ | ✓ | ✓ |
| Cross-pool management | — | — | — | — | — | ✓ |
| Create/close pools | — | — | — | — | — | ✓ |

### 5.4 Pool State Machine

#### 5.4.1 State Definitions

| State | Value | Description |
|-------|-------|-------------|
| `Draft` | 0 | Pool just created; setting up metadata and uploading initial documents |
| `DD_In_Progress` | 1 | Due diligence underway; all required documents being uploaded and reviewed |
| `IC_Review` | 2 | Investment Committee reviewing; awaiting IC decision |
| `Approved_Internal` | 3 | Internally approved; awaiting legal and compliance final confirmation |
| `Ready_To_Issue` | 4 | All prerequisites met; ready for tokenisation (Phase 2) |
| `Rejected` | 5 | IC rejected the pool |
| `Cancelled` | 6 | Owner cancelled the pool |
| `Issued` | 7 | (Phase 2) RWA token minted and distributed |
| `Closed` | 8 | (Phase 2) Pool lifecycle ended |

#### 5.4.2 Transition Diagram

```
                          ┌──────────────────────────────────┐
                          │         Request Changes          │
                          │    (IC requests more data)        │
                          ▼                                  │
Draft ──→ DD_In_Progress ──→ IC_Review ──→ Approved_Internal ──→ Ready_To_Issue
  │                │              │                                    │
  │                │              └──→ Rejected                        │ (Phase 2)
  │                │                      │                            ▼
  └──→ Cancelled   └──→ Cancelled         └ ─ ─ → Draft (re-open)   Issued → Closed
```

#### 5.4.3 Transition Rules with Gate Conditions

| From | To | Trigger | Gate Condition |
|------|----|---------|---------------|
| Draft | DD_In_Progress | OWNER | All Required Checklist Items ≥ Uploaded |
| DD_In_Progress | IC_Review | OWNER | All Required Checklist Items = Reviewed |
| IC_Review | Approved_Internal | OWNER (requires IC Approve decision) | IC decision_type = Approve |
| IC_Review | Rejected | OWNER (requires IC Reject decision) | IC decision_type = Reject |
| IC_Review | DD_In_Progress | OWNER (requires IC RequestChanges) | IC decision_type = RequestChanges |
| Approved_Internal | Ready_To_Issue | OWNER | Legal Required Items finalised + Compliance checklist complete |
| Draft | Cancelled | OWNER | None |
| DD_In_Progress | Cancelled | OWNER | None |
| Rejected | Draft | OWNER (optional) | None |
| Ready_To_Issue | Issued | System (Phase 2) | Token minted successfully |
| Issued | Closed | OWNER (Phase 2) | All positions redeemed/transferred |

Gate Conditions are enforced on-chain by the Move contract. The frontend simultaneously displays unfulfilled conditions, greying out the transition button.

### 5.5 DD Checklist System

The DD Checklist is the core differentiating feature, elevating the platform from a file store to a structured Deal Hub.

#### Default Folder Structure

```
DataRoom/
├── Legal/           — Legal documents (agreements, guarantees, terms)
├── Financials/      — Financial documents (statements, cashflow, management accounts)
├── Collateral/      — Collateral documents (valuations, insurance, title)
├── Compliance/      — Compliance documents (KYC, AML, sanctions screening)
├── Reports/         — Reports (DD report, credit rating)
└── Misc/            — Other
```

#### Checklist Item Properties

Each item has:
- `item_id`, `folder`, `name`
- `requirement_level`: Required / Conditional / Optional
- `status`: Not_Uploaded → Uploaded → In_Review → Reviewed → Needs_Revision → Not_Applicable
- `linked_doc_id`: Reference to uploaded Document object

Customisation: OWNER and ORG_ADMIN can add, remove, or modify checklist items and their requirement levels. Checklist templates can be reused across pools.

#### Suggested Items per Folder

**Legal/**: Loan Agreement (Required), Security Agreement (Required), Intercreditor Agreement (Conditional), Legal Opinion (Required), Corporate Authorisation (Required), Subordination Agreement (Optional)

**Financials/**: Audited Financial Statements 3Y (Required), Management Accounts Latest Quarter (Required), Cashflow Projections (Required), Tax Returns 2Y (Required), Debt Schedule (Required), Budget / Business Plan (Optional)

**Collateral/**: Collateral Valuation Report (Required), Insurance Certificates (Required), Title / Ownership Documents (Required), Environmental Assessment (Conditional)

**Compliance/**: KYC Documentation (Required), AML Screening Results (Required), Sanctions Screening (Required), Regulatory Opinion (Optional)

**Reports/**: Due Diligence Report (Required), Credit Rating / Scoring (Optional), Third-Party Assessment (Optional)

### 5.6 Per-Reviewer Document Review System

Each reviewer has an independent review state per document:

| Reviewer State | Description |
|---------------|-------------|
| Pending | Reviewer has not yet reviewed |
| Approved | Reviewer marked as approved |
| NeedsRevision | Reviewer marked as needing revision (must include rationale) |

**Aggregation rules for document-level status:**

| Aggregated Status | Condition |
|-------------------|-----------|
| NotReviewed | All reviewers are Pending |
| InReview | At least one reviewer has submitted; others still Pending |
| Reviewed | All assigned reviewers are Approved |
| NeedsRevision | At least one reviewer is NeedsRevision (regardless of others) |

**Key rules:**
- OWNER assigns which reviewers must review each document
- When a new document version is uploaded, all reviewer states reset to Pending
- Review state changes emit on-chain events for the audit trail
- The `approval_count` field on Document tracks approved reviews (since dynamic fields cannot be iterated)

### 5.7 IC Decision System

- IC members register decisions via the platform: Approve / Reject / RequestChanges
- Each decision must include a rationale or signed PDF decision document
- Decision data is written on-chain as `ICDecision` objects stored as dynamic fields on the Pool (keyed by u64 index)
- `ic_decision::new()` includes built-in validation (decision_type, committee members, votes)
- All decisions are immutable on-chain records
- `has_ic_approval` requires iterating through IC decision dynamic fields

### 5.8 Events and Audit Trail

All core operations emit on-chain events. Every event includes a `timestamp: u64` parameter.

| Event | Tracked Data |
|-------|-------------|
| PoolCreated | Originator, currency, target_size, encryption_scheme |
| PoolStateChanged | From state, to state, trigger actor, gate condition results |
| DataRoomCreated | Pool ID, owner address |
| MemberAdded | Member address, role bitmask, added_by |
| MemberRemoved | Member address, removed_by |
| MemberRoleUpdated | Member address, old role, new role |
| DocumentCreated | Doc ID, folder, title, walrus_blob_id, content_hash |
| DocumentVersionAdded | Doc ID, version number, new blob_id, new hash |
| DocumentReviewed | Doc ID, reviewer address, status (Approved/NeedsRevision) |
| ICDecisionCreated | Pool ID, decision_type, decider address, decision doc blob_id |
| FolderCreated | DataRoom ID, folder name |
| KeyRotated | Affected folders, trigger reason (member removal) |
| AuditEvent | Generic event for additional tracking |

All audit trail data is immutable and undeletable. The AUDITOR role can access all audit trails and document hashes but cannot access plaintext documents.

### 5.9 Error Handling

Error constants use the `E_` prefix with numeric abort codes. In `#[expected_failure]` test annotations, raw abort codes must be used (e.g., `abort_code = 306`), not function calls like `errors::xxx()`.

Error accessor naming uses snake_case (e.g., `not_member()`, not `e_not_member()`).

Key gotchas from implementation:
- `admin::assert_not_paused` uses error code 101 (EPoolPaused), not 500 (EAlreadyPaused)
- Role bitmask is independent bits — `OWNER(8) & VIEWER(1) = 0`; only `role_all()(63)` contains all roles
- Plan's `dataroom::add_member(...)` calls are package-only; tests must use `*_entry` module entry functions

### 5.10 Seal Policy Module

Two public functions for Seal key server verification:
- `can_access(pool, caller, min_role)` — Verifies the caller is an active member with at least `min_role`. DataRoom is borrowed internally from Pool (DOF), not passed as a separate argument.
- `can_access_folder(pool, caller, folder_visible_to_roles)` — Verifies the caller's role matches the folder's visibility bitmask. The caller passes the pre-resolved visibility mask (from the Document's `visible_to_roles` field); the function does not look up folder metadata on-chain.

These are called by Seal key servers to decide whether to release decryption key shares.

---

## 6. Backend Architecture (NestJS)

### 6.1 API Overview

Base URL: `https://api.rwadataroom.io/v1`
All endpoints except `/auth/*` require Bearer JWT + CSRF token for mutations.
Pagination: limit max 100 per page; filtering and sorting via query string.

Standard error envelope:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### 6.2 API Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 4 | Wallet challenge/verify, refresh, logout |
| Organisation | 5 | CRUD + member management + invite codes |
| Pool | 6 | CRUD + state transitions (user-signed TX) |
| DataRoom | 5 | Folder management + member management |
| Document | 7 | Upload metadata / download / version management |
| Checklist | 5 | CRUD + status tracking + template management |
| Review | 4 | Per-reviewer review operations |
| IC Decision | 3 | Submit / query decisions |
| Audit | 3 | Query audit trail + export (JSON/CSV) |
| Notification | 4 | Preferences + in-app notifications |
| Billing | 5 | Subscription + invoice management |
| Admin | 4 | Platform admin operations (pause/unpause) |

### 6.3 Transaction Signing Model (Hybrid)

| Operation | Signer | Gas Sponsor | Rationale |
|-----------|--------|-------------|-----------|
| Pool state transition | User (browser) | User | Non-repudiation for high-privilege ops |
| Member add/remove | User (browser) | User | Permission changes require explicit authorisation |
| IC decision submit | User (browser) | User | Legal accountability, personal signature |
| Document review state change | User (browser) | User | Reviewer accountability |
| File metadata write | Backend (platform key) | Platform (sponsored) | Routine operation, UX improvement |
| Audit event emit | Backend (platform key) | Platform (sponsored) | System-triggered automation |

**User-signed flow:**
1. Frontend requests operation → Backend builds `TransactionBlock` (unsigned)
2. Backend returns serialised `tx_bytes` (base64)
3. Frontend requests wallet signature from user
4. User confirms and signs
5. Frontend sends signed TX back to Backend
6. Backend submits to Sui RPC

**Platform key management:**
- Production: HSM or KMS
- Development: Ed25519 keypair in environment variables (never committed)
- Platform key only used for sponsored TX; holds no high-privilege roles
- Gas budget cap per sponsored TX to prevent anomalous consumption

### 6.4 Event Indexer

Standalone worker process connecting to a Sui Full Node via gRPC (or JSON-RPC event subscription).

**Event-to-table mapping:**

| Sui Event | Target Table(s) | Operation |
|-----------|-----------------|-----------|
| PoolCreated | pools | INSERT |
| PoolStateChanged | pools | UPDATE current_state |
| DataRoomCreated | datarooms | INSERT |
| MemberAdded | members | INSERT or UPDATE (reactivation) |
| MemberRemoved | members | UPDATE is_active=false |
| MemberRoleUpdated | members | UPDATE role |
| DocumentCreated | documents | INSERT |
| DocumentVersionAdded | document_versions, documents | INSERT version, UPDATE current_version |
| DocumentReviewed | document_reviews | UPSERT |
| ICDecisionCreated | ic_decisions | INSERT |
| AuditEvent | audit_events | INSERT |

**Processing flow:**
1. Read last cursor from `indexer_checkpoints`
2. Subscribe to events starting from cursor
3. For each event batch: begin DB transaction → process events → update cursor → commit
4. On crash/restart: resume from last committed cursor (at-least-once delivery)

**Idempotency:** Each event is uniquely identified by `(sui_tx_digest, sui_event_seq)`. Tables use UPSERT logic keyed on `sui_object_id`.

**Cache invalidation:** When the Indexer updates a core table, it deletes the corresponding Redis cache key (`cache:pool:{id}`, `cache:members:{pool_id}`).

### 6.5 Background Workers

| Worker | Schedule | Responsibility |
|--------|----------|---------------|
| Walrus Renewal | Daily 00:00 UTC | Renew blobs within 30-day expiry window |
| Walrus Backup | Event-driven (async) | Backup encrypted blobs to S3 for Seal Beta pools |
| Subscription Monitor | Daily | Check expiring subscriptions, send reminders, manage grace period |
| Notification Dispatcher | Event-driven | Send email + in-app notifications |
| Cost Tracker | Daily | Aggregate Walrus costs per pool per period |

### 6.6 Notification System

| Trigger Event | Recipients | Channels |
|--------------|-----------|----------|
| Document marked NeedsRevision | EDITOR (uploader) | Email + In-App |
| Document assigned for review | Assigned REVIEWER | Email + In-App |
| All reviewers completed | OWNER | In-App |
| IC decision submitted | OWNER | Email + In-App |
| IC RequestChanges (sent back to DD) | OWNER + all EDITORs | Email + In-App |
| Pool state changed | All pool members | Email + In-App |
| Member added to pool | New member | Email + In-App |
| Member removed from pool | Removed member | Email |
| Subscription expiring (30 days before) | ORG_ADMIN + OWNER | Email (weekly) |
| Account frozen / overdue | ORG_ADMIN + OWNER | Email |
| Checklist item marked Not Applicable | All REVIEWERs | In-App |
| New document version uploaded (review reset) | Assigned REVIEWERs | Email + In-App |

User preferences: Email frequency (immediate / daily digest / weekly digest). In-app notifications cannot be disabled. Subscription notifications cannot be disabled.

---

## 7. Database Architecture

### 7.1 Data Consistency Model

| Layer | Guarantee |
|-------|-----------|
| Sui on-chain | Strong consistency (finality) |
| PostgreSQL (core tables) | Eventual consistency via Indexer (~<2s delay) |
| PostgreSQL (off-chain tables) | Strong consistency (direct API writes) |
| Redis cache | Best-effort, TTL-based expiry |

Core tables (pools, datarooms, members, documents, document_versions, document_reviews, ic_decisions, audit_events) are written **only by the Indexer**. The API treats them as read-only. For critical authorisation checks, the API falls back to direct on-chain RPC queries when DB data is older than 5 seconds.

### 7.2 Core Tables (On-Chain Synced)

**pools** — sui_object_id (UNIQUE), org_id (FK), name, borrower_name_hash, currency, target_notional, expected_maturity_date, current_state (SMALLINT 0–8), encryption_scheme (0=AES, 1=Seal), created_by_address, timestamps, sui_tx_digest

**datarooms** — sui_object_id (UNIQUE), pool_id (FK), owner_address, member_count, timestamps

**members** — dataroom_id (FK), pool_id (FK), member_address, role (SMALLINT bitmask 1–63), added_by_address, is_active, revoked_at. Unique index on (dataroom_id, member_address).

**documents** — sui_object_id (UNIQUE), pool_id (FK), dataroom_id (FK), folder_id, doc_type, title, tags (TEXT[]), current_version, version_count, required_flag, encryption_scheme, timestamps. GIN index for full-text search on title + tags.

**document_versions** — document_id (FK), version (INT), walrus_blob_id, content_hash (SHA-256), size_bytes, uploaded_by_address, change_log. Unique index on (document_id, version).

**document_reviews** — document_id (FK), reviewer_address, status (0=Pending, 1=Approved, 2=NeedsRevision), comment_hash, reviewed_at. Unique index on (document_id, reviewer_address).

**ic_decisions** — pool_id (FK), decision_index, decision_type, decision_text, decision_pdf_blob_id, created_by_address, committee_members (JSONB), votes (JSONB), related_doc_ids (JSONB). Unique index on (pool_id, decision_index).

**audit_events** — pool_id (FK), event_type (TEXT), actor_address, target_id, metadata (JSONB), sui_tx_digest, sui_event_seq, timestamp. Unique index on (sui_tx_digest, sui_event_seq). Consider monthly range partitioning at 10M+ rows.

### 7.3 Off-Chain Tables

**organisations** — name, legal_name, billing_plan (ENUM: free_trial/pro/enterprise), default_policies (JSONB), created_by_user_id (FK)

**users** — primary_wallet_address (UNIQUE), email, display_name, org_id (FK), role_in_org, last_login_at

**comments** — document_id (FK), pool_id (FK), author_address, content, parent_comment_id (self-FK for threading)

**notifications** — user_id (FK), type (TEXT), title, body, related_pool_id, related_document_id, is_read

**notification_preferences** — user_id (FK, UNIQUE), email_enabled, in_app_enabled, preferences (JSONB per notification type)

**checklist_templates** — name, description, items (JSONB array)

**pool_checklist_items** — pool_id (FK), folder, item_name, is_required, linked_document_id (FK), status (ENUM: missing/uploaded/reviewed/needs_revision)

**subscriptions** — org_id (FK), plan, status (ENUM: trial/active/expired/grace_period/suspended), trial dates, period dates, grace_period_end, penalty_rate (default 1.30), amount, currency (default SGD)

**invoices** — org_id (FK), subscription_id (FK), amount, currency, status (ENUM: pending/paid/overdue/cancelled), penalty_applied, issued_at, due_at, paid_at

**invite_codes** — org_id (FK), code (UNIQUE, format: `{ORG_PREFIX}-{RANDOM_4}-{RANDOM_4}`), created_by_user_id (FK), max_uses, current_uses, expires_at

**indexer_checkpoints** — chain_id, last_cursor, last_tx_digest, last_event_seq

### 7.4 Redis Schema

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `session:{sid}` | Hash | 7 days | User session (user_id, wallet, org_id, role, csrf) |
| `csrf:{token}` | String | 15 min | CSRF token validation |
| `auth:challenge:{nonce}` | Hash | 5 min | Auth challenge for wallet signature |
| `rate:auth:{ip}` | Counter | 60s | Auth rate limiter (max 5/min) |
| `rate:api:{user_id}` | Counter | 60s | API rate limiter (max 100/min) |
| `cache:pool:{pool_id}` | Hash | 30s | Cached pool data |
| `cache:members:{pool_id}` | Hash | 30s | Cached member list |
| `notification:unread:{user_id}` | Counter | 60s | Unread notification count |
| `token:blacklist:{jti}` | String | Remaining JWT life | Logged-out JWT blacklist |
| `ws:connections:{user_id}` | Set | None | Active WebSocket connections |

---

## 8. Storage Architecture (Walrus)

### 8.1 Core Concepts

| Concept | Description |
|---------|-------------|
| **Blob** | Immutable binary object on Walrus (encrypted file bytes in this project) |
| **Blob ID** | Unique identifier returned by Publisher. **Not a CID** — not content-addressed. Same plaintext with different IV produces different Blob ID |
| **Publisher** | Service endpoint that receives blob uploads, performs erasure coding |
| **Aggregator** | Service endpoint that reconstructs blobs from storage node shards |
| **Storage Epoch** | Time unit; blobs are stored for N epochs. Expired blobs are permanently lost |
| **Erasure Coding** | Redundant sharding across multiple storage nodes for fault tolerance |

### 8.2 Upload Flow

```
User selects file in browser
  │
  ▼
① Frontend reads file as ArrayBuffer
② Frontend fetches folder AES key from Sui (encrypted with user's public key)
③ Frontend decrypts AES key locally with user's keypair
④ Frontend computes SHA-256 of plaintext (for integrity verification)
⑤ Frontend generates random IV (12 bytes) and encrypts with AES-256-GCM
   Upload payload = IV (12 bytes) ∥ ciphertext ∥ auth_tag (16 bytes)
⑥ Frontend uploads directly to Walrus Publisher
   POST {publisher_url}/v1/blobs?epochs=N
⑦ Walrus returns blob_id, size, expiry_epoch, cost
⑧ Frontend calls Backend API with metadata
   POST /api/v1/pools/:poolId/documents
⑨ Backend builds sponsored Sui TX → creates Document object on-chain
⑩ Sui emits DocumentCreated event
⑪ Indexer syncs to PostgreSQL
⑫ Frontend receives response with document_id
```

**Key design decisions:**
- Frontend uploads directly to Walrus — ciphertext never passes through Backend
- Backend only handles metadata — consistent with zero-trust architecture
- `content_hash` is the hash of the **plaintext**, used to verify decryption integrity

### 8.3 Download Flow

```
User clicks download in UI
  │
  ▼
① Frontend fetches Document metadata from Backend API
② Frontend fetches folder AES key from Sui
③ Frontend decrypts AES key locally
④ Frontend downloads blob from Walrus Aggregator
   GET {aggregator_url}/v1/blobs/{blob_id}
⑤ Frontend splits: iv = blob[0:12], ciphertext = blob[12:]
⑥ Frontend decrypts with AES-256-GCM
⑦ Frontend verifies: SHA-256(plaintext) === on_chain_content_hash
   If mismatch → abort, show tampering warning, log security event
⑧ Frontend presents plaintext to user (download or preview)
```

**Seal engine difference:** Instead of fetching AES key from Sui dynamic field, the frontend requests threshold decryption shares from Seal key servers, who verify on-chain Move policy before releasing shares. The frontend reconstructs the key locally.

### 8.4 Chunked Upload (Files > 50 MB)

| Parameter | Value |
|-----------|-------|
| Chunking threshold | 50 MB |
| Chunk size | 10 MB |
| Max file size | ~256 MB (Walrus limit) |
| Concurrent uploads | 3 chunks in parallel |
| Retry per chunk | Max 3 attempts, exponential backoff |

**Flow:**
1. Split plaintext into 10 MB chunks
2. Each chunk encrypted independently (unique IV per chunk)
3. Each chunk uploaded as independent blob to Walrus
4. Compose chunk manifest (JSON with all chunk blob_ids + sizes)
5. Manifest stored in Document metadata

**Download:** Fetch chunks in parallel (3 concurrent), decrypt each, concatenate in order, verify overall SHA-256 hash.

### 8.5 Blob Lifecycle Management

**Renewal Worker** runs daily at 00:00 UTC:
- Queries all active pools' document versions (including superseded versions — audit trail requirement)
- If `expiry_epoch - current_epoch ≤ 30 days`: renew via `POST /v1/blobs/{blob_id}/extend?epochs=N`
- On failure: retry 5× with exponential backoff → alert Ops team + email Pool Owner
- Stops renewing after subscription grace period ends (day 15+)

**Subscription expiry impact:**

| Subscription Status | Blob Handling |
|--------------------|---------------|
| Active | Automatic renewal; costs absorbed by platform |
| Grace Period (day 1–14) | Platform continues renewal at 1.3× penalty rate |
| Post-Grace (day 15+) | Platform stops renewal; blobs expire with their epochs; data permanently lost |

### 8.6 Backup Strategy

**Seal Beta pools:** Mandatory backup of encrypted blobs to S3 (ap-southeast-1, Standard-IA, server-side AES-256). Backup content is ciphertext only — still requires Seal key shares to decrypt.

**AES pools:** Optional backup (configurable per pool). Same S3 strategy.

Backup is disaster recovery only, not primary storage. Recovery requires admin intervention: fetch from S3 → re-upload to Walrus → update on-chain Blob ID.

### 8.7 File Preview Pipeline

| Format | Preview Method | Technology |
|--------|---------------|------------|
| PDF | In-browser embedded | PDF.js (mozilla/pdf.js) |
| Images (PNG, JPG, WebP, GIF) | Native browser rendering | `<img>` + `URL.createObjectURL()` |
| Plain text (TXT, CSV, JSON) | In-browser display | `<pre>` or Monaco Editor (read-only) |
| Other (DOCX, XLSX, etc.) | No preview | "Download to view" button |

Watermark: User address (truncated) + UTC timestamp, rendered client-side on canvas overlay. Purpose: leak attribution.

---

## 9. Encryption Architecture (Dual-Engine)

### 9.1 Encryption Abstraction Layer

```
┌────────────────────────────────────────────────────┐
│                 Client SDK                          │
│                                                    │
│   EncryptionEngine (interface)                     │
│     ├── AESEngine   (Production, default)          │
│     └── SealEngine  (Beta, optional)               │
│                                                    │
│   Upload:  engine.encrypt(file) → encrypted blob   │
│   Download: engine.decrypt(blob) → plaintext       │
│                                                    │
│   Document metadata: encryption_scheme: "aes"|"seal"│
│   SDK auto-selects correct engine for decryption   │
└────────────────────────────────────────────────────┘
```

Users experience identical UX regardless of engine. The only visible difference: a small badge in the Pool header (🔐 AES-256 or 🧪 Seal Beta).

### 9.2 AES Engine (Production)

| Property | Specification |
|----------|--------------|
| Algorithm | AES-256-GCM |
| Key granularity | Per-folder symmetric key |
| Key distribution | Key encrypted with each member's public key, stored in Sui dynamic fields |
| Key access | Only addresses in DataRoom.members can retrieve encrypted keys via Move contract |
| Decryption flow | Fetch encrypted key → decrypt locally with private key → download blob from Walrus → decrypt file locally |
| SLA | Full production SLA |
| Compliance | SOC 2 / ISO 27001 full coverage |
| Pricing | 100% standard price |

### 9.3 Seal Engine (Beta)

| Property | Specification |
|----------|--------------|
| Mechanism | Seal threshold encryption |
| Policy definition | Defined in Move contract (`seal_policy.move`) |
| Key distribution | Seal key servers verify on-chain Move policy, then release key shares |
| Decryption flow | Request shares from Seal key servers → servers verify policy → client reconstructs key locally → decrypt |
| SLA | Best-effort, explicitly marked Beta |
| Compliance | Not included in formal audit scope; separate Beta security report |
| Pricing | 90% standard price (10% Beta discount) |

**Critical clarification:** Seal is not a backend API. It uses threshold encryption where key servers verify on-chain Move policies to decide whether to release key shares. The entire decryption process occurs client-side.

### 9.4 Key Management

**Per-folder key rotation on member removal:**
1. Generate new folder key for every folder the removed member had access to
2. Encrypt new key with remaining members' public keys → update Sui dynamic fields
3. Re-encrypt all files in affected folders with new key + new IV → upload new blobs to Walrus
4. Update on-chain Blob IDs (old blobs naturally expire)
5. Emit KeyRotated event on-chain

**Performance consideration:** Key rotation is expensive — may take significant time for large pools. UI should show progress indicator. Consider scheduling during off-peak hours and processing in batches.

**Key Recovery — 2-of-3 Shamir's Secret Sharing:**
```
Pool Owner creates pool → generates recovery shares
  ├── Share 1: Owner (wallet)
  ├── Share 2: Org Admin (organisational backup)
  └── Share 3: Platform Escrow (activated only during recovery)

Recovery requires any 2-of-3 shares
```

- Sui native multi-sig address as Pool Owner
- Platform escrow share requires explicit legal terms; only activated in recovery flow
- Recovery flow requires identity verification + cooling period (social engineering defence)

### 9.5 Seal Graduated Rollout

**Phase 1 — Dual Launch (v0 launch):**
- New pools default to AES Engine
- Optional "Enable Seal Beta Engine" checkbox with explicit Beta disclosure
- Once chosen, an existing pool's engine **cannot be changed** (avoids re-encryption risk)

**Phase 2 — Invited Beta (3–6 months post-launch):**
- Small-batch invitations to tech-friendly mid-tier customers
- Invited customers: Seal pools free for 3 months (platform subsidised)
- Continuous monitoring: key server uptime, encrypt/decrypt latency (p50/p95/p99), failure rate

**Phase 3 — Seal promoted to production (all targets met):**
- Seal key server uptime ≥ 99.9% for 90 consecutive days
- Encrypt/decrypt p99 latency ≤ 2× AES
- Failure rate < 0.1%
- At least 10 Beta pools running 6 months with no major incidents
- Independent security audit passed

**Post-promotion:** New pools default to Seal; AES retained as "Classic" (never removed). Migration incentive: existing AES customers creating new Seal pools get 15% first-year discount. No automatic migration of existing pools.

### 9.6 Seal Engine Failure Handling

- If Seal key servers are temporarily unavailable: show friendly error message
- **Never auto-fallback to AES** — mixing engines would break the security model
- Log event to monitoring + notify platform on-call
- Seal Beta pool files maintain AES-encrypted backup on S3 as disaster recovery

---

## 10. Authentication & Session Management

### 10.1 Wallet Authentication Flow

```
Browser Wallet          Frontend (Next.js)          Backend (NestJS)          Redis
     │                       │                           │                     │
     │  1. Connect Wallet    │                           │                     │
     │◄─────────────────────►│                           │                     │
     │                       │  2. GET /auth/challenge    │                     │
     │                       │──────────────────────────►│  3. Store nonce     │
     │                       │                           │────────────────────►│
     │                       │  4. { nonce, timestamp }   │                     │
     │                       │◄──────────────────────────│                     │
     │  5. Sign message      │                           │                     │
     │◄──────────────────────│                           │                     │
     │  6. signature         │                           │                     │
     │──────────────────────►│  7. POST /auth/verify      │                     │
     │                       │──────────────────────────►│  8-11. Verify +     │
     │                       │                           │  create session     │
     │                       │  12. JWT + Set-Cookie      │────────────────────►│
     │                       │◄──────────────────────────│                     │
```

**Verification steps (in order):**
1. Nonce exists in Redis and not expired (5 min TTL); delete after use (one-time)
2. Challenge timestamp within 5 minutes
3. Signature valid for address (using `@mysten/sui` SDK `verifyPersonalMessageSignature()`)
4. User upserted to PostgreSQL
5. Session created in Redis
6. JWT access token (Ed25519 signed, 15 min) + refresh token (opaque 64-byte hex, 7 days via httpOnly cookie)

### 10.2 Token Specifications

| Token | Storage | TTL | Purpose |
|-------|---------|-----|---------|
| Access Token (JWT) | Frontend memory (not localStorage) | 15 min | API request authentication |
| Refresh Token | httpOnly, Secure, SameSite=Strict cookie | 7 days | Issue new access tokens |

**JWT payload:** sub (user UUID), address, org_id, org_role, sid (session ID), iat, exp

**Refresh token rotation:** Each refresh issues new access + new refresh token; old refresh immediately invalidated. Reuse detection: if a rotated-out refresh token is reused → invalidate entire session, force re-login.

### 10.3 First-Time User & Organisation Flow

```
Wallet connected + JWT issued
  │
  ▼
Backend checks user.org_id
  │
  ├── org_id == null → Onboarding page
  │     ├── "Create Organisation" → fill name + legal name → POST /v1/orgs → user becomes org_admin
  │     └── "Join Organisation" → enter invite code → POST /v1/orgs/join → role set by invite
  │
  └── org_id != null → Dashboard
```

- Invite code format: `{ORG_PREFIX}-{RANDOM_4}-{RANDOM_4}` (human-readable, e.g., `MAPLE-A3X9-K2M7`)
- One user per organisation (Phase 1 limitation)
- Only org_admin can generate invite codes

### 10.4 Permission Check Layers

```
Layer 1: JWT validity (NestJS AuthGuard)
Layer 2: Organisation membership (user.org_id matches request org)
Layer 3: Pool membership + role (check against DB, fail fast)
Layer 4: On-chain verification (Move contract execution-time validation — final authority)
```

Layers 1–3 are performance optimisations, not security boundaries. Layer 4 is the ultimate authority.

### 10.5 Security Mechanisms

| Mechanism | Implementation |
|-----------|---------------|
| Rate limiting | Redis sliding window: /auth/challenge 10/min per IP, /auth/verify 5/min per IP, API reads 100/min per user, writes 30/min per user |
| CORS | Whitelist frontend domain only (+ localhost:3000 in dev) |
| CSRF | SameSite=Strict cookie + X-CSRF-Token header for all mutations |
| Security headers | HSTS, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, CSP, Referrer-Policy |
| JWT blacklist | On logout, jti added to Redis with TTL = remaining token lifetime |
| Anomaly detection | Refresh token reuse → session invalidation; IP burst → rate limit + 15 min block |

---

## 11. Frontend Architecture

### 11.1 Technology

- **Framework:** Next.js + React
- **Wallet integration:** Sui dApp Kit (wallet connect, transaction signing)
- **State management:** TanStack Query for server state
- **Encryption:** Client-side Encryption SDK (AES Engine + Seal Engine abstraction)
- **Styling:** Tailwind CSS or similar utility-first framework
- **Design system:** Inter or Plus Jakarta Sans font; Sui blue (#007BFF) primary

### 11.2 Key Screens

| # | Screen | Description |
|---|--------|-------------|
| 1 | Landing / Login | Wallet connect, authentication flow |
| 2 | Onboarding | Create or join organisation |
| 3 | Organisation Dashboard | Overview cards (total pools, pending reviews, total assets) |
| 4 | Pool List + Creation | Pool table with state badges; 5-step creation wizard |
| 5 | Pool Detail / VDR | Left folder tree, centre document list (drag-drop upload), right review drawer |
| 6 | DD Checklist Dashboard | Two-layer progress (uploaded vs reviewed); Gate Condition badges |
| 7 | Review Interface | Per-reviewer status panel; Approve/NeedsRevision buttons + comments |
| 8 | IC Decision Panel | Committee vote display; vote tally; decision history table |
| 9 | Audit Trail Viewer | Vertical timeline with event type icons; filters; export (JSON/CSV) |
| 10 | Document Version History | Vertical timeline with v1/v2/... cards; current version highlighted |
| 11 | Settings | Notification preferences, billing, subscription management |

### 11.3 Pool Creation Wizard (5 Steps)

1. **Basic Info** — Pool name, borrower name, currency, target size, maturity date, industry
2. **Encryption Engine** — AES-256-GCM (default) or Seal Beta (with explicit Beta disclosure)
3. **DD Checklist** — Select template or customise; set requirement levels
4. **Initial Members** — Invite by wallet address, assign roles
5. **Review & Confirm** — Summary of all settings; create pool on-chain

### 11.4 Design System

| Property | Specification |
|----------|--------------|
| Primary colour | #007BFF (Sui blue) |
| Text colours | #1A1C29 (navy), #64748B (slate grey) |
| Semantic colours | #10B981 (Approved/Green), #F59E0B (Warning/Amber), #EF4444 (Rejected/Red) |
| Border radius | 8–12px |
| Shadows | Soft drop shadows |
| Font | Inter or Plus Jakarta Sans |
| Accessibility | WCAG AA (4.5:1 contrast), keyboard navigation, visible focus rings, aria-labels |
| Responsive | Desktop ≥1280px primary; Tablet ≥768px supported; Mobile deferred to Phase 2 |
| Micro-interactions | Loading spinners, toast notifications (3–5s fade), skeleton screens |

### 11.5 Encryption SDK Interface

```typescript
interface EncryptionSDK {
  encryptAndUpload(
    file: File,
    folderKey: CryptoKey,
    walrusPublisherUrl: string,
    epochs: number,
  ): Promise<{ walrusResult: WalrusUploadResult; contentHash: string; sizeBytes: number }>;

  downloadAndDecrypt(
    blobId: string,
    folderKey: CryptoKey,
    expectedHash: string,
    walrusAggregatorUrl: string,
  ): Promise<{ plaintext: ArrayBuffer; verified: boolean }>;

  getFolderKey(
    dataRoomId: string,
    folderId: number,
    userKeyPair: CryptoKeyPair,
  ): Promise<CryptoKey>;
}
```

---

## 12. Phase 2: Investor Onboarding & KYC

### 12.1 Scope

Phase 2 introduces the investor-facing side of the platform: KYC/AML verification, investor data rooms, subscription agreement signing, and the tokenisation bridge.

### 12.2 New On-Chain Objects

**InvestorProfile** — wallet address, KYC status (none/pending/approved/rejected), accreditation level, jurisdiction, risk profile, KYC document Walrus CID

**SubscriptionAgreement** — pool_id, investor address, token amount, subscription date, status (Active/Redeemed/Transferred), agreement document blob_id

### 12.3 KYC/AML Oracle Integration

- External Oracle provides institutional investor KYC credential status
- Seal reads and dynamically updates admission policies: only KYC-approved + signed investors can be whitelisted for decryption
- `InvestorProfile.kyc_status = approved` is a prerequisite for joining IC or accessing investor sections

### 12.4 Advanced Seal Policies

Beyond simple member whitelist (Phase 1), Phase 2 policies include:
- KYC credential verification (only approved investors)
- Jurisdiction-based access control (comply with PDPA/GDPR/MiCA per region)
- Time-based access (e.g., investor access window during subscription period)
- Document-type restrictions (certain docs only visible to specific roles)

### 12.5 Tokenisation Bridge

- Issuance module strictly depends on Pool state: only `Ready_To_Issue` pools can initiate RWA token minting
- Checklist completeness serves as on-chain verifiable pre-issuance condition
- Token contract interface: `mint_rwa_token(pool: &Pool)` — verifies state on-chain before proceeding
- Pool transitions to `Issued` state after successful minting

### 12.6 Investor Data Room

Separate from the originator DD data room:
- Investor-only sections within the DataRoom
- Access controlled by Seal policy (KYC-gated)
- Contains: term sheet (final), investor presentation, subscription agreement template, risk disclosures

### 12.7 Multi-Device Session Management

- `GET /auth/sessions` — list all active sessions
- `DELETE /auth/sessions/:sid` — remote logout of specific device
- Organisation-level session policies (max lifetime, required re-sign interval, IP whitelist)

### 12.8 EU (MiCA) Compliance Module

- Jurisdiction field on Pool and DataRoom objects
- GDPR data residency checks for EU-based pools
- Additional consent flows for cross-border data transfer
- MiCA reporting templates integrated into DD Checklist

---

## 13. Phase 3: Post-Issuance Lifecycle

### 13.1 Scope

Phase 3 extends the platform from a pre-issuance tool to a full lifecycle management system, covering the period from token issuance through maturity or resolution.

### 13.2 Lifecycle State Machine

```
Performing → Watchlist → Default → Workout → Resolved
```

| State | Description |
|-------|-------------|
| Performing | Normal operation; interest payments on schedule |
| Watchlist | Early warning; covenant breaches or payment delays |
| Default | Formal default declared |
| Workout | Restructuring or recovery in progress |
| Resolved | Final state; all positions settled |

This state machine is independent of the pre-issuance state machine and begins when the Pool transitions to `Issued`.

### 13.3 Servicing Events

Immutable on-chain records for:
- Interest payments (amount, currency, date, payer)
- Principal repayments
- Default declarations
- Covenant breach notifications
- Restructuring events
- Monthly/quarterly financial reports (Walrus blob references)

Each event type has a dedicated struct and corresponding Sui event emission.

### 13.4 Dynamic Contract Upgrades

- Covenant modifications (e.g., relaxed financial ratios during workout)
- Payment schedule changes (rescheduling, grace periods)
- Collateral substitution tracking
- All modifications require OWNER + legal sign-off and are recorded as immutable audit events

### 13.5 Investor Reporting Dashboard

- Pool performance overview: NAV, yield, payment history
- Document repository: monthly reports, financial statements
- Event timeline: all servicing events in chronological order
- Position summary: per-investor token holdings, distributions received

### 13.6 Open API / SDK

- RESTful API for secondary market platforms and DeFi protocol integration
- TypeScript SDK for programmatic interaction
- Webhook subscriptions for real-time event notifications
- Rate-limited access with API key authentication

### 13.7 Compliance Certifications

| Certification | Phase 3 Target |
|--------------|----------------|
| SOC 2 Type II | Full operational audit (6–12 month observation period) |
| ISO 27001 | Formal ISMS certification |
| Seal Production GA | If all graduated rollout targets met |

---

## 14. Security & Compliance

### 14.1 Threat Model Summary

| Threat | Risk Level | Mitigation |
|--------|-----------|------------|
| Backend compromised | **Low** — backend never holds plaintext or keys | Zero-trust architecture |
| Walrus storage node compromised | **Low** — only holds ciphertext | AES-256-GCM encryption |
| Blob ID leaked | **Low** — ciphertext without key is unreadable | Encryption protects confidentiality |
| Nonce reuse | **Critical if occurs** | Enforce `crypto.getRandomValues()`; code review |
| Frontend XSS | **Medium** | CSP headers, sanitisation, keys never in localStorage |
| Removed member retains old key | **Medium** | Key rotation re-encrypts all affected files |
| Walrus total outage | **Low** | S3 backup (Seal Beta default, AES optional) |
| Refresh token theft | **Medium** | Refresh token rotation + reuse detection → session invalidation |

### 14.2 Data Protection

- All files client-side encrypted before upload (mandatory, not optional)
- Per-folder AES-256-GCM key management
- Member removal triggers key rotation for affected folders
- IV: 12 bytes from `crypto.getRandomValues()` — never reuse (key, nonce) pair
- Frontend memory cleanup: zero ArrayBuffer contents, revoke Object URLs on page unload
- Critical files maintain off-chain encrypted backups (S3)

### 14.3 Compliance Certifications Roadmap

| Phase | Actions |
|-------|---------|
| Phase 1 (v0–v1) | Design per SOC 2 Type I + ISO 27001 Annex A controls; complete 1 penetration test |
| Phase 2 (paid customers) | Obtain SOC 2 Type I report; begin ISO 27001 ISMS build |
| Phase 3 (scale) | Upgrade to SOC 2 Type II; obtain ISO 27001 certification |

### 14.4 Data Residency

- Singapore (PDPA): Encrypted data cross-border transfer is defensible
- EU (MiCA/GDPR): Phase 2 evaluation; may require region-specific Walrus publisher/aggregator endpoints or S3 backup in EU region
- Walrus storage nodes: decentralised; data residency is a shared responsibility model

### 14.5 Prohibited Actions

- **Never log:** Private keys, mnemonics, refresh token plaintext, full JWTs
- **Never store:** User private keys (backend never touches them)
- **Never transmit:** Encryption key plaintext (all key exchange via public key encryption)
- **Never trust:** Frontend-supplied user role (always verify against backend DB + on-chain contract)

---

## 15. Architecture Decision Records

### ADR-01: Per-Folder Key Encryption
Each DataRoom folder has an independent AES-256-GCM symmetric key. On member removal, only affected folder keys are rotated. Balances KMS complexity with security granularity.

### ADR-02: Hybrid Signing Model
High-privilege operations (state transitions, permissions, IC decisions) require user wallet signature for non-repudiation. Routine operations (file metadata, audit events) are backend-sponsored for UX. Sui natively supports sponsored transactions.

### ADR-03: Walrus Cost Model
Platform pays all Walrus storage costs, included in SaaS subscription. 30-day pre-expiry reminders. 14-day grace period at 1.3× penalty rate. Day 15+: platform stops paying; data may be permanently lost.

### ADR-04: SOC 2 + ISO 27001 Dual-Track Compliance
Phase 1: design per standards (no audit). Phase 2: SOC 2 Type I + ISMS build. Phase 3: SOC 2 Type II + ISO 27001 certification.

### ADR-05: Singapore First Jurisdiction Strategy
Singapore (MAS) primary — most active RWA tokenisation market, PDPA friendly. EU (MiCA) secondary — Phase 2. US (SEC) deferred — highest uncertainty.

### ADR-06: 2-of-3 Key Recovery
Shamir's Secret Sharing: Owner + Org Admin + Platform Escrow. Any 2-of-3 to recover. Recovery requires identity verification + cooling period.

### ADR-07: Dual-Engine Encryption with Graduated Rollout
AES-256-GCM production default. Seal Beta optional with 10% discount. Graduated rollout: Dual Launch → Invited Beta → Production (if targets met). Existing pools never auto-migrated. AES "Classic" never removed.

---

## 16. Deployment & Operations

### 16.1 Network Progression

```
Devnet (development) → Testnet (staging/QA) → Mainnet (production)
```

### 16.2 Move Package Upgrade Strategy

- Sui Move supports package upgrades with compatibility checks
- Upgrade policy: `compatible` (additive changes only) for production
- Version bump constants maintained in `types.move`
- Pre-upgrade checklist: all tests pass, gas analysis, compatibility check via `sui move build --test`

### 16.3 Infrastructure

| Component | Production Setup |
|-----------|-----------------|
| NestJS API | Container (Docker) on managed Kubernetes or ECS |
| PostgreSQL | Managed service (RDS or equivalent), Multi-AZ |
| Redis | Managed service (ElastiCache or equivalent), cluster mode |
| Indexer Worker | Separate container, auto-restart on crash |
| Renewal Worker | CronJob in Kubernetes or scheduled ECS task |
| Backup Worker | Event-driven Lambda or ECS task |
| Monitoring | Grafana + Prometheus + PagerDuty |
| Secrets | AWS Secrets Manager or HashiCorp Vault |
| CDN | CloudFront for frontend static assets |

### 16.4 Monitoring & Alerting

| Metric | Alert Threshold |
|--------|----------------|
| API error rate | > 1% over 5 minutes |
| API p99 latency | > 2 seconds |
| Indexer lag | > 30 seconds behind chain head |
| Walrus renewal failures | Any failure after 5 retries |
| SUI reserve balance | Below 30-day projected spend |
| PostgreSQL connection pool | > 80% utilisation |
| Redis memory | > 80% capacity |

### 16.5 Disaster Recovery

| Scenario | Recovery Procedure |
|----------|--------------------|
| PostgreSQL failure | Automated failover to read replica; Indexer re-syncs from last cursor |
| Redis failure | Sessions invalidated; users re-authenticate; cache rebuilds automatically |
| Indexer crash | Auto-restart; resumes from last committed cursor (at-least-once) |
| Walrus total outage | Serve from S3 backup (admin-initiated); re-upload to Walrus when restored |
| Sui network outage | Read-only mode from PostgreSQL cache; queue pending transactions |

---

## 17. Glossary

| Term | Definition |
|------|-----------|
| Pool | A complete private credit asset pool project unit |
| DataRoom | Virtual data room associated 1:1 with a Pool |
| DD Checklist | Due diligence checklist defining required documents per pool |
| Gate Condition | State transition prerequisite driven by checklist completion |
| Blob ID | Walrus storage content identifier (not IPFS CID) |
| Seal | Sui ecosystem threshold encryption engine via key server network |
| IC | Investment Committee |
| Bitmask | Bitwise role permission composition mechanism |
| Sponsored Transaction | Sui native mechanism allowing a third party to pay transaction gas |
| SSOT | Single Source of Truth |
| VDR | Virtual Data Room |
| MAS | Monetary Authority of Singapore |
| MiCA | Markets in Crypto-Assets (EU regulation) |
| PDPA | Personal Data Protection Act (Singapore) |
| Erasure Coding | Redundant data sharding across multiple storage nodes for fault tolerance |
| Threshold Encryption | Encryption scheme requiring k-of-n key shares to decrypt |

---

## Appendix A: Document Index

| Document | Path | Relationship |
|----------|------|-------------|
| Executive Summary | `specs/spec.md` | High-level overview |
| **This Document** | `specs/system-architecture.md` | Consolidated single source of truth |
| Implementation Architecture | `specs/implementation-architecture.md` | Module boundaries and interface contracts for parallel development |
| Implementation Plan | `docs/superpowers/plans/2026-03-13-full-implementation.md` | Phased execution plan with parallel work streams |
| Move Interface (reference) | `docs/design/move-interface.md` | Detailed Move function signatures |
| API Spec (reference) | `docs/design/api-spec.md` | Detailed REST endpoint specifications |
| DB Schema (reference) | `docs/design/db-schema.md` | Complete CREATE TABLE statements |
| Walrus Integration (reference) | `docs/design/walrus-integration.md` | Detailed Walrus flow diagrams and error handling |
| UI Design (reference) | `docs/design/UI設計書.md` | Screen layouts and design system details |
| Auth Flow (reference) | `docs/design/auth-flow.md` | Authentication sequence diagrams |
| Architecture Decisions (reference) | `docs/design/decisions.md` | Full ADR text with rationale |
| Roadmap (reference) | `docs/design/roadmap.md` | Timeline and milestones |
