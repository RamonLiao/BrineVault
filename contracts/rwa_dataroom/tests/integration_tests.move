#[test_only]
module rwa_dataroom::integration_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::document;
use rwa_dataroom::types;
use rwa_dataroom::pool_entry;
use rwa_dataroom::dataroom_entry;
use rwa_dataroom::document_entry;
use rwa_dataroom::seal_policy;
use rwa_dataroom::test_helpers;

const ALICE: address = @0xA;
const BOB: address = @0xB;
const CAROL: address = @0xC;
const DAVE: address = @0xD;

// ============================================================
// Test 1: Full Lifecycle Happy Path
// DRAFT → DD → IC_REVIEW → APPROVED_INTERNAL → READY_TO_ISSUE
// ============================================================

#[test]
fun test_full_lifecycle_happy_path() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());

    // 1. Create pool with ALICE as OWNER (DRAFT state)
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_draft());

    // 2. Add BOB (EDITOR) and CAROL (REVIEWER)
    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, BOB,
        types::role_editor(), vector[], &clock, scenario.ctx(),
    );
    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, CAROL,
        types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );

    // 3. Verify member_count == 3 (ALICE + BOB + CAROL)
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 3);

    // 4. Create custom folder
    scenario.next_tx(ALICE);
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Due Diligence"),
        option::none(),
        types::role_all(),
        &clock, scenario.ctx(),
    );

    // 5. ALICE creates a required document (in default folder 0)
    scenario.next_tx(ALICE);
    let doc_id = document_entry::create_document(
        &admin_config, &mut pool,
        0, // folder_id (default Financial folder)
        types::doc_type_legal_agreement(),
        string::utf8(b"Master Loan Agreement"),
        true, // required
        types::role_all(),
        string::utf8(b"walrus_blob_mla_001"),
        x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        2048,
        string::utf8(b"Initial version"),
        vector[string::utf8(b"legal"), string::utf8(b"mla")],
        &clock,
        scenario.ctx(),
    );

    // 6. CAROL reviews document (approved) — must switch sender
    scenario.next_tx(CAROL);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    // Verify approval count
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    // 7. Verify seal_policy::can_access
    // BOB is EDITOR (4), CAROL is REVIEWER (2) — bitmask check, not hierarchy
    assert!(seal_policy::can_access(&pool, BOB, types::role_editor()) == true);
    assert!(seal_policy::can_access(&pool, CAROL, types::role_reviewer()) == true);
    // BOB doesn't have OWNER bit
    assert!(seal_policy::can_access(&pool, BOB, types::role_owner()) == false);
    // DAVE is not a member at all
    assert!(seal_policy::can_access(&pool, DAVE, types::role_viewer()) == false);

    // 8. ALICE progresses: DRAFT → DD_IN_PROGRESS
    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    // 9. DD → IC_REVIEW (with required doc list)
    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    // 10. Record IC approval → APPROVED_INTERNAL
    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Unanimous approval"),
        string::utf8(b"walrus_pdf_ic_approval"),
        vector[ALICE, CAROL],
        vector[1, 1],
        vector[doc_id],
        &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());

    // 11. APPROVED_INTERNAL → READY_TO_ISSUE
    scenario.next_tx(ALICE);
    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    // 12. Assert final state
    assert!(pool::current_state(&pool) == types::pool_state_ready_to_issue());

    // Cleanup
    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}

// ============================================================
// Test 2: Rejection and Reopen Flow
// DRAFT → DD → IC_REVIEW → REJECTED → DRAFT → DD → IC_REVIEW
//   → APPROVED_INTERNAL → READY_TO_ISSUE
// ============================================================

#[test]
fun test_rejection_and_reopen_flow() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());

    // 1. Create pool with ALICE as OWNER
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_draft());

    // 2. Add CAROL as REVIEWER
    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, CAROL,
        types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );

    // 3. ALICE creates required doc, CAROL approves it
    scenario.next_tx(ALICE);
    let doc_id = document_entry::create_document(
        &admin_config, &mut pool,
        0,
        types::doc_type_financial_statement(),
        string::utf8(b"Q4 Financial Report"),
        true,
        types::role_all(),
        string::utf8(b"walrus_blob_fin_001"),
        x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        4096,
        string::utf8(b"Q4 report upload"),
        vector[string::utf8(b"financial")],
        &clock,
        scenario.ctx(),
    );

    scenario.next_tx(CAROL);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    // Verify doc approved
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    // 4. Progress DRAFT → DD → IC_REVIEW
    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    // 5. Record IC rejection → REJECTED
    scenario.next_tx(ALICE);
    pool_entry::record_ic_rejection(
        &admin_config, &mut pool,
        string::utf8(b"Insufficient collateral coverage"),
        string::utf8(b"walrus_pdf_ic_rejection"),
        vector[ALICE],
        vector[0],
        vector[doc_id],
        &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_rejected());

    // 6. Reopen → DRAFT
    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_draft());

    // 7. Progress again: DRAFT → DD → IC_REVIEW → APPROVED → READY_TO_ISSUE
    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_dd_in_progress());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_ic_review());

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approved after collateral remediation"),
        string::utf8(b"walrus_pdf_ic_approval_v2"),
        vector[ALICE, CAROL],
        vector[1, 1],
        vector[doc_id],
        &clock, scenario.ctx(),
    );
    assert!(pool::current_state(&pool) == types::pool_state_approved_internal());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ready_to_issue(
        &admin_config, &mut pool, vector[doc_id], &clock, scenario.ctx(),
    );

    // 8. Assert final state
    assert!(pool::current_state(&pool) == types::pool_state_ready_to_issue());

    // Cleanup
    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock.destroy_for_testing();
    scenario.end();
}
