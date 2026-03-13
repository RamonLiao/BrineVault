module rwa_dataroom::types;

// ========== Role Bitmask ==========
const ROLE_VIEWER:    u8 = 1;
const ROLE_REVIEWER:  u8 = 2;
const ROLE_EDITOR:    u8 = 4;
const ROLE_OWNER:     u8 = 8;
const ROLE_AUDITOR:   u8 = 16;
const ROLE_ORG_ADMIN: u8 = 32;

const ROLE_REVIEWER_UP: u8 = 42; // REVIEWER | OWNER | ORG_ADMIN (EDITOR is lateral, not above REVIEWER)
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

public fun is_valid_role(role: u8): bool {
    role > 0 && role <= ROLE_ALL
}

// ========== Assert Helpers ==========
public fun assert_valid_encryption_scheme(scheme: u8) {
    assert!(is_valid_encryption_scheme(scheme), 600); // EInvalidEncryptionScheme
}

public fun assert_valid_pool_state(state: u8) {
    assert!(is_valid_pool_state(state), 100); // EInvalidStateTransition
}

public fun assert_valid_doc_type(doc_type: u8) {
    assert!(is_valid_doc_type(doc_type), 303); // EInvalidDocType
}

public fun assert_valid_review_status(status: u8) {
    assert!(status <= REVIEW_NEEDS_REVISION, 601); // EInvalidRole (reuse for invalid status)
}

// ========== Accessor constants (public) ==========
public fun role_viewer(): u8 { ROLE_VIEWER }
public fun role_reviewer(): u8 { ROLE_REVIEWER }
public fun role_editor(): u8 { ROLE_EDITOR }
public fun role_owner(): u8 { ROLE_OWNER }
public fun role_auditor(): u8 { ROLE_AUDITOR }
public fun role_org_admin(): u8 { ROLE_ORG_ADMIN }
public fun role_reviewer_up(): u8 { ROLE_REVIEWER_UP }
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
