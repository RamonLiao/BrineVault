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

/// Dynamic-field key for looking up Documents by their ID on a Pool.
public struct DocKey has copy, drop, store {
    doc_id: ID,
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
    assert!(content_hash.length() == 32, errors::invalid_content_hash_len());

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
    assert!(content_hash.length() == 32, errors::invalid_content_hash_len());

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
        walrus_blob_id,
        content_hash,
        ctx.sender(),
        now,
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
        assert!(comment_hash.borrow().length() == 32, errors::invalid_content_hash_len());
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
        now,
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

/// Get the uploader of the current version (for self-review prevention).
public(package) fun current_version_uploader(doc: &Document): address {
    let ver: &DocVersion = df::borrow(&doc.id, doc.current_version);
    ver.uploaded_by
}

/// Set the required_flag on a document.
public(package) fun set_required_flag(doc: &mut Document, required: bool, clock: &Clock) {
    doc.required_flag = required;
    doc.last_updated_at = clock.timestamp_ms();
}

