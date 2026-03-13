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
use rwa_dataroom::ic_decision::{Self, ICDecision};
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
    has_ic_approval_cached: bool,
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
        has_ic_approval_cached: false,
        last_updated_at: now,
    };

    let pool_id = object::id(&pool);

    // Create DataRoom and attach as dynamic object field
    let dataroom = dataroom::new(pool_id, caller, clock, ctx);
    dof::add(&mut pool.id, b"dataroom", dataroom);

    events::emit_pool_created(pool_id, name, org_id_hash, caller, encryption_scheme, now);

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
    let is_approval = ic_decision::decision_type(&decision) == types::ic_approve();
    let idx = pool.ic_decision_count;
    df::add(&mut pool.id, idx, decision);
    pool.ic_decision_count = idx + 1;
    if (is_approval) {
        pool.has_ic_approval_cached = true;
    };
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
    assert!(is_valid_transition(pool.current_state, new_state), errors::invalid_state_transition());
    pool.current_state = new_state;
    pool.last_updated_at = clock.timestamp_ms();
}

/// Whitelist of legal state transitions.
fun is_valid_transition(from: u8, to: u8): bool {
    let draft = types::pool_state_draft();
    let dd    = types::pool_state_dd_in_progress();
    let ic    = types::pool_state_ic_review();
    let approved = types::pool_state_approved_internal();
    let ready = types::pool_state_ready_to_issue();
    let rejected = types::pool_state_rejected();
    let cancelled = types::pool_state_cancelled();
    let issued = types::pool_state_issued();
    let closed = types::pool_state_closed();

    (from == draft && (to == dd || to == cancelled)) ||
    (from == dd && (to == ic || to == cancelled)) ||
    (from == ic && (to == approved || to == rejected || to == dd)) ||
    (from == approved && to == ready) ||
    (from == ready && to == issued) ||
    (from == rejected && to == draft) ||
    (from == issued && to == closed)
}

// ============================================================
// State Assertions (package-only)
// ============================================================

public(package) fun assert_state(pool: &Pool, expected: u8) {
    assert!(pool.current_state == expected, errors::invalid_state_transition());
}

public(package) fun assert_state_one_of(pool: &Pool, s1: u8, s2: u8) {
    assert!(
        pool.current_state == s1 || pool.current_state == s2,
        errors::invalid_state_transition(),
    );
}

// ============================================================
// IC Decision Query (package-only)
// ============================================================

public(package) fun has_ic_approval(pool: &Pool): bool {
    pool.has_ic_approval_cached
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
public fun has_ic_approval_cached(pool: &Pool): bool { pool.has_ic_approval_cached }
public fun last_updated_at(pool: &Pool): u64 { pool.last_updated_at }
public(package) fun uid(pool: &Pool): &UID { &pool.id }
public(package) fun uid_mut(pool: &mut Pool): &mut UID { &mut pool.id }

// ============================================================
// Test-only
// ============================================================

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
        ic_decision_count: 0,
        has_ic_approval_cached: false,
        tags,
        created_at: now,
        created_by: creator,
        last_updated_at: now,
    };
    // Attach DataRoom as dynamic_object_field
    let dataroom = dataroom::new(object::id(&pool), creator, clock, ctx);
    dof::add(&mut pool.id, b"dataroom", dataroom);
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
    let dataroom: DataRoom = dof::remove(&mut id, b"dataroom");
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
    let idx = pool.ic_decision_count;
    let decision = ic_decision::new(
        idx,
        decision_type,
        decision_text,
        pdf_blob_id,
        ctx.sender(),
        committee,
        votes,
        clock.timestamp_ms(),
        related_doc_ids,
    );
    attach_ic_decision(pool, decision, clock);
}
