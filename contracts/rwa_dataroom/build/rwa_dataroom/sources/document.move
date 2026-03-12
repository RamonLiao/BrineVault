module rwa_dataroom::document;

use std::string::String;
use sui::clock::Clock;
use rwa_dataroom::pool::Pool;

// Stub module — full implementation in Chunk 4.

#[test_only]
/// Internal create that returns ID (used by test_helpers).
public fun create_document_internal(
    _pool: &mut Pool,
    _folder_id: u64,
    _doc_type: u8,
    _title: String,
    _required_flag: bool,
    _visible_to_roles: u8,
    _walrus_blob_id: String,
    _content_hash: vector<u8>,
    _size_bytes: u64,
    _change_log: String,
    _tags: vector<String>,
    _uploader: address,
    _clock: &Clock,
    _ctx: &mut TxContext,
): ID {
    // Stub — returns a dummy ID. Full implementation in Chunk 4.
    object::id(_pool)
}

#[test_only]
public fun last_doc_id(_pool: &Pool): ID {
    // Stub — returns pool ID as placeholder. Full implementation in Chunk 4.
    object::id(_pool)
}
