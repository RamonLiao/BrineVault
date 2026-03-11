# RWA Credit Data Room — Phase 1 Implementation Spec

**Version:** 1.0
**Date:** 2026-03-11
**Scope:** Phase 1 (v0–v1) — 盡職調查資料室與狀態機

---

## 1. Product Overview

RWA Credit Data Room 是為私募信貸型 RWA 打造的合規型鏈上虛擬資料室 (VDR) 暨盡調交易管理平台 (Deal Hub)。透過 Sui + Walrus + Seal 提供安全儲存、權限控管與審計追蹤。

**核心差異化：** DD Checklist 系統 + Gate Conditions + 完整狀態機，驅動信貸資產從草案到發行的完整工作流程。

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contract | Sui Move |
| Backend | NestJS (Node.js/TypeScript) |
| Frontend | Next.js + React + Sui dApp Kit |
| Database | PostgreSQL 16+ (read cache/index) + Redis 7+ (session/cache) |
| Storage | Walrus (decentralized blob storage) |
| Encryption | AES-256-GCM (Production) + Seal (Beta) — Dual-Engine |
| Indexer | Sui event indexer → PostgreSQL via gRPC |
| Auth | Wallet signature + JWT session (hybrid signing) |

---

## 3. Architecture Principles

- **Zero-Trust Client-Side Encryption:** 後端永不接觸明文，所有加解密在客戶端完成
- **On-chain SSOT:** Sui 鏈上合約為唯一權限判定來源
- **Eventual Consistency:** PostgreSQL 為 read-optimized cache，鏈上資料透過 Indexer 同步
- **Dual-Engine Encryption:** AES (Production) + Seal (Beta)，透過 Encryption Abstraction Layer 對用戶無感
- **Hybrid Signing:** 高權限操作用戶簽名，routine 操作 backend sponsor gas

---

## 4. Move Smart Contract Modules (9 modules)

Package: `rwa_dataroom`

| Module | Responsibility |
|--------|---------------|
| `types.move` | Role bitmasks, state enums, doc types, encryption schemes |
| `errors.move` | Error constants (E_ prefixed) |
| `events.move` | All event struct definitions |
| `admin.move` | AdminConfig shared object, AdminCap, pause/unpause |
| `pool.move` | Pool owned object, state machine transitions (Draft → DD_In_Progress → IC_Review → Approved_Internal → Ready_To_Issue / Rejected / Cancelled) |
| `dataroom.move` | DataRoom, membership Table, folder management, encrypted key distribution |
| `document.move` | Document, DocVersion (dynamic fields), ReviewRecord, per-reviewer tracking |
| `ic_decision.move` | ICDecision structs stored on Pool |
| `seal_policy.move` | Seal key server verification entry point |

### On-Chain Object Model

- **Pool** — 主體資產池 (originator, currency, target_size, maturity_date, state, encryption_scheme)
- **DataRoom** — 虛擬資料室，與 Pool 1:1 (pool_id, folders, members: address → role bitmask)
- **Document** — 文件 Metadata (doc_id, folder, versions, checklist_item_id)
- **DocVersion** — 版本紀錄 (walrus_blob_id, content_hash SHA-256, encryption_scheme)
- **ChecklistItem** — DD Checklist 項目 (requirement_level, status, linked_doc_id)
- **ReviewRecord** — Per-Reviewer 審閱紀錄
- **ICDecision** — 投審會決議
- **AuditTrailEntry** — 系統操作稽核紀錄

### Role Bitmask

| Role | Value | Permissions |
|------|-------|------------|
| VIEWER | 1 | Read authorized docs |
| REVIEWER | 2 | View + mark review status + comment |
| EDITOR | 4 | Upload/update docs + comment |
| OWNER | 8 | Full pool management (includes EDITOR + REVIEWER) |
| AUDITOR | 16 | Read-only metadata + audit trail (no plaintext) |
| ORG_ADMIN | 32 | Cross-pool management |

### State Machine

```
Draft → DD_In_Progress → IC_Review → Approved_Internal → Ready_To_Issue
  ↓          ↓              ↓ ↑ (RequestChanges)
Cancelled  Cancelled      Rejected → Draft (re-open, optional)
```

Gate Conditions enforced on-chain:
- Draft → DD_In_Progress: All Required items ≥ Uploaded
- DD_In_Progress → IC_Review: All Required items = Reviewed
- Approved_Internal → Ready_To_Issue: Legal Required finalized + Compliance complete

---

## 5. Backend API (NestJS)

12 modules, 50+ endpoints — See `docs/design/api-spec.md`

### Key API Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 4 | Wallet challenge/verify, refresh, logout |
| Organization | 5 | CRUD + member management |
| Pool | 6 | CRUD + state transitions |
| DataRoom | 5 | Folders + member management |
| Document | 7 | Upload/download + version management |
| Checklist | 5 | CRUD + status tracking |
| Review | 4 | Per-reviewer review operations |
| IC Decision | 3 | Submit/query decisions |
| Audit | 3 | Query audit trail |
| Notification | 4 | Preferences + in-app notifications |
| Billing | 5 | Subscription + invoice management |
| Admin | 4 | Platform admin operations |

### Auth Flow

1. Wallet connect → GET /auth/challenge (nonce, 5min TTL in Redis)
2. Sign message → POST /auth/verify (verify signature → JWT + httpOnly cookie)
3. JWT access token (15min) + refresh token (7d, Redis)
4. CSRF token for mutations

---

## 6. Database (PostgreSQL + Redis)

19 tables — See `docs/design/db-schema.md`

### Core Tables (On-chain Synced via Indexer)
pools, datarooms, members, documents, document_versions, document_reviews, checklist_items, ic_decisions, audit_events

### Off-chain Tables
organizations, users, user_sessions, notification_preferences, notifications, subscriptions, invoices, walrus_blobs, indexer_state, organization_members

### Redis Schema
- Session: `session:{session_id}` (TTL 7d)
- CSRF: `csrf:{token}` (TTL 15min)
- Auth challenge: `auth:challenge:{nonce}` (TTL 5min)
- Rate limit: `ratelimit:{ip}:{endpoint}` (sliding window)
- Cache: `cache:pool:{id}`, `cache:dataroom:{id}` (TTL 30s-5min)

---

## 7. Walrus Integration

See `docs/design/walrus-integration.md`

### Key Flows
- **Upload:** Client encrypt → Walrus Publisher → get Blob ID → write metadata to Sui
- **Download:** Read metadata from Sui → Walrus Aggregator → client decrypt
- **Version upload:** New blob upload → increment version → reset reviewer states
- **Blob lifecycle:** Backend worker auto-renew before epoch expiry
- **Backup:** Critical files dual-stored (Walrus + S3 encrypted backup)
- **Chunking:** Files > 10MB use chunked upload (10MB chunks)
- **File limit:** 200MB per file

---

## 8. Encryption System (Dual-Engine)

### AES Engine (Production, default)
- AES-256-GCM, per-folder symmetric key
- Key distributed via member public keys, stored in Sui dynamic fields
- Client-side encrypt/decrypt

### Seal Engine (Beta, optional)
- Threshold encryption via Seal Key Servers
- Policy defined in Move contract
- Key servers verify on-chain policy before releasing key shares
- Client-side key reconstruction and decrypt

### Key Management
- Member removal → rotate affected folder keys → re-encrypt files
- Key recovery: 2-of-3 Shamir's Secret Sharing (Owner + Org Admin + Platform Escrow)

---

## 9. Frontend (Next.js + React)

See `docs/design/UI設計書.md`

### Key Pages (10+ screens)
1. Landing / Login (wallet connect)
2. Organization Dashboard
3. Pool List + Creation
4. Pool Detail / DataRoom
5. Document Upload + Preview
6. DD Checklist Dashboard
7. Review Interface (per-reviewer)
8. IC Decision Panel
9. Audit Trail Viewer
10. Settings (notification preferences, billing)

### Frontend Architecture
- Sui dApp Kit for wallet + transaction
- Encryption SDK (AES Engine + Seal Engine abstraction)
- TanStack Query for server state
- Client-side file encryption before upload

---

## 10. Remaining Docs to Write

- [ ] `seal-integration.md` — Seal Beta 引擎完整整合規格
- [ ] `test-strategy.md` — 測試策略（unit / integration / e2e / monkey testing）
- [ ] `deployment.md` — 部署策略（devnet → testnet → mainnet）

---

## 11. Design Documents Index

| Document | Path | Content |
|----------|------|---------|
| 產品規格書 v2.0 | `docs/design/規格書.md` | 完整產品規格、角色、狀態機、加密、審計 |
| 系統架構書 v2.0 | `docs/design/系統架構書.md` | 技術架構、時序圖、Seal/Walrus 架構 |
| Move Interface | `docs/design/move-interface.md` | 9 模組完整 Move 介面、authorization matrix、gas 分析 |
| REST API Spec | `docs/design/api-spec.md` | 12 模組 50+ endpoints、request/response 範例 |
| Auth Flow | `docs/design/auth-flow.md` | 錢包認證 + JWT Session + 混合簽名 |
| DB Schema | `docs/design/db-schema.md` | 19 表 CREATE TABLE + Redis + Indexer 同步 |
| Walrus Integration | `docs/design/walrus-integration.md` | 上傳/下載/備份/續期/chunking |
| UI 設計書 | `docs/design/UI設計書.md` | 10+ 畫面 + responsive + a11y |
| Architecture Decisions | `docs/design/decisions.md` | 7 項 ADR |
| Roadmap | `docs/design/roadmap.md` | Phase 1-3 時程 + 定價策略 |
| Comprehensive Review | `docs/review/2026-03-11-comprehensive-review.md` | 四維度審查報告 |
