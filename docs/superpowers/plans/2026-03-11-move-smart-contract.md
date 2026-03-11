# Move Smart Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 Sui Move modules for the RWA Credit Data Room on-chain layer — Pool lifecycle, DataRoom membership, Document management, IC decisions, and Seal policy verification.

**Architecture:** Bottom-up module implementation following dependency graph. Pool is the root shared object containing DataRoom (dynamic_object_field), Documents and ICDecisions (dynamic_fields). All audit data uses events (not stored objects) to minimize gas. TDD with `sui move test`.

**Tech Stack:** Sui Move 2024 edition, sui::test_scenario, sui::clock, sui::dynamic_field, sui::dynamic_object_field, sui::table, sui::event

**Spec:** `docs/design/move-interface.md`

---

## ⚠️ ERRATA — Plan Review Fixes (2026-03-12)

> **For executing agents:** This plan was written by 3 parallel agents. The following corrections are AUTHORITATIVE. When any code in Chunks 2-6 conflicts with these rules, follow the errata.

### E1: Single Source of Truth

- **Chunk 1 definitions** (types.move, errors.move, events.move, admin.move) are canonical.
- **Chunk 2-6 "prerequisite" blocks** (e.g., "Add to types.move if not present") are OBSOLETE and must be IGNORED. All constants, structs, and helpers are already fully defined in Chunk 1.

### E2: Error Accessor Naming Convention

Chunk 1 uses **snake_case without `e_` prefix**. Chunks 2-6 use `errors::e_*()` style. **Use Chunk 1 convention**:

| Chunk 2-6 (WRONG) | Chunk 1 (CORRECT) |
|----|----|
| `errors::e_paused()` | `errors::already_paused()` or `errors::pool_paused()` |
| `errors::e_unauthorized()` | `errors::not_authorized()` |
| `errors::e_not_member()` | `errors::not_member()` |
| `errors::e_member_already_exists()` | `errors::member_already_exists()` |
| `errors::e_max_members_reached()` | `errors::max_members_reached()` |
| `errors::e_cannot_remove_owner()` | `errors::cannot_remove_owner()` |
| `errors::e_cannot_demote_owner()` | `errors::cannot_demote_owner()` *(new — add to errors.move)* |
| `errors::e_invalid_role()` | `errors::invalid_role()` |
| `errors::e_empty_name()` | `errors::empty_name()` |
| `errors::e_folder_not_found()` | `errors::folder_not_found()` |
| `errors::e_invalid_doc_type()` | `errors::invalid_doc_type()` |
| `errors::e_empty_blob_id()` | `errors::empty_blob_id()` |
| `errors::e_invalid_content_hash()` | `errors::invalid_content_hash_len()` |
| `errors::e_self_review()` | `errors::self_review()` *(new — add to errors.move)* |
| `errors::e_no_ic_approval()` | `errors::no_ic_approval()` *(new — add to errors.move)* |

### E3: Missing Error Constants — Add to errors.move (Task 3)

Append these to errors.move before the public accessors section:

```move
// ========== IC Decision ==========
const ENoICApproval:           u64 = 800;

// ========== Review ==========
const ESelfReview:             u64 = 801;

// ========== Role ==========
const ECannotDemoteOwner:      u64 = 802;
```

And add accessors:
```move
public fun no_ic_approval(): u64 { ENoICApproval }
public fun self_review(): u64 { ESelfReview }
public fun cannot_demote_owner(): u64 { ECannotDemoteOwner }
```

### E4: Function Naming — `has_role()` not `role_has_permission()`

Chunk 1 defines `types::has_role(role, required): bool` using bitmask AND. Chunk 2's `role_has_permission()` uses a WRONG permission-level check (`<=`). **Always use `types::has_role()`**.

Similarly: `types::role_bitmask_all()` → use `types::role_all()` (Chunk 1).

### E5: Pool State Constants

Chunk 2 prerequisite defines wrong names. **Correct names** (from Chunk 1):

| WRONG (Chunk 2) | CORRECT (Chunk 1) |
|----|----|
| `POOL_STATE_OPEN` (1) | `POOL_STATE_DD_IN_PROGRESS` (1) |
| `POOL_STATE_UNDER_REVIEW` (2) | `POOL_STATE_IC_REVIEW` (2) |
| `POOL_STATE_APPROVED` (3) | `POOL_STATE_APPROVED_INTERNAL` (3) |
| *(missing)* | `POOL_STATE_READY_TO_ISSUE` (4) |
| `POOL_STATE_REJECTED` (4→5) | `POOL_STATE_REJECTED` (5) |
| `POOL_STATE_CLOSED` (5→8) | `POOL_STATE_CLOSED` (8) |
| *(missing)* | `POOL_STATE_CANCELLED` (6) |
| *(missing)* | `POOL_STATE_ISSUED` (7) |

### E6: `create_document` Must Return ID

Per spec (`docs/design/move-interface.md`), `create_document` returns `ID`. Change:
- `public entry fun create_document(...)` → `public fun create_document(...): ID`
- Add `doc_id` as return value at the end of the function body.

### E7: Event Emit Signatures Must Match Chunk 1

Chunk 1 defines all emit functions with `timestamp: u64` parameter. Chunks 2-6 sometimes call emit functions **without timestamp**. Always pass `clock.timestamp_ms()` as the last argument.

Example: `events::emit_member_added(dataroom_id, member, role, added_by, timestamp)` — 5 args, not 4.

### E8: admin.move Implicit Imports

In Move 2024 edition, `sui::object` and `sui::transfer` are auto-imported. No explicit import needed. This is NOT a bug.

### E9: test_helpers Module — Must Be Created

A `test_helpers.move` module is referenced 100+ times but never defined. **Add Task 2.5** (after Task 5, before Task 6) to create it. See the new task definition below in Chunk 1.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `contracts/rwa_dataroom/Move.toml` | Package manifest — name, edition, dependencies, addresses |
| `contracts/rwa_dataroom/sources/types.move` | Role bitmasks, state enums, doc types, encryption schemes, helper functions |
| `contracts/rwa_dataroom/sources/errors.move` | All error constants (E_ prefixed), public accessor functions |
| `contracts/rwa_dataroom/sources/events.move` | All event struct definitions (`copy, drop`), `public(package)` emit functions |
| `contracts/rwa_dataroom/sources/admin.move` | AdminConfig shared object, AdminCap owned capability, pause/unpause, config |
| `contracts/rwa_dataroom/sources/pool.move` | Pool object, state machine transitions, create/cancel/advance |
| `contracts/rwa_dataroom/sources/dataroom.move` | DataRoom struct, membership Table, folder management |
| `contracts/rwa_dataroom/sources/document.move` | Document, DocVersion (dynamic fields), ReviewRecord, upload/review/archive |
| `contracts/rwa_dataroom/sources/ic_decision.move` | ICDecision structs stored as dynamic fields on Pool |
| `contracts/rwa_dataroom/sources/seal_policy.move` | Seal key server verification entry point |
| `contracts/rwa_dataroom/tests/types_tests.move` | Tests for types helper functions |
| `contracts/rwa_dataroom/tests/admin_tests.move` | Tests for AdminConfig init, pause/unpause, update_config |
| `contracts/rwa_dataroom/tests/pool_tests.move` | Tests for Pool creation, state transitions, cancellation |
| `contracts/rwa_dataroom/tests/dataroom_tests.move` | Tests for DataRoom membership, folder operations |
| `contracts/rwa_dataroom/tests/document_tests.move` | Tests for Document CRUD, versioning, review workflow |
| `contracts/rwa_dataroom/tests/seal_policy_tests.move` | Tests for Seal policy verification logic |
| `contracts/rwa_dataroom/tests/integration_tests.move` | End-to-end tests across multiple modules |

---

## Chunk 1: Setup + Foundation Modules (types, errors, events, admin)

---

### Task 1: Project Scaffolding

**Files:**
- Create `contracts/rwa_dataroom/Move.toml`
- Create `contracts/rwa_dataroom/sources/` (directory)
- Create `contracts/rwa_dataroom/tests/` (directory)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p contracts/rwa_dataroom/sources
mkdir -p contracts/rwa_dataroom/tests
```

- [ ] **Step 2: Create Move.toml**

```toml
[package]
name = "rwa_dataroom"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
rwa_dataroom = "0x0"
```

- [ ] **Step 3: Create placeholder module to verify build**

Create a minimal `sources/types.move` with just the module declaration:

```move
module rwa_dataroom::types;
```

- [ ] **Step 4: Verify build**

Run: `cd contracts/rwa_dataroom && sui move build`

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit scaffold**

```bash
git add contracts/rwa_dataroom/Move.toml contracts/rwa_dataroom/sources/
git commit -m "chore: scaffold rwa_dataroom Move package with Move.toml"
```

---

### Task 2: types.move

**Files:**
- Create `contracts/rwa_dataroom/sources/types.move`
- Create `contracts/rwa_dataroom/tests/types_tests.move`

- [ ] **Step 1: Implement types.move with all constants, helpers, and public accessors**

```move
module rwa_dataroom::types;

// ========== Role Bitmask ==========
const ROLE_VIEWER:    u8 = 1;
const ROLE_REVIEWER:  u8 = 2;
const ROLE_EDITOR:    u8 = 4;
const ROLE_OWNER:     u8 = 8;
const ROLE_AUDITOR:   u8 = 16;
const ROLE_ORG_ADMIN: u8 = 32;

const ROLE_EDITOR_UP:  u8 = 12;  // EDITOR | OWNER
const ROLE_OWNER_UP:   u8 = 40;  // OWNER | ORG_ADMIN
const ROLE_ALL:        u8 = 63;

// ========== Pool State ==========
const POOL_STATE_DRAFT:             u8 = 0;
const POOL_STATE_DD_IN_PROGRESS:    u8 = 1;
const POOL_STATE_IC_REVIEW:         u8 = 2;
const POOL_STATE_APPROVED_INTERNAL: u8 = 3;
const POOL_STATE_READY_TO_ISSUE:    u8 = 4;
const POOL_STATE_REJECTED:          u8 = 5;
const POOL_STATE_CANCELLED:         u8 = 6;
const POOL_STATE_ISSUED:            u8 = 7;
const POOL_STATE_CLOSED:            u8 = 8;

// ========== Review State ==========
const REVIEW_PENDING:        u8 = 0;
const REVIEW_APPROVED:       u8 = 1;
const REVIEW_NEEDS_REVISION: u8 = 2;

// ========== Document Type ==========
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

// ========== Encryption Scheme ==========
const ENCRYPTION_AES:  u8 = 0;
const ENCRYPTION_SEAL: u8 = 1;

// ========== IC Decision Type ==========
const IC_APPROVE:          u8 = 0;
const IC_REJECT:           u8 = 1;
const IC_REQUEST_CHANGES:  u8 = 2;

// ========== Action Types ==========
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

// ========== Helpers ==========
public fun has_role(role: u8, required: u8): bool {
    (role & required) > 0
}

public fun is_valid_pool_state(state: u8): bool {
    state <= 8
}

public fun is_valid_encryption_scheme(scheme: u8): bool {
    scheme <= 1
}

public fun is_valid_doc_type(doc_type: u8): bool {
    doc_type <= 9
}

// ========== Accessor constants (public) ==========
public fun role_viewer(): u8 { ROLE_VIEWER }
public fun role_reviewer(): u8 { ROLE_REVIEWER }
public fun role_editor(): u8 { ROLE_EDITOR }
public fun role_owner(): u8 { ROLE_OWNER }
public fun role_auditor(): u8 { ROLE_AUDITOR }
public fun role_org_admin(): u8 { ROLE_ORG_ADMIN }
public fun role_owner_up(): u8 { ROLE_OWNER_UP }
public fun role_editor_up(): u8 { ROLE_EDITOR_UP }
public fun role_all(): u8 { ROLE_ALL }

public fun pool_state_draft(): u8 { POOL_STATE_DRAFT }
public fun pool_state_dd_in_progress(): u8 { POOL_STATE_DD_IN_PROGRESS }
public fun pool_state_ic_review(): u8 { POOL_STATE_IC_REVIEW }
public fun pool_state_approved_internal(): u8 { POOL_STATE_APPROVED_INTERNAL }
public fun pool_state_ready_to_issue(): u8 { POOL_STATE_READY_TO_ISSUE }
public fun pool_state_rejected(): u8 { POOL_STATE_REJECTED }
public fun pool_state_cancelled(): u8 { POOL_STATE_CANCELLED }
public fun pool_state_issued(): u8 { POOL_STATE_ISSUED }
public fun pool_state_closed(): u8 { POOL_STATE_CLOSED }

public fun review_pending(): u8 { REVIEW_PENDING }
public fun review_approved(): u8 { REVIEW_APPROVED }
public fun review_needs_revision(): u8 { REVIEW_NEEDS_REVISION }

public fun doc_type_financial_statement(): u8 { DOC_TYPE_FINANCIAL_STATEMENT }
public fun doc_type_legal_agreement(): u8 { DOC_TYPE_LEGAL_AGREEMENT }
public fun doc_type_kyc_aml(): u8 { DOC_TYPE_KYC_AML }
public fun doc_type_collateral(): u8 { DOC_TYPE_COLLATERAL }
public fun doc_type_valuation_report(): u8 { DOC_TYPE_VALUATION_REPORT }
public fun doc_type_insurance(): u8 { DOC_TYPE_INSURANCE }
public fun doc_type_corporate_doc(): u8 { DOC_TYPE_CORPORATE_DOC }
public fun doc_type_term_sheet(): u8 { DOC_TYPE_TERM_SHEET }
public fun doc_type_ic_memo(): u8 { DOC_TYPE_IC_MEMO }
public fun doc_type_misc(): u8 { DOC_TYPE_MISC }

public fun encryption_aes(): u8 { ENCRYPTION_AES }
public fun encryption_seal(): u8 { ENCRYPTION_SEAL }

public fun ic_approve(): u8 { IC_APPROVE }
public fun ic_reject(): u8 { IC_REJECT }
public fun ic_request_changes(): u8 { IC_REQUEST_CHANGES }

public fun action_pool_created(): u8 { ACTION_POOL_CREATED }
public fun action_state_changed(): u8 { ACTION_STATE_CHANGED }
public fun action_member_added(): u8 { ACTION_MEMBER_ADDED }
public fun action_member_removed(): u8 { ACTION_MEMBER_REMOVED }
public fun action_member_role_updated(): u8 { ACTION_MEMBER_ROLE_UPDATED }
public fun action_doc_created(): u8 { ACTION_DOC_CREATED }
public fun action_doc_version_added(): u8 { ACTION_DOC_VERSION_ADDED }
public fun action_doc_reviewed(): u8 { ACTION_DOC_REVIEWED }
public fun action_doc_archived(): u8 { ACTION_DOC_ARCHIVED }
public fun action_ic_decision(): u8 { ACTION_IC_DECISION }
public fun action_folder_created(): u8 { ACTION_FOLDER_CREATED }
public fun action_pool_cancelled(): u8 { ACTION_POOL_CANCELLED }
public fun action_pause_toggled(): u8 { ACTION_PAUSE_TOGGLED }
```

- [ ] **Step 2: Implement types_tests.move**

```move
#[test_only]
module rwa_dataroom::types_tests;

use rwa_dataroom::types;

// ========== has_role tests ==========

#[test]
fun test_has_role_single_match() {
    assert!(types::has_role(types::role_viewer(), types::role_viewer()));
    assert!(types::has_role(types::role_owner(), types::role_owner()));
}

#[test]
fun test_has_role_no_match() {
    assert!(!types::has_role(types::role_viewer(), types::role_editor()));
    assert!(!types::has_role(types::role_reviewer(), types::role_owner()));
}

#[test]
fun test_has_role_multi_bit_match() {
    // User has EDITOR | OWNER (12), check against OWNER
    let combined = types::role_editor() | types::role_owner();
    assert!(types::has_role(combined, types::role_owner()));
    assert!(types::has_role(combined, types::role_editor()));
    assert!(!types::has_role(combined, types::role_auditor()));
}

#[test]
fun test_has_role_editor_up() {
    // ROLE_EDITOR_UP = EDITOR | OWNER = 12
    assert!(types::has_role(types::role_editor(), types::role_editor_up()));
    assert!(types::has_role(types::role_owner(), types::role_editor_up()));
    assert!(!types::has_role(types::role_viewer(), types::role_editor_up()));
    assert!(!types::has_role(types::role_reviewer(), types::role_editor_up()));
}

#[test]
fun test_has_role_owner_up() {
    // ROLE_OWNER_UP = OWNER | ORG_ADMIN = 40
    assert!(types::has_role(types::role_owner(), types::role_owner_up()));
    assert!(types::has_role(types::role_org_admin(), types::role_owner_up()));
    assert!(!types::has_role(types::role_editor(), types::role_owner_up()));
}

#[test]
fun test_has_role_all() {
    assert!(types::has_role(types::role_viewer(), types::role_all()));
    assert!(types::has_role(types::role_reviewer(), types::role_all()));
    assert!(types::has_role(types::role_editor(), types::role_all()));
    assert!(types::has_role(types::role_owner(), types::role_all()));
    assert!(types::has_role(types::role_auditor(), types::role_all()));
    assert!(types::has_role(types::role_org_admin(), types::role_all()));
}

#[test]
fun test_has_role_zero() {
    assert!(!types::has_role(0, types::role_viewer()));
    assert!(!types::has_role(0, types::role_all()));
}

// ========== Validation function tests ==========

#[test]
fun test_is_valid_pool_state() {
    let mut i: u8 = 0;
    while (i <= 8) {
        assert!(types::is_valid_pool_state(i));
        i = i + 1;
    };
    assert!(!types::is_valid_pool_state(9));
    assert!(!types::is_valid_pool_state(255));
}

#[test]
fun test_is_valid_encryption_scheme() {
    assert!(types::is_valid_encryption_scheme(0));
    assert!(types::is_valid_encryption_scheme(1));
    assert!(!types::is_valid_encryption_scheme(2));
    assert!(!types::is_valid_encryption_scheme(255));
}

#[test]
fun test_is_valid_doc_type() {
    let mut i: u8 = 0;
    while (i <= 9) {
        assert!(types::is_valid_doc_type(i));
        i = i + 1;
    };
    assert!(!types::is_valid_doc_type(10));
    assert!(!types::is_valid_doc_type(255));
}

// ========== Accessor value correctness ==========

#[test]
fun test_role_bitmask_values() {
    assert!(types::role_viewer()    == 1);
    assert!(types::role_reviewer()  == 2);
    assert!(types::role_editor()    == 4);
    assert!(types::role_owner()     == 8);
    assert!(types::role_auditor()   == 16);
    assert!(types::role_org_admin() == 32);
    assert!(types::role_editor_up() == 12);
    assert!(types::role_owner_up()  == 40);
    assert!(types::role_all()       == 63);
}

#[test]
fun test_pool_state_values() {
    assert!(types::pool_state_draft()             == 0);
    assert!(types::pool_state_dd_in_progress()    == 1);
    assert!(types::pool_state_ic_review()         == 2);
    assert!(types::pool_state_approved_internal() == 3);
    assert!(types::pool_state_ready_to_issue()    == 4);
    assert!(types::pool_state_rejected()          == 5);
    assert!(types::pool_state_cancelled()         == 6);
    assert!(types::pool_state_issued()            == 7);
    assert!(types::pool_state_closed()            == 8);
}

#[test]
fun test_ic_decision_values() {
    assert!(types::ic_approve()         == 0);
    assert!(types::ic_reject()          == 1);
    assert!(types::ic_request_changes() == 2);
}
```

- [ ] **Step 3: Verify tests pass**

Run: `cd contracts/rwa_dataroom && sui move test --filter types_tests`

- [ ] **Step 4: Commit types module**

```bash
git add contracts/rwa_dataroom/sources/types.move contracts/rwa_dataroom/tests/types_tests.move
git commit -m "feat(move): add types.move — role bitmasks, state enums, helpers + tests"
```

---

### Task 3: errors.move

**Files:**
- Create `contracts/rwa_dataroom/sources/errors.move`

- [ ] **Step 1: Implement errors.move with all error constants and public accessors**

```move
module rwa_dataroom::errors;

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
const EInvalidHashLength:       u64 = 603;
const EEmptyCommittee:          u64 = 604;

// ========== DD Checklist ==========
const ERequiredDocsNotReviewed: u64 = 700;
const EComplianceCheckFailed:   u64 = 701;

// ========== IC Decision (ERRATA E3) ==========
const ENoICApproval:           u64 = 800;

// ========== Review (ERRATA E3) ==========
const ESelfReview:             u64 = 801;

// ========== Role (ERRATA E3) ==========
const ECannotDemoteOwner:      u64 = 802;

// ========== Public accessors ==========
public fun not_authorized(): u64 { ENotAuthorized }
public fun not_owner(): u64 { ENotOwner }
public fun not_member(): u64 { ENotMember }
public fun insufficient_role(): u64 { EInsufficientRole }
public fun member_not_active(): u64 { EMemberNotActive }

public fun invalid_state_transition(): u64 { EInvalidStateTransition }
public fun pool_paused(): u64 { EPoolPaused }
public fun pool_not_in_draft(): u64 { EPoolNotInDraft }
public fun pool_not_in_dd(): u64 { EPoolNotInDD }
public fun pool_not_in_ic_review(): u64 { EPoolNotInICReview }
public fun pool_not_rejected(): u64 { EPoolNotRejected }
public fun pool_cancelled(): u64 { EPoolCancelled }

public fun member_already_exists(): u64 { EMemberAlreadyExists }
public fun member_not_found(): u64 { EMemberNotFound }
public fun cannot_remove_owner(): u64 { ECannotRemoveOwner }
public fun max_members_reached(): u64 { EMaxMembersReached }
public fun member_already_revoked(): u64 { EMemberAlreadyRevoked }

public fun document_not_found(): u64 { EDocumentNotFound }
public fun max_versions_reached(): u64 { EMaxVersionsReached }
public fun document_archived(): u64 { EDocumentArchived }
public fun invalid_doc_type(): u64 { EInvalidDocType }
public fun empty_blob_id(): u64 { EEmptyBlobId }
public fun empty_content_hash(): u64 { EEmptyContentHash }
public fun invalid_content_hash_len(): u64 { EInvalidContentHashLen }
public fun already_reviewed(): u64 { EAlreadyReviewed }

public fun folder_not_found(): u64 { EFolderNotFound }
public fun folder_name_empty(): u64 { EFolderNameEmpty }
public fun parent_folder_not_found(): u64 { EParentFolderNotFound }

public fun already_paused(): u64 { EAlreadyPaused }
public fun not_paused(): u64 { ENotPaused }
public fun invalid_config(): u64 { EInvalidConfig }

public fun invalid_encryption_scheme(): u64 { EInvalidEncryptionScheme }
public fun invalid_role(): u64 { EInvalidRole }
public fun empty_name(): u64 { EEmptyName }
public fun invalid_hash_length(): u64 { EInvalidHashLength }
public fun empty_committee(): u64 { EEmptyCommittee }

public fun required_docs_not_reviewed(): u64 { ERequiredDocsNotReviewed }
public fun compliance_check_failed(): u64 { EComplianceCheckFailed }

// ERRATA E3: Missing accessors
public fun no_ic_approval(): u64 { ENoICApproval }
public fun self_review(): u64 { ESelfReview }
public fun cannot_demote_owner(): u64 { ECannotDemoteOwner }
```

- [ ] **Step 2: Verify build**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 3: Commit errors module**

```bash
git add contracts/rwa_dataroom/sources/errors.move
git commit -m "feat(move): add errors.move — all error code constants with accessors"
```

---

### Task 4: events.move

**Files:**
- Create `contracts/rwa_dataroom/sources/events.move`

- [ ] **Step 1: Implement events.move with all event structs and public(package) emit functions**

```move
module rwa_dataroom::events;

use sui::event;
use std::string::String;

// ========== Event Structs ==========

public struct PoolCreated has copy, drop {
    pool_id: ID,
    name: String,
    org_id_hash: vector<u8>,
    created_by: address,
    encryption_scheme: u8,
    timestamp: u64,
}

public struct PoolStateChanged has copy, drop {
    pool_id: ID,
    from_state: u8,
    to_state: u8,
    actor: address,
    timestamp: u64,
}

public struct PoolCancelled has copy, drop {
    pool_id: ID,
    actor: address,
    timestamp: u64,
}

public struct MemberAdded has copy, drop {
    dataroom_id: ID,
    member: address,
    role: u8,
    added_by: address,
    timestamp: u64,
}

public struct MemberRemoved has copy, drop {
    dataroom_id: ID,
    member: address,
    removed_by: address,
    timestamp: u64,
}

public struct MemberRoleUpdated has copy, drop {
    dataroom_id: ID,
    member: address,
    old_role: u8,
    new_role: u8,
    actor: address,
    timestamp: u64,
}

public struct DocumentCreated has copy, drop {
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

public struct DocumentVersionAdded has copy, drop {
    pool_id: ID,
    doc_id: ID,
    version: u64,
    blob_id: String,
    content_hash: vector<u8>,
    uploader: address,
    timestamp: u64,
}

public struct DocumentReviewed has copy, drop {
    pool_id: ID,
    doc_id: ID,
    reviewer: address,
    status: u8,
    timestamp: u64,
}

public struct DocumentArchived has copy, drop {
    pool_id: ID,
    doc_id: ID,
    actor: address,
    timestamp: u64,
}

public struct ICDecisionRecorded has copy, drop {
    pool_id: ID,
    decision_index: u64,
    decision_type: u8,
    created_by: address,
    timestamp: u64,
}

public struct FolderCreated has copy, drop {
    dataroom_id: ID,
    folder_id: u64,
    name: String,
    parent_id: Option<u64>,
    created_by: address,
    timestamp: u64,
}

public struct FolderKeyStored has copy, drop {
    dataroom_id: ID,
    folder_id: u64,
    member: address,
    stored_by: address,
    timestamp: u64,
}

public struct AdminPauseToggled has copy, drop {
    paused: bool,
    actor: address,
    timestamp: u64,
}

public struct AuditEvent has copy, drop {
    pool_id: ID,
    actor: address,
    action_type: u8,
    target_id: Option<ID>,
    timestamp: u64,
    metadata_hash: Option<vector<u8>>,
}

// ========== Emit Functions (public(package)) ==========

public(package) fun emit_pool_created(
    pool_id: ID,
    name: String,
    org_id_hash: vector<u8>,
    created_by: address,
    encryption_scheme: u8,
    timestamp: u64,
) {
    event::emit(PoolCreated {
        pool_id,
        name,
        org_id_hash,
        created_by,
        encryption_scheme,
        timestamp,
    });
}

public(package) fun emit_pool_state_changed(
    pool_id: ID,
    from_state: u8,
    to_state: u8,
    actor: address,
    timestamp: u64,
) {
    event::emit(PoolStateChanged {
        pool_id,
        from_state,
        to_state,
        actor,
        timestamp,
    });
}

public(package) fun emit_pool_cancelled(
    pool_id: ID,
    actor: address,
    timestamp: u64,
) {
    event::emit(PoolCancelled {
        pool_id,
        actor,
        timestamp,
    });
}

public(package) fun emit_member_added(
    dataroom_id: ID,
    member: address,
    role: u8,
    added_by: address,
    timestamp: u64,
) {
    event::emit(MemberAdded {
        dataroom_id,
        member,
        role,
        added_by,
        timestamp,
    });
}

public(package) fun emit_member_removed(
    dataroom_id: ID,
    member: address,
    removed_by: address,
    timestamp: u64,
) {
    event::emit(MemberRemoved {
        dataroom_id,
        member,
        removed_by,
        timestamp,
    });
}

public(package) fun emit_member_role_updated(
    dataroom_id: ID,
    member: address,
    old_role: u8,
    new_role: u8,
    actor: address,
    timestamp: u64,
) {
    event::emit(MemberRoleUpdated {
        dataroom_id,
        member,
        old_role,
        new_role,
        actor,
        timestamp,
    });
}

public(package) fun emit_document_created(
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
) {
    event::emit(DocumentCreated {
        pool_id,
        doc_id,
        folder_id,
        doc_type,
        title,
        version,
        blob_id,
        content_hash,
        uploader,
        timestamp,
    });
}

public(package) fun emit_document_version_added(
    pool_id: ID,
    doc_id: ID,
    version: u64,
    blob_id: String,
    content_hash: vector<u8>,
    uploader: address,
    timestamp: u64,
) {
    event::emit(DocumentVersionAdded {
        pool_id,
        doc_id,
        version,
        blob_id,
        content_hash,
        uploader,
        timestamp,
    });
}

public(package) fun emit_document_reviewed(
    pool_id: ID,
    doc_id: ID,
    reviewer: address,
    status: u8,
    timestamp: u64,
) {
    event::emit(DocumentReviewed {
        pool_id,
        doc_id,
        reviewer,
        status,
        timestamp,
    });
}

public(package) fun emit_document_archived(
    pool_id: ID,
    doc_id: ID,
    actor: address,
    timestamp: u64,
) {
    event::emit(DocumentArchived {
        pool_id,
        doc_id,
        actor,
        timestamp,
    });
}

public(package) fun emit_ic_decision_recorded(
    pool_id: ID,
    decision_index: u64,
    decision_type: u8,
    created_by: address,
    timestamp: u64,
) {
    event::emit(ICDecisionRecorded {
        pool_id,
        decision_index,
        decision_type,
        created_by,
        timestamp,
    });
}

public(package) fun emit_folder_created(
    dataroom_id: ID,
    folder_id: u64,
    name: String,
    parent_id: Option<u64>,
    created_by: address,
    timestamp: u64,
) {
    event::emit(FolderCreated {
        dataroom_id,
        folder_id,
        name,
        parent_id,
        created_by,
        timestamp,
    });
}

public(package) fun emit_folder_key_stored(
    dataroom_id: ID,
    folder_id: u64,
    member: address,
    stored_by: address,
    timestamp: u64,
) {
    event::emit(FolderKeyStored {
        dataroom_id,
        folder_id,
        member,
        stored_by,
        timestamp,
    });
}

public(package) fun emit_admin_pause_toggled(
    paused: bool,
    actor: address,
    timestamp: u64,
) {
    event::emit(AdminPauseToggled {
        paused,
        actor,
        timestamp,
    });
}

public(package) fun emit_audit_event(
    pool_id: ID,
    actor: address,
    action_type: u8,
    target_id: Option<ID>,
    timestamp: u64,
    metadata_hash: Option<vector<u8>>,
) {
    event::emit(AuditEvent {
        pool_id,
        actor,
        action_type,
        target_id,
        timestamp,
        metadata_hash,
    });
}
```

- [ ] **Step 2: Verify build**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 3: Commit events module**

```bash
git add contracts/rwa_dataroom/sources/events.move
git commit -m "feat(move): add events.move — all event structs with package-scoped emit functions"
```

---

### Task 5: admin.move

**Files:**
- Create `contracts/rwa_dataroom/sources/admin.move`
- Create `contracts/rwa_dataroom/tests/admin_tests.move`

- [ ] **Step 1: Implement admin.move**

```move
module rwa_dataroom::admin;

use sui::clock::Clock;
use rwa_dataroom::errors;
use rwa_dataroom::events;

// ========== Structs ==========

/// Shared object — one per deployment.
public struct AdminConfig has key {
    id: UID,
    paused: bool,
    pause_authority: address,
    platform_address: address,
    max_members_per_room: u64,
    max_doc_versions: u64,
}

/// Owned capability — held by deployer multi-sig.
public struct AdminCap has key, store {
    id: UID,
}

// ========== Module Initializer ==========

/// Called once on publish. Creates AdminConfig (shared) and AdminCap (to sender).
fun init(ctx: &mut TxContext) {
    let sender = ctx.sender();

    let config = AdminConfig {
        id: object::new(ctx),
        paused: false,
        pause_authority: sender,
        platform_address: sender,
        max_members_per_room: 200,
        max_doc_versions: 500,
    };
    transfer::share_object(config);

    let cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(cap, sender);
}

// ========== Entry Functions ==========

/// Emergency pause — blocks all state-changing entry functions.
public entry fun pause(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(!config.paused, errors::already_paused());
    config.paused = true;

    events::emit_admin_pause_toggled(
        true,
        ctx.sender(),
        clock.timestamp_ms(),
    );
}

/// Resume operations.
public entry fun unpause(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(config.paused, errors::not_paused());
    config.paused = false;

    events::emit_admin_pause_toggled(
        false,
        ctx.sender(),
        clock.timestamp_ms(),
    );
}

/// Update tunable parameters.
public entry fun update_config(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    max_members_per_room: u64,
    max_doc_versions: u64,
    platform_address: address,
    pause_authority: address,
    _ctx: &TxContext,
) {
    assert!(max_members_per_room > 0, errors::invalid_config());
    assert!(max_doc_versions > 0, errors::invalid_config());

    config.max_members_per_room = max_members_per_room;
    config.max_doc_versions = max_doc_versions;
    config.platform_address = platform_address;
    config.pause_authority = pause_authority;
}

// ========== Package-internal Helpers ==========

/// Aborts with EPoolPaused if paused. Called by every state-changing function.
public(package) fun assert_not_paused(config: &AdminConfig) {
    assert!(!config.paused, errors::pool_paused());
}

/// Read accessor: max members per room.
public(package) fun max_members(config: &AdminConfig): u64 {
    config.max_members_per_room
}

/// Read accessor: max document versions.
public(package) fun max_versions(config: &AdminConfig): u64 {
    config.max_doc_versions
}

/// Read accessor: is paused.
public fun is_paused(config: &AdminConfig): bool {
    config.paused
}

/// Read accessor: platform address.
public(package) fun platform_address(config: &AdminConfig): address {
    config.platform_address
}

/// Read accessor: pause authority.
public(package) fun pause_authority(config: &AdminConfig): address {
    config.pause_authority
}

// ========== Test-only ==========

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}
```

- [ ] **Step 2: Implement admin_tests.move**

```move
#[test_only]
module rwa_dataroom::admin_tests;

use sui::test_scenario;
use sui::clock;
use rwa_dataroom::admin::{Self, AdminConfig, AdminCap};

const ADMIN: address = @0xAD;

#[test]
fun test_init_creates_config_and_cap() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        assert!(!admin::is_paused(&config));
        assert!(admin::max_members(&config) == 200);
        assert!(admin::max_versions(&config) == 500);
        test_scenario::return_shared(config);

        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_pause_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        assert!(admin::is_paused(&config));

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 500)] // EAlreadyPaused
fun test_pause_when_already_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        // Second pause should abort
        admin::pause(&cap, &mut config, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_unpause_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        assert!(admin::is_paused(&config));

        admin::unpause(&cap, &mut config, &clk, scenario.ctx());
        assert!(!admin::is_paused(&config));

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 501)] // ENotPaused
fun test_unpause_when_not_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        // Config starts unpaused, unpause should abort
        admin::unpause(&cap, &mut config, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_update_config() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            100, // max_members_per_room
            250, // max_doc_versions
            @0xBEEF, // platform_address
            @0xCAFE, // pause_authority
            scenario.ctx(),
        );

        assert!(admin::max_members(&config) == 100);
        assert!(admin::max_versions(&config) == 250);

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 502)] // EInvalidConfig
fun test_update_config_zero_members_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            0, // invalid: zero max_members
            250,
            @0xBEEF,
            @0xCAFE,
            scenario.ctx(),
        );

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 502)] // EInvalidConfig
fun test_update_config_zero_versions_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            100,
            0, // invalid: zero max_doc_versions
            @0xBEEF,
            @0xCAFE,
            scenario.ctx(),
        );

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_assert_not_paused_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        admin::assert_not_paused(&config); // should abort

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}
```

- [ ] **Step 3: Verify tests pass**

Run: `cd contracts/rwa_dataroom && sui move test --filter admin_tests`

- [ ] **Step 4: Run full test suite to verify no regressions**

Run: `cd contracts/rwa_dataroom && sui move test`

- [ ] **Step 5: Commit admin module**

```bash
git add contracts/rwa_dataroom/sources/admin.move contracts/rwa_dataroom/tests/admin_tests.move
git commit -m "feat(move): add admin.move — AdminConfig, AdminCap, pause/unpause + tests"
```

---

### Chunk 1 Completion Checklist

- [ ] All 4 foundation modules compile: `sui move build` succeeds
- [ ] All tests pass: `sui move test` shows green
- [ ] Module dependency chain verified: types <- errors <- events <- admin
- [ ] No unused imports or dead code warnings

---

### Task 5.5: test_helpers.move (ERRATA E9 — New Task)

**Files:**
- Create `contracts/rwa_dataroom/tests/test_helpers.move`

> **Context:** This module is referenced 100+ times in Chunks 3-6 tests but was never defined. It provides reusable test setup utilities.

- [ ] **Step 1: Create `tests/test_helpers.move`**

```move
#[test_only]
module rwa_dataroom::test_helpers;

use sui::clock::{Self, Clock};
use sui::test_scenario::{Self, Scenario};
use std::string;
use rwa_dataroom::admin::{Self, AdminConfig, AdminCap};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::dataroom;
use rwa_dataroom::types;
use rwa_dataroom::document;

// ============================================================
// Pool Helpers
// ============================================================

const ORG_HASH: vector<u8> = x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BORROWER_HASH: vector<u8> = x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/// Create a Pool in DRAFT state with `owner` as the creator and sole OWNER member.
public fun create_test_pool(
    owner: address,
    clock: &Clock,
    ctx: &mut TxContext,
): Pool {
    // Assumes AdminConfig is already created and available.
    // This is a test-only helper that directly constructs a Pool.
    pool::create_pool_for_testing(
        ORG_HASH,
        string::utf8(b"Test Pool"),
        BORROWER_HASH,
        string::utf8(b"USD"),
        1_000_000,
        2_000_000_000,
        0, // AES encryption
        vector[],
        owner,
        clock,
        ctx,
    )
}

/// Create a Pool directly at a specific state (skipping transitions).
public fun create_test_pool_at_state(
    owner: address,
    target_state: u8,
    clock: &Clock,
    ctx: &mut TxContext,
): Pool {
    let mut pool = create_test_pool(owner, clock, ctx);
    pool::set_state_for_testing(&mut pool, target_state);
    pool
}

/// Destroy a Pool in tests (consumes the object).
public fun destroy_pool(pool: Pool) {
    pool::destroy_for_testing(pool);
}

// ============================================================
// Document Helpers
// ============================================================

const CONTENT_HASH: vector<u8> = x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

/// Create a test document in the given pool. Returns the document ID.
public fun create_test_document(
    pool: &mut Pool,
    folder_id: u64,
    uploader: address,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    document::create_document_internal(
        pool,
        folder_id,
        0, // FINANCIAL_STATEMENT
        string::utf8(b"Test Document"),
        false,
        types::role_all(),
        string::utf8(b"blob_id_123"),
        CONTENT_HASH,
        1024,
        string::utf8(b"Initial version"),
        vector[],
        uploader,
        clock,
        ctx,
    )
}

/// Get the ID of the last created document in a pool (by doc_count).
public fun last_created_doc_id(pool: &Pool): ID {
    document::last_doc_id(pool)
}

// ============================================================
// IC Decision Helpers
// ============================================================

/// Record a test IC approval on the pool.
public fun record_test_ic_approval(
    pool: &mut Pool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    pool::record_ic_decision_for_testing(
        pool,
        types::ic_approve(),
        string::utf8(b"Approved"),
        string::utf8(b""),
        vector[ctx.sender()],
        vector[1],
        vector[],
        clock,
        ctx,
    );
}

// ============================================================
// Address Helpers
// ============================================================

/// Generate a deterministic address from a u64 value (for bulk member tests).
public fun addr_from_u64(n: u64): address {
    // Simple conversion: pad u64 to 32 bytes
    let mut bytes = vector[];
    let mut i = 0u64;
    while (i < 24) {
        bytes.push_back(0u8);
        i = i + 1;
    };
    // Big-endian u64
    bytes.push_back(((n >> 56) & 0xFF) as u8);
    bytes.push_back(((n >> 48) & 0xFF) as u8);
    bytes.push_back(((n >> 40) & 0xFF) as u8);
    bytes.push_back(((n >> 32) & 0xFF) as u8);
    bytes.push_back(((n >> 24) & 0xFF) as u8);
    bytes.push_back(((n >> 16) & 0xFF) as u8);
    bytes.push_back(((n >> 8) & 0xFF) as u8);
    bytes.push_back((n & 0xFF) as u8);
    sui::address::from_bytes(bytes)
}
```

- [ ] **Step 2: Add `_for_testing` functions to pool.move and document.move**

These test-only functions are needed by `test_helpers`:

Add to `pool.move`:
```move
#[test_only]
public fun create_pool_for_testing(
    org_id_hash: vector<u8>,
    name: String,
    borrower_name_hash: vector<u8>,
    currency: String,
    target_notional: u64,
    expected_maturity_date: u64,
    encryption_scheme: u8,
    tags: vector<String>,
    creator: address,
    clock: &Clock,
    ctx: &mut TxContext,
): Pool {
    // Same as create_pool but returns Pool directly instead of share_object
    let now = clock.timestamp_ms();
    let mut pool = Pool {
        id: object::new(ctx),
        name,
        org_id_hash,
        borrower_name_hash,
        currency,
        target_notional,
        expected_maturity_date,
        encryption_scheme,
        current_state: types::pool_state_draft(),
        doc_count: 0,
        ic_decision_count: 0,
        tags,
        created_at: now,
        created_by: creator,
        last_updated_at: now,
    };
    // Attach DataRoom as dynamic_object_field
    let dataroom = dataroom::new(object::id(&pool), creator, clock, ctx);
    dynamic_object_field::add(&mut pool.id, b"dataroom", dataroom);
    pool
}

#[test_only]
public fun set_state_for_testing(pool: &mut Pool, state: u8) {
    pool.current_state = state;
}

#[test_only]
public fun destroy_for_testing(pool: Pool) {
    let Pool { id, .. } = pool;
    // Need to remove DataRoom DOF first
    let dataroom: DataRoom = dynamic_object_field::remove(&mut id, b"dataroom");
    dataroom::destroy_for_testing(dataroom);
    object::delete(id);
}

#[test_only]
public fun record_ic_decision_for_testing(
    pool: &mut Pool,
    decision_type: u8,
    decision_text: String,
    pdf_blob_id: String,
    committee: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let index = pool.ic_decision_count;
    let decision = ic_decision::new(
        index, decision_type, decision_text, pdf_blob_id,
        ctx.sender(), committee, votes, clock.timestamp_ms(),
        related_doc_ids,
    );
    dynamic_field::add(&mut pool.id, index, decision);
    pool.ic_decision_count = pool.ic_decision_count + 1;
}
```

Add to `dataroom.move`:
```move
#[test_only]
public fun destroy_for_testing(dataroom: DataRoom) {
    let DataRoom { id, members, .. } = dataroom;
    members.drop(); // Table::drop in test mode
    object::delete(id);
}
```

Add to `document.move`:
```move
#[test_only]
/// Internal create that returns ID (used by test_helpers).
public fun create_document_internal(
    pool: &mut Pool,
    folder_id: u64,
    doc_type: u8,
    title: String,
    required_flag: bool,
    visible_to_roles: u8,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    tags: vector<String>,
    uploader: address,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    // Same logic as create_document but callable from tests and returns ID
    // Implementation mirrors create_document body
}

#[test_only]
public fun last_doc_id(pool: &Pool): ID {
    // Returns the ID of the most recently added document
    // Uses pool.doc_count - 1 as the key
}
```

- [ ] **Step 3: Verify build with tests**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 4: Commit test helpers**

```bash
git add contracts/rwa_dataroom/tests/test_helpers.move
git commit -m "feat(move): add test_helpers module with pool, document, IC, and address helpers"
```

---

### Task 6: ic_decision.move

**Files:** `contracts/rwa_dataroom/sources/ic_decision.move`

- [ ] **Step 1: Create `ic_decision.move` with struct and constructor**

```move
module rwa_dataroom::ic_decision;

use std::string::String;

// ============================================================
// Structs
// ============================================================

public struct ICDecision has store, drop {
    index: u64,
    decision_type: u8,
    decision_text: String,
    decision_pdf_blob_id: String,
    created_by: address,
    committee_members: vector<address>,
    votes: vector<u8>,
    created_at: u64,
    related_doc_ids: vector<ID>,
}

// ============================================================
// Constructor (package-only)
// ============================================================

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
): ICDecision {
    ICDecision {
        index,
        decision_type,
        decision_text,
        decision_pdf_blob_id,
        created_by,
        committee_members,
        votes,
        created_at,
        related_doc_ids,
    }
}

// ============================================================
// Accessors
// ============================================================

public fun index(d: &ICDecision): u64 { d.index }
public fun decision_type(d: &ICDecision): u8 { d.decision_type }
public fun decision_text(d: &ICDecision): &String { &d.decision_text }
public fun decision_pdf_blob_id(d: &ICDecision): &String { &d.decision_pdf_blob_id }
public fun created_by(d: &ICDecision): address { d.created_by }
public fun committee_members(d: &ICDecision): &vector<address> { &d.committee_members }
public fun votes(d: &ICDecision): &vector<u8> { &d.votes }
public fun created_at(d: &ICDecision): u64 { d.created_at }
public fun related_doc_ids(d: &ICDecision): &vector<ID> { &d.related_doc_ids }
```

- [ ] **Step 2: Build check**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 3: Commit**

```bash
git add contracts/rwa_dataroom/sources/ic_decision.move
git commit -m "feat(move): add ic_decision struct-only module with constructor and accessors"
```

---

### Task 7: dataroom.move

**Files:** `contracts/rwa_dataroom/sources/dataroom.move`

- [ ] **Step 1: Create `dataroom.move` with structs, constructor, default folders, and helpers**

```move
module rwa_dataroom::dataroom;

use sui::table::{Self, Table};
use sui::clock::Clock;
use sui::dynamic_field as df;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;

// ============================================================
// Constants
// ============================================================

const CUSTOM_FOLDER_START_ID: u64 = 100;

// ============================================================
// Structs
// ============================================================

public struct DataRoom has key, store {
    id: UID,
    pool_id: ID,
    owner: address,
    member_count: u64,
    members: Table<address, Membership>,
    default_folders: vector<String>,
    custom_folder_count: u64,
    seal_policy_id: Option<ID>,
    created_at: u64,
    last_updated_at: u64,
}

public struct Membership has store, drop, copy {
    role: u8,
    added_by: address,
    added_at: u64,
    is_active: bool,
    revoked_at: Option<u64>,
    tags: vector<String>,
}

public struct FolderMeta has store, drop {
    name: String,
    folder_id: u64,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    created_at: u64,
    created_by: address,
}

/// Dynamic-field key for per-member folder encryption keys.
public struct FolderKeyTag has copy, drop, store {
    folder_id: u64,
    member: address,
}

// ============================================================
// Constructor (package-only)
// ============================================================

public(package) fun new(
    pool_id: ID,
    owner: address,
    clock: &Clock,
    ctx: &mut TxContext,
): DataRoom {
    let now = clock.timestamp_ms();
    let mut dataroom = DataRoom {
        id: object::new(ctx),
        pool_id,
        owner,
        member_count: 1,
        members: table::new(ctx),
        default_folders: vector[],
        custom_folder_count: CUSTOM_FOLDER_START_ID,
        seal_policy_id: option::none(),
        created_at: now,
        last_updated_at: now,
    };

    // Add creator as OWNER member
    let membership = Membership {
        role: types::role_owner(),
        added_by: owner,
        added_at: now,
        is_active: true,
        revoked_at: option::none(),
        tags: vector[],
    };
    dataroom.members.add(owner, membership);

    // Create default folders
    create_default_folders(&mut dataroom, owner, now);

    events::emit_member_added(pool_id, owner, types::role_owner(), owner, now); // ERRATA E7: added timestamp

    dataroom
}

// ============================================================
// Default Folders
// ============================================================

fun create_default_folders(
    dataroom: &mut DataRoom,
    creator: address,
    now: u64,
) {
    let names = vector[
        b"Financial".to_string(),
        b"Legal".to_string(),
        b"KYC".to_string(),
        b"Collateral".to_string(),
        b"Reports".to_string(),
    ];

    let mut i = 0u64;
    while (i < names.length()) {
        let meta = FolderMeta {
            name: names[i],
            folder_id: i,
            parent_id: option::none(),
            visible_to_roles: types::role_all(), // ERRATA E4: was role_bitmask_all()
            created_at: now,
            created_by: creator,
        };
        df::add(&mut dataroom.id, i, meta);
        dataroom.default_folders.push_back(names[i]);
        i = i + 1;
    };
}

// ============================================================
// Membership Helpers (package-only)
// ============================================================

public(package) fun assert_member_role(
    dataroom: &DataRoom,
    caller: address,
    required_role: u8,
) {
    assert!(dataroom.members.contains(caller), errors::not_member());
    let m = &dataroom.members[caller];
    assert!(m.is_active, errors::not_member());
    assert!(
        types::has_role(m.role, required_role), // ERRATA E4: was role_has_permission()
        errors::insufficient_role(),
    );
}

public(package) fun get_role(dataroom: &DataRoom, addr: address): u8 {
    assert!(dataroom.members.contains(addr), errors::not_member());
    let m = &dataroom.members[addr];
    m.role
}

public(package) fun is_active_member(dataroom: &DataRoom, addr: address): bool {
    if (!dataroom.members.contains(addr)) return false;
    let m = &dataroom.members[addr];
    m.is_active
}

// ============================================================
// Member Management (package-only, called by entry fns)
// ============================================================

public(package) fun add_member(
    dataroom: &mut DataRoom,
    addr: address,
    role: u8,
    added_by: address,
    tags: vector<String>,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    assert!(!dataroom.members.contains(addr), errors::already_member());
    assert!(role > 0 && role <= types::role_all(), errors::invalid_role()); // ERRATA E4: was assert_valid_role()

    let membership = Membership {
        role,
        added_by,
        added_at: now,
        is_active: true,
        revoked_at: option::none(),
        tags,
    };
    dataroom.members.add(addr, membership);
    dataroom.member_count = dataroom.member_count + 1;
    dataroom.last_updated_at = now;

    events::emit_member_added(dataroom.pool_id, addr, role, added_by, now); // ERRATA E7: added timestamp
}

public(package) fun revoke_member(
    dataroom: &mut DataRoom,
    addr: address,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    assert!(dataroom.members.contains(addr), errors::not_member());
    let m = &mut dataroom.members[addr];
    assert!(m.is_active, errors::not_member());
    m.is_active = false;
    m.revoked_at = option::some(now);
    dataroom.member_count = dataroom.member_count - 1;
    dataroom.last_updated_at = now;

    events::emit_member_removed(dataroom.pool_id, addr, addr, now); // ERRATA E7: was emit_member_revoked without timestamp. Chunk 1 uses emit_member_removed(dataroom_id, member, removed_by, timestamp)
}

// ============================================================
// Folder Management (package-only)
// ============================================================

public(package) fun create_custom_folder(
    dataroom: &mut DataRoom,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    creator: address,
    clock: &Clock,
): u64 {
    let now = clock.timestamp_ms();
    let folder_id = dataroom.custom_folder_count;
    dataroom.custom_folder_count = folder_id + 1;

    // If parent_id is set, verify it exists
    if (parent_id.is_some()) {
        let pid = *parent_id.borrow();
        assert!(df::exists_(&dataroom.id, pid), errors::folder_not_found());
    };

    let meta = FolderMeta {
        name,
        folder_id,
        parent_id,
        visible_to_roles,
        created_at: now,
        created_by: creator,
    };
    df::add(&mut dataroom.id, folder_id, meta);
    dataroom.last_updated_at = now;

    events::emit_folder_created(dataroom.pool_id, folder_id, creator);

    folder_id
}

public(package) fun folder_exists(dataroom: &DataRoom, folder_id: u64): bool {
    df::exists_(&dataroom.id, folder_id)
}

// ============================================================
// Folder Key Management (package-only)
// ============================================================

public(package) fun set_folder_key(
    dataroom: &mut DataRoom,
    folder_id: u64,
    member: address,
    encrypted_key: vector<u8>,
) {
    let tag = FolderKeyTag { folder_id, member };
    if (df::exists_(&dataroom.id, tag)) {
        let existing: &mut vector<u8> = df::borrow_mut(&mut dataroom.id, tag);
        *existing = encrypted_key;
    } else {
        df::add(&mut dataroom.id, tag, encrypted_key);
    };
}

public(package) fun get_folder_key(
    dataroom: &DataRoom,
    folder_id: u64,
    member: address,
): &vector<u8> {
    let tag = FolderKeyTag { folder_id, member };
    df::borrow(&dataroom.id, tag)
}

public(package) fun has_folder_key(
    dataroom: &DataRoom,
    folder_id: u64,
    member: address,
): bool {
    let tag = FolderKeyTag { folder_id, member };
    df::exists_(&dataroom.id, tag)
}

// ============================================================
// Seal Policy
// ============================================================

public(package) fun set_seal_policy_id(
    dataroom: &mut DataRoom,
    policy_id: ID,
    clock: &Clock,
) {
    dataroom.seal_policy_id = option::some(policy_id);
    dataroom.last_updated_at = clock.timestamp_ms();
}

// ============================================================
// Accessors
// ============================================================

public fun pool_id(dr: &DataRoom): ID { dr.pool_id }
public fun owner(dr: &DataRoom): address { dr.owner }
public fun member_count(dr: &DataRoom): u64 { dr.member_count }
public fun custom_folder_count(dr: &DataRoom): u64 { dr.custom_folder_count }
public fun seal_policy_id(dr: &DataRoom): &Option<ID> { &dr.seal_policy_id }
public fun created_at(dr: &DataRoom): u64 { dr.created_at }
public fun last_updated_at(dr: &DataRoom): u64 { dr.last_updated_at }
public(package) fun uid(dr: &DataRoom): &UID { &dr.id }
public(package) fun uid_mut(dr: &mut DataRoom): &mut UID { &mut dr.id }
```

> **ERRATA E1/E2/E4/E7:** The prerequisite block that was here contained WRONG function names
> (`role_has_permission`, `role_bitmask_all`, `assert_valid_role`) and simplified event structs
> without timestamps. **DO NOT add any new functions here.** Use Chunk 1 definitions:
> - `types::role_all()` instead of `role_bitmask_all()`
> - `types::has_role()` instead of `role_has_permission()`
> - All error constants already defined in Task 3 (errors.move)
> - All event structs/emitters already defined in Task 4 (events.move) with timestamps
> - See Errata section at top of this plan for complete mapping.

~~- [ ] **Step 2: Ensure prerequisite functions exist in types.move, errors.move, events.move**~~

> **SKIPPED** — Already defined in Chunk 1. The code in dataroom.move Step 1 above needs these corrections when implementing:
> - Line `types::role_bitmask_all()` → `types::role_all()`
> - Line `types::role_has_permission(m.role, required_role)` → `types::has_role(m.role, required_role)`
> - Line `types::assert_valid_role(role)` → `assert!(types::is_valid_pool_state(role) || role <= types::role_all(), errors::invalid_role())`
> - `events::emit_member_added(pool_id, addr, role, added_by)` → add `timestamp` as 5th arg
> - `errors::already_member()` → `errors::member_already_exists()`

~~Verify or add to `events.move`:~~

> **REMOVED** — Chunk 2 defined simplified MemberAdded/MemberRevoked/FolderCreated without timestamps.
> Use the FULL definitions from Chunk 1's events.move (Task 4) which include all fields + timestamp.

~~public fun emit_member_added(pool_id: ID, member: address, role: u8, added_by: address) {~~
~~    sui::event::emit(MemberAdded { pool_id, member, role, added_by });~~
~~}~~

~~public fun emit_member_revoked(pool_id: ID, member: address) {~~
~~    sui::event::emit(MemberRevoked { pool_id, member });~~
~~}~~

~~public fun emit_folder_created(pool_id: ID, folder_id: u64, created_by: address) {~~
~~    sui::event::emit(FolderCreated { pool_id, folder_id, created_by });~~
~~}~~
~~```~~

> **ERRATA E1:** Entire prerequisite events block above is STRUCK OUT. Use Chunk 1 events.move definitions.

- [ ] **Step 3: Build check**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 4: Commit**

```bash
git add contracts/rwa_dataroom/sources/dataroom.move
git add contracts/rwa_dataroom/sources/types.move contracts/rwa_dataroom/sources/errors.move contracts/rwa_dataroom/sources/events.move
git commit -m "feat(move): add dataroom module with membership, folders, and key management"
```

---

### Task 8: document.move

**Files:** `contracts/rwa_dataroom/sources/document.move`

- [ ] **Step 1: Create `document.move` with structs, constructor, version management, and review helpers**

```move
module rwa_dataroom::document;

use sui::clock::Clock;
use sui::dynamic_field as df;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;

// ============================================================
// Structs
// ============================================================

public struct Document has key, store {
    id: UID,
    dataroom_id: ID,
    folder_id: u64,
    doc_type: u8,
    title: String,
    current_version: u64,
    version_count: u64,
    required_flag: bool,
    is_archived: bool,
    visible_to_roles: u8,
    encryption_scheme: u8,
    tags: vector<String>,
    created_by: address,
    created_at: u64,
    last_updated_at: u64,
}

public struct DocVersion has store, drop {
    version: u64,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    uploaded_by: address,
    uploaded_at: u64,
    change_log: String,
}

public struct ReviewRecord has store, drop {
    reviewer: address,
    status: u8,
    comment_hash: Option<vector<u8>>,
    reviewed_at: u64,
}

// ============================================================
// Constructor (package-only)
// ============================================================

public(package) fun new(
    dataroom_id: ID,
    folder_id: u64,
    doc_type: u8,
    title: String,
    required_flag: bool,
    visible_to_roles: u8,
    encryption_scheme: u8,
    tags: vector<String>,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    clock: &Clock,
    ctx: &mut TxContext,
): Document {
    let now = clock.timestamp_ms();

    // Validate content_hash is 32 bytes (SHA-256)
    assert!(content_hash.length() == 32, errors::invalid_hash_length());

    // Validate doc_type
    types::assert_valid_doc_type(doc_type);

    let mut doc = Document {
        id: object::new(ctx),
        dataroom_id,
        folder_id,
        doc_type,
        title,
        current_version: 1,
        version_count: 1,
        required_flag,
        is_archived: false,
        visible_to_roles,
        encryption_scheme,
        tags,
        created_by: ctx.sender(),
        created_at: now,
        last_updated_at: now,
    };

    // Attach first version as dynamic field keyed by version number
    let v1 = DocVersion {
        version: 1,
        walrus_blob_id,
        content_hash,
        size_bytes,
        uploaded_by: ctx.sender(),
        uploaded_at: now,
        change_log,
    };
    df::add(&mut doc.id, 1u64, v1);

    doc
}

// ============================================================
// Version Management (package-only)
// ============================================================

public(package) fun add_version(
    doc: &mut Document,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(!doc.is_archived, errors::document_archived());
    assert!(content_hash.length() == 32, errors::invalid_hash_length());

    let now = clock.timestamp_ms();
    let new_version = doc.version_count + 1;

    let ver = DocVersion {
        version: new_version,
        walrus_blob_id,
        content_hash,
        size_bytes,
        uploaded_by: ctx.sender(),
        uploaded_at: now,
        change_log,
    };
    df::add(&mut doc.id, new_version, ver);

    doc.current_version = new_version;
    doc.version_count = new_version;
    doc.last_updated_at = now;

    events::emit_document_version_added(
        doc.dataroom_id,
        object::id(doc),
        new_version,
        ctx.sender(),
    );
}

// ============================================================
// Review Management (package-only)
// ============================================================

public(package) fun submit_review(
    doc: &mut Document,
    reviewer: address,
    status: u8,
    comment_hash: Option<vector<u8>>,
    clock: &Clock,
) {
    assert!(!doc.is_archived, errors::document_archived());
    types::assert_valid_review_status(status);

    // Validate optional comment_hash length
    if (comment_hash.is_some()) {
        assert!(comment_hash.borrow().length() == 32, errors::invalid_hash_length());
    };

    let now = clock.timestamp_ms();
    let record = ReviewRecord {
        reviewer,
        status,
        comment_hash,
        reviewed_at: now,
    };

    // Overwrite previous review by this reviewer if exists
    if (df::exists_(&doc.id, reviewer)) {
        let existing: &mut ReviewRecord = df::borrow_mut(&mut doc.id, reviewer);
        *existing = record;
    } else {
        df::add(&mut doc.id, reviewer, record);
    };

    doc.last_updated_at = now;

    events::emit_document_reviewed(
        doc.dataroom_id,
        object::id(doc),
        reviewer,
        status,
    );
}

/// Check if a document has at least one APPROVED review.
public(package) fun has_approved_review(doc: &Document, reviewer: address): bool {
    if (!df::exists_(&doc.id, reviewer)) return false;
    let record: &ReviewRecord = df::borrow(&doc.id, reviewer);
    record.status == types::review_approved()
}

// ============================================================
// Archive (package-only)
// ============================================================

public(package) fun archive(doc: &mut Document, clock: &Clock) {
    doc.is_archived = true;
    doc.last_updated_at = clock.timestamp_ms();
}

// ============================================================
// Accessors
// ============================================================

public fun doc_id(doc: &Document): ID { object::id(doc) }
public fun dataroom_id(doc: &Document): ID { doc.dataroom_id }
public fun folder_id(doc: &Document): u64 { doc.folder_id }
public fun doc_type(doc: &Document): u8 { doc.doc_type }
public fun title(doc: &Document): &String { &doc.title }
public fun current_version(doc: &Document): u64 { doc.current_version }
public fun version_count(doc: &Document): u64 { doc.version_count }
public fun required_flag(doc: &Document): bool { doc.required_flag }
public fun is_archived(doc: &Document): bool { doc.is_archived }
public fun visible_to_roles(doc: &Document): u8 { doc.visible_to_roles }
public fun encryption_scheme(doc: &Document): u8 { doc.encryption_scheme }
public fun tags(doc: &Document): &vector<String> { &doc.tags }
public fun created_by(doc: &Document): address { doc.created_by }
public fun created_at(doc: &Document): u64 { doc.created_at }
public fun last_updated_at(doc: &Document): u64 { doc.last_updated_at }
public(package) fun uid(doc: &Document): &UID { &doc.id }
public(package) fun uid_mut(doc: &mut Document): &mut UID { &mut doc.id }
```

- [ ] **Step 2: Add prerequisite functions to types.move and errors.move and events.move**

Add to `types.move`:
```move
// Document types
const DOC_TYPE_GENERAL: u8 = 0;
const DOC_TYPE_FINANCIAL: u8 = 1;
const DOC_TYPE_LEGAL: u8 = 2;
const DOC_TYPE_KYC: u8 = 3;
const DOC_TYPE_COLLATERAL: u8 = 4;
const DOC_TYPE_REPORT: u8 = 5;

public fun assert_valid_doc_type(t: u8) {
    assert!(t <= DOC_TYPE_REPORT, 0);
}

// Review statuses
const REVIEW_PENDING: u8 = 0;
const REVIEW_APPROVED: u8 = 1;
const REVIEW_NEEDS_REVISION: u8 = 2;

public fun review_pending(): u8 { REVIEW_PENDING }
public fun review_approved(): u8 { REVIEW_APPROVED }
public fun review_needs_revision(): u8 { REVIEW_NEEDS_REVISION }

public fun assert_valid_review_status(s: u8) {
    assert!(s <= REVIEW_NEEDS_REVISION, 0);
}
```

Add to `errors.move`:
```move
const EDocumentArchived: u64 = 300;
const EInvalidHashLength: u64 = 301;

public fun document_archived(): u64 { EDocumentArchived }
public fun invalid_hash_length(): u64 { EInvalidHashLength }
```

Add to `events.move`:
```move
public struct DocumentVersionAdded has copy, drop {
    dataroom_id: ID,
    doc_id: ID,
    version: u64,
    uploaded_by: address,
}

public struct DocumentReviewed has copy, drop {
    dataroom_id: ID,
    doc_id: ID,
    reviewer: address,
    status: u8,
}

public fun emit_document_version_added(
    dataroom_id: ID,
    doc_id: ID,
    version: u64,
    uploaded_by: address,
) {
    sui::event::emit(DocumentVersionAdded { dataroom_id, doc_id, version, uploaded_by });
}

public fun emit_document_reviewed(
    dataroom_id: ID,
    doc_id: ID,
    reviewer: address,
    status: u8,
) {
    sui::event::emit(DocumentReviewed { dataroom_id, doc_id, reviewer, status });
}
```

- [ ] **Step 3: Build check**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 4: Commit**

```bash
git add contracts/rwa_dataroom/sources/document.move
git add contracts/rwa_dataroom/sources/types.move contracts/rwa_dataroom/sources/errors.move contracts/rwa_dataroom/sources/events.move
git commit -m "feat(move): add document module with versioning and review management"
```

---

### Task 9: pool.move — Struct + create_pool + Borrow Helpers

**Files:** `contracts/rwa_dataroom/sources/pool.move`, `contracts/rwa_dataroom/tests/pool_tests.move`

- [ ] **Step 1: Create `pool.move` with struct, `create_pool`, borrow helpers, and state accessors**

```move
module rwa_dataroom::pool;

use sui::clock::Clock;
use sui::dynamic_object_field as dof;
use sui::dynamic_field as df;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;
use rwa_dataroom::admin::{Self, AdminConfig};
use rwa_dataroom::dataroom::{Self, DataRoom};
use rwa_dataroom::ic_decision::ICDecision;
use rwa_dataroom::document::Document;

// ============================================================
// Structs
// ============================================================

public struct Pool has key {
    id: UID,
    org_id_hash: vector<u8>,
    name: String,
    borrower_name_hash: vector<u8>,
    currency: String,
    target_notional: u64,
    expected_maturity_date: u64,
    created_at: u64,
    created_by: address,
    current_state: u8,
    encryption_scheme: u8,
    tags: vector<String>,
    ic_decision_count: u64,
    last_updated_at: u64,
}

// ============================================================
// Entry: create_pool
// ============================================================

public entry fun create_pool(
    admin_config: &AdminConfig,
    org_id_hash: vector<u8>,
    name: String,
    borrower_name_hash: vector<u8>,
    currency: String,
    target_notional: u64,
    expected_maturity_date: u64,
    encryption_scheme: u8,
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // Guards
    admin::assert_not_paused(admin_config);
    assert!(org_id_hash.length() == 32, errors::invalid_hash_length());
    assert!(borrower_name_hash.length() == 32, errors::invalid_hash_length());
    types::assert_valid_encryption_scheme(encryption_scheme);

    let now = clock.timestamp_ms();
    let caller = ctx.sender();

    let mut pool = Pool {
        id: object::new(ctx),
        org_id_hash,
        name,
        borrower_name_hash,
        currency,
        target_notional,
        expected_maturity_date,
        created_at: now,
        created_by: caller,
        current_state: types::pool_state_draft(),
        encryption_scheme,
        tags,
        ic_decision_count: 0,
        last_updated_at: now,
    };

    let pool_id = object::id(&pool);

    // Create DataRoom and attach as dynamic object field
    let dataroom = dataroom::new(pool_id, caller, clock, ctx);
    dof::add(&mut pool.id, b"dataroom", dataroom);

    events::emit_pool_created(pool_id, caller);

    transfer::share_object(pool);
}

// ============================================================
// Borrow Helpers (package-only)
// ============================================================

public(package) fun borrow_dataroom(pool: &Pool): &DataRoom {
    dof::borrow(&pool.id, b"dataroom")
}

public(package) fun borrow_dataroom_mut(pool: &mut Pool): &mut DataRoom {
    dof::borrow_mut(&mut pool.id, b"dataroom")
}

// ============================================================
// Document Attachment (package-only)
// ============================================================

public(package) fun attach_document(pool: &mut Pool, doc_id: ID, doc: Document) {
    df::add(&mut pool.id, doc_id, doc);
    pool.last_updated_at = pool.last_updated_at; // updated by caller
}

public(package) fun borrow_document(pool: &Pool, doc_id: ID): &Document {
    df::borrow(&pool.id, doc_id)
}

public(package) fun borrow_document_mut(pool: &mut Pool, doc_id: ID): &mut Document {
    df::borrow_mut(&mut pool.id, doc_id)
}

public(package) fun has_document(pool: &Pool, doc_id: ID): bool {
    df::exists_(&pool.id, doc_id)
}

// ============================================================
// IC Decision Attachment (package-only)
// ============================================================

public(package) fun attach_ic_decision(
    pool: &mut Pool,
    decision: ICDecision,
    clock: &Clock,
) {
    let idx = pool.ic_decision_count;
    df::add(&mut pool.id, idx, decision);
    pool.ic_decision_count = idx + 1;
    pool.last_updated_at = clock.timestamp_ms();
}

public(package) fun ic_decision_count(pool: &Pool): u64 {
    pool.ic_decision_count
}

// ============================================================
// State Management (package-only)
// ============================================================

public(package) fun set_state(pool: &mut Pool, new_state: u8, clock: &Clock) {
    types::assert_valid_pool_state(new_state);
    pool.current_state = new_state;
    pool.last_updated_at = clock.timestamp_ms();
}

// ============================================================
// Role Check via DataRoom (package-only convenience)
// ============================================================

public(package) fun assert_role(pool: &Pool, caller: address, required_role: u8) {
    let dr = borrow_dataroom(pool);
    dataroom::assert_member_role(dr, caller, required_role);
}

// ============================================================
// Accessors
// ============================================================

public fun current_state(pool: &Pool): u8 { pool.current_state }
public fun encryption_scheme(pool: &Pool): u8 { pool.encryption_scheme }
public fun pool_id(pool: &Pool): ID { object::id(pool) }
public fun name(pool: &Pool): &String { &pool.name }
public fun org_id_hash(pool: &Pool): &vector<u8> { &pool.org_id_hash }
public fun borrower_name_hash(pool: &Pool): &vector<u8> { &pool.borrower_name_hash }
public fun currency(pool: &Pool): &String { &pool.currency }
public fun target_notional(pool: &Pool): u64 { pool.target_notional }
public fun expected_maturity_date(pool: &Pool): u64 { pool.expected_maturity_date }
public fun created_at(pool: &Pool): u64 { pool.created_at }
public fun created_by(pool: &Pool): address { pool.created_by }
public fun tags(pool: &Pool): &vector<String> { &pool.tags }
public fun last_updated_at(pool: &Pool): u64 { pool.last_updated_at }
public(package) fun uid(pool: &Pool): &UID { &pool.id }
public(package) fun uid_mut(pool: &mut Pool): &mut UID { &mut pool.id }
```

- [ ] **Step 2: Add prerequisite functions to types.move, errors.move, events.move**

> **ERRATA E1/E5:** The prerequisite block that was here contained WRONG state constant names
> (POOL_STATE_OPEN, POOL_STATE_UNDER_REVIEW, etc.) and simplified event structs.
> **DO NOT add any new constants to types.move, errors.move, or events.move here.**
> All constants and emit functions are already fully defined in Chunk 1 (Tasks 2-4).
> Use the Chunk 1 definitions as-is. See Errata section at top of this plan.

- [ ] **Step 3: Build check**

Run: `cd contracts/rwa_dataroom && sui move build`

- [ ] **Step 4: Create `tests/pool_tests.move`**

```move
#[test_only]
module rwa_dataroom::pool_tests;

use sui::test_scenario;
use sui::clock;
use rwa_dataroom::admin::{Self, AdminConfig, AdminCap};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::dataroom;
use rwa_dataroom::types;

const ADMIN: address = @0xAD;
const ALICE: address = @0xA;

// Reusable 32-byte hashes
const ORG_HASH: vector<u8> = x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BORROWER_HASH: vector<u8> = x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// ============================================================
// Helpers
// ============================================================

#[test_only]
fun setup_admin(scenario: &mut test_scenario::Scenario) {
    scenario.next_tx(ADMIN);
    admin::init_for_testing(scenario.ctx());
}

#[test_only]
fun create_test_pool(scenario: &mut test_scenario::Scenario) {
    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Test Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0, // AES
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
}

// ============================================================
// Tests
// ============================================================

#[test]
fun test_create_pool_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    // Verify pool state
    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        assert!(pool::current_state(&pool) == types::pool_state_draft());
        assert!(pool::created_by(&pool) == ALICE);
        assert!(pool::encryption_scheme(&pool) == 0);

        // Verify DataRoom attached with ALICE as OWNER
        let dr = pool::borrow_dataroom(&pool);
        assert!(dataroom::is_active_member(dr, ALICE));
        assert!(dataroom::get_role(dr, ALICE) == types::role_owner());
        assert!(dataroom::member_count(dr) == 1);
        assert!(dataroom::owner(dr) == ALICE);

        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
#[expected_failure]
fun test_create_pool_invalid_encryption_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Bad Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            99, // invalid encryption scheme
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 301)] // EInvalidHashLength
fun test_create_pool_invalid_hash_length_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            x"aabbccdd", // only 4 bytes, not 32
            b"Bad Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0,
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
#[expected_failure] // EPaused
fun test_create_pool_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    // Pause the system
    scenario.next_tx(ADMIN);
    {
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        admin::pause(&cap, &mut config);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };

    // Attempt to create pool while paused
    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Paused Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0,
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
fun test_borrow_dataroom_returns_correct_ref() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        let dr = pool::borrow_dataroom(&pool);

        // DataRoom's pool_id should match Pool's id
        assert!(dataroom::pool_id(dr) == pool::pool_id(&pool));

        // Default folders: 5 folders (IDs 0-4), custom_folder_count starts at 100
        assert!(dataroom::custom_folder_count(dr) == 100);

        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
fun test_pool_assert_role_owner_passes() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        // ALICE is OWNER, should pass any role check (owner has highest privilege)
        pool::assert_role(&pool, ALICE, types::role_owner());
        pool::assert_role(&pool, ALICE, types::role_manager());
        pool::assert_role(&pool, ALICE, types::role_member());
        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
#[expected_failure] // ENotMember
fun test_pool_assert_role_non_member_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        let bob = @0xB;
        pool::assert_role(&pool, bob, types::role_member());
        test_scenario::return_shared(pool);
    };
    scenario.end();
}
```

- [ ] **Step 5: Run tests**

Run: `cd contracts/rwa_dataroom && sui move test --filter pool_tests`

- [ ] **Step 6: Commit**

```bash
git add contracts/rwa_dataroom/sources/pool.move contracts/rwa_dataroom/tests/pool_tests.move
git add contracts/rwa_dataroom/sources/types.move contracts/rwa_dataroom/sources/errors.move contracts/rwa_dataroom/sources/events.move
git commit -m "feat(move): add pool module with create_pool, borrow helpers, and tests"
```

---

### Chunk 2 Completion Checklist

| Task | Module | Key Deliverables | Test Coverage |
|------|--------|-----------------|---------------|
| 6 | `ic_decision.move` | Struct + `new()` + accessors | Tested via pool_tests |
| 7 | `dataroom.move` | Struct + membership + folders + folder keys | Tested via pool_tests (DataRoom created inside create_pool) |
| 8 | `document.move` | Struct + versioning + reviews + archive | Tested in Chunk 4 with entry functions |
| 9 | `pool.move` | Root shared object + `create_pool` + borrow helpers | `pool_tests.move` — 6 tests |

**Cross-module dependency order:** `types` → `errors` → `events` → `ic_decision` → `dataroom` → `document` → `pool`

**Next:** Chunk 3 covers DataRoom entry functions (add/revoke members, create folders, manage folder keys) and Pool state transitions.

---



## Chunk 3: DataRoom Entry Functions (Tasks 10-14)

### Task 10: add_member

**Files:** `sources/dataroom.move`, `tests/dataroom_tests.move`

- [ ] **Step 1: Add add_member entry function to `sources/dataroom.move`**

```move
/// Add a new member to the pool's dataroom, or reactivate a revoked member.
public entry fun add_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    role: u8,
    tags: vector<String>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);
    let dataroom = pool::borrow_dataroom_mut(pool);

    // Auth: caller must be OWNER or ORG_ADMIN
    dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    // Precondition: not paused
    assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    // Validate role bitmask
    assert!(types::is_valid_role(role), errors::e_invalid_role());

    let member_count = dataroom::member_count(dataroom);
    let max_members = admin_config::max_members(admin_config);

    if (dataroom::has_member(dataroom, member_addr)) {
        let member = dataroom::borrow_member_mut(dataroom, member_addr);
        // If active → abort duplicate
        assert!(!member::is_active(member), errors::e_member_already_exists());
        // Revoked member → reactivate
        member::reactivate(member, role, tags, now);
        // member_count was decremented on removal, increment back
        dataroom::increment_member_count(dataroom);
    } else {
        // New member
        assert!(member_count < max_members, errors::e_max_members_reached());
        let new_member = member::new(member_addr, role, tags, now);
        dataroom::add_member_record(dataroom, member_addr, new_member);
        dataroom::increment_member_count(dataroom);
    };

    // Events
    event::emit(events::member_added(
        pool::id(pool),
        dataroom::id(dataroom),
        member_addr,
        role,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"add_member",
        now,
    ));
}
```

- [ ] **Step 2: Add helper functions to `dataroom.move` module (internal)**

These helpers must exist on the `DataRoom` struct for `add_member` to work. Add if not already present from Chunk 2:

```move
/// Check if dataroom has a member record (active or revoked)
public(package) fun has_member(dataroom: &DataRoom, addr: address): bool {
    table::contains(&dataroom.members, addr)
}

/// Borrow mutable member record
public(package) fun borrow_member_mut(dataroom: &mut DataRoom, addr: address): &mut Member {
    table::borrow_mut(&mut dataroom.members, addr)
}

/// Add a new member record to the table
public(package) fun add_member_record(dataroom: &mut DataRoom, addr: address, member: Member) {
    table::add(&mut dataroom.members, addr, member);
}

/// Increment active member count
public(package) fun increment_member_count(dataroom: &mut DataRoom) {
    dataroom.member_count = dataroom.member_count + 1;
}

/// Decrement active member count
public(package) fun decrement_member_count(dataroom: &mut DataRoom) {
    dataroom.member_count = dataroom.member_count - 1;
}

/// Get member count
public(package) fun member_count(dataroom: &DataRoom): u64 {
    dataroom.member_count
}

/// Check if paused
public(package) fun is_paused(dataroom: &DataRoom): bool {
    dataroom.is_paused
}

/// Assert caller has at minimum the specified role bitmask
public(package) fun assert_role(dataroom: &DataRoom, caller: address, min_role: u8) {
    assert!(has_member(dataroom, caller), errors::e_not_member());
    let member = table::borrow(&dataroom.members, caller);
    assert!(member::is_active(member), errors::e_not_member());
    assert!(types::has_role(member::role(member), min_role), errors::e_unauthorized());
}

/// Get a member's role
public(package) fun get_role(dataroom: &DataRoom, addr: address): u8 {
    let member = table::borrow(&dataroom.members, addr);
    member::role(member)
}

/// Check if member is active
public(package) fun is_active_member(dataroom: &DataRoom, addr: address): bool {
    if (!has_member(dataroom, addr)) return false;
    let member = table::borrow(&dataroom.members, addr);
    member::is_active(member)
}
```

- [ ] **Step 3: Add member module helpers needed**

In `sources/member.move` (or wherever Member struct lives), ensure these exist:

```move
/// Reactivate a revoked member with new role and tags
public(package) fun reactivate(member: &mut Member, role: u8, tags: vector<String>, now: u64) {
    member.is_active = true;
    member.role = role;
    member.tags = tags;
    member.revoked_at = option::none();
    member.updated_at = now;
}

public(package) fun is_active(member: &Member): bool {
    member.is_active
}

public(package) fun role(member: &Member): u8 {
    member.role
}

public(package) fun set_role(member: &mut Member, role: u8, now: u64) {
    member.role = role;
    member.updated_at = now;
}

public(package) fun revoke(member: &mut Member, now: u64) {
    member.is_active = false;
    member.revoked_at = option::some(now);
    member.updated_at = now;
}
```

- [ ] **Step 4: Write tests in `tests/dataroom_tests.move`**

```move
#[test]
fun test_add_member_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());

    // Setup: create admin config + pool with ALICE as owner
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Act: ALICE adds BOB as EDITOR
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config,
        &mut pool,
        @bob,
        types::ROLE_EDITOR(),
        vector[string::utf8(b"team-a")],
        &clock,
        scenario.ctx(),
    );

    // Assert: BOB is now an active member
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::is_active_member(dr, @bob));
    assert!(dataroom::member_count(dr) == 2); // ALICE + BOB

    // Cleanup
    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_unauthorized())]
fun test_add_member_not_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add BOB as VIEWER first
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // BOB (VIEWER) tries to add CAROL → should abort
    scenario.next_tx(@bob);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_member_already_exists())]
fun test_add_member_already_exists_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    // Add BOB again → abort
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_max_members_reached())]
fun test_add_member_max_reached_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    // Create admin config with max_members = 2
    let admin_config = admin::create_admin_config_with_max_members_for_testing(2, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Pool already has ALICE (count=1). Add BOB (count=2 = max).
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    // Add CAROL → exceeds max → abort
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_reactivate_revoked_member() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add then remove BOB
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::remove_member(
        &admin_config, &mut pool, @bob, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(!dataroom::is_active_member(dr, @bob));
    assert!(dataroom::member_count(dr) == 1); // only ALICE

    // Reactivate BOB with EDITOR role
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(),
        vector[string::utf8(b"reinstated")],
        &clock, scenario.ctx(),
    );

    let dr2 = pool::borrow_dataroom(&pool);
    assert!(dataroom::is_active_member(dr2, @bob));
    assert!(dataroom::get_role(dr2, @bob) == types::ROLE_EDITOR());
    assert!(dataroom::member_count(dr2) == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 5: Run tests**

`Run: sui move test --filter test_add_member`
`Run: sui move test --filter test_reactivate_revoked_member`

- [ ] **Step 6: Commit**

```bash
git add sources/dataroom.move sources/member.move tests/dataroom_tests.move
git commit -m "feat(dataroom): add_member entry function with reactivation support"
```

---

### Task 11: remove_member

**Files:** `sources/dataroom.move`, `tests/dataroom_tests.move`

- [ ] **Step 1: Add remove_member entry function to `sources/dataroom.move`**

```move
/// Soft-remove a member (set inactive, record revoked_at).
/// Cannot remove the DataRoom owner.
public entry fun remove_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);
    let dataroom = pool::borrow_dataroom_mut(pool);

    // Auth
    dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    assert!(!dataroom::is_paused(dataroom), errors::e_paused());

    // Cannot remove the owner
    assert!(member_addr != dataroom::owner(dataroom), errors::e_cannot_remove_owner());

    // Member must exist and be active
    assert!(dataroom::has_member(dataroom, member_addr), errors::e_not_member());
    let member = dataroom::borrow_member_mut(dataroom, member_addr);
    assert!(member::is_active(member), errors::e_not_member());

    // Soft-remove
    member::revoke(member, now);
    dataroom::decrement_member_count(dataroom);

    // Events
    event::emit(events::member_removed(
        pool::id(pool),
        dataroom::id(dataroom),
        member_addr,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"remove_member",
        now,
    ));
}
```

- [ ] **Step 2: Add `owner()` accessor to dataroom module if not present**

```move
/// Return the owner address of the DataRoom
public(package) fun owner(dataroom: &DataRoom): address {
    dataroom.owner
}
```

- [ ] **Step 3: Write tests**

```move
#[test]
fun test_remove_member_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );

    // Remove BOB
    dataroom::remove_member(
        &admin_config, &mut pool, @bob, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(!dataroom::is_active_member(dr, @bob));
    assert!(dataroom::member_count(dr) == 1);
    // Record still exists
    assert!(dataroom::has_member(dr, @bob));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_cannot_remove_owner())]
fun test_remove_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // ALICE tries to remove herself (owner)
    scenario.next_tx(@alice);
    dataroom::remove_member(
        &admin_config, &mut pool, @alice, &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_not_member())]
fun test_remove_nonexistent_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::remove_member(
        &admin_config, &mut pool, @bob, &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 4: Run tests**

`Run: sui move test --filter test_remove_member`
`Run: sui move test --filter test_remove_owner`
`Run: sui move test --filter test_remove_nonexistent`

- [ ] **Step 5: Commit**

```bash
git add sources/dataroom.move tests/dataroom_tests.move
git commit -m "feat(dataroom): remove_member with soft-delete and owner protection"
```

---

### Task 12: update_member_role

**Files:** `sources/dataroom.move`, `tests/dataroom_tests.move`

- [ ] **Step 1: Add update_member_role entry function to `sources/dataroom.move`**

```move
/// Update a member's role bitmask.
/// Cannot demote the owner below OWNER role.
public entry fun update_member_role(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    new_role: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);
    let dataroom = pool::borrow_dataroom_mut(pool);

    // Auth
    dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    assert!(types::is_valid_role(new_role), errors::e_invalid_role());

    // Cannot demote owner below OWNER
    if (member_addr == dataroom::owner(dataroom)) {
        assert!(
            types::has_role(new_role, types::ROLE_OWNER()),
            errors::e_cannot_demote_owner(),
        );
    };

    // Member must exist and be active
    assert!(dataroom::has_member(dataroom, member_addr), errors::e_not_member());
    let member = dataroom::borrow_member_mut(dataroom, member_addr);
    assert!(member::is_active(member), errors::e_not_member());

    member::set_role(member, new_role, now);

    // Events
    event::emit(events::member_role_updated(
        pool::id(pool),
        dataroom::id(dataroom),
        member_addr,
        new_role,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"update_member_role",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_update_role_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // Promote BOB to EDITOR
    dataroom::update_member_role(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(),
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::get_role(dr, @bob) == types::ROLE_EDITOR());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_cannot_demote_owner())]
fun test_demote_owner_below_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Try to demote ALICE (owner) to VIEWER
    scenario.next_tx(@alice);
    dataroom::update_member_role(
        &admin_config, &mut pool, @alice, types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_update_role`
`Run: sui move test --filter test_demote_owner`

- [ ] **Step 4: Commit**

```bash
git add sources/dataroom.move tests/dataroom_tests.move
git commit -m "feat(dataroom): update_member_role with owner demotion guard"
```

---

### Task 13: create_custom_folder

**Files:** `sources/dataroom.move`, `tests/dataroom_tests.move`

- [ ] **Step 1: Add FolderInfo struct and storage to DataRoom**

In `sources/dataroom.move` or a dedicated `sources/folder.move`:

```move
/// Metadata for a custom folder, stored in DataRoom.custom_folders table
public struct FolderInfo has store, drop, copy {
    id: u64,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    created_at: u64,
    created_by: address,
}
```

Ensure `DataRoom` has:
```move
custom_folders: Table<u64, FolderInfo>,  // folder_id → FolderInfo
custom_folder_count: u64,                // next folder_id counter, starts at 100
```

- [ ] **Step 2: Add create_custom_folder entry function**

```move
/// Create a custom folder in the dataroom.
/// Folder IDs start at 100 to leave room for system folders.
public entry fun create_custom_folder(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);
    let dataroom = pool::borrow_dataroom_mut(pool);

    // Auth: EDITOR+
    dataroom::assert_role(dataroom, caller, types::ROLE_EDITOR_UP());
    assert!(!dataroom::is_paused(dataroom), errors::e_paused());

    // Validate name non-empty
    assert!(!string::is_empty(&name), errors::e_empty_name());

    // Validate parent exists if specified
    if (option::is_some(&parent_id)) {
        let pid = *option::borrow(&parent_id);
        assert!(
            table::contains(&dataroom.custom_folders, pid),
            errors::e_folder_not_found(),
        );
    };

    // Assign folder ID
    let folder_id = dataroom.custom_folder_count; // starts at 100
    dataroom.custom_folder_count = folder_id + 1;

    let folder_info = FolderInfo {
        id: folder_id,
        name,
        parent_id,
        visible_to_roles,
        created_at: now,
        created_by: caller,
    };
    table::add(&mut dataroom.custom_folders, folder_id, folder_info);

    // Events
    event::emit(events::folder_created(
        pool::id(pool),
        dataroom::id(dataroom),
        folder_id,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"create_custom_folder",
        now,
    ));
}
```

- [ ] **Step 3: Add folder helpers**

```move
/// Check if a folder exists
public(package) fun has_folder(dataroom: &DataRoom, folder_id: u64): bool {
    // System folders (0-99) always exist, custom folders checked in table
    folder_id < 100 || table::contains(&dataroom.custom_folders, folder_id)
}
```

- [ ] **Step 4: Write tests**

```move
#[test]
fun test_create_folder_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::create_custom_folder(
        &admin_config,
        &mut pool,
        string::utf8(b"Legal Documents"),
        option::none(),
        types::ROLE_VIEWER(), // visible to all roles
        &clock,
        scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::has_folder(dr, 100)); // first custom folder

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_create_folder_with_parent() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    // Create parent folder (id=100)
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Parent"),
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );
    // Create child folder (id=101) under parent 100
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Child"),
        option::some(100),
        types::ROLE_EDITOR(),
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::has_folder(dr, 101));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_empty_name())]
fun test_create_folder_empty_name_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b""), // empty
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_folder_not_found())]
fun test_create_folder_invalid_parent_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Orphan"),
        option::some(999), // nonexistent parent
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 5: Run tests**

`Run: sui move test --filter test_create_folder`

- [ ] **Step 6: Commit**

```bash
git add sources/dataroom.move tests/dataroom_tests.move
git commit -m "feat(dataroom): create_custom_folder with parent validation"
```

---

### Task 14: store_encrypted_folder_key

**Files:** `sources/dataroom.move`, `tests/dataroom_tests.move`

- [ ] **Step 1: Add FolderKeyTag struct**

```move
/// Dynamic field key for storing encrypted folder keys.
/// Each (folder_id, member) pair maps to an encrypted AES key.
public struct FolderKeyTag has store, copy, drop {
    folder_id: u64,
    member: address,
}
```

- [ ] **Step 2: Add store_encrypted_folder_key entry function**

```move
/// Store an encrypted AES key for a specific folder+member pair.
/// Idempotent: overwrites if the key already exists.
public entry fun store_encrypted_folder_key(
    pool: &mut Pool,
    folder_id: u64,
    member_addr: address,
    encrypted_key: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);
    let dataroom = pool::borrow_dataroom_mut(pool);

    // Auth: OWNER or ORG_ADMIN
    dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    assert!(!dataroom::is_paused(dataroom), errors::e_paused());

    // Validate folder exists
    assert!(dataroom::has_folder(dataroom, folder_id), errors::e_folder_not_found());

    // Validate member exists and is active
    assert!(dataroom::is_active_member(dataroom, member_addr), errors::e_not_member());

    let tag = FolderKeyTag { folder_id, member: member_addr };

    // Idempotent: remove old key if exists, then add new
    if (dynamic_field::exists_(&dataroom.id, tag)) {
        dynamic_field::remove<FolderKeyTag, vector<u8>>(&mut dataroom.id, tag);
    };
    dynamic_field::add(&mut dataroom.id, tag, encrypted_key);

    // Events
    event::emit(events::folder_key_stored(
        pool::id(pool),
        dataroom::id(dataroom),
        folder_id,
        member_addr,
        caller,
        now,
    ));
}
```

- [ ] **Step 3: Write tests**

```move
#[test]
fun test_store_folder_key_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add BOB and create a folder
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Encrypted Folder"),
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    // Store encrypted key for BOB on folder 100
    let fake_key = b"encrypted_aes_key_data_32_bytes!";
    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @bob, fake_key, &clock, scenario.ctx(),
    );

    // Verify key stored via dynamic field
    let dr = pool::borrow_dataroom(&pool);
    let tag = dataroom::folder_key_tag(100, @bob);
    assert!(dynamic_field::exists_(&dr.id, tag));
    let stored_key = dynamic_field::borrow<FolderKeyTag, vector<u8>>(&dr.id, tag);
    assert!(*stored_key == fake_key);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_store_folder_key_overwrite() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Folder"),
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    let key_v1 = b"old_key_padding__old_key_padding!";
    let key_v2 = b"new_key_padding__new_key_padding!";

    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @bob, key_v1, &clock, scenario.ctx(),
    );
    // Overwrite
    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @bob, key_v2, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    let tag = dataroom::folder_key_tag(100, @bob);
    let stored = dynamic_field::borrow<FolderKeyTag, vector<u8>>(&dr.id, tag);
    assert!(*stored == key_v2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_unauthorized())]
fun test_store_folder_key_not_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Folder"),
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    // BOB (EDITOR, not OWNER) tries to store key → abort
    scenario.next_tx(@bob);
    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @bob, b"key_data_here___key_data_here___!", &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 4: Add public helper for test access to FolderKeyTag**

```move
/// Construct a FolderKeyTag (for test/read access)
public fun folder_key_tag(folder_id: u64, member: address): FolderKeyTag {
    FolderKeyTag { folder_id, member }
}
```

- [ ] **Step 5: Run tests**

`Run: sui move test --filter test_store_folder_key`

- [ ] **Step 6: Commit**

```bash
git add sources/dataroom.move tests/dataroom_tests.move
git commit -m "feat(dataroom): store_encrypted_folder_key with idempotent overwrite"
```

---

## Chunk 4: Document Entry Functions (Tasks 15-19)

### Task 15: create_document

**Files:** `sources/document.move`, `tests/document_tests.move`

- [ ] **Step 1: Add Document and DocVersion structs to `sources/document.move`** (if not done in Chunk 2)

```move
module rwa_dataroom::document;

use sui::object::{Self, ID, UID};
use sui::tx_context::{Self, TxContext};
use sui::clock::{Self, Clock};
use sui::event;
use sui::dynamic_field;
use std::string::{Self, String};
use std::option::{Self, Option};

use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::admin::{Self, AdminConfig};
use rwa_dataroom::dataroom;

/// Document metadata stored as dynamic field on Pool keyed by doc_id (ID).
public struct Document has store {
    id: UID,
    folder_id: u64,
    doc_type: u8,
    title: String,
    required_flag: bool,
    visible_to_roles: u8,
    is_archived: bool,
    version_count: u64,
    current_version: u64,
    tags: vector<String>,
    created_at: u64,
    created_by: address,
    updated_at: u64,
}

/// A single version of a document.
/// Stored as dynamic field on Document keyed by version number (u64).
public struct DocVersion has store, drop, copy {
    version: u64,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    uploaded_by: address,
    created_at: u64,
}

/// Review record stored as dynamic field on Document keyed by reviewer address.
public struct ReviewRecord has store, drop, copy {
    reviewer: address,
    status: u8,        // 0=PENDING, 1=APPROVED, 2=NEEDS_REVISION
    comment_hash: Option<vector<u8>>,
    reviewed_at: u64,
}

/// Dynamic field key to store Document on Pool
public struct DocKey has store, copy, drop {
    doc_id: ID,
}
```

- [ ] **Step 2: Add create_document entry function**

```move
/// Create a new document in the pool's dataroom. Returns the new document's ID.
/// NOTE (ERRATA E6): Changed from `entry fun` to `public fun` to allow return value.
public fun create_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    folder_id: u64,
    doc_type: u8,
    title: String,
    required_flag: bool,
    visible_to_roles: u8,
    walrus_blob_id: String,
    content_hash: vector<u8>,
    size_bytes: u64,
    change_log: String,
    tags: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    // Auth & preconditions (read dataroom immutably first for checks)
    {
        let dataroom = pool::borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_EDITOR_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
        assert!(dataroom::has_folder(dataroom, folder_id), errors::e_folder_not_found());
    };

    // Validate inputs
    assert!(types::is_valid_doc_type(doc_type), errors::e_invalid_doc_type());
    assert!(!string::is_empty(&walrus_blob_id), errors::e_empty_blob_id());
    assert!(vector::length(&content_hash) == 32, errors::e_invalid_content_hash());

    // Create Document object
    let doc_uid = object::new(ctx);
    let doc_id = object::uid_to_inner(&doc_uid);

    let first_version = DocVersion {
        version: 1,
        walrus_blob_id,
        content_hash,
        size_bytes,
        change_log,
        uploaded_by: caller,
        created_at: now,
    };

    let mut doc = Document {
        id: doc_uid,
        folder_id,
        doc_type,
        title,
        required_flag,
        visible_to_roles,
        is_archived: false,
        version_count: 1,
        current_version: 1,
        tags,
        created_at: now,
        created_by: caller,
        updated_at: now,
    };

    // Store version 1 as dynamic field on Document
    dynamic_field::add(&mut doc.id, 1u64, first_version);

    // Store Document as dynamic field on Pool
    let doc_key = DocKey { doc_id };
    pool::add_dynamic_field(pool, doc_key, doc);

    // Increment doc count on dataroom
    let dataroom = pool::borrow_dataroom_mut(pool);
    dataroom::increment_doc_count(dataroom);

    // Events
    event::emit(events::document_created(
        pool::id(pool),
        doc_id,
        folder_id,
        doc_type,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"create_document",
        now,
    ));

    // ERRATA E6: Return the new document ID
    doc_id
}
```

- [ ] **Step 3: Add pool helper for dynamic fields**

```move
// In pool.move:

/// Add a dynamic field to the Pool object
public(package) fun add_dynamic_field<K: store + copy + drop, V: store>(
    pool: &mut Pool, key: K, value: V,
) {
    dynamic_field::add(&mut pool.id, key, value);
}

/// Borrow a dynamic field from Pool
public(package) fun borrow_dynamic_field<K: store + copy + drop, V: store>(
    pool: &Pool, key: K,
): &V {
    dynamic_field::borrow(&pool.id, key)
}

/// Borrow mutable dynamic field from Pool
public(package) fun borrow_dynamic_field_mut<K: store + copy + drop, V: store>(
    pool: &mut Pool, key: K,
): &mut V {
    dynamic_field::borrow_mut(&mut pool.id, key)
}

/// Check if Pool has a dynamic field
public(package) fun has_dynamic_field<K: store + copy + drop>(
    pool: &Pool, key: K,
): bool {
    dynamic_field::exists_(&pool.id, key)
}
```

- [ ] **Step 4: Add dataroom helper**

```move
// In dataroom.move:
public(package) fun increment_doc_count(dataroom: &mut DataRoom) {
    dataroom.doc_count = dataroom.doc_count + 1;
}
```

- [ ] **Step 5: Write tests in `tests/document_tests.move`**

```move
#[test_only]
module rwa_dataroom::document_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use std::option;
use std::vector;

use rwa_dataroom::document;
use rwa_dataroom::dataroom;
use rwa_dataroom::pool;
use rwa_dataroom::admin;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::test_helpers;

fun make_hash_32(): vector<u8> {
    // 32-byte hash
    b"abcdefghijklmnopqrstuvwxyz012345"
}

#[test]
fun test_create_document_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    document::create_document(
        &admin_config,
        &mut pool,
        0, // system folder 0 (default)
        types::DOC_TYPE_LEGAL(),
        string::utf8(b"Term Sheet"),
        true,  // required
        types::ROLE_VIEWER(),
        string::utf8(b"walrus_blob_abc123"),
        make_hash_32(),
        1024,
        string::utf8(b"Initial upload"),
        vector[string::utf8(b"legal")],
        &clock,
        scenario.ctx(),
    );

    // Verify doc_count incremented
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::doc_count(dr) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_content_hash())]
fun test_create_document_invalid_hash_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    document::create_document(
        &admin_config, &mut pool,
        0, types::DOC_TYPE_LEGAL(),
        string::utf8(b"Bad Doc"), false, types::ROLE_VIEWER(),
        string::utf8(b"blob"),
        b"too_short", // not 32 bytes
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_empty_blob_id())]
fun test_create_document_empty_blob_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    document::create_document(
        &admin_config, &mut pool,
        0, types::DOC_TYPE_LEGAL(),
        string::utf8(b"Doc"), false, types::ROLE_VIEWER(),
        string::utf8(b""), // empty blob id
        make_hash_32(),
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_unauthorized())]
fun test_create_document_viewer_cannot_create() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add BOB as VIEWER
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // BOB (VIEWER) tries to create document → abort
    scenario.next_tx(@bob);
    document::create_document(
        &admin_config, &mut pool,
        0, types::DOC_TYPE_LEGAL(),
        string::utf8(b"Doc"), false, types::ROLE_VIEWER(),
        string::utf8(b"blob"),
        make_hash_32(),
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 6: Run tests**

`Run: sui move test --filter test_create_document`

- [ ] **Step 7: Commit**

```bash
git add sources/document.move sources/pool.move sources/dataroom.move tests/document_tests.move
git commit -m "feat(document): create_document with version 1 and validation"
```

---

### Task 16: add_version

**Files:** `sources/document.move`, `tests/document_tests.move`

- [ ] **Step 1: Add document accessor helpers**

```move
// In document.move:

/// Construct a DocKey for looking up documents on Pool
public fun doc_key(doc_id: ID): DocKey {
    DocKey { doc_id }
}

/// Borrow a Document from the Pool
public(package) fun borrow_doc(pool: &Pool, doc_id: ID): &Document {
    pool::borrow_dynamic_field<DocKey, Document>(pool, DocKey { doc_id })
}

/// Borrow a mutable Document from the Pool
public(package) fun borrow_doc_mut(pool: &mut Pool, doc_id: ID): &mut Document {
    pool::borrow_dynamic_field_mut<DocKey, Document>(pool, DocKey { doc_id })
}

/// Check if a document exists on the Pool
public(package) fun doc_exists(pool: &Pool, doc_id: ID): bool {
    pool::has_dynamic_field<DocKey>(pool, DocKey { doc_id })
}

/// Get the uploader of the current version
public(package) fun current_version_uploader(doc: &Document): address {
    let ver = dynamic_field::borrow<u64, DocVersion>(&doc.id, doc.current_version);
    ver.uploaded_by
}
```

- [ ] **Step 2: Add add_version entry function**

```move
/// Add a new version to an existing document.
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
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    // Auth check
    {
        let dataroom = pool::borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_EDITOR_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    // Validate inputs
    assert!(!string::is_empty(&walrus_blob_id), errors::e_empty_blob_id());
    assert!(vector::length(&content_hash) == 32, errors::e_invalid_content_hash());

    let max_versions = admin_config::max_versions(admin_config);

    // Document must exist and not be archived
    assert!(doc_exists(pool, doc_id), errors::e_doc_not_found());
    let doc = borrow_doc_mut(pool, doc_id);
    assert!(!doc.is_archived, errors::e_doc_archived());
    assert!(doc.version_count < max_versions, errors::e_max_versions_reached());

    // Create new version
    let new_version_num = doc.current_version + 1;
    let version = DocVersion {
        version: new_version_num,
        walrus_blob_id,
        content_hash,
        size_bytes,
        change_log,
        uploaded_by: caller,
        created_at: now,
    };

    dynamic_field::add(&mut doc.id, new_version_num, version);
    doc.version_count = doc.version_count + 1;
    doc.current_version = new_version_num;
    doc.updated_at = now;

    // Events
    event::emit(events::document_version_added(
        pool::id(pool),
        doc_id,
        new_version_num,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"add_version",
        now,
    ));
}
```

- [ ] **Step 3: Write tests**

```move
#[test]
fun test_add_version_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Create a document first
    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // Add version 2
    document::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"walrus_blob_v2"),
        make_hash_32(),
        2048,
        string::utf8(b"Updated content"),
        &clock, scenario.ctx(),
    );

    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.version_count == 2);
    assert!(doc.current_version == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_doc_archived())]
fun test_add_version_archived_doc_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // Archive it
    document::archive_document(
        &admin_config, &mut pool, doc_id, &clock, scenario.ctx(),
    );

    // Try to add version → abort
    document::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"),
        make_hash_32(),
        100,
        string::utf8(b""),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_max_versions_reached())]
fun test_add_version_max_reached_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    // max_versions = 2
    let admin_config = admin::create_admin_config_with_max_versions_for_testing(2, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    ); // version 1

    // Add version 2 (at max now)
    document::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"), make_hash_32(), 100,
        string::utf8(b"v2"), &clock, scenario.ctx(),
    );

    // Add version 3 → exceeds max → abort
    document::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v3"), make_hash_32(), 100,
        string::utf8(b"v3"), &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 4: Run tests**

`Run: sui move test --filter test_add_version`

- [ ] **Step 5: Commit**

```bash
git add sources/document.move tests/document_tests.move
git commit -m "feat(document): add_version with archive and max-version guards"
```

---

### Task 17: submit_review

**Files:** `sources/document.move`, `tests/document_tests.move`

- [ ] **Step 1: Add ReviewerKey struct and constants**

```move
/// Dynamic field key for review records on Document
public struct ReviewerKey has store, copy, drop {
    reviewer: address,
}

// Review status constants
const REVIEW_PENDING: u8 = 0;
const REVIEW_APPROVED: u8 = 1;
const REVIEW_NEEDS_REVISION: u8 = 2;

public fun review_approved(): u8 { REVIEW_APPROVED }
public fun review_needs_revision(): u8 { REVIEW_NEEDS_REVISION }
```

- [ ] **Step 2: Add submit_review entry function**

```move
/// Submit a review for a document.
/// Reviewer cannot be the uploader of the current version (no self-approval).
public entry fun submit_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    status: u8,
    comment_hash: Option<vector<u8>>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    // Auth: REVIEWER or higher
    {
        let dataroom = pool::borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_REVIEWER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    // Validate status
    assert!(
        status == REVIEW_PENDING || status == REVIEW_APPROVED || status == REVIEW_NEEDS_REVISION,
        errors::e_invalid_review_status(),
    );

    // Validate comment_hash if present (must be 32 bytes)
    if (option::is_some(&comment_hash)) {
        let hash = option::borrow(&comment_hash);
        assert!(vector::length(hash) == 32, errors::e_invalid_content_hash());
    };

    // Document must exist
    assert!(doc_exists(pool, doc_id), errors::e_doc_not_found());

    let doc = borrow_doc_mut(pool, doc_id);
    assert!(!doc.is_archived, errors::e_doc_archived());

    // No self-approval: reviewer != current version uploader
    let uploader = current_version_uploader(doc);
    assert!(caller != uploader, errors::e_self_review());

    let review = ReviewRecord {
        reviewer: caller,
        status,
        comment_hash,
        reviewed_at: now,
    };

    let key = ReviewerKey { reviewer: caller };

    // Idempotent: overwrite existing review
    if (dynamic_field::exists_(&doc.id, key)) {
        dynamic_field::remove<ReviewerKey, ReviewRecord>(&mut doc.id, key);
    };
    dynamic_field::add(&mut doc.id, key, review);

    doc.updated_at = now;

    // Events
    event::emit(events::document_reviewed(
        pool::id(pool),
        doc_id,
        caller,
        status,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"submit_review",
        now,
    ));
}
```

- [ ] **Step 3: Add review query helper for state machine checks**

```move
/// Check if a document has at least one APPROVED review.
public(package) fun has_approved_review(pool: &Pool, doc_id: ID, reviewers: &vector<address>): bool {
    let doc = borrow_doc(pool, doc_id);
    let len = vector::length(reviewers);
    let mut i = 0;
    while (i < len) {
        let reviewer = *vector::borrow(reviewers, i);
        let key = ReviewerKey { reviewer };
        if (dynamic_field::exists_(&doc.id, key)) {
            let record = dynamic_field::borrow<ReviewerKey, ReviewRecord>(&doc.id, key);
            if (record.status == REVIEW_APPROVED) {
                return true
            };
        };
        i = i + 1;
    };
    false
}

/// Check if a specific document with required_flag has at least one APPROVED review.
/// Used by pool state transitions.
public fun is_doc_approved(pool: &Pool, doc_id: ID): bool {
    let doc = borrow_doc(pool, doc_id);
    // We check via the document's required_flag and look for any approved review
    // Since we can't iterate dynamic fields, the caller must provide reviewer addresses
    // Alternative: store a review_count + approved_count on Document
    doc.required_flag // placeholder — see all_required_docs_approved below
}

/// Check that all docs in the list that have required_flag=true have ≥1 approved review.
/// Caller must pass known reviewer addresses per doc.
/// Simplified approach: store approved_count on Document to avoid needing reviewer list.
public fun all_required_docs_approved(
    pool: &Pool,
    doc_ids: &vector<ID>,
): bool {
    let len = vector::length(doc_ids);
    let mut i = 0;
    while (i < len) {
        let doc_id = *vector::borrow(doc_ids, i);
        let doc = borrow_doc(pool, doc_id);
        if (doc.required_flag && doc.approved_count == 0) {
            return false
        };
        i = i + 1;
    };
    true
}
```

- [ ] **Step 4: Add approved_count field to Document and update submit_review**

Add to Document struct:
```move
approved_count: u64,  // number of APPROVED reviews
```

Initialize in create_document:
```move
approved_count: 0,
```

Update in submit_review, after adding review record:
```move
    // Update approved count
    // If we overwrote an old review, we need to adjust counts
    // Simple approach: recount isn't feasible with dynamic fields
    // So track net change:
    if (dynamic_field::exists_(&doc.id, key)) {
        let old_review = dynamic_field::borrow<ReviewerKey, ReviewRecord>(&doc.id, key);
        if (old_review.status == REVIEW_APPROVED) {
            doc.approved_count = doc.approved_count - 1;
        };
        dynamic_field::remove<ReviewerKey, ReviewRecord>(&mut doc.id, key);
    };
    if (status == REVIEW_APPROVED) {
        doc.approved_count = doc.approved_count + 1;
    };
    dynamic_field::add(&mut doc.id, key, review);
```

- [ ] **Step 5: Write tests**

```move
#[test]
fun test_submit_review_approved() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // ALICE creates doc, add CAROL as REVIEWER
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // CAROL reviews as APPROVED
    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_submit_review_needs_revision() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_needs_revision(),
        option::some(make_hash_32()),
        &clock, scenario.ctx(),
    );

    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 0);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_self_review())]
fun test_self_review_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // ALICE creates doc then tries to review her own doc
    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_unauthorized())]
fun test_viewer_cannot_review() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // BOB (VIEWER) tries to review → abort
    scenario.next_tx(@bob);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 6: Run tests**

`Run: sui move test --filter test_submit_review`
`Run: sui move test --filter test_self_review`
`Run: sui move test --filter test_viewer_cannot_review`

- [ ] **Step 7: Commit**

```bash
git add sources/document.move tests/document_tests.move
git commit -m "feat(document): submit_review with self-approval prevention and overwrite"
```

---

### Task 18: mark_as_required

**Files:** `sources/document.move`, `tests/document_tests.move`

- [ ] **Step 1: Add mark_as_required entry function**

```move
/// Toggle the required_flag on a document.
public entry fun mark_as_required(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    required: bool,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = pool::borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert!(doc_exists(pool, doc_id), errors::e_doc_not_found());
    let doc = borrow_doc_mut(pool, doc_id);
    doc.required_flag = required;
    doc.updated_at = now;
}
```

- [ ] **Step 2: Write test**

```move
#[test]
fun test_mark_required_toggle() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    ); // required=true by default in helper

    // Toggle to false
    document::mark_as_required(
        &admin_config, &mut pool, doc_id, false, &clock, scenario.ctx(),
    );
    let doc = document::borrow_doc(&pool, doc_id);
    assert!(!doc.required_flag);

    // Toggle back to true
    document::mark_as_required(
        &admin_config, &mut pool, doc_id, true, &clock, scenario.ctx(),
    );
    let doc2 = document::borrow_doc(&pool, doc_id);
    assert!(doc2.required_flag);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_mark_required`

- [ ] **Step 4: Commit**

```bash
git add sources/document.move tests/document_tests.move
git commit -m "feat(document): mark_as_required toggle"
```

---

### Task 19: archive_document

**Files:** `sources/document.move`, `tests/document_tests.move`

- [ ] **Step 1: Add archive_document entry function**

```move
/// Archive a document. Archived documents cannot have new versions or reviews.
public entry fun archive_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = pool::borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert!(doc_exists(pool, doc_id), errors::e_doc_not_found());
    let doc = borrow_doc_mut(pool, doc_id);
    assert!(!doc.is_archived, errors::e_doc_already_archived());

    doc.is_archived = true;
    doc.updated_at = now;

    // Events
    event::emit(events::document_archived(
        pool::id(pool),
        doc_id,
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"archive_document",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_archive_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    document::archive_document(
        &admin_config, &mut pool, doc_id, &clock, scenario.ctx(),
    );

    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.is_archived);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_doc_already_archived())]
fun test_archive_already_archived_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    document::archive_document(
        &admin_config, &mut pool, doc_id, &clock, scenario.ctx(),
    );
    // Archive again → abort
    document::archive_document(
        &admin_config, &mut pool, doc_id, &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_archive`

- [ ] **Step 4: Commit**

```bash
git add sources/document.move tests/document_tests.move
git commit -m "feat(document): archive_document with double-archive guard"
```

---

## Chunk 5: Pool State Machine (Tasks 20-27)

### Task 20: progress_to_dd

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add pool state constants to `sources/types.move`** (if not already present)

```move
// Pool states
const POOL_DRAFT: u8 = 0;
const POOL_DD_IN_PROGRESS: u8 = 1;
const POOL_IC_REVIEW: u8 = 2;
const POOL_APPROVED_INTERNAL: u8 = 3;
const POOL_READY_TO_ISSUE: u8 = 4;
const POOL_REJECTED: u8 = 5;
const POOL_CANCELLED: u8 = 6;

public fun pool_draft(): u8 { POOL_DRAFT }
public fun pool_dd_in_progress(): u8 { POOL_DD_IN_PROGRESS }
public fun pool_ic_review(): u8 { POOL_IC_REVIEW }
public fun pool_approved_internal(): u8 { POOL_APPROVED_INTERNAL }
public fun pool_ready_to_issue(): u8 { POOL_READY_TO_ISSUE }
public fun pool_rejected(): u8 { POOL_REJECTED }
public fun pool_cancelled(): u8 { POOL_CANCELLED }
```

- [ ] **Step 2: Add state accessor and transition helpers to pool.move**

```move
/// Get the current state of the pool
public(package) fun state(pool: &Pool): u8 {
    pool.state
}

/// Set pool state (package-internal)
public(package) fun set_state(pool: &mut Pool, new_state: u8) {
    pool.state = new_state;
}

/// Assert pool is in an expected state
public(package) fun assert_state(pool: &Pool, expected: u8) {
    assert!(pool.state == expected, errors::e_invalid_state_transition());
}

/// Assert pool is in one of two expected states
public(package) fun assert_state_one_of(pool: &Pool, s1: u8, s2: u8) {
    assert!(pool.state == s1 || pool.state == s2, errors::e_invalid_state_transition());
}
```

- [ ] **Step 3: Add progress_to_dd entry function to pool.move**

```move
/// Transition pool: DRAFT → DD_IN_PROGRESS
public entry fun progress_to_dd(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_draft());
    set_state(pool, types::pool_dd_in_progress());

    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_draft(),
        types::pool_dd_in_progress(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"progress_to_dd",
        now,
    ));
}
```

- [ ] **Step 4: Write tests**

```move
#[test]
fun test_progress_to_dd_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::state(&pool) == types::pool_dd_in_progress());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_progress_to_dd_wrong_state_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Progress to DD first
    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    // Try DD → DD again → abort
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 5: Run tests**

`Run: sui move test --filter test_progress_to_dd`

- [ ] **Step 6: Commit**

```bash
git add sources/pool.move sources/types.move tests/pool_tests.move
git commit -m "feat(pool): progress_to_dd state transition DRAFT→DD_IN_PROGRESS"
```

---

### Task 21: progress_to_ic_review

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add progress_to_ic_review entry function**

```move
/// Transition pool: DD_IN_PROGRESS → IC_REVIEW
/// Gate: all required docs must have at least one approved review.
public entry fun progress_to_ic_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_dd_in_progress());

    // Gate: all required docs must be approved
    assert!(
        document::all_required_docs_approved(pool, &required_doc_ids),
        errors::e_required_docs_not_approved(),
    );

    set_state(pool, types::pool_ic_review());

    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_dd_in_progress(),
        types::pool_ic_review(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"progress_to_ic_review",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_progress_to_ic_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Setup: add reviewer, create required doc, review it
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    ); // required=true

    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );

    // Progress: DRAFT → DD → IC_REVIEW
    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    assert!(pool::state(&pool) == types::pool_ic_review());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_required_docs_not_approved())]
fun test_progress_to_ic_docs_not_reviewed_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Create required doc but NO review
    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    // Try to progress to IC without approved reviews → abort
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_progress_to_ic`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): progress_to_ic_review with required docs gate"
```

---

### Task 22: record_ic_approval

**Files:** `sources/pool.move`, `sources/ic_decision.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add ICDecision struct to `sources/ic_decision.move`**

```move
module rwa_dataroom::ic_decision;

use sui::object::{Self, UID};
use sui::tx_context::TxContext;
use std::string::String;
use std::vector;

const IC_APPROVE: u8 = 0;
const IC_REJECT: u8 = 1;
const IC_REQUEST_CHANGES: u8 = 2;

public fun ic_approve(): u8 { IC_APPROVE }
public fun ic_reject(): u8 { IC_REJECT }
public fun ic_request_changes(): u8 { IC_REQUEST_CHANGES }

/// Represents an Investment Committee decision.
public struct ICDecision has store {
    decision_type: u8,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    created_at: u64,
    created_by: address,
}

/// Create a new ICDecision
public fun new(
    decision_type: u8,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    created_at: u64,
    created_by: address,
): ICDecision {
    // Votes and members must match in length
    assert!(
        vector::length(&committee_members) == vector::length(&votes),
        0, // e_length_mismatch — use errors module
    );
    ICDecision {
        decision_type,
        decision_text,
        pdf_blob_id,
        committee_members,
        votes,
        related_doc_ids,
        created_at,
        created_by,
    }
}

public fun decision_type(d: &ICDecision): u8 { d.decision_type }
```

- [ ] **Step 2: Add ICDecisionKey and ic decision storage to pool.move**

```move
/// Dynamic field key for IC decisions on Pool
public struct ICDecisionKey has store, copy, drop {
    index: u64,
}
```

Add to Pool struct:
```move
ic_decision_count: u64,
```

Add accessor:
```move
public(package) fun ic_decision_count(pool: &Pool): u64 {
    pool.ic_decision_count
}

public(package) fun has_ic_approval(pool: &Pool): bool {
    // Check if any IC decision with type APPROVE exists
    let mut i = 0;
    while (i < pool.ic_decision_count) {
        let key = ICDecisionKey { index: i };
        if (dynamic_field::exists_(&pool.id, key)) {
            let decision = dynamic_field::borrow<ICDecisionKey, ic_decision::ICDecision>(
                &pool.id, key,
            );
            if (ic_decision::decision_type(decision) == ic_decision::ic_approve()) {
                return true
            };
        };
        i = i + 1;
    };
    false
}
```

- [ ] **Step 3: Add record_ic_approval entry function**

```move
/// Record IC committee approval. IC_REVIEW(2) → APPROVED_INTERNAL(3).
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
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_ic_review());

    let decision = ic_decision::new(
        ic_decision::ic_approve(),
        decision_text,
        pdf_blob_id,
        committee_members,
        votes,
        related_doc_ids,
        now,
        caller,
    );

    let idx = pool.ic_decision_count;
    let key = ICDecisionKey { index: idx };
    dynamic_field::add(&mut pool.id, key, decision);
    pool.ic_decision_count = idx + 1;

    set_state(pool, types::pool_approved_internal());

    event::emit(events::ic_decision_recorded(
        pool::id(pool),
        ic_decision::ic_approve(),
        caller,
        now,
    ));
    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_ic_review(),
        types::pool_approved_internal(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"record_ic_approval",
        now,
    ));
}
```

- [ ] **Step 4: Write test**

```move
#[test]
fun test_ic_approval_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::record_ic_approval(
        &admin_config,
        &mut pool,
        string::utf8(b"Approved by committee"),
        string::utf8(b"walrus_pdf_blob_id"),
        vector[@alice, @bob, @carol],
        vector[1, 1, 0], // 2 approve, 1 reject
        vector[],
        &clock,
        scenario.ctx(),
    );

    assert!(pool::state(&pool) == types::pool_approved_internal());
    assert!(pool::ic_decision_count(&pool) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 5: Run tests**

`Run: sui move test --filter test_ic_approval`

- [ ] **Step 6: Commit**

```bash
git add sources/pool.move sources/ic_decision.move tests/pool_tests.move
git commit -m "feat(pool): record_ic_approval with ICDecision storage"
```

---

### Task 23: record_ic_rejection

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add record_ic_rejection entry function**

```move
/// Record IC committee rejection. IC_REVIEW(2) → REJECTED(5).
public entry fun record_ic_rejection(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_ic_review());

    let decision = ic_decision::new(
        ic_decision::ic_reject(),
        decision_text,
        pdf_blob_id,
        committee_members,
        votes,
        related_doc_ids,
        now,
        caller,
    );

    let idx = pool.ic_decision_count;
    let key = ICDecisionKey { index: idx };
    dynamic_field::add(&mut pool.id, key, decision);
    pool.ic_decision_count = idx + 1;

    set_state(pool, types::pool_rejected());

    event::emit(events::ic_decision_recorded(
        pool::id(pool),
        ic_decision::ic_reject(),
        caller,
        now,
    ));
    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_ic_review(),
        types::pool_rejected(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"record_ic_rejection",
        now,
    ));
}
```

- [ ] **Step 2: Write test**

```move
#[test]
fun test_ic_rejection_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::record_ic_rejection(
        &admin_config,
        &mut pool,
        string::utf8(b"Insufficient documentation"),
        string::utf8(b"walrus_pdf_rejection"),
        vector[@alice, @bob],
        vector[0, 0], // both reject
        vector[],
        &clock,
        scenario.ctx(),
    );

    assert!(pool::state(&pool) == types::pool_rejected());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_ic_rejection`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): record_ic_rejection IC_REVIEW→REJECTED"
```

---

### Task 24: record_ic_request_changes

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add record_ic_request_changes entry function**

```move
/// IC requests changes. IC_REVIEW(2) → DD_IN_PROGRESS(1) (backward transition).
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
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_ic_review());

    let decision = ic_decision::new(
        ic_decision::ic_request_changes(),
        decision_text,
        pdf_blob_id,
        committee_members,
        votes,
        related_doc_ids,
        now,
        caller,
    );

    let idx = pool.ic_decision_count;
    let key = ICDecisionKey { index: idx };
    dynamic_field::add(&mut pool.id, key, decision);
    pool.ic_decision_count = idx + 1;

    set_state(pool, types::pool_dd_in_progress());

    event::emit(events::ic_decision_recorded(
        pool::id(pool),
        ic_decision::ic_request_changes(),
        caller,
        now,
    ));
    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_ic_review(),
        types::pool_dd_in_progress(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"record_ic_request_changes",
        now,
    ));
}
```

- [ ] **Step 2: Write test**

```move
#[test]
fun test_ic_request_changes_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::record_ic_request_changes(
        &admin_config,
        &mut pool,
        string::utf8(b"Need updated financials"),
        string::utf8(b"walrus_pdf_changes"),
        vector[@alice],
        vector[2], // request changes
        vector[],
        &clock,
        scenario.ctx(),
    );

    // Goes back to DD_IN_PROGRESS
    assert!(pool::state(&pool) == types::pool_dd_in_progress());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_ic_request_changes`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): record_ic_request_changes IC_REVIEW→DD_IN_PROGRESS"
```

---

### Task 25: progress_to_ready_to_issue

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add progress_to_ready_to_issue entry function**

```move
/// Transition pool: APPROVED_INTERNAL(3) → READY_TO_ISSUE(4)
/// Gate: at least one IC approval exists, all required docs approved.
public entry fun progress_to_ready_to_issue(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
        assert!(!dataroom::is_paused(dataroom), errors::e_paused());
    };

    assert_state(pool, types::pool_approved_internal());

    // Gate: must have at least one IC approval
    assert!(has_ic_approval(pool), errors::e_no_ic_approval());

    // Gate: all required docs approved
    assert!(
        document::all_required_docs_approved(pool, &required_doc_ids),
        errors::e_required_docs_not_approved(),
    );

    set_state(pool, types::pool_ready_to_issue());

    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_approved_internal(),
        types::pool_ready_to_issue(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"progress_to_ready_to_issue",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_progress_to_ready_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    // Pool at APPROVED_INTERNAL with one IC approval already recorded
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_approved_internal(), &clock, scenario.ctx(),
    );
    // Manually record an IC approval for the gate check
    test_helpers::record_test_ic_approval(&mut pool, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    pool::progress_to_ready_to_issue(
        &admin_config, &mut pool,
        vector[], // no required docs for simplicity
        &clock, scenario.ctx(),
    );

    assert!(pool::state(&pool) == types::pool_ready_to_issue());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_no_ic_approval())]
fun test_progress_to_ready_no_ic_decision_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    // Pool at APPROVED_INTERNAL but NO IC decision recorded
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_approved_internal(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_progress_to_ready`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): progress_to_ready_to_issue with IC approval gate"
```

---

### Task 26: cancel_pool

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add cancel_pool entry function**

```move
/// Cancel a pool. Only from DRAFT or DD_IN_PROGRESS.
public entry fun cancel_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    };

    // Only DRAFT or DD_IN_PROGRESS can be cancelled
    assert_state_one_of(pool, types::pool_draft(), types::pool_dd_in_progress());

    let old_state = state(pool);
    set_state(pool, types::pool_cancelled());

    event::emit(events::pool_cancelled(
        pool::id(pool),
        caller,
        now,
    ));
    event::emit(events::pool_state_changed(
        pool::id(pool),
        old_state,
        types::pool_cancelled(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"cancel_pool",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_cancel_from_draft() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    pool::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::state(&pool) == types::pool_cancelled());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_cancel_from_dd() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::state(&pool) == types::pool_cancelled());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_cancel_from_ic_review_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_cancel`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): cancel_pool from DRAFT or DD_IN_PROGRESS only"
```

---

### Task 27: reopen_rejected_pool

**Files:** `sources/pool.move`, `tests/pool_tests.move`

- [ ] **Step 1: Add reopen_rejected_pool entry function**

```move
/// Reopen a rejected pool back to DRAFT. REJECTED(5) → DRAFT(0).
public entry fun reopen_rejected_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    let caller = tx_context::sender(ctx);
    let now = clock::timestamp_ms(clock);

    {
        let dataroom = borrow_dataroom(pool);
        dataroom::assert_role(dataroom, caller, types::ROLE_OWNER_UP());
    };

    assert_state(pool, types::pool_rejected());
    set_state(pool, types::pool_draft());

    event::emit(events::pool_state_changed(
        pool::id(pool),
        types::pool_rejected(),
        types::pool_draft(),
        caller,
        now,
    ));
    event::emit(events::audit_event(
        pool::id(pool),
        caller,
        b"reopen_rejected_pool",
        now,
    ));
}
```

- [ ] **Step 2: Write tests**

```move
#[test]
fun test_reopen_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_rejected(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::state(&pool) == types::pool_draft());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_reopen_non_rejected_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx()); // DRAFT

    scenario.next_tx(@alice);
    pool::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter test_reopen`

- [ ] **Step 4: Commit**

```bash
git add sources/pool.move tests/pool_tests.move
git commit -m "feat(pool): reopen_rejected_pool REJECTED→DRAFT"
```

---

## Chunk 6: Seal Policy + Integration + Monkey Tests (Tasks 28-30)

### Task 28: seal_policy.move

**Files:** `sources/seal_policy.move`, `tests/seal_policy_tests.move`

- [ ] **Step 1: Create `sources/seal_policy.move`**

```move
/// Seal integration module.
/// Provides pure-function access checks for Seal decryption policies.
/// These functions are called by Seal's policy engine to determine
/// whether a caller can decrypt folder-level encrypted content.
module rwa_dataroom::seal_policy;

use rwa_dataroom::dataroom::{Self, DataRoom};
use rwa_dataroom::types;
use rwa_dataroom::pool::{Self, Pool};

/// Check if caller is an active member with at least min_role.
/// Used by Seal to gate decryption of pool-level content.
public fun can_access(
    pool: &Pool,
    caller: address,
    min_role: u8,
): bool {
    let dataroom = pool::borrow_dataroom(pool);
    dataroom::is_active_member(dataroom, caller) &&
    types::has_role(dataroom::get_role(dataroom, caller), min_role)
}

/// Check if caller can access a specific folder based on role visibility mask.
/// Used by Seal to gate decryption of folder-specific encrypted keys.
public fun can_access_folder(
    pool: &Pool,
    caller: address,
    folder_visible_to_roles: u8,
): bool {
    let dataroom = pool::borrow_dataroom(pool);
    dataroom::is_active_member(dataroom, caller) &&
    types::has_role(dataroom::get_role(dataroom, caller), folder_visible_to_roles)
}
```

- [ ] **Step 2: Create `tests/seal_policy_tests.move`**

```move
#[test_only]
module rwa_dataroom::seal_policy_tests;

use sui::test_scenario;
use sui::clock;
use std::string;

use rwa_dataroom::seal_policy;
use rwa_dataroom::dataroom;
use rwa_dataroom::pool;
use rwa_dataroom::admin;
use rwa_dataroom::types;
use rwa_dataroom::test_helpers;

#[test]
fun test_can_access_active_member() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // ALICE is OWNER → has all roles
    assert!(seal_policy::can_access(&pool, @alice, types::ROLE_VIEWER()));
    assert!(seal_policy::can_access(&pool, @alice, types::ROLE_EDITOR()));
    assert!(seal_policy::can_access(&pool, @alice, types::ROLE_OWNER()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_can_access_inactive_member_returns_false() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add then remove BOB
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::remove_member(
        &admin_config, &mut pool, @bob, &clock, scenario.ctx(),
    );

    // BOB is inactive
    assert!(!seal_policy::can_access(&pool, @bob, types::ROLE_VIEWER()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_can_access_insufficient_role_returns_false() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add BOB as VIEWER
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // BOB has VIEWER but not EDITOR
    assert!(seal_policy::can_access(&pool, @bob, types::ROLE_VIEWER()));
    assert!(!seal_policy::can_access(&pool, @bob, types::ROLE_EDITOR()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_can_access_folder_with_role_match() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );

    // Folder visible to EDITOR+ → BOB (EDITOR) can access
    assert!(seal_policy::can_access_folder(
        &pool, @bob, types::ROLE_EDITOR(),
    ));

    // Folder visible to VIEWER → BOB (EDITOR, which includes VIEWER bit) can access
    assert!(seal_policy::can_access_folder(
        &pool, @bob, types::ROLE_VIEWER(),
    ));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::


destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_can_access_folder_role_mismatch() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // Folder visible to OWNER only → BOB (VIEWER) cannot access
    assert!(!seal_policy::can_access_folder(
        &pool, @bob, types::ROLE_OWNER(),
    ));

    // Non-member cannot access any folder
    assert!(!seal_policy::can_access_folder(
        &pool, @dave, types::ROLE_VIEWER(),
    ));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter seal_policy`

- [ ] **Step 4: Commit**

```bash
git add sources/seal_policy.move tests/seal_policy_tests.move
git commit -m "feat(seal_policy): can_access and can_access_folder for Seal integration"
```

---

### Task 29: Integration Tests

**Files:** `tests/integration_tests.move`

- [ ] **Step 1: Create `tests/integration_tests.move` with full lifecycle test**

```move
#[test_only]
module rwa_dataroom::integration_tests;

use sui::test_scenario;
use sui::clock;
use sui::object;
use std::string;
use std::option;
use std::vector;

use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::document;
use rwa_dataroom::types;
use rwa_dataroom::ic_decision;
use rwa_dataroom::seal_policy;
use rwa_dataroom::test_helpers;

/// Full happy-path lifecycle:
/// Admin init → create pool → add members → store folder keys →
/// create folder → create doc → review → Draft→DD→IC→Approved→Ready
#[test]
fun test_full_lifecycle_happy_path() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());

    // 1. Create pool with ALICE as OWNER
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // 2. Add BOB (EDITOR) and CAROL (REVIEWER)
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    // Verify member count
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 3); // ALICE + BOB + CAROL

    // 3. Create custom folder
    scenario.next_tx(@alice);
    dataroom::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Due Diligence"),
        option::none(),
        types::ROLE_VIEWER(),
        &clock, scenario.ctx(),
    );

    // 4. Store folder keys for BOB and CAROL
    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @bob,
        b"enc_key_bob_32bytes_padding_here",
        &clock, scenario.ctx(),
    );
    dataroom::store_encrypted_folder_key(
        &mut pool, 100, @carol,
        b"enc_key_carol_32byte_padding_ok!",
        &clock, scenario.ctx(),
    );

    // 5. BOB creates a required document
    scenario.next_tx(@bob);
    document::create_document(
        &admin_config, &mut pool,
        100, // custom folder
        types::DOC_TYPE_LEGAL(),
        string::utf8(b"Term Sheet v1"),
        true, // required
        types::ROLE_VIEWER(),
        string::utf8(b"walrus_blob_termsheet_001"),
        b"abcdefghijklmnopqrstuvwxyz012345", // 32 bytes
        4096,
        string::utf8(b"Initial term sheet upload"),
        vector[string::utf8(b"legal"), string::utf8(b"term-sheet")],
        &clock,
        scenario.ctx(),
    );

    // Grab doc_id (we need to track it — use doc_count as proxy)
    let dr2 = pool::borrow_dataroom(&pool);
    assert!(dataroom::doc_count(dr2) == 1);

    // For the test we need the doc_id. In real code, it's emitted via event.
    // Use test helper that returns doc_id:
    let doc_id = test_helpers::last_created_doc_id(&pool);

    // 6. CAROL reviews the document → APPROVED
    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    // Verify approved_count
    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 1);

    // 7. Seal policy: verify access
    assert!(seal_policy::can_access(&pool, @bob, types::ROLE_EDITOR()));
    assert!(seal_policy::can_access(&pool, @carol, types::ROLE_REVIEWER()));
    assert!(!seal_policy::can_access(&pool, @dave, types::ROLE_VIEWER()));

    // 8. ALICE progresses: DRAFT → DD_IN_PROGRESS
    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::state(&pool) == types::pool_dd_in_progress());

    // 9. DD_IN_PROGRESS → IC_REVIEW (all required docs approved)
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_ic_review());

    // 10. Record IC approval → APPROVED_INTERNAL
    pool::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Committee unanimously approves"),
        string::utf8(b"walrus_ic_minutes_pdf"),
        vector[@alice, @bob, @carol],
        vector[1, 1, 1],
        vector[doc_id],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_approved_internal());

    // 11. APPROVED_INTERNAL → READY_TO_ISSUE
    pool::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_ready_to_issue());

    // Cleanup
    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 2: Add rejection + reopen flow test**

```move
/// Rejection flow: create pool → progress to IC → reject → reopen → complete lifecycle
#[test]
fun test_rejection_and_reopen_flow() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add CAROL as reviewer, create required doc, get it reviewed
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    document::create_document(
        &admin_config, &mut pool,
        0, types::DOC_TYPE_FINANCIAL(),
        string::utf8(b"Financials Q4"),
        true, types::ROLE_VIEWER(),
        string::utf8(b"walrus_financials"),
        b"abcdefghijklmnopqrstuvwxyz012345",
        8192,
        string::utf8(b"Q4 financials"),
        vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::last_created_doc_id(&pool);

    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );

    // Progress to IC_REVIEW
    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_ic_review());

    // IC REJECTS
    pool::record_ic_rejection(
        &admin_config, &mut pool,
        string::utf8(b"Risk too high"),
        string::utf8(b"walrus_rejection_pdf"),
        vector[@alice],
        vector[0],
        vector[doc_id],
        &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_rejected());

    // Reopen → DRAFT
    pool::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::state(&pool) == types::pool_draft());

    // Can progress again through full lifecycle
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    pool::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approved on second round"),
        string::utf8(b"walrus_approval_pdf_v2"),
        vector[@alice],
        vector[1],
        vector[doc_id],
        &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_approved_internal());

    pool::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::state(&pool) == types::pool_ready_to_issue());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Run tests**

`Run: sui move test --filter integration`

- [ ] **Step 4: Commit**

```bash
git add tests/integration_tests.move
git commit -m "test: full lifecycle and rejection+reopen integration tests"
```

---

### Task 30: Monkey Tests (Extreme Edge Cases)

**Files:** `tests/monkey_tests.move`

- [ ] **Step 1: Create `tests/monkey_tests.move` — boundary tests**

```move
#[test_only]
module rwa_dataroom::monkey_tests;

use sui::test_scenario;
use sui::clock;
use sui::object;
use std::string;
use std::option;
use std::vector;

use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::document;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::test_helpers;

/// Add members up to the limit, then verify one more fails.
#[test]
#[expected_failure(abort_code = errors::e_max_members_reached())]
fun test_add_199_members_then_one_more_at_limit() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    // max_members = 200, ALICE is already member #1
    let admin_config = admin::create_admin_config_with_max_members_for_testing(200, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    // Add 199 members (addresses 0x2..0xC8) → total 200 = max
    let mut i: u64 = 2;
    while (i <= 200) {
        let addr = test_helpers::addr_from_u64(i);
        dataroom::add_member(
            &admin_config, &mut pool, addr,
            types::ROLE_VIEWER(), vector[],
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 200);

    // Member #201 → abort
    let overflow_addr = test_helpers::addr_from_u64(201);
    dataroom::add_member(
        &admin_config, &mut pool, overflow_addr,
        types::ROLE_VIEWER(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Remove all members except owner, verify owner cannot be removed.
#[test]
fun test_remove_all_members_except_owner() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let addrs = vector[@bob, @carol, @dave];
    let mut i = 0;
    while (i < 3) {
        dataroom::add_member(
            &admin_config, &mut pool, *vector::borrow(&addrs, i),
            types::ROLE_EDITOR(), vector[],
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    // Remove all three
    i = 0;
    while (i < 3) {
        dataroom::remove_member(
            &admin_config, &mut pool, *vector::borrow(&addrs, i),
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 1); // only ALICE

    // All removed members still have records (soft delete)
    assert!(dataroom::has_member(dr, @bob));
    assert!(!dataroom::is_active_member(dr, @bob));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 2: Add version boundary and rapid state transition tests**

```move
/// Add versions up to max-1, then verify one more at max succeeds and max+1 fails.
#[test]
#[expected_failure(abort_code = errors::e_max_versions_reached())]
fun test_add_version_at_max_minus_one_then_one_more() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_with_max_versions_for_testing(5, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    ); // version 1

    // Add versions 2..5 (reaching max=5)
    let mut v = 2;
    while (v <= 5) {
        document::add_version(
            &admin_config, &mut pool, doc_id,
            string::utf8(b"blob_vN"), 
            b"abcdefghijklmnopqrstuvwxyz012345",
            100, string::utf8(b"update"),
            &clock, scenario.ctx(),
        );
        v = v + 1;
    };

    // Version 6 → exceeds max → abort
    document::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_overflow"),
        b"abcdefghijklmnopqrstuvwxyz012345",
        100, string::utf8(b"too many"),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Rapid state transitions: Draft→DD→IC→Approved→Ready in one tx block.
#[test]
fun test_rapid_state_transitions() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Setup: reviewer + approved required doc
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );

    // All transitions in one tx
    scenario.next_tx(@alice);
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    pool::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Fast track"),
        string::utf8(b"pdf"),
        vector[@alice], vector[1], vector[doc_id],
        &clock, scenario.ctx(),
    );
    pool::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    assert!(pool::state(&pool) == types::pool_ready_to_issue());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Create 100 documents in one pool.
#[test]
fun test_create_100_documents_in_one_pool() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    let mut i = 0;
    while (i < 100) {
        document::create_document(
            &admin_config, &mut pool,
            0, types::DOC_TYPE_LEGAL(),
            string::utf8(b"Bulk Doc"),
            false, types::ROLE_VIEWER(),
            string::utf8(b"walrus_bulk_blob"),
            b"abcdefghijklmnopqrstuvwxyz012345",
            512, string::utf8(b"bulk"),
            vector[],
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::doc_count(dr) == 100);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 3: Add review edge case and invalid state transition tests**

```move
/// Review with exactly 32-byte comment hash.
#[test]
fun test_review_with_max_length_comment_hash() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(),
        option::some(b"exactly_32_bytes_of_hash_data!!!"), // 32 bytes
        &clock, scenario.ctx(),
    );

    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Try every invalid state transition pair.
#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_draft_cannot_go_to_ic_review_directly() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // DRAFT → IC_REVIEW (skipping DD) → abort
    scenario.next_tx(@alice);
    pool::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_dd_cannot_go_to_approved_directly() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_dd_in_progress(), &clock, scenario.ctx(),
    );

    // DD → APPROVED_INTERNAL (skipping IC) → abort
    scenario.next_tx(@alice);
    pool::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"nope"), string::utf8(b"pdf"),
        vector[@alice], vector[1], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_ready_to_issue_cannot_be_cancelled() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        @alice, types::pool_ready_to_issue(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@alice);
    pool::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Cancelled pool cannot do anything.
#[test]
#[expected_failure(abort_code = errors::e_invalid_state_transition())]
fun test_cancelled_pool_cannot_progress() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    pool::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    // Try to progress cancelled pool → abort
    pool::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 4: Add double-review overwrite and concurrent reviewer tests**

```move
/// Double review overwrites — second review replaces first.
#[test]
fun test_double_review_overwrites() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // CAROL approves
    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );
    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 1);

    // CAROL changes mind → NEEDS_REVISION (overwrites)
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_needs_revision(), option::none(),
        &clock, scenario.ctx(),
    );
    let doc2 = document::borrow_doc(&pool, doc_id);
    assert!(doc2.approved_count == 0); // decremented from 1 → 0

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// 3 independent reviewers, each submits independently.
#[test]
fun test_concurrent_reviewers_independent_state() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    // Add 3 reviewers
    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::add_member(
        &admin_config, &mut pool, @carol, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::add_member(
        &admin_config, &mut pool, @dave, types::ROLE_REVIEWER(), vector[],
        &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    // BOB approves
    scenario.next_tx(@bob);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );

    // CAROL needs revision
    scenario.next_tx(@carol);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_needs_revision(), option::none(),
        &clock, scenario.ctx(),
    );

    // DAVE approves
    scenario.next_tx(@dave);
    document::submit_review(
        &admin_config, &mut pool, doc_id,
        document::review_approved(), option::none(),
        &clock, scenario.ctx(),
    );

    // 2 approved, 1 needs revision
    let doc = document::borrow_doc(&pool, doc_id);
    assert!(doc.approved_count == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Member removal preserves audit trail (record still in table, just inactive).
#[test]
fun test_member_removal_preserves_audit_trail() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob, types::ROLE_EDITOR(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom::remove_member(
        &admin_config, &mut pool, @bob, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    // Record exists but is inactive
    assert!(dataroom::has_member(dr, @bob));
    assert!(!dataroom::is_active_member(dr, @bob));
    // Active count reflects removal
    assert!(dataroom::member_count(dr) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Zero role bitmask should be rejected.
#[test]
#[expected_failure(abort_code = errors::e_invalid_role())]
fun test_zero_role_bitmask_rejected() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob,
        0u8, // zero bitmask → invalid
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

/// Role 63 (0b00111111) — all permission bits set.
#[test]
fun test_role_63_all_permissions() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@alice, &clock, scenario.ctx());

    scenario.next_tx(@alice);
    dataroom::add_member(
        &admin_config, &mut pool, @bob,
        63u8, // all bits
        vector[],
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    let role = dataroom::get_role(dr, @bob);
    assert!(types::has_role(role, types::ROLE_VIEWER()));
    assert!(types::has_role(role, types::ROLE_EDITOR()));
    assert!(types::has_role(role, types::ROLE_REVIEWER()));
    assert!(types::has_role(role, types::ROLE_OWNER()));
    assert!(types::has_role(role, types::ROLE_ORG_ADMIN()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
```

- [ ] **Step 5: Run all monkey tests**

`Run: sui move test --filter monkey`

- [ ] **Step 6: Commit**

```bash
git add tests/monkey_tests.move
git commit -m "test: monkey tests — boundary limits, invalid transitions, concurrent reviews"
```

- [ ] **Step 7: Run full test suite to verify everything passes**

`Run: sui move test`

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test failures from full suite run"
```
