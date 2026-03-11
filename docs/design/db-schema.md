# RWA Credit Data Room — Database Schema

**Created:** 2026-03-11
**Status:** Draft
**Backend:** Node.js / NestJS
**Primary DB:** PostgreSQL 16+
**Cache/Session:** Redis 7+

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Consistency Model](#2-data-consistency-model)
3. [Enum & Type Definitions](#3-enum--type-definitions)
4. [Core Tables (On-chain Synced)](#4-core-tables-on-chain-synced)
5. [Off-chain Tables](#5-off-chain-tables)
6. [Indexer State](#6-indexer-state)
7. [Redis Schema](#7-redis-schema)
8. [Entity Relationship Diagram](#8-entity-relationship-diagram)
9. [Indexer Sync Strategy](#9-indexer-sync-strategy)
10. [Migration Notes](#10-migration-notes)

---

## 1. Architecture Overview

```
┌──────────────┐    gRPC events     ┌──────────────┐     SQL      ┌──────────────┐
│   Sui Chain  │ ─────────────────► │   Indexer    │ ──────────► │  PostgreSQL  │
│  (SSOT)      │                    │   Worker     │             │  (cache/idx) │
└──────────────┘                    └──────────────┘             └──────┬───────┘
                                                                       │
                                                                       ▼
                                                                ┌──────────────┐
                                                                │  NestJS API  │◄──► Redis
                                                                └──────────────┘
```

The PostgreSQL database is a **read-optimized cache/index layer**. All authorization-critical data (roles, membership, pool state) has its source of truth on the Sui blockchain. The DB exists to enable fast queries, full-text search, pagination, and notification/billing features that are impractical on-chain.

---

## 2. Data Consistency Model

### On-chain is the Source of Truth (SSOT)

- **Core tables** (`pools`, `datarooms`, `members`, `documents`, `document_versions`, `document_reviews`, `ic_decisions`, `audit_events`) are populated exclusively by the Indexer from on-chain events.
- The API **never writes** to core tables directly. All mutations go through Sui transactions first, then the Indexer picks up the resulting events and updates the DB.
- If the DB and on-chain state diverge, **on-chain wins**. The API can fall back to direct RPC queries for critical authorization checks.

### Eventual Consistency

- There is a small delay (typically <2s) between an on-chain transaction and the DB reflecting the new state.
- The API may serve slightly stale data from the DB cache. For authorization decisions, the API should verify against on-chain state when the DB data is older than a threshold (e.g., 5s).

### Consistency Guarantees

| Layer | Guarantee |
|-------|-----------|
| Sui on-chain | Strong consistency (finality) |
| PostgreSQL (core tables) | Eventual consistency via Indexer |
| PostgreSQL (off-chain tables) | Strong consistency (direct writes) |
| Redis cache | Best-effort, TTL-based expiry |

---

## 3. Enum & Type Definitions

```sql
-- =============================================
-- Custom ENUM types
-- =============================================

CREATE TYPE billing_plan AS ENUM ('free_trial', 'pro', 'enterprise');

CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'expired', 'grace_period', 'suspended');

CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

CREATE TYPE checklist_item_status AS ENUM ('missing', 'uploaded', 'reviewed', 'needs_revision');
```

### Bitmask Constants (application-level, not DB enums)

| Role | Value | Binary |
|------|-------|--------|
| VIEWER | 1 | `000001` |
| REVIEWER | 2 | `000010` |
| EDITOR | 4 | `000100` |
| OWNER | 8 | `001000` |
| AUDITOR | 16 | `010000` |
| ORG_ADMIN | 32 | `100000` |

### Pool State Constants

| State | Value |
|-------|-------|
| DRAFT | 0 |
| DD_IN_PROGRESS | 1 |
| IC_REVIEW | 2 |
| APPROVED_INTERNAL | 3 |
| READY_TO_ISSUE | 4 |
| REJECTED | 5 |
| CANCELLED | 6 |
| ISSUED (Phase 2) | 7 |
| CLOSED (Phase 2) | 8 |

### Document Review States

| State | Value |
|-------|-------|
| PENDING | 0 |
| APPROVED | 1 |
| NEEDS_REVISION | 2 |

### Encryption Schemes

| Scheme | Value |
|--------|-------|
| AES | 0 |
| SEAL | 1 |

---

## 4. Core Tables (On-chain Synced)

These tables are written **only by the Indexer**. The API treats them as read-only.

### 4.1 pools

```sql
CREATE TABLE pools (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id         TEXT NOT NULL UNIQUE,
    org_id                UUID NOT NULL REFERENCES organizations(id),
    name                  TEXT NOT NULL,
    borrower_name_hash    TEXT,
    currency              TEXT NOT NULL DEFAULT 'USD',
    target_notional       BIGINT,
    expected_maturity_date DATE,
    current_state         SMALLINT NOT NULL DEFAULT 0,
    encryption_scheme     SMALLINT NOT NULL DEFAULT 0,
    created_by_address    TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    sui_tx_digest         TEXT,

    CONSTRAINT chk_pool_state CHECK (current_state BETWEEN 0 AND 8),
    CONSTRAINT chk_encryption_scheme CHECK (encryption_scheme IN (0, 1))
);

CREATE INDEX idx_pools_org_id ON pools(org_id);
CREATE INDEX idx_pools_current_state ON pools(current_state);
CREATE INDEX idx_pools_created_by ON pools(created_by_address);
CREATE INDEX idx_pools_created_at ON pools(created_at DESC);
```

### 4.2 datarooms

```sql
CREATE TABLE datarooms (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id     TEXT NOT NULL UNIQUE,
    pool_id           UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    owner_address     TEXT NOT NULL,
    member_count      INT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_datarooms_pool_id ON datarooms(pool_id);
CREATE INDEX idx_datarooms_owner ON datarooms(owner_address);
```

### 4.3 members

```sql
CREATE TABLE members (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataroom_id       UUID NOT NULL REFERENCES datarooms(id) ON DELETE CASCADE,
    pool_id           UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    member_address    TEXT NOT NULL,
    role              SMALLINT NOT NULL,
    added_by_address  TEXT NOT NULL,
    added_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active         BOOLEAN NOT NULL DEFAULT true,
    revoked_at        TIMESTAMPTZ,

    CONSTRAINT chk_member_role CHECK (role > 0 AND role <= 63)
);

CREATE UNIQUE INDEX idx_members_dataroom_address ON members(dataroom_id, member_address);
CREATE INDEX idx_members_pool_id ON members(pool_id);
CREATE INDEX idx_members_address ON members(member_address);
CREATE INDEX idx_members_active ON members(dataroom_id, is_active) WHERE is_active = true;
```

### 4.4 documents

```sql
CREATE TABLE documents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sui_object_id     TEXT NOT NULL UNIQUE,
    pool_id           UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    dataroom_id       UUID NOT NULL REFERENCES datarooms(id) ON DELETE CASCADE,
    folder_id         BIGINT,
    doc_type          SMALLINT NOT NULL DEFAULT 0,
    title             TEXT NOT NULL,
    tags              TEXT[] DEFAULT '{}',
    current_version   INT NOT NULL DEFAULT 1,
    version_count     INT NOT NULL DEFAULT 1,
    required_flag     BOOLEAN NOT NULL DEFAULT false,
    encryption_scheme SMALLINT NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_doc_encryption CHECK (encryption_scheme IN (0, 1))
);

CREATE INDEX idx_documents_pool_id ON documents(pool_id);
CREATE INDEX idx_documents_dataroom_id ON documents(dataroom_id);
CREATE INDEX idx_documents_folder ON documents(pool_id, folder_id);
CREATE INDEX idx_documents_created_at ON documents(created_at DESC);

-- Full-text search index
CREATE INDEX idx_documents_fts ON documents
    USING GIN (to_tsvector('english', title || ' ' || array_to_string(tags, ' ')));
```

### 4.5 document_versions

```sql
CREATE TABLE document_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version             INT NOT NULL,
    walrus_blob_id      TEXT NOT NULL,
    content_hash        TEXT NOT NULL,
    size_bytes          BIGINT NOT NULL DEFAULT 0,
    uploaded_by_address TEXT NOT NULL,
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    change_log          TEXT,

    CONSTRAINT chk_version_positive CHECK (version > 0)
);

CREATE UNIQUE INDEX idx_docversions_doc_version ON document_versions(document_id, version);
CREATE INDEX idx_docversions_blob ON document_versions(walrus_blob_id);
CREATE INDEX idx_docversions_uploader ON document_versions(uploaded_by_address);
```

### 4.6 document_reviews

```sql
CREATE TABLE document_reviews (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    reviewer_address  TEXT NOT NULL,
    status            SMALLINT NOT NULL DEFAULT 0,
    comment_hash      TEXT,
    reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_review_status CHECK (status BETWEEN 0 AND 2)
);

CREATE UNIQUE INDEX idx_reviews_doc_reviewer ON document_reviews(document_id, reviewer_address);
CREATE INDEX idx_reviews_status ON document_reviews(document_id, status);
```

### 4.7 ic_decisions

```sql
CREATE TABLE ic_decisions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id             UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    decision_index      INT NOT NULL,
    decision_type       SMALLINT NOT NULL,
    decision_text       TEXT,
    decision_pdf_blob_id TEXT,
    created_by_address  TEXT NOT NULL,
    committee_members   JSONB NOT NULL DEFAULT '[]',
    votes               JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    related_doc_ids     JSONB DEFAULT '[]'
);

CREATE UNIQUE INDEX idx_ic_pool_index ON ic_decisions(pool_id, decision_index);
CREATE INDEX idx_ic_creator ON ic_decisions(created_by_address);
```

### 4.8 audit_events

```sql
CREATE TABLE audit_events (
    id              BIGSERIAL PRIMARY KEY,
    pool_id         UUID REFERENCES pools(id) ON DELETE SET NULL,
    event_type      TEXT NOT NULL,
    actor_address   TEXT NOT NULL,
    target_id       TEXT,
    metadata        JSONB DEFAULT '{}',
    sui_tx_digest   TEXT NOT NULL,
    sui_event_seq   BIGINT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_pool_ts ON audit_events(pool_id, timestamp DESC);
CREATE INDEX idx_audit_actor_ts ON audit_events(actor_address, timestamp DESC);
CREATE INDEX idx_audit_event_type ON audit_events(event_type);
CREATE UNIQUE INDEX idx_audit_tx_seq ON audit_events(sui_tx_digest, sui_event_seq);
```

---

## 5. Off-chain Tables

These are written directly by the NestJS API. They have no on-chain counterpart.

### 5.1 organizations

```sql
CREATE TABLE organizations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              TEXT NOT NULL,
    legal_name        TEXT,
    billing_plan      billing_plan NOT NULL DEFAULT 'free_trial',
    default_policies  JSONB DEFAULT '{}',
    created_by_user_id UUID,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_name ON organizations(name);
CREATE INDEX idx_orgs_plan ON organizations(billing_plan);
```

### 5.2 users

```sql
CREATE TABLE users (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_wallet_address TEXT NOT NULL UNIQUE,
    email                 TEXT,
    display_name          TEXT,
    org_id                UUID REFERENCES organizations(id) ON DELETE SET NULL,
    role_in_org           SMALLINT NOT NULL DEFAULT 1,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at         TIMESTAMPTZ
);

-- Add FK from organizations back to users after users table exists
ALTER TABLE organizations
    ADD CONSTRAINT fk_orgs_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id);

CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX idx_users_wallet ON users(primary_wallet_address);
```

### 5.3 comments

```sql
CREATE TABLE comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    pool_id           UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    author_address    TEXT NOT NULL,
    content           TEXT NOT NULL,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_doc_ts ON comments(document_id, created_at);
CREATE INDEX idx_comments_pool ON comments(pool_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id) WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_comments_author ON comments(author_address);
```

### 5.4 notifications

```sql
CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                TEXT NOT NULL,
    title               TEXT NOT NULL,
    body                TEXT,
    related_pool_id     UUID REFERENCES pools(id) ON DELETE SET NULL,
    related_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    is_read             BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query pattern: unread notifications for a user, newest first
CREATE INDEX idx_notifications_user_read_ts ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_pool ON notifications(related_pool_id) WHERE related_pool_id IS NOT NULL;
```

**Notification types:**
- `doc_needs_revision` — a reviewer requested changes
- `doc_approved` — a document was approved
- `ic_review_requested` — pool moved to IC_REVIEW state
- `member_added` — user was added to a dataroom
- `member_removed` — user was removed from a dataroom
- `pool_state_changed` — pool transitioned to a new state
- `subscription_expiring` — subscription nearing expiry
- `subscription_expired` — subscription has expired
- `invoice_overdue` — invoice past due date

### 5.5 notification_preferences

```sql
CREATE TABLE notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    email_enabled   BOOLEAN NOT NULL DEFAULT true,
    in_app_enabled  BOOLEAN NOT NULL DEFAULT true,
    preferences     JSONB NOT NULL DEFAULT '{}'
);
```

`preferences` JSONB structure example:
```json
{
  "doc_needs_revision": { "email": true, "in_app": true },
  "member_added": { "email": false, "in_app": true },
  "subscription_expiring": { "email": true, "in_app": true }
}
```

### 5.6 checklist_templates

```sql
CREATE TABLE checklist_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    items       JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`items` JSONB structure:
```json
[
  { "folder": "KYC", "item_name": "Certificate of Incorporation", "required_default": true },
  { "folder": "KYC", "item_name": "Board Resolution", "required_default": true },
  { "folder": "Financial", "item_name": "Audited Financial Statements (3Y)", "required_default": true },
  { "folder": "Collateral", "item_name": "Collateral Valuation Report", "required_default": false }
]
```

### 5.7 pool_checklist_items

```sql
CREATE TABLE pool_checklist_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id             UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
    folder              TEXT NOT NULL,
    item_name           TEXT NOT NULL,
    is_required         BOOLEAN NOT NULL DEFAULT false,
    linked_document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
    status              checklist_item_status NOT NULL DEFAULT 'missing',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_checklist_pool_folder_item ON pool_checklist_items(pool_id, folder, item_name);
CREATE INDEX idx_checklist_pool_status ON pool_checklist_items(pool_id, status);
```

### 5.8 subscriptions

```sql
CREATE TABLE subscriptions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan                 billing_plan NOT NULL,
    status               subscription_status NOT NULL DEFAULT 'trial',
    trial_start_at       TIMESTAMPTZ,
    trial_end_at         TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    grace_period_end     TIMESTAMPTZ,
    penalty_rate         DECIMAL(4,2) NOT NULL DEFAULT 1.30,
    amount               DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency             TEXT NOT NULL DEFAULT 'SGD',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end)
    WHERE status IN ('active', 'trial');
```

### 5.9 invoices

```sql
CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount          DECIMAL(12,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'SGD',
    status          invoice_status NOT NULL DEFAULT 'pending',
    penalty_applied BOOLEAN NOT NULL DEFAULT false,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_at          TIMESTAMPTZ NOT NULL,
    paid_at         TIMESTAMPTZ
);

CREATE INDEX idx_invoices_org ON invoices(org_id);
CREATE INDEX idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due ON invoices(due_at) WHERE status = 'pending';
```

### 5.10 invite_codes

```sql
CREATE TABLE invite_codes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code              TEXT NOT NULL UNIQUE,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    max_uses          INT NOT NULL DEFAULT 1,
    current_uses      INT NOT NULL DEFAULT 0,
    expires_at        TIMESTAMPTZ NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_invite_uses CHECK (current_uses <= max_uses),
    CONSTRAINT chk_invite_max CHECK (max_uses > 0)
);

CREATE INDEX idx_invites_org ON invite_codes(org_id);
CREATE INDEX idx_invites_code ON invite_codes(code);
CREATE INDEX idx_invites_expires ON invite_codes(expires_at) WHERE current_uses < max_uses;
```

---

## 6. Indexer State

### 6.1 indexer_checkpoints

```sql
CREATE TABLE indexer_checkpoints (
    id              INT PRIMARY KEY,
    chain_id        TEXT NOT NULL,
    last_cursor     TEXT,
    last_tx_digest  TEXT,
    last_event_seq  BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with initial row
INSERT INTO indexer_checkpoints (id, chain_id, last_event_seq)
VALUES (1, 'sui:mainnet', 0);
```

---

## 7. Redis Schema

### Key Patterns

| Key Pattern | Type | TTL | Description |
|-------------|------|-----|-------------|
| `session:{session_id}` | Hash | 7 days | User session data (user_id, wallet, org_id, role, csrf_token) |
| `csrf:{token}` | String | 15 min | CSRF token validation |
| `auth:challenge:{nonce}` | Hash | 5 min | Auth challenge for wallet signature verification |
| `rate:auth:{ip}` | String (counter) | 60s | Auth endpoint rate limiter (max 5/min) |
| `rate:api:{user_id}` | String (counter) | 60s | API rate limiter per user (max 100/min) |
| `cache:pool:{pool_id}` | Hash | 30s | Cached pool data for hot reads |
| `cache:members:{pool_id}` | Hash | 30s | Cached member list for authorization checks |
| `notification:unread:{user_id}` | String (counter) | 60s | Unread notification count badge |
| `ws:connections:{user_id}` | Set | none | Active WebSocket connection IDs for a user |

### Session Hash Fields

```
session:{session_id} = {
    user_id:        UUID,
    wallet_address: string,
    org_id:         UUID,
    role_in_org:    number,
    created_at:     ISO timestamp,
    last_active:    ISO timestamp
}
```

### Auth Challenge Hash Fields

```
auth:challenge:{nonce} = {
    nonce:          string,
    wallet_address: string,
    message:        string (the message to sign),
    created_at:     ISO timestamp
}
```

---

## 8. Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  organizations   │       │     users        │       │  invite_codes    │
│──────────────────│       │──────────────────│       │──────────────────│
│ id (PK)          │◄──┐   │ id (PK)          │───┐   │ id (PK)          │
│ name             │   │   │ wallet_address   │   │   │ org_id (FK)      │
│ billing_plan     │   │   │ org_id (FK) ─────┼───┘   │ code (UNIQUE)    │
│ created_by (FK)──┼───┼──►│ role_in_org      │       │ created_by (FK)  │
└────────┬─────────┘   │   └──────────────────┘       └──────────────────┘
         │             │
         │             │
    ┌────▼─────┐  ┌────┴──────────┐
    │ subscrip-│  │    pools      │
    │  tions   │  │───────────────│
    │──────────│  │ id (PK)       │
    │ org_id   │  │ sui_object_id │◄──────────────────────────────────────┐
    │ plan     │  │ org_id (FK)   │                                      │
    │ status   │  │ current_state │                                      │
    └────┬─────┘  └───┬───────────┘                                      │
         │            │                                                   │
    ┌────▼─────┐      │    ┌──────────────────┐                          │
    │ invoices │      ├───►│   datarooms      │                          │
    │──────────│      │    │──────────────────│                          │
    │ org_id   │      │    │ id (PK)          │                          │
    │ sub_id   │      │    │ pool_id (FK)     │                          │
    │ amount   │      │    │ owner_address    │                          │
    └──────────┘      │    └───┬──────────────┘                          │
                      │        │                                          │
                      │   ┌────▼──────────┐                              │
                      │   │   members     │                              │
                      │   │──────────────│                               │
                      │   │ dataroom_id  │                               │
                      │   │ pool_id (FK) │                               │
                      │   │ member_addr  │                               │
                      │   │ role (mask)  │                               │
                      │   └──────────────┘                               │
                      │                                                   │
                      │    ┌──────────────────┐     ┌────────────────┐   │
                      ├───►│   documents      │────►│ doc_versions   │   │
                      │    │──────────────────│     │────────────────│   │
                      │    │ pool_id (FK)     │     │ document_id    │   │
                      │    │ dataroom_id (FK) │     │ version        │   │
                      │    │ title            │     │ walrus_blob_id │   │
                      │    └───┬──────────────┘     └────────────────┘   │
                      │        │                                          │
                      │   ┌────▼────────────┐   ┌───────────────────┐   │
                      │   │ doc_reviews     │   │   comments        │   │
                      │   │────────────────│    │───────────────────│   │
                      │   │ document_id    │   │ document_id (FK)  │   │
                      │   │ reviewer_addr  │   │ pool_id (FK)      │   │
                      │   │ status         │   │ parent_id (self)  │   │
                      │   └────────────────┘   └───────────────────┘   │
                      │                                                   │
                      │    ┌──────────────────┐                          │
                      ├───►│  ic_decisions    │                          │
                      │    │──────────────────│                          │
                      │    │ pool_id (FK)     │                          │
                      │    │ decision_index   │                          │
                      │    │ votes (JSONB)    │                          │
                      │    └──────────────────┘                          │
                      │                                                   │
                      │    ┌──────────────────┐                          │
                      ├───►│  audit_events    │──────────────────────────┘
                      │    │──────────────────│
                      │    │ pool_id (FK)     │
                      │    │ event_type       │
                      │    │ actor_address    │
                      │    │ sui_tx_digest    │
                      │    └──────────────────┘
                      │
                      │    ┌─────────────────────┐
                      └───►│ pool_checklist_items │
                           │─────────────────────│
                           │ pool_id (FK)         │
                           │ linked_document_id   │
                           │ status               │
                           └─────────────────────┘

┌──────────────────────┐     ┌──────────────────────────┐
│ checklist_templates  │     │ notification_preferences │
│──────────────────────│     │──────────────────────────│
│ id (PK)              │     │ user_id (FK, UNIQUE)     │
│ name                 │     │ preferences (JSONB)      │
│ items (JSONB)        │     └──────────────────────────┘
└──────────────────────┘

┌──────────────────────┐     ┌──────────────────────┐
│    notifications     │     │ indexer_checkpoints  │
│──────────────────────│     │─────────────────────│
│ user_id (FK)         │     │ chain_id             │
│ related_pool_id      │     │ last_cursor          │
│ related_doc_id       │     │ last_event_seq       │
│ is_read              │     └─────────────────────┘
└──────────────────────┘
```

---

## 9. Indexer Sync Strategy

### Event-Driven Architecture

The Indexer is a standalone worker process that connects to a Sui Full Node via **gRPC** (or JSON-RPC event subscription) and processes events in order.

### Event-to-Table Mapping

| Sui Event | Target Table(s) | Operation |
|-----------|-----------------|-----------|
| `PoolCreated` | `pools` | INSERT |
| `PoolStateChanged` | `pools` | UPDATE `current_state` |
| `DataRoomCreated` | `datarooms` | INSERT |
| `MemberAdded` | `members` | INSERT or UPDATE (reactivation) |
| `MemberRemoved` | `members` | UPDATE `is_active=false, revoked_at=now()` |
| `MemberRoleUpdated` | `members` | UPDATE `role` |
| `DocumentCreated` | `documents` | INSERT |
| `DocumentVersionAdded` | `document_versions`, `documents` | INSERT version, UPDATE `current_version`/`version_count` |
| `DocumentReviewed` | `document_reviews` | UPSERT |
| `ICDecisionCreated` | `ic_decisions` | INSERT |
| `AuditEvent` (generic) | `audit_events` | INSERT |

### Processing Flow

```
1. Read last cursor from indexer_checkpoints
2. Subscribe to events starting from cursor (or poll with cursor)
3. For each event batch:
   a. Begin DB transaction
   b. Process events → map to table operations
   c. Update indexer_checkpoints with new cursor
   d. Commit transaction
4. On crash/restart: resume from last committed cursor (at-least-once delivery)
```

### Idempotency

- Each event is uniquely identified by `(sui_tx_digest, sui_event_seq)`.
- The `audit_events` table enforces uniqueness via `idx_audit_tx_seq`.
- For other tables, the Indexer uses UPSERT logic keyed on `sui_object_id` to handle replayed events.

### Cache Invalidation

When the Indexer updates a core table, it also invalidates the corresponding Redis cache key:
- Pool update → `DEL cache:pool:{pool_id}`
- Member update → `DEL cache:members:{pool_id}`

---

## 10. Migration Notes

### Creation Order (respecting FK dependencies)

```
1. organizations (no FK deps)
2. users (depends on organizations)
3. organizations ALTER (add FK to users)
4. pools (depends on organizations)
5. datarooms (depends on pools)
6. members (depends on datarooms, pools)
7. documents (depends on pools, datarooms)
8. document_versions (depends on documents)
9. document_reviews (depends on documents)
10. ic_decisions (depends on pools)
11. audit_events (depends on pools)
12. comments (depends on documents, pools)
13. notifications (depends on users, pools, documents)
14. notification_preferences (depends on users)
15. checklist_templates (no FK deps)
16. pool_checklist_items (depends on pools, documents)
17. subscriptions (depends on organizations)
18. invoices (depends on organizations, subscriptions)
19. invite_codes (depends on organizations, users)
20. indexer_checkpoints (no FK deps)
```

### Partitioning Considerations

- `audit_events`: Consider range partitioning by `timestamp` (monthly) once the table exceeds ~10M rows. This improves query performance and allows efficient archival.
- `notifications`: Consider partitioning by `created_at` or archiving read notifications older than 90 days.

### Indexes for Common Query Patterns

| Query | Index Used |
|-------|-----------|
| List pools for an org | `idx_pools_org_id` |
| Get pool members | `idx_members_active` |
| Search documents by title | `idx_documents_fts` |
| Unread notifications | `idx_notifications_user_read_ts` |
| Audit trail for a pool | `idx_audit_pool_ts` |
| Pending invoices due soon | `idx_invoices_due` |
| Active subscriptions expiring | `idx_subscriptions_period_end` |
| Unused invite codes | `idx_invites_expires` |
