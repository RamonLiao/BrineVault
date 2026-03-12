#[test_only]
module rwa_dataroom::test_helpers;

use sui::clock::Clock;
use std::string;
use rwa_dataroom::pool::{Self, Pool};
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
// Document Helpers (stubs — full implementation in Chunk 4)
// ============================================================

const CONTENT_HASH: vector<u8> = x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

/// Create a test document in the given pool. Returns the document ID.
/// Stub — returns pool ID as placeholder until Chunk 4 entry functions are implemented.
public fun create_test_document(
    pool: &mut Pool,
    _folder_id: u64,
    _uploader: address,
    _clock: &Clock,
    _ctx: &mut TxContext,
): ID {
    object::id(pool)
}

/// Get the ID of the last created document in a pool.
/// Stub — returns pool ID as placeholder until Chunk 4.
public fun last_created_doc_id(pool: &Pool): ID {
    object::id(pool)
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
