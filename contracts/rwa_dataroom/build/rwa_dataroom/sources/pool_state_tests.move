#[test_only]
module rwa_dataroom::pool_state_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::document;
use rwa_dataroom::types;
use rwa_dataroom::pool_entry;
use rwa_dataroom::test_helpers;

const ALICE: address = @0xA;
const BOB: address = @0xB;
const CAROL: address = @0xC;

// ============================================================
// Task 20: progress_to_dd
// ============================================================

#[test]
fun test_progress_to_dd_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_progress_to_dd_wrong_state_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Advance to DD first
    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    // Try DD → DD again → abort
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_progress_to_dd_non_owner_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add BOB as viewer
    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, BOB, types::role_viewer(), ALICE, vector[], &clock);

    // BOB tries to progress → abort (not OWNER)
    scenario.next_tx(BOB);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 21: progress_to_ic_review
// ============================================================

#[test]
fun test_progress_to_ic_review_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add reviewer
    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    // Create doc and approve it
    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_and_approve_document(
        &admin_config, &mut pool, CAROL, &clock, scenario.ctx(),
    );

    // DRAFT → DD → IC_REVIEW
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_progress_to_ic_review_no_required_docs() {
    // If no required_doc_ids passed, gate is trivially satisfied
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_dd_in_progress(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 700)] // ERequiredDocsNotReviewed
fun test_progress_to_ic_review_unapproved_doc_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Create doc but NO review
    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    // Try to progress with unapproved doc → abort
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_progress_to_ic_review_wrong_state_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Still in DRAFT, try to jump to IC_REVIEW → abort
    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 22: record_ic_approval
// ============================================================

#[test]
fun test_record_ic_approval_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config,
        &mut pool,
        string::utf8(b"Approved by committee"),
        string::utf8(b"walrus_pdf_blob_id"),
        vector[ALICE, BOB, CAROL],
        vector[1, 1, 0],
        vector[],
        &clock,
        scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());
    assert!(pool::ic_decision_count(&pool) == 1);
    assert!(pool::has_ic_approval(&pool));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_record_ic_approval_wrong_state_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx()); // DRAFT

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config,
        &mut pool,
        string::utf8(b"Approve"),
        string::utf8(b"pdf"),
        vector[ALICE],
        vector[1],
        vector[],
        &clock,
        scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 604)] // EEmptyCommittee
fun test_record_ic_approval_empty_committee_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config,
        &mut pool,
        string::utf8(b"Approve"),
        string::utf8(b"pdf"),
        vector[], // empty committee
        vector[],
        vector[],
        &clock,
        scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 23: record_ic_rejection
// ============================================================

#[test]
fun test_record_ic_rejection_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_rejection(
        &admin_config,
        &mut pool,
        string::utf8(b"Insufficient documentation"),
        string::utf8(b"walrus_pdf_rejection"),
        vector[ALICE, BOB],
        vector[0, 0],
        vector[],
        &clock,
        scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_rejected());
    assert!(pool::ic_decision_count(&pool) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 502)] // EInvalidConfig (votes/members mismatch)
fun test_record_ic_rejection_votes_mismatch_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_rejection(
        &admin_config,
        &mut pool,
        string::utf8(b"Reject"),
        string::utf8(b"pdf"),
        vector[ALICE, BOB],
        vector[0], // only 1 vote for 2 members
        vector[],
        &clock,
        scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 24: record_ic_request_changes
// ============================================================

#[test]
fun test_record_ic_request_changes_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_request_changes(
        &admin_config,
        &mut pool,
        string::utf8(b"Need updated financials"),
        string::utf8(b"walrus_pdf_changes"),
        vector[ALICE],
        vector[2],
        vector[],
        &clock,
        scenario.ctx(),
    );

    // Goes back to DD_IN_PROGRESS
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());
    assert!(pool::ic_decision_count(&pool) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 25: progress_to_ready_to_issue
// ============================================================

#[test]
fun test_progress_to_ready_to_issue_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_approved_internal(), &clock, scenario.ctx(),
    );

    // Record an IC approval so the gate passes
    scenario.next_tx(ALICE);
    test_helpers::record_test_ic_approval(&mut pool, &clock, scenario.ctx());

    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_ready_to_issue());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 800)] // ENoICApproval
fun test_progress_to_ready_no_ic_approval_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_approved_internal(), &clock, scenario.ctx(),
    );

    // No IC decision recorded
    scenario.next_tx(ALICE);
    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 800)] // ENoICApproval
fun test_progress_to_ready_only_rejection_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_approved_internal(), &clock, scenario.ctx(),
    );

    // Record a rejection (not approval)
    scenario.next_tx(ALICE);
    test_helpers::record_test_ic_rejection(&mut pool, &clock, scenario.ctx());

    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 700)] // ERequiredDocsNotReviewed
fun test_progress_to_ready_unapproved_docs_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_approved_internal(), &clock, scenario.ctx(),
    );

    // Record IC approval
    scenario.next_tx(ALICE);
    test_helpers::record_test_ic_approval(&mut pool, &clock, scenario.ctx());

    // Create doc but no review
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 26: cancel_pool
// ============================================================

#[test]
fun test_cancel_from_draft() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::current_state(&pool) == types::pool_state_cancelled());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_cancel_from_dd() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::current_state(&pool) == types::pool_state_cancelled());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_cancel_from_ic_review_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_cancel_from_cancelled_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_cancelled(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Task 27: reopen_rejected_pool
// ============================================================

#[test]
fun test_reopen_rejected_success() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_rejected(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(pool::current_state(&pool) == types::pool_state_draft());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_reopen_from_draft_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx()); // DRAFT

    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_reopen_from_cancelled_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_cancelled(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Monkey Tests: Full Cycle & Edge Cases
// ============================================================

#[test]
fun test_full_lifecycle_draft_to_ready_to_issue() {
    // DRAFT → DD → IC_REVIEW → APPROVED_INTERNAL → READY_TO_ISSUE
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add reviewer
    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    // Create and approve doc
    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_and_approve_document(
        &admin_config, &mut pool, CAROL, &clock, scenario.ctx(),
    );

    // DRAFT → DD
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    // DD → IC_REVIEW
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    // IC_REVIEW → APPROVED_INTERNAL
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approved"),
        string::utf8(b"pdf"),
        vector[ALICE, BOB],
        vector[1, 1],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());

    // APPROVED_INTERNAL → READY_TO_ISSUE
    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ready_to_issue());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_ic_request_changes_then_resubmit() {
    // IC_REVIEW → (request changes) → DD_IN_PROGRESS → IC_REVIEW → APPROVED
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    // Request changes → back to DD
    scenario.next_tx(ALICE);
    pool_entry::record_ic_request_changes(
        &admin_config, &mut pool,
        string::utf8(b"Need more data"),
        string::utf8(b"pdf"),
        vector[ALICE],
        vector[2],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());
    assert!(pool::ic_decision_count(&pool) == 1);

    // DD → IC_REVIEW again (no required docs for simplicity)
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    // Now approve
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approved after revision"),
        string::utf8(b"pdf2"),
        vector[ALICE],
        vector[1],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());
    assert!(pool::ic_decision_count(&pool) == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_reject_then_reopen_then_full_cycle() {
    // REJECTED → DRAFT → DD → IC_REVIEW → APPROVED
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_rejected(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_draft());

    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Finally approved"),
        string::utf8(b"pdf"),
        vector[ALICE],
        vector[1],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_double_cancel_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    // Already CANCELLED → abort
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_progress_to_dd_from_ready_to_issue_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ready_to_issue(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_multiple_ic_decisions_before_approval() {
    // IC_REVIEW → request_changes → DD → IC_REVIEW → reject → (manually set IC_REVIEW) → approve
    // Tests that ic_decision_count accumulates
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    // First: request changes
    scenario.next_tx(ALICE);
    pool_entry::record_ic_request_changes(
        &admin_config, &mut pool,
        string::utf8(b"Changes needed"),
        string::utf8(b"pdf1"),
        vector[ALICE],
        vector[2],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::ic_decision_count(&pool) == 1);

    // Back to IC_REVIEW
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    // Second: approve
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Now approved"),
        string::utf8(b"pdf2"),
        vector[ALICE, BOB],
        vector[1, 1],
        vector[],
        &clock,
        scenario.ctx(),
    );
    assert!(pool::ic_decision_count(&pool) == 2);
    assert!(pool::has_ic_approval(&pool));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_approval_count_tracks_review_changes() {
    // Verify approval_count correctly tracks when reviews change status
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add reviewer
    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    // Create doc
    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Approve
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_approved(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);
    assert!(document::has_any_approval(doc));

    // Change to needs_revision (overwrite)
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_needs_revision(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 0);
    assert!(!document::has_any_approval(doc));

    // Re-approve
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_approved(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 2)] // ENotMember
fun test_non_member_cannot_progress() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // BOB is not a member
    scenario.next_tx(BOB);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// S1: Paused admin blocks state transitions
// ============================================================

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_progress_to_dd_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_paused_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_cancel_pool_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_paused_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_record_ic_approval_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_paused_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approve"), string::utf8(b"pdf"),
        vector[ALICE], vector[1], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_reopen_rejected_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_paused_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_rejected(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// S2: Mixed approved/unapproved docs
// ============================================================

#[test]
#[expected_failure(abort_code = 700)] // ERequiredDocsNotReviewed
fun test_progress_to_ic_review_mixed_approval_aborts() {
    // 2 docs: 1 approved, 1 not → should abort
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    // Doc 1: approved
    scenario.next_tx(ALICE);
    let doc_id_1 = test_helpers::create_and_approve_document(
        &admin_config, &mut pool, CAROL, &clock, scenario.ctx(),
    );

    // Doc 2: NOT approved
    let doc_id_2 = test_helpers::create_test_document(
        &admin_config, &mut pool, &clock, scenario.ctx(),
    );

    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    // Should abort — doc_id_2 has no approval
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id_1, doc_id_2], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_progress_to_ic_review_all_approved_passes() {
    // 2 docs: both approved → should pass
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    scenario.next_tx(ALICE);
    let doc_id_1 = test_helpers::create_and_approve_document(
        &admin_config, &mut pool, CAROL, &clock, scenario.ctx(),
    );
    let doc_id_2 = test_helpers::create_and_approve_document(
        &admin_config, &mut pool, CAROL, &clock, scenario.ctx(),
    );

    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id_1, doc_id_2], &clock, scenario.ctx(),
    );

    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// S3: IC actions from wrong states (beyond basic wrong state)
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_record_ic_approval_from_approved_internal_aborts() {
    // Already APPROVED_INTERNAL, try to record IC approval again → abort
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_approved_internal(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Double approve"), string::utf8(b"pdf"),
        vector[ALICE], vector[1], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_record_ic_rejection_from_dd_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_dd_in_progress(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_rejection(
        &admin_config, &mut pool,
        string::utf8(b"Reject from DD"), string::utf8(b"pdf"),
        vector[ALICE], vector[0], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_record_ic_request_changes_from_rejected_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_rejected(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_request_changes(
        &admin_config, &mut pool,
        string::utf8(b"Changes from rejected"), string::utf8(b"pdf"),
        vector[ALICE], vector[2], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// S4: Multi-reviewer approval_count tracking
// ============================================================

#[test]
fun test_multi_reviewer_approval_count() {
    // CAROL approves, BOB approves → count=2
    // CAROL changes to needs_revision → count=1
    // BOB still approved → has_any_approval true
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);
    dataroom::add_member(dr, BOB, types::role_reviewer(), ALICE, vector[], &clock);

    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // CAROL approves
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_approved(), option::none(), &clock);

    // BOB approves
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, BOB, types::review_approved(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 2);

    // CAROL changes to needs_revision
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_needs_revision(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);
    assert!(document::has_any_approval(doc)); // BOB still approved

    // BOB also changes to needs_revision
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, BOB, types::review_needs_revision(), option::none(), &clock);

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 0);
    assert!(!document::has_any_approval(doc));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// More Monkey Tests
// ============================================================

#[test]
#[expected_failure(abort_code = 300)] // EDocumentNotFound
fun test_progress_to_ic_review_nonexistent_doc_aborts() {
    // Pass a doc_id that doesn't exist on the pool
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_dd_in_progress(), &clock, scenario.ctx(),
    );

    let fake_doc_id = object::id_from_address(@0xDEAD);

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[fake_doc_id], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 604)] // EEmptyCommittee (now from ic_decision::new)
fun test_ic_decision_empty_committee_from_constructor_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_rejection(
        &admin_config, &mut pool,
        string::utf8(b"Reject"), string::utf8(b"pdf"),
        vector[], vector[], vector[], // empty committee
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_progress_to_ready_from_draft_aborts() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[], &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_cancel_then_cannot_reopen() {
    // Cancelled is a terminal state — reopen only works from REJECTED
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_cancelled());

    // Verify we can't progress from cancelled
    // (already covered by test_cancel_from_cancelled_aborts for cancel,
    //  and test_reopen_from_cancelled_aborts for reopen)

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_editor_cannot_record_ic_approval() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ic_review(), &clock, scenario.ctx(),
    );

    // Add BOB as editor
    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, BOB, types::role_editor(), ALICE, vector[], &clock);

    // Editor tries IC approval → abort (needs OWNER_UP)
    scenario.next_tx(BOB);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approve"), string::utf8(b"pdf"),
        vector[BOB], vector[1], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_reviewer_cannot_cancel_pool() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, BOB, types::role_reviewer(), ALICE, vector[], &clock);

    scenario.next_tx(BOB);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

#[test]
fun test_approval_overwrite_same_status_no_change() {
    // Approving twice doesn't double-count
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    let dr = pool::borrow_dataroom_mut(&mut pool);
    dataroom::add_member(dr, CAROL, types::role_reviewer(), ALICE, vector[], &clock);

    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // CAROL approves
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_approved(), option::none(), &clock);
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    // CAROL approves again (overwrite) — count should stay 1
    let doc_mut = pool::borrow_document_mut(&mut pool, doc_id);
    document::submit_review(doc_mut, CAROL, types::review_approved(), option::none(), &clock);
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}
