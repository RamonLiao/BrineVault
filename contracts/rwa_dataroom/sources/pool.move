module rwa_dataroom::pool;

use std::string::String;
use sui::clock::Clock;
use sui::dynamic_object_field;
use sui::dynamic_field;
use rwa_dataroom::types;
use rwa_dataroom::dataroom::{Self, DataRoom};

/// Pool — the top-level shared object representing an RWA deal.
public struct Pool has key, store {
    id: UID,
    name: String,
    org_id_hash: vector<u8>,
    borrower_name_hash: vector<u8>,
    currency: String,
    target_notional: u64,
    expected_maturity_date: u64,
    encryption_scheme: u8,
    current_state: u8,
    doc_count: u64,
    ic_decision_count: u64,
    tags: vector<String>,
    created_at: u64,
    created_by: address,
    last_updated_at: u64,
}

// ========== Test-only ==========

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
    let Pool { mut id, .. } = pool;
    // Need to remove DataRoom DOF first
    let dataroom: DataRoom = dynamic_object_field::remove(&mut id, b"dataroom");
    dataroom::destroy_for_testing(dataroom);
    object::delete(id);
}

#[test_only]
public fun record_ic_decision_for_testing(
    pool: &mut Pool,
    _decision_type: u8,
    _decision_text: String,
    _pdf_blob_id: String,
    _committee: vector<address>,
    _votes: vector<u8>,
    _related_doc_ids: vector<ID>,
    _clock: &Clock,
    _ctx: &mut TxContext,
) {
    // Stub — will be fully implemented in Chunk 2 (ic_decision module)
    pool.ic_decision_count = pool.ic_decision_count + 1;
}
