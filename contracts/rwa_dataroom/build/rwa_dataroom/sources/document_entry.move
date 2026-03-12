module rwa_dataroom::document_entry;

use sui::clock::Clock;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;
use rwa_dataroom::admin::{Self, AdminConfig};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::dataroom;
use rwa_dataroom::document;

// ============================================================
// Task 15: create_document (returns ID — ERRATA E6)
// ============================================================

/// Create a new document in the pool's dataroom. Returns the new document's ID.
/// Caller must be EDITOR or above.
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
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    {
        let dr = pool::borrow_dataroom(pool);
        dataroom::assert_member_role(dr, caller, types::role_editor_up());
        assert!(dataroom::folder_exists(dr, folder_id), errors::folder_not_found());
    };

    // Validate inputs
    assert!(types::is_valid_doc_type(doc_type), errors::invalid_doc_type());
    assert!(!walrus_blob_id.is_empty(), errors::empty_blob_id());
    // content_hash + doc_type validated inside document::new

    let pool_id = pool::pool_id(pool);
    let encryption_scheme = pool::encryption_scheme(pool);

    // Create Document via package constructor (validates content_hash len internally)
    let doc = document::new(
        pool_id,
        folder_id,
        doc_type,
        title,
        required_flag,
        visible_to_roles,
        encryption_scheme,
        tags,
        walrus_blob_id,
        content_hash,
        size_bytes,
        change_log,
        clock,
        ctx,
    );

    let doc_id = document::doc_id(&doc);

    // Events
    events::emit_document_created(
        pool_id,
        doc_id,
        folder_id,
        doc_type,
        title,
        1, // version
        walrus_blob_id,
        content_hash,
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_doc_created(),
        option::some(doc_id),
        now,
        option::none(),
    );

    // Attach document to pool as dynamic field
    pool::attach_document(pool, doc_id, doc);

    doc_id
}

// ============================================================
// Task 16: add_version
// ============================================================

/// Add a new version to an existing document.
/// Caller must be EDITOR or above. Document must not be archived.
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
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    {
        let dr = pool::borrow_dataroom(pool);
        dataroom::assert_member_role(dr, caller, types::role_editor_up());
    };

    // Validate inputs
    assert!(!walrus_blob_id.is_empty(), errors::empty_blob_id());

    // Max versions check
    let max_versions = admin::max_versions(admin_config);
    let doc = pool::borrow_document(pool, doc_id);
    assert!(document::version_count(doc) < max_versions, errors::max_versions_reached());

    // Mutably borrow and add version (validates archived + content_hash internally)
    let doc_mut = pool::borrow_document_mut(pool, doc_id);
    document::add_version(doc_mut, walrus_blob_id, content_hash, size_bytes, change_log, clock, ctx);

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_doc_version_added(),
        option::some(doc_id),
        now,
        option::none(),
    );
}

// ============================================================
// Task 17: submit_review
// ============================================================

/// Submit a review for a document.
/// Caller must be REVIEWER or above. Cannot self-review (reviewer != current version uploader).
public entry fun submit_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    status: u8,
    comment_hash: Option<vector<u8>>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    {
        let dr = pool::borrow_dataroom(pool);
        dataroom::assert_member_role(dr, caller, types::role_reviewer_up());
    };

    // Self-review prevention: reviewer != uploader of current version
    let doc = pool::borrow_document(pool, doc_id);
    let uploader = document::current_version_uploader(doc);
    assert!(caller != uploader, errors::self_review());

    // Mutably borrow and submit review (validates archived, status, comment_hash internally)
    let doc_mut = pool::borrow_document_mut(pool, doc_id);
    document::submit_review(doc_mut, caller, status, comment_hash, clock);

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_doc_reviewed(),
        option::some(doc_id),
        now,
        option::none(),
    );
}

// ============================================================
// Task 18: mark_as_required
// ============================================================

/// Toggle the required_flag on a document.
/// Caller must be OWNER or above.
public entry fun mark_as_required(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    required: bool,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    {
        let dr = pool::borrow_dataroom(pool);
        dataroom::assert_member_role(dr, caller, types::role_owner_up());
    };

    assert!(pool::has_document(pool, doc_id), errors::document_not_found());

    let doc_mut = pool::borrow_document_mut(pool, doc_id);
    document::set_required_flag(doc_mut, required, clock);

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_doc_created(), // reuse closest action type
        option::some(doc_id),
        now,
        option::none(),
    );
}

// ============================================================
// Task 19: archive_document
// ============================================================

/// Archive a document. Archived documents cannot have new versions or reviews.
/// Caller must be OWNER or above.
public entry fun archive_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    doc_id: ID,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    {
        let dr = pool::borrow_dataroom(pool);
        dataroom::assert_member_role(dr, caller, types::role_owner_up());
    };

    assert!(pool::has_document(pool, doc_id), errors::document_not_found());

    let doc = pool::borrow_document(pool, doc_id);
    assert!(!document::is_archived(doc), errors::document_archived());

    let doc_mut = pool::borrow_document_mut(pool, doc_id);
    document::archive(doc_mut, clock);

    // Events
    let pool_id = pool::pool_id(pool);
    events::emit_document_archived(pool_id, doc_id, caller, now);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_doc_archived(),
        option::some(doc_id),
        now,
        option::none(),
    );
}
