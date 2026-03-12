module rwa_dataroom::pool_entry;

use sui::clock::Clock;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;
use rwa_dataroom::admin::{Self, AdminConfig};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::document;
use rwa_dataroom::ic_decision;

// ============================================================
// Task 20: progress_to_dd  (DRAFT → DD_IN_PROGRESS)
// ============================================================

public entry fun progress_to_dd(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_draft());
    pool::set_state(pool, types::pool_state_dd_in_progress(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_draft(),
        types::pool_state_dd_in_progress(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_state_changed(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 21: progress_to_ic_review  (DD_IN_PROGRESS → IC_REVIEW)
// Gate: all required docs must have at least one approved review.
// ============================================================

public entry fun progress_to_ic_review(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_dd_in_progress());

    // Gate: every required doc must have at least one approved review
    assert!(
        all_docs_have_approval(pool, &required_doc_ids),
        errors::required_docs_not_reviewed(),
    );

    pool::set_state(pool, types::pool_state_ic_review(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_dd_in_progress(),
        types::pool_state_ic_review(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_state_changed(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 22: record_ic_approval  (IC_REVIEW → APPROVED_INTERNAL)
// ============================================================

public entry fun record_ic_approval(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_ic_review());

    let idx = pool::ic_decision_count(pool);
    let decision = ic_decision::new(
        idx,
        types::ic_approve(),
        decision_text,
        pdf_blob_id,
        caller,
        committee_members,
        votes,
        now,
        related_doc_ids,
    );
    pool::attach_ic_decision(pool, decision, clock);

    pool::set_state(pool, types::pool_state_approved_internal(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_ic_decision_recorded(pool_id, idx, types::ic_approve(), caller, now);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_ic_review(),
        types::pool_state_approved_internal(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_ic_decision(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 23: record_ic_rejection  (IC_REVIEW → REJECTED)
// ============================================================

public entry fun record_ic_rejection(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_ic_review());

    let idx = pool::ic_decision_count(pool);
    let decision = ic_decision::new(
        idx,
        types::ic_reject(),
        decision_text,
        pdf_blob_id,
        caller,
        committee_members,
        votes,
        now,
        related_doc_ids,
    );
    pool::attach_ic_decision(pool, decision, clock);

    pool::set_state(pool, types::pool_state_rejected(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_ic_decision_recorded(pool_id, idx, types::ic_reject(), caller, now);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_ic_review(),
        types::pool_state_rejected(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_ic_decision(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 24: record_ic_request_changes  (IC_REVIEW → DD_IN_PROGRESS)
// ============================================================

public entry fun record_ic_request_changes(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    decision_text: String,
    pdf_blob_id: String,
    committee_members: vector<address>,
    votes: vector<u8>,
    related_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_ic_review());

    let idx = pool::ic_decision_count(pool);
    let decision = ic_decision::new(
        idx,
        types::ic_request_changes(),
        decision_text,
        pdf_blob_id,
        caller,
        committee_members,
        votes,
        now,
        related_doc_ids,
    );
    pool::attach_ic_decision(pool, decision, clock);

    // Backward transition to DD_IN_PROGRESS
    pool::set_state(pool, types::pool_state_dd_in_progress(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_ic_decision_recorded(pool_id, idx, types::ic_request_changes(), caller, now);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_ic_review(),
        types::pool_state_dd_in_progress(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_ic_decision(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 25: progress_to_ready_to_issue  (APPROVED_INTERNAL → READY_TO_ISSUE)
// Gate: at least one IC approval exists, all required docs approved.
// ============================================================

public entry fun progress_to_ready_to_issue(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    required_doc_ids: vector<ID>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_approved_internal());

    // Gate: must have at least one IC approval
    assert!(pool::has_ic_approval(pool), errors::no_ic_approval());

    // Gate: all required docs approved
    assert!(
        all_docs_have_approval(pool, &required_doc_ids),
        errors::required_docs_not_reviewed(),
    );

    pool::set_state(pool, types::pool_state_ready_to_issue(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_approved_internal(),
        types::pool_state_ready_to_issue(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_state_changed(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 26: cancel_pool  (DRAFT or DD_IN_PROGRESS → CANCELLED)
// ============================================================

public entry fun cancel_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state_one_of(
        pool,
        types::pool_state_draft(),
        types::pool_state_dd_in_progress(),
    );

    let old_state = pool::current_state(pool);
    pool::set_state(pool, types::pool_state_cancelled(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_pool_cancelled(pool_id, caller, now);
    events::emit_pool_state_changed(pool_id, old_state, types::pool_state_cancelled(), caller, now);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_pool_cancelled(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 27: reopen_rejected_pool  (REJECTED → DRAFT)
// ============================================================

public entry fun reopen_rejected_pool(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();
    pool::assert_role(pool, caller, types::role_owner_up());

    pool::assert_state(pool, types::pool_state_rejected());
    pool::set_state(pool, types::pool_state_draft(), clock);

    let pool_id = pool::pool_id(pool);
    events::emit_pool_state_changed(
        pool_id,
        types::pool_state_rejected(),
        types::pool_state_draft(),
        caller,
        now,
    );
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_state_changed(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Internal Helpers
// ============================================================

/// Check that every doc in the list has at least one approved review.
fun all_docs_have_approval(pool: &Pool, doc_ids: &vector<ID>): bool {
    let mut i = 0;
    while (i < doc_ids.length()) {
        let doc_id = doc_ids[i];
        assert!(pool::has_document(pool, doc_id), errors::document_not_found());
        let doc = pool::borrow_document(pool, doc_id);
        if (!document::has_any_approval(doc)) return false;
        i = i + 1;
    };
    true
}
