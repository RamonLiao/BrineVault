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

public struct DataRoomCreated has copy, drop {
    pool_id: ID,
    dataroom_id: ID,
    owner: address,
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

public struct ICDecisionCreated has copy, drop {
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

public(package) fun emit_dataroom_created(
    pool_id: ID,
    dataroom_id: ID,
    owner: address,
    timestamp: u64,
) {
    event::emit(DataRoomCreated {
        pool_id,
        dataroom_id,
        owner,
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

public(package) fun emit_ic_decision_created(
    pool_id: ID,
    decision_index: u64,
    decision_type: u8,
    created_by: address,
    timestamp: u64,
) {
    event::emit(ICDecisionCreated {
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
