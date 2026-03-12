#[test_only]
module rwa_dataroom::test_helpers;

use sui::clock::Clock;
use std::string;
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::admin::AdminConfig;
use rwa_dataroom::document_entry;
use rwa_dataroom::document;
use rwa_dataroom::types;

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
/// Uses the real create_document entry function.
public fun create_test_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    create_test_document_in_folder(admin_config, pool, 0, clock, ctx)
}

/// Create a test document in a specific folder.
public fun create_test_document_in_folder(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    folder_id: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    document_entry::create_document(
        admin_config,
        pool,
        folder_id,
        types::doc_type_legal_agreement(),
        string::utf8(b"Test Document"),
        true, // required_flag
        types::role_all(), // visible_to_roles
        string::utf8(b"walrus_blob_test_123"),
        CONTENT_HASH,
        1024,
        string::utf8(b"Initial upload"),
        vector[string::utf8(b"test")],
        clock,
        ctx,
    )
}

// ============================================================
// IC Decision Helpers
// ============================================================

/// Record a test IC approval on the pool (creates real ICDecision).
public fun record_test_ic_approval(
    pool: &mut Pool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    pool::record_ic_decision_for_testing(
        pool,
        types::ic_approve(),
        string::utf8(b"Approved by committee"),
        string::utf8(b"walrus_pdf_approval"),
        vector[ctx.sender()],
        vector[1],
        vector[],
        clock,
        ctx,
    );
}

/// Record a test IC rejection on the pool.
public fun record_test_ic_rejection(
    pool: &mut Pool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    pool::record_ic_decision_for_testing(
        pool,
        types::ic_reject(),
        string::utf8(b"Rejected"),
        string::utf8(b"walrus_pdf_rejection"),
        vector[ctx.sender()],
        vector[0],
        vector[],
        clock,
        ctx,
    );
}

/// Create a test document and approve it via review. Returns doc_id.
/// Needs a reviewer (different from pool owner) to already be a member.
public fun create_and_approve_document(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    reviewer: address,
    clock: &Clock,
    ctx: &mut TxContext,
): ID {
    let doc_id = create_test_document(admin_config, pool, clock, ctx);
    // Submit approved review (caller must be the reviewer)
    let doc_mut = pool::borrow_document_mut(pool, doc_id);
    document::submit_review(
        doc_mut,
        reviewer,
        types::review_approved(),
        option::none(),
        clock,
    );
    doc_id
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
