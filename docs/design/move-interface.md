# RWA Credit Data Room — Move Interface Specification

**Created:** 2026-03-11
**Status:** Draft
**Package name:** `rwa_dataroom`
**Target network:** Sui Mainnet / Testnet
**Visibility model:** `public(package)` for all internal functions; `entry` for user-facing endpoints

---

## Table of Contents

1. [Module Layout](#1-module-layout)
2. [types.move — Constants](#2-typesmove)
3. [errors.move — Error Codes](#3-errorsmove)
4. [events.move — Event Definitions](#4-eventsmove)
5. [admin.move — Platform Administration](#5-adminmove)
6. [pool.move — Pool & State Machine](#6-poolmove)
7. [dataroom.move — DataRoom & Membership](#7-dataroommove)
8. [document.move — Documents & Reviews](#8-documentmove)
9. [ic_decision.move — IC Decision Recording](#9-ic_decisionmove)
10. [seal_policy.move — Seal Access Verification](#10-seal_policymove)
11. [Gas Cost Considerations](#11-gas-cost-considerations)
12. [Package Upgrade Strategy](#12-package-upgrade-strategy)

---

## 1. Module Layout

```
rwa_dataroom/sources/
  types.move          — Role bitmasks, state enums, doc types, encryption schemes
  errors.move         — Error constants (all E_ prefixed)
  events.move         — All event struct definitions
  admin.move          — AdminConfig shared object, AdminCap, pause/unpause
  pool.move           — Pool owned object, state machine transitions
  dataroom.move       — DataRoom, membership Table, folder management
  document.move       — Document, DocVersion (dynamic fields), ReviewRecord
  ic_decision.move    — ICDecision structs stored on Pool
  seal_policy.move    — Seal key server verification entry point
```

### Object Ownership Model

```
AdminConfig (shared)       — one per package deployment
AdminCap (owned)           — held by deployer / platform multi-sig

Pool (shared)              — one per deal
  ├── dynamic_object_field key b"dataroom" → DataRoom (store)
  ├── dynamic_field key (doc_id: ID) → Document (store)
  └── dynamic_field key (decision_index: u64) → ICDecision (store)

DataRoom (store, child of Pool)
  ├── Table<address, Membership>
  ├── dynamic_field key (folder_id: u64) → FolderMeta (store)
  └── dynamic_field key (b"folder_key", folder_id: u64, member: address) → vector<u8>

Document (store, child of Pool)
  ├── dynamic_field key (version: u64) → DocVersion (store)
  └── dynamic_field key (reviewer: address) → ReviewRecord (store)
```

---

## 2. types.move

```move
module rwa_dataroom::types {

    // ========== Role Bitmask ==========
    const ROLE_VIEWER:    u8 = 1;   // 0b000001
    const ROLE_REVIEWER:  u8 = 2;   // 0b000010
    const ROLE_EDITOR:    u8 = 4;   // 0b000100
    const ROLE_OWNER:     u8 = 8;   // 0b001000
    const ROLE_AUDITOR:   u8 = 16;  // 0b010000
    const ROLE_ORG_ADMIN: u8 = 32;  // 0b100000

    // Composite masks for convenience
    const ROLE_EDITOR_UP:  u8 = 12;  // EDITOR | OWNER
    const ROLE_OWNER_UP:   u8 = 40;  // OWNER | ORG_ADMIN
    const ROLE_ALL:        u8 = 63;  // all bits

    // ========== Pool State (u8) ==========
    const POOL_STATE_DRAFT:             u8 = 0;
    const POOL_STATE_DD_IN_PROGRESS:    u8 = 1;
    const POOL_STATE_IC_REVIEW:         u8 = 2;
    const POOL_STATE_APPROVED_INTERNAL: u8 = 3;
    const POOL_STATE_READY_TO_ISSUE:    u8 = 4;
    const POOL_STATE_REJECTED:          u8 = 5;
    const POOL_STATE_CANCELLED:         u8 = 6;
    // Phase 2:
    const POOL_STATE_ISSUED:            u8 = 7;
    const POOL_STATE_CLOSED:            u8 = 8;

    // ========== Document Review State (u8) ==========
    const REVIEW_PENDING:        u8 = 0;
    const REVIEW_APPROVED:       u8 = 1;
    const REVIEW_NEEDS_REVISION: u8 = 2;

    // ========== Document Type (u8) ==========
    const DOC_TYPE_FINANCIAL_STATEMENT:  u8 = 0;
    const DOC_TYPE_LEGAL_AGREEMENT:      u8 = 1;
    const DOC_TYPE_KYC_AML:              u8 = 2;
    const DOC_TYPE_COLLATERAL:           u8 = 3;
    const DOC_TYPE_VALUATION_REPORT:     u8 = 4;
    const DOC_TYPE_INSURANCE:            u8 = 5;
    const DOC_TYPE_CORPORATE_DOC:        u8 = 6;
    const DOC_TYPE_TERM_SHEET:           u8 = 7;
    const DOC_TYPE_IC_MEMO:              u8 = 8;
    const DOC_TYPE_MISC:                 u8 = 9;

    // ========== Encryption Scheme (u8) ==========
    const ENCRYPTION_AES:  u8 = 0;
    const ENCRYPTION_SEAL: u8 = 1;

    // ========== IC Decision Type (u8) ==========
    const IC_APPROVE:          u8 = 0;
    const IC_REJECT:           u8 = 1;
    const IC_REQUEST_CHANGES:  u8 = 2;

    // ========== Action Types for AuditEvent (u8) ==========
    const ACTION_POOL_CREATED:        u8 = 0;
    const ACTION_STATE_CHANGED:       u8 = 1;
    const ACTION_MEMBER_ADDED:        u8 = 2;
    const ACTION_MEMBER_REMOVED:      u8 = 3;
    const ACTION_MEMBER_ROLE_UPDATED: u8 = 4;
    const ACTION_DOC_CREATED:         u8 = 5;
    const ACTION_DOC_VERSION_ADDED:   u8 = 6;
    const ACTION_DOC_REVIEWED:        u8 = 7;
    const ACTION_DOC_ARCHIVED:        u8 = 8;
    const ACTION_IC_DECISION:         u8 = 9;
    const ACTION_FOLDER_CREATED:      u8 = 10;
    const ACTION_POOL_CANCELLED:      u8 = 11;
    const ACTION_PAUSE_TOGGLED:       u8 = 12;

    // ========== Helper functions ==========

    /// Check if `role` has the required bit(s) set
    public fun has_role(role: u8, required: u8): bool {
        (role & required) > 0
    }

    /// Validate pool state is one of the expected values
    public fun is_valid_pool_state(state: u8): bool {
        state <= 8
    }

    /// Validate encryption scheme
    public fun is_valid_encryption_scheme(scheme: u8): bool {
        scheme <= 1
    }

    /// Validate document type
    public fun is_valid_doc_type(doc_type: u8): bool {
        doc_type <= 9
    }
}
```

---

## 3. errors.move

```move
module rwa_dataroom::errors {

    // ========== Authorization ==========
    const ENotAuthorized:         u64 = 0;
    const ENotOwner:              u64 = 1;
    const ENotMember:             u64 = 2;
    const EInsufficientRole:      u64 = 3;
    const EMemberNotActive:       u64 = 4;

    // ========== State Machine ==========
    const EInvalidStateTransition: u64 = 100;
    const EPoolPaused:             u64 = 101;
    const EPoolNotInDraft:         u64 = 102;
    const EPoolNotInDD:            u64 = 103;
    const EPoolNotInICReview:      u64 = 104;
    const EPoolNotRejected:        u64 = 105;
    const EPoolCancelled:          u64 = 106;

    // ========== Membership ==========
    const EMemberAlreadyExists:    u64 = 200;
    const EMemberNotFound:         u64 = 201;
    const ECannotRemoveOwner:      u64 = 202;
    const EMaxMembersReached:      u64 = 203;
    const EMemberAlreadyRevoked:   u64 = 204;

    // ========== Document ==========
    const EDocumentNotFound:       u64 = 300;
    const EMaxVersionsReached:     u64 = 301;
    const EDocumentArchived:       u64 = 302;
    const EInvalidDocType:         u64 = 303;
    const EEmptyBlobId:            u64 = 304;
    const EEmptyContentHash:       u64 = 305;
    const EInvalidContentHashLen:  u64 = 306;
    const EAlreadyReviewed:        u64 = 307;

    // ========== Folder ==========
    const EFolderNotFound:         u64 = 400;
    const EFolderNameEmpty:        u64 = 401;
    const EParentFolderNotFound:   u64 = 402;

    // ========== Admin ==========
    const EAlreadyPaused:          u64 = 500;
    const ENotPaused:              u64 = 501;
    const EInvalidConfig:          u64 = 502;

    // ========== Validation ==========
    const EInvalidEncryptionScheme: u64 = 600;
    const EInvalidRole:             u64 = 601;
    const EEmptyName:               u64 = 602;
    const EInvalidHashLength:       u64 = 603;  // expected 32 bytes
    const EEmptyCommittee:          u64 = 604;

    // ========== DD Checklist ==========
    const ERequiredDocsNotReviewed: u64 = 700;
    const EComplianceCheckFailed:   u64 = 701;
}
```

---

## 4. events.move

All events use `copy, drop` abilities. No `store` — events are emitted, never persisted as objects.

```move
module rwa_dataroom::events {
    use sui::event;

    struct PoolCreated has copy, drop {
        pool_id: ID,
        name: String,
        org_id_hash: vector<u8>,
        created_by: address,
        encryption_scheme: u8,
        timestamp: u64,
    }

    struct PoolStateChanged has copy, drop {
        pool_id: ID,
        from_state: u8,
        to_state: u8,
        actor: address,
        timestamp: u64,
    }

    struct PoolCancelled has copy, drop {
        pool_id: ID,
        actor: address,
        timestamp: u64,
    }

    struct MemberAdded has copy, drop {
        dataroom_id: ID,
        member: address,
        role: u8,
        added_by: address,
        timestamp: u64,
    }

    struct MemberRemoved has copy, drop {
        dataroom_id: ID,
        member: address,
        removed_by: address,
        timestamp: u64,
    }

    struct MemberRoleUpdated has copy, drop {
        dataroom_id: ID,
        member: address,
        old_role: u8,
        new_role: u8,
        actor: address,
        timestamp: u64,
    }

    struct DocumentCreated has copy, drop {
        pool_id: ID,
        doc_id: ID,
        folder_id: u64,
        doc_type: u8,
        title: String,
        version: u64,
        blob_id: String,
        content_hash: vector<u8>,
        uploader: address,
        timestamp: u64,
    }

    struct DocumentVersionAdded has copy, drop {
        pool_id: ID,
        doc_id: ID,
        version: u64,
        blob_id: String,
        content_hash: vector<u8>,
        uploader: address,
        timestamp: u64,
    }

    struct DocumentReviewed has copy, drop {
        pool_id: ID,
        doc_id: ID,
        reviewer: address,
        status: u8,
        timestamp: u64,
    }

    struct DocumentArchived has copy, drop {
        pool_id: ID,
        doc_id: ID,
        actor: address,
        timestamp: u64,
    }

    struct ICDecisionRecorded has copy, drop {
        pool_id: ID,
        decision_index: u64,
        decision_type: u8,
        created_by: address,
        timestamp: u64,
    }

    struct FolderCreated has copy, drop {
        dataroom_id: ID,
        folder_id: u64,
        name: String,
        parent_id: Option<u64>,
        created_by: address,
        timestamp: u64,
    }

    struct FolderKeyStored has copy, drop {
        dataroom_id: ID,
        folder_id: u64,
        member: address,
        stored_by: address,
        timestamp: u64,
    }

    struct AdminPauseToggled has copy, drop {
        paused: bool,
        actor: address,
        timestamp: u64,
    }

    /// Generic audit event for indexer consumption.
    /// metadata_hash: SHA-256 of any off-chain metadata blob (optional).
    struct AuditEvent has copy, drop {
        pool_id: ID,
        actor: address,
        action_type: u8,
        target_id: Option<ID>,
        timestamp: u64,
        metadata_hash: Option<vector<u8>>,
    }
}
```

---

## 5. admin.move

### Structs

```move
module rwa_dataroom::admin {
    use sui::clock::Clock;

    /// Shared object — one per deployment.
    struct AdminConfig has key {
        id: UID,
        paused: bool,
        pause_authority: address,
        platform_address: address,   // for sponsored txs
        max_members_per_room: u64,
        max_doc_versions: u64,
    }

    /// Owned capability — held by deployer multi-sig.
    struct AdminCap has key, store {
        id: UID,
    }
}
```

### Functions

| Function | Auth | Precondition | Description |
|----------|------|--------------|-------------|
| `init` (module init) | Package publish | — | Creates `AdminConfig` (shared) and `AdminCap` (transfer to `tx_context::sender`). Sets defaults: `paused=false`, `max_members_per_room=200`, `max_doc_versions=500`. |
| `pause` | `AdminCap` holder | `!config.paused` | Sets `config.paused = true`. Emits `AdminPauseToggled`. |
| `unpause` | `AdminCap` holder | `config.paused` | Sets `config.paused = false`. Emits `AdminPauseToggled`. |
| `update_config` | `AdminCap` holder | — | Updates `max_members_per_room`, `max_doc_versions`, `platform_address`, `pause_authority`. Validates non-zero values. |

```move
    /// Module initializer — called once on publish.
    fun init(ctx: &mut TxContext) {
        // Creates AdminConfig (share_object) and AdminCap (transfer to sender)
    }

    /// Emergency pause — blocks all state-changing entry functions.
    public entry fun pause(
        _cap: &AdminCap,
        config: &mut AdminConfig,
        clock: &Clock,
        ctx: &TxContext,
    );

    /// Resume operations.
    public entry fun unpause(
        _cap: &AdminCap,
        config: &mut AdminConfig,
        clock: &Clock,
        ctx: &TxContext,
    );

    /// Update tunable parameters.
    public entry fun update_config(
        _cap: &AdminCap,
        config: &mut AdminConfig,
        max_members_per_room: u64,
        max_doc_versions: u64,
        platform_address: address,
        pause_authority: address,
        ctx: &TxContext,
    );

    // ========== Package-internal helpers ==========

    /// Aborts with EPoolPaused if paused. Called by every state-changing function.
    public(package) fun assert_not_paused(config: &AdminConfig);

    /// Read accessors
    public(package) fun max_members(config: &AdminConfig): u64;
    public(package) fun max_versions(config: &AdminConfig): u64;
```

---

## 6. pool.move

### Struct

```move
module rwa_dataroom::pool {
    use sui::clock::Clock;
    use sui::dynamic_object_field;
    use sui::dynamic_field;
    use std::string::String;

    struct Pool has key {
        id: UID,
        org_id_hash: vector<u8>,         // 32 bytes, SHA-256 of org identifier
        name: String,
        borrower_name_hash: vector<u8>,   // 32 bytes, SHA-256 of borrower name
        currency: String,
        target_notional: u64,
        expected_maturity_date: u64,      // epoch ms
        created_at: u64,
        created_by: address,
        current_state: u8,                // PoolState enum
        encryption_scheme: u8,            // AES(0) or SEAL(1), IMMUTABLE after creation
        tags: vector<String>,
        ic_decision_count: u64,           // monotonic counter for decision_index keys
        last_updated_at: u64,
    }
}
```

### Dynamic Field Layout on Pool

| Key | Value Type | Description |
|-----|-----------|-------------|
| `b"dataroom"` | `DataRoom` | Single DataRoom child (dynamic_object_field) |
| `(doc_id: ID)` | `Document` | Documents keyed by their ID (dynamic_field) |
| `(decision_index: u64)` | `ICDecision` | IC decisions keyed by monotonic index (dynamic_field) |

### State Machine

```
DRAFT(0) ──→ DD_IN_PROGRESS(1) ──→ IC_REVIEW(2) ──→ APPROVED_INTERNAL(3) ──→ READY_TO_ISSUE(4)
                                        │
                                        ├──→ REJECTED(5) ──→ DRAFT(0) [reopen]
                                        │
                                        └──← DD_IN_PROGRESS(1) [IC request changes]

DRAFT(0) ──→ CANCELLED(6)
DD_IN_PROGRESS(1) ──→ CANCELLED(6)

Phase 2:
READY_TO_ISSUE(4) ──→ ISSUED(7) ──→ CLOSED(8)
```

### Functions

#### `create_pool`

```move
/// Creates a new Pool + DataRoom. Caller becomes OWNER.
/// Pool is shared. DataRoom is attached as dynamic_object_field.
///
/// Authorization: Any address (platform may restrict via frontend).
/// Precondition: !admin_config.paused
/// Postcondition: Pool.current_state == DRAFT, DataRoom created with caller as OWNER member.
///
/// Emits: PoolCreated, MemberAdded, AuditEvent
public entry fun create_pool(
    admin_config: &AdminConfig,
    org_id_hash: vector<u8>,           // must be 32 bytes
    name: String,                      // non-empty
    borrower_name_hash: vector<u8>,    // must be 32 bytes
    currency: String,
    target_notional: u64,
    expected_maturity_date: u64,
    encryption_scheme: u8,             // 0=AES, 1=SEAL
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
);
```

#### `progress_to_dd`

```move
/// Transition: DRAFT → DD_IN_PROGRESS
///
/// Authorization: OWNER | ORG_ADMIN (checked via DataRoom membership)
/// Precondition: !paused, current_state == DRAFT
///
/// Emits: PoolStateChanged, AuditEvent
public entry fun progress_to_dd(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `progress_to_ic_review`

```move
/// Transition: DD_IN_PROGRESS → IC_REVIEW
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == DD_IN_PROGRESS
/// Validation: All documents with required_flag == true must have at least one
///             ReviewRecord with status == APPROVED. Aborts with ERequiredDocsNotReviewed otherwise.
///
/// Implementation note: Iterate doc IDs (maintained as a vector on DataRoom or passed as arg),
///   load each Document via dynamic_field, check required_flag + review status.
///
/// Emits: PoolStateChanged, AuditEvent
public entry fun progress_to_ic_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,      // caller provides list of required doc IDs for gas-bounded iteration
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `record_ic_approval`

```move
/// Transition: IC_REVIEW → APPROVED_INTERNAL
/// Records an ICDecision on the Pool and transitions state.
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == IC_REVIEW
///
/// Emits: ICDecisionRecorded, PoolStateChanged, AuditEvent
public entry fun record_ic_approval(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &mut TxContext,
);
```

#### `record_ic_rejection`

```move
/// Transition: IC_REVIEW → REJECTED
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == IC_REVIEW
///
/// Emits: ICDecisionRecorded, PoolStateChanged, AuditEvent
public entry fun record_ic_rejection(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    reason: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &mut TxContext,
);
```

#### `record_ic_request_changes`

```move
/// Transition: IC_REVIEW → DD_IN_PROGRESS
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == IC_REVIEW
///
/// Emits: ICDecisionRecorded, PoolStateChanged, AuditEvent
public entry fun record_ic_request_changes(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &mut TxContext,
);
```

#### `progress_to_ready_to_issue`

```move
/// Transition: APPROVED_INTERNAL → READY_TO_ISSUE
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == APPROVED_INTERNAL
/// Validation: At least one IC decision of type APPROVE exists.
///             All required documents have APPROVED reviews.
///
/// Emits: PoolStateChanged, AuditEvent
public entry fun progress_to_ready_to_issue(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `cancel_pool`

```move
/// Transition: DRAFT | DD_IN_PROGRESS → CANCELLED
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state in {DRAFT, DD_IN_PROGRESS}
///
/// Emits: PoolCancelled, PoolStateChanged, AuditEvent
public entry fun cancel_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `reopen_rejected_pool`

```move
/// Transition: REJECTED → DRAFT
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, current_state == REJECTED
///
/// Emits: PoolStateChanged, AuditEvent
public entry fun reopen_rejected_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### Internal Helpers

```move
/// Borrow the DataRoom from Pool. Aborts if not attached.
public(package) fun borrow_dataroom(pool: &Pool): &DataRoom;
public(package) fun borrow_dataroom_mut(pool: &mut Pool): &mut DataRoom;

/// Assert caller has required role in the DataRoom. Aborts with EInsufficientRole.
public(package) fun assert_role(pool: &Pool, caller: address, required_role: u8);

/// Validate state transition. Aborts with EInvalidStateTransition.
fun assert_valid_transition(from: u8, to: u8);
```

---

## 7. dataroom.move

### Structs

```move
module rwa_dataroom::dataroom {
    use sui::table::Table;
    use sui::clock::Clock;
    use sui::dynamic_field;
    use std::string::String;

    struct DataRoom has key, store {
        id: UID,
        pool_id: ID,
        owner: address,
        member_count: u64,
        members: Table<address, Membership>,
        default_folders: vector<String>,    // ["Financial", "Legal", "KYC", "Collateral", "Reports"]
        custom_folder_count: u64,           // monotonic counter, starts at 100 (0-99 reserved for defaults)
        seal_policy_id: Option<ID>,         // set only if encryption_scheme == SEAL
        created_at: u64,
        last_updated_at: u64,
    }

    struct Membership has store, drop, copy {
        role: u8,                // bitmask (VIEWER | REVIEWER | EDITOR | OWNER | AUDITOR | ORG_ADMIN)
        added_by: address,
        added_at: u64,
        is_active: bool,
        revoked_at: Option<u64>,
        tags: vector<String>,    // e.g., ["legal-team", "external-counsel"]
    }

    struct FolderMeta has store, drop {
        name: String,
        folder_id: u64,
        parent_id: Option<u64>,
        visible_to_roles: u8,   // role bitmask — who can see this folder
        created_at: u64,
        created_by: address,
    }
}
```

### Dynamic Field Layout on DataRoom

| Key | Value Type | Description |
|-----|-----------|-------------|
| `(folder_id: u64)` | `FolderMeta` | Folder metadata |
| `(b"folder_key", folder_id: u64, member: address)` | `vector<u8>` | Per-member encrypted AES folder key |

### Functions

#### `add_member`

```move
/// Add a new member to the DataRoom.
///
/// Authorization: OWNER | ORG_ADMIN (caller must have role in DataRoom)
/// Precondition: !paused, member not already in table (or is revoked → reactivate),
///               member_count < admin_config.max_members_per_room
/// Postcondition: Membership inserted into table, member_count incremented.
///
/// Note: After adding a member, the client MUST call store_encrypted_folder_key
///       for each folder the member should access. This is a separate transaction
///       because the client must encrypt the folder key with the new member's public key.
///
/// Emits: MemberAdded, AuditEvent
public entry fun add_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    role: u8,                  // bitmask, validated: must be non-zero, must be subset of ROLE_ALL
    tags: vector<String>,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `remove_member`

```move
/// Soft-remove a member: sets is_active = false, records revoked_at.
/// Does NOT delete the Table entry (preserves audit trail).
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, member exists and is_active, member != dataroom.owner
/// Postcondition: is_active = false, revoked_at = now. member_count decremented.
///
/// Note: After removing, the client SHOULD rotate folder keys for all folders
///       this member had access to. This is enforced at the application layer,
///       not on-chain (re-encryption is a client-side operation).
///
/// Emits: MemberRemoved, AuditEvent
public entry fun remove_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `update_member_role`

```move
/// Update a member's role bitmask.
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, member exists and is_active
/// Constraint: Cannot demote the DataRoom owner below OWNER role.
///
/// Emits: MemberRoleUpdated, AuditEvent
public entry fun update_member_role(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    new_role: u8,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `create_custom_folder`

```move
/// Create a custom folder within the DataRoom.
///
/// Authorization: OWNER | EDITOR (must have EDITOR or higher role)
/// Precondition: !paused, name is non-empty,
///               if parent_id is Some → parent folder must exist
/// Postcondition: FolderMeta stored as dynamic_field, custom_folder_count incremented.
///
/// Emits: FolderCreated, AuditEvent
public entry fun create_custom_folder(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    clock: &Clock,
    ctx: &mut TxContext,
);
```

#### `store_encrypted_folder_key`

```move
/// Store a per-member encrypted AES folder key.
/// The client encrypts the raw folder AES key with the member's public key
/// and submits the ciphertext here.
///
/// Authorization: OWNER | ORG_ADMIN (only someone who already has the folder key)
/// Precondition: member exists and is_active, folder exists
/// Idempotent: Overwrites if key already exists for this (folder, member) pair.
///
/// Note: This function does NOT emit a heavyweight event to save gas.
///       It emits FolderKeyStored for indexer tracking.
///
/// Emits: FolderKeyStored
public entry fun store_encrypted_folder_key(
    pool: &mut Pool,
    folder_id: u64,
    member_addr: address,
    encrypted_key: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### Internal Helpers

```move
/// Check if address is an active member with at least the required role.
public(package) fun assert_member_role(
    dataroom: &DataRoom,
    caller: address,
    required_role: u8,
);

/// Get a member's role. Returns 0 if not found or inactive.
public(package) fun get_role(dataroom: &DataRoom, addr: address): u8;

/// Check if member exists and is active.
public(package) fun is_active_member(dataroom: &DataRoom, addr: address): bool;

/// Create default folders during DataRoom initialization.
/// Default folder IDs: 0=Financial, 1=Legal, 2=KYC, 3=Collateral, 4=Reports
fun create_default_folders(dataroom: &mut DataRoom, clock: &Clock, ctx: &TxContext);
```

---

## 8. document.move

### Structs

```move
module rwa_dataroom::document {
    use sui::clock::Clock;
    use sui::dynamic_field;
    use std::string::String;

    struct Document has key, store {
        id: UID,
        dataroom_id: ID,
        folder_id: u64,
        doc_type: u8,
        title: String,
        current_version: u64,
        version_count: u64,
        required_flag: bool,          // part of DD checklist
        is_archived: bool,
        visible_to_roles: u8,         // role bitmask
        encryption_scheme: u8,        // inherited from Pool, IMMUTABLE
        tags: vector<String>,
        created_by: address,
        created_at: u64,
        last_updated_at: u64,
    }

    struct DocVersion has store, drop {
        version: u64,
        walrus_blob_id: String,       // Walrus blob identifier
        content_hash: vector<u8>,     // 32 bytes, SHA-256 of PLAINTEXT (before encryption)
        size_bytes: u64,
        uploaded_by: address,
        uploaded_at: u64,
        change_log: String,
    }

    struct ReviewRecord has store, drop {
        reviewer: address,
        status: u8,                   // PENDING(0), APPROVED(1), NEEDS_REVISION(2)
        comment_hash: Option<vector<u8>>,  // SHA-256 of off-chain comment, 32 bytes
        reviewed_at: u64,
    }
}
```

### Dynamic Field Layout on Document

| Key | Value Type | Description |
|-----|-----------|-------------|
| `(version: u64)` | `DocVersion` | Version data, key = version number (1-indexed) |
| `(reviewer: address)` | `ReviewRecord` | Per-reviewer record, one per reviewer address |

### Functions

#### `create_document`

```move
/// Create a new Document and its first version (v1).
/// Document is stored as dynamic_field on Pool keyed by doc_id.
///
/// Authorization: EDITOR | OWNER | ORG_ADMIN
/// Precondition: !paused, folder_id exists in DataRoom, doc_type is valid,
///               blob_id non-empty, content_hash is 32 bytes
/// Postcondition: Document created with version_count=1, current_version=1.
///                DocVersion(1) stored as dynamic_field on Document.
///
/// Emits: DocumentCreated, AuditEvent
public entry fun create_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    folder_id: u64,
    doc_type: u8,
    title: String,
    required_flag: bool,
    visible_to_roles: u8,
    walrus_blob_id: String,
    content_hash: vector<u8>,     // 32 bytes
    size_bytes: u64,
    change_log: String,
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
): ID;   // returns the new document's ID
```

#### `add_version`

```move
/// Add a new version to an existing Document.
///
/// Authorization: EDITOR | OWNER | ORG_ADMIN
/// Precondition: !paused, document exists on pool, not archived,
///               version_count < admin_config.max_doc_versions,
///               blob_id non-empty, content_hash is 32 bytes
/// Postcondition: New DocVersion stored, current_version and version_count incremented.
///
/// Emits: DocumentVersionAdded, AuditEvent
public entry fun add_version(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `submit_review`

```move
/// Submit or update a review for a document.
/// Each reviewer gets one ReviewRecord. Calling again overwrites the previous review.
///
/// Authorization: REVIEWER | OWNER | ORG_ADMIN
/// Precondition: !paused, document exists, not archived,
///               status is valid (0, 1, or 2),
///               if comment_hash is Some → must be 32 bytes
/// Constraint: Reviewer cannot be the document's uploader (for the current version).
///             This prevents self-approval. Enforced on-chain.
///
/// Emits: DocumentReviewed, AuditEvent
public entry fun submit_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    status: u8,
    comment_hash: Option<vector<u8>>,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `mark_as_required`

```move
/// Toggle a document's required_flag (DD checklist inclusion).
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, document exists, not archived
///
/// No event (low-priority change, tracked via last_updated_at).
public entry fun mark_as_required(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    required: bool,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### `archive_document`

```move
/// Soft-delete a document. Sets is_archived = true.
/// Archived documents cannot receive new versions or reviews.
/// Existing versions and reviews are preserved.
///
/// Authorization: OWNER | ORG_ADMIN
/// Precondition: !paused, document exists, not already archived
///
/// Emits: DocumentArchived, AuditEvent
public entry fun archive_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    clock: &Clock,
    ctx: &TxContext,
);
```

#### Read Helpers

```move
/// Check if all documents in the given ID list that have required_flag == true
/// also have at least one ReviewRecord with status == APPROVED.
/// Used by pool state transitions.
///
/// Returns: true if all required docs are approved, false otherwise.
public(package) fun all_required_docs_approved(
    pool: &Pool,
    doc_ids: &vector<ID>,
): bool;
```

---

## 9. ic_decision.move

### Struct

```move
module rwa_dataroom::ic_decision {
    use std::string::String;

    struct ICDecision has store, drop {
        index: u64,                    // monotonic, assigned from Pool.ic_decision_count
        decision_type: u8,            // APPROVE(0), REJECT(1), REQUEST_CHANGES(2)
        decision_text: String,        // summary / rationale
        decision_pdf_blob_id: String, // Walrus blob ID of signed PDF
        created_by: address,
        committee_members: vector<address>,
        votes: vector<u8>,            // parallel to committee_members, per-member vote
        created_at: u64,
        related_doc_ids: vector<ID>,  // documents referenced in the decision
    }
}
```

IC decisions are created by `pool::record_ic_*` functions and stored as dynamic fields on Pool with key `(decision_index: u64)`.

There are no standalone entry functions in this module. It exposes only:

```move
    /// Construct an ICDecision. Called by pool.move internally.
    public(package) fun new(
        index: u64,
        decision_type: u8,
        decision_text: String,
        decision_pdf_blob_id: String,
        created_by: address,
        committee_members: vector<address>,
        votes: vector<u8>,
        created_at: u64,
        related_doc_ids: vector<ID>,
    ): ICDecision;
```

**Validation (enforced by caller `pool.move`):**
- `committee_members` must be non-empty
- `votes.length() == committee_members.length()`
- All committee members must be active DataRoom members

---

## 10. seal_policy.move

This module provides the on-chain policy verification function that Seal key servers call to determine whether a user may receive decryption key shares.

```move
module rwa_dataroom::seal_policy {
    use rwa_dataroom::dataroom::DataRoom;
    use rwa_dataroom::types;
    use sui::table;

    /// Called by Seal key servers during decryption requests.
    /// The key server passes the DataRoom reference and the requesting user's address.
    ///
    /// Returns true if:
    ///   1. caller is in dataroom.members
    ///   2. membership.is_active == true
    ///   3. (membership.role & min_role) > 0
    ///
    /// This function is public (not entry) — it is a read-only verification function.
    /// It does NOT modify state and does NOT emit events.
    public fun can_access(
        dataroom: &DataRoom,
        caller: address,
        min_role: u8,
    ): bool {
        if (!table::contains(&dataroom.members, caller)) {
            return false
        };
        let membership = table::borrow(&dataroom.members, caller);
        membership.is_active && types::has_role(membership.role, min_role)
    }

    /// Folder-level access check.
    /// Returns true if can_access() passes AND the folder's visible_to_roles
    /// includes the caller's role.
    public fun can_access_folder(
        dataroom: &DataRoom,
        caller: address,
        folder_visible_to_roles: u8,
    ): bool {
        if (!table::contains(&dataroom.members, caller)) {
            return false
        };
        let membership = table::borrow(&dataroom.members, caller);
        membership.is_active && types::has_role(membership.role, folder_visible_to_roles)
    }
}
```

---

## 11. Gas Cost Considerations

### Object Storage vs Events

| Approach | Gas Cost | Query Cost |
|----------|----------|-----------|
| Stored objects (audit entries) | ~0.5-2 SUI per entry (storage rebate partial) | Free via fullnode |
| Events | ~0.001 SUI per event | Requires indexer |

**Decision:** All audit trail data uses events. This avoids storage cost explosion at scale (thousands of events per pool lifecycle). An off-chain indexer (or Sui's built-in event subscription) captures and stores events for querying.

### Dynamic Fields vs Vectors

- **Document versions:** Each `DocVersion` is ~200-300 bytes. At 500 versions, a vector would consume ~150KB, approaching the 256KB object limit. Dynamic fields scale to thousands of versions without hitting the limit. Each dynamic field access costs ~1 additional object read.
- **Members:** `Table<address, Membership>` avoids O(n) iteration for membership lookups. Table entries are loaded on demand.
- **Trade-off:** Dynamic fields and Tables require knowing the key to access. Functions like `progress_to_ic_review` that need to check all required documents receive the doc ID list as a parameter from the client, bounding gas cost to the number of required docs rather than total docs.

### Sponsored Transactions

Functions that are typically backend-sponsored (metadata writes, audit events):
- `create_document` / `add_version` — document metadata
- `store_encrypted_folder_key` — key distribution
- `archive_document`

Functions requiring user signature (high-privilege):
- `create_pool`, `progress_to_*`, `cancel_pool`, `reopen_rejected_pool`
- `add_member`, `remove_member`, `update_member_role`
- `submit_review`
- `record_ic_*`

### Batching

Consider PTB (Programmable Transaction Block) composition for operations that commonly occur together:
- `add_member` + multiple `store_encrypted_folder_key` calls (one per folder)
- `create_document` + `mark_as_required`

---

## 12. Package Upgrade Strategy

### Upgrade Policy

Use `sui::package::UpgradeCap` with **compatible** upgrade policy (default). This allows:
- Adding new modules
- Adding new functions to existing modules
- Adding new fields to structs (at the end)
- Adding new event types

This does NOT allow:
- Removing or renaming existing public functions
- Changing function signatures
- Removing struct fields
- Changing struct abilities

### Upgrade Guard

```move
// In admin.move — future extension
struct UpgradeGuard has key {
    id: UID,
    upgrade_cap: UpgradeCap,
    timelock_hours: u64,       // e.g., 24h delay for mainnet
    pending_digest: Option<vector<u8>>,
    pending_since: Option<u64>,
}
```

**Phase 1:** `UpgradeCap` held by deployer multi-sig. Upgrades are immediate.
**Phase 2:** Wrap `UpgradeCap` in `UpgradeGuard` with a 24-hour timelock. This gives users a window to exit if they disagree with an upgrade.

### Versioning Convention

Each struct that may gain fields in future upgrades should include a `version: u64` field (not shown in the structs above to avoid noise, but recommended for implementation):

```move
struct Pool has key {
    id: UID,
    version: u64,  // starts at 1, bump on each upgrade that touches Pool
    // ... existing fields ...
}
```

Migration functions:

```move
/// Called post-upgrade to migrate a Pool to the new version.
/// Idempotent: no-op if already at current version.
public entry fun migrate_pool(pool: &mut Pool, ctx: &TxContext);
```

### Module Dependency Graph

```
types.move ←── errors.move
    ↑               ↑
    │               │
events.move    admin.move
    ↑               ↑
    │               │
    ├───── pool.move ←── ic_decision.move
    │         ↑
    │         │
    ├── dataroom.move
    │         ↑
    │         │
    ├── document.move
    │
    └── seal_policy.move
```

All modules depend on `types` and `errors`. `pool.move` is the central coordinator that orchestrates state transitions and delegates to `dataroom`, `document`, and `ic_decision`.

---

## Appendix A: Authorization Matrix

| Function | VIEWER | REVIEWER | EDITOR | OWNER | AUDITOR | ORG_ADMIN |
|----------|--------|----------|--------|-------|---------|-----------|
| `create_pool` | -- | -- | -- | creator | -- | -- |
| `progress_to_dd` | | | | Y | | Y |
| `progress_to_ic_review` | | | | Y | | Y |
| `record_ic_*` | | | | Y | | Y |
| `progress_to_ready_to_issue` | | | | Y | | Y |
| `cancel_pool` | | | | Y | | Y |
| `reopen_rejected_pool` | | | | Y | | Y |
| `add_member` | | | | Y | | Y |
| `remove_member` | | | | Y | | Y |
| `update_member_role` | | | | Y | | Y |
| `create_custom_folder` | | | Y | Y | | Y |
| `store_encrypted_folder_key` | | | | Y | | Y |
| `create_document` | | | Y | Y | | Y |
| `add_version` | | | Y | Y | | Y |
| `submit_review` | | Y | | Y | | Y |
| `mark_as_required` | | | | Y | | Y |
| `archive_document` | | | | Y | | Y |
| Read (via Seal) | Y | Y | Y | Y | Y | Y |

## Appendix B: Event Indexing Requirements

The off-chain indexer must subscribe to all events in `rwa_dataroom::events` and persist them for:

1. **Audit trail UI** — filtered by `pool_id` and `action_type`
2. **Activity feed** — ordered by `timestamp`
3. **Compliance reporting** — all state transitions, member changes, document reviews
4. **Seal access logs** — tracked separately via Seal key server logs (not on-chain)

Recommended indexing stack: Sui's `sui_subscribeEvent` JSON-RPC or a custom indexer reading from the Sui fullnode checkpoint data.
