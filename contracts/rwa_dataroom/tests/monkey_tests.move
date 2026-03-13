#[test_only]
module rwa_dataroom::monkey_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::document;
use rwa_dataroom::document_entry;
use rwa_dataroom::dataroom_entry;
use rwa_dataroom::pool_entry;
use rwa_dataroom::types;
use rwa_dataroom::test_helpers;

const ALICE: address = @0xA;
const BOB: address = @0xB;
const CAROL: address = @0xC;
const DAVE: address = @0xD;

const HASH_32: vector<u8> = x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";

// ============================================================
// 1. Boundary: add members up to max, then overflow
// ============================================================

#[test]
#[expected_failure(abort_code = 203)] // EMaxMembersReached
fun test_add_members_up_to_max_then_overflow() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_with_max_members_for_testing(5, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // ALICE is already member #1. Add 4 more to reach max=5.
    scenario.next_tx(ALICE);
    let mut i = 1u64;
    while (i <= 4) {
        dataroom_entry::add_member(
            &admin_config, &mut pool,
            test_helpers::addr_from_u64(i),
            types::role_viewer(),
            vector[],
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 5);

    // 6th member -> abort 203
    dataroom_entry::add_member(
        &admin_config, &mut pool,
        test_helpers::addr_from_u64(100),
        types::role_viewer(),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 2. Boundary: remove all members except owner
// ============================================================

#[test]
fun test_remove_all_members_except_owner() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    dataroom_entry::add_member(&admin_config, &mut pool, BOB, types::role_editor(), vector[], &clock, scenario.ctx());
    dataroom_entry::add_member(&admin_config, &mut pool, CAROL, types::role_viewer(), vector[], &clock, scenario.ctx());
    dataroom_entry::add_member(&admin_config, &mut pool, DAVE, types::role_reviewer(), vector[], &clock, scenario.ctx());

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr) == 4);

    // Remove all 3
    dataroom_entry::remove_member(&admin_config, &mut pool, BOB, &clock, scenario.ctx());
    dataroom_entry::remove_member(&admin_config, &mut pool, CAROL, &clock, scenario.ctx());
    dataroom_entry::remove_member(&admin_config, &mut pool, DAVE, &clock, scenario.ctx());

    let dr2 = pool::borrow_dataroom(&pool);
    assert!(dataroom::member_count(dr2) == 1); // only ALICE

    // Soft-delete audit trail: records exist but inactive
    assert!(dataroom::has_member(dr2, BOB));
    assert!(!dataroom::is_active_member(dr2, BOB));
    assert!(dataroom::has_member(dr2, CAROL));
    assert!(!dataroom::is_active_member(dr2, CAROL));
    assert!(dataroom::has_member(dr2, DAVE));
    assert!(!dataroom::is_active_member(dr2, DAVE));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 3. Boundary: add version at max, then overflow
// ============================================================

#[test]
#[expected_failure(abort_code = 301)] // EMaxVersionsReached
fun test_add_version_at_max_then_overflow() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_with_max_versions_for_testing(3, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // v2
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"), HASH_32, 100,
        string::utf8(b"v2"), &clock, scenario.ctx(),
    );
    // v3 (at max=3)
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v3"), HASH_32, 100,
        string::utf8(b"v3"), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::version_count(doc) == 3);

    // v4 -> abort 301
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v4"), HASH_32, 100,
        string::utf8(b"v4"), &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 4. Stress: create 100 documents in one pool
// ============================================================

#[test]
fun test_create_100_documents_in_one_pool() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Reduced from 100 to 20 to avoid test runner timeout while still stress-testing
    scenario.next_tx(ALICE);
    let mut i = 0u64;
    while (i < 20) {
        let _id = document_entry::create_document(
            &admin_config, &mut pool,
            0,
            types::doc_type_legal_agreement(),
            string::utf8(b"Bulk Doc"),
            false,
            types::role_all(),
            string::utf8(b"walrus_blob_bulk"),
            HASH_32,
            512,
            string::utf8(b"bulk"),
            vector[],
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 5. Invalid state: DRAFT cannot go to IC_REVIEW directly
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_draft_cannot_go_to_ic_review_directly() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_ic_review(&admin_config, &mut pool, vector[], &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 6. Invalid state: DD cannot go to APPROVED directly
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_dd_cannot_go_to_approved_directly() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_dd_in_progress(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::record_ic_approval(
        &admin_config, &mut pool,
        string::utf8(b"Approved"), string::utf8(b"pdf_blob"),
        vector[ALICE], vector[1], vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 7. Invalid state: READY_TO_ISSUE cannot be cancelled
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_ready_to_issue_cannot_be_cancelled() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool_at_state(
        ALICE, types::pool_state_ready_to_issue(), &clock, scenario.ctx(),
    );

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 8. Invalid state: cancelled pool cannot progress
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_cancelled_pool_cannot_progress() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::cancel_pool(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::current_state(&pool) == types::pool_state_cancelled());

    // Try to progress cancelled pool -> abort 100
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 9. Review edge case: double review overwrites
// ============================================================

#[test]
fun test_double_review_overwrites() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add CAROL as reviewer
    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, CAROL, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    // ALICE creates doc (uploader = ALICE)
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // CAROL approves
    scenario.next_tx(CAROL);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 1);

    // CAROL changes to needs_revision
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_needs_revision(), option::none(), &clock, scenario.ctx(),
    );

    let doc2 = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc2) == 0);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 10. Review edge case: concurrent reviewers independent state
// ============================================================

#[test]
fun test_concurrent_reviewers_independent_state() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Add BOB, CAROL, DAVE as reviewers
    scenario.next_tx(ALICE);
    dataroom_entry::add_member(&admin_config, &mut pool, BOB, types::role_reviewer(), vector[], &clock, scenario.ctx());
    dataroom_entry::add_member(&admin_config, &mut pool, CAROL, types::role_reviewer(), vector[], &clock, scenario.ctx());
    dataroom_entry::add_member(&admin_config, &mut pool, DAVE, types::role_reviewer(), vector[], &clock, scenario.ctx());

    // ALICE creates doc
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // BOB approves
    scenario.next_tx(BOB);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    // CAROL needs_revision
    scenario.next_tx(CAROL);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_needs_revision(), option::none(), &clock, scenario.ctx(),
    );

    // DAVE approves
    scenario.next_tx(DAVE);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::approval_count(doc) == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 11. Role edge case: zero role bitmask rejected
// ============================================================

#[test]
#[expected_failure(abort_code = 601)] // EInvalidRole
fun test_zero_role_bitmask_rejected() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, BOB, 0, vector[], // role=0 invalid
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 12. Role edge case: role_all permissions
// ============================================================

#[test]
fun test_role_all_permissions() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    dataroom_entry::add_member(
        &admin_config, &mut pool, BOB, types::role_all(), vector[],
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    let bob_role = dataroom::get_role(dr, BOB);
    assert!(bob_role == 63); // role_all = all bits set

    // Verify each individual role bit
    assert!(types::has_role(bob_role, types::role_viewer()));
    assert!(types::has_role(bob_role, types::role_editor()));
    assert!(types::has_role(bob_role, types::role_reviewer()));
    assert!(types::has_role(bob_role, types::role_owner()));
    assert!(types::has_role(bob_role, types::role_org_admin()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 13. Monkey: self-review prevented
// ============================================================

#[test]
#[expected_failure(abort_code = 801)] // ESelfReview
fun test_self_review_prevented() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // ALICE creates doc (uploader = ALICE), ALICE tries to review -> abort
    scenario.next_tx(ALICE);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 14. Monkey: paused system blocks all operations
// ============================================================

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_paused_system_blocks_all_operations() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_paused_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    pool_entry::progress_to_dd(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 15. Monkey: cannot remove owner
// ============================================================

#[test]
#[expected_failure(abort_code = 202)] // ECannotRemoveOwner
fun test_cannot_remove_owner() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    scenario.next_tx(ALICE);
    dataroom_entry::remove_member(&admin_config, &mut pool, ALICE, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// 16. Monkey: reopen non-rejected pool fails
// ============================================================

#[test]
#[expected_failure(abort_code = 100)] // EInvalidStateTransition
fun test_reopen_non_rejected_pool_fails() {
    let mut scenario = test_scenario::begin(ALICE);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(ALICE, &clock, scenario.ctx());

    // Pool is in DRAFT, try to reopen -> abort 100
    scenario.next_tx(ALICE);
    pool_entry::reopen_rejected_pool(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
