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
