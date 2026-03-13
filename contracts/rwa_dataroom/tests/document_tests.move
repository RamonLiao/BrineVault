#[test_only]
module rwa_dataroom::document_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::document;
use rwa_dataroom::document_entry;
use rwa_dataroom::dataroom_entry;
use rwa_dataroom::pool;
use rwa_dataroom::admin;
use rwa_dataroom::types;
use rwa_dataroom::test_helpers;

// ============================================================
// Helpers
// ============================================================

const HASH_32: vector<u8> = x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const HASH_32_V2: vector<u8> = x"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

// ============================================================
// Task 15: create_document tests
// ============================================================

#[test]
fun test_create_document_success() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = document_entry::create_document(
        &admin_config,
        &mut pool,
        0, // default folder (Legal)
        types::doc_type_legal_agreement(),
        string::utf8(b"Term Sheet"),
        true,
        types::role_all(),
        string::utf8(b"walrus_blob_abc123"),
        HASH_32,
        1024,
        string::utf8(b"Initial upload"),
        vector[string::utf8(b"legal")],
        &clock,
        scenario.ctx(),
    );

    // Verify document exists on pool
    assert!(pool::has_document(&pool, doc_id));

    // Verify document fields
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::version_count(doc) == 1);
    assert!(document::current_version(doc) == 1);
    assert!(document::required_flag(doc) == true);
    assert!(document::is_archived(doc) == false);
    assert!(document::folder_id(doc) == 0);
    assert!(document::doc_type(doc) == types::doc_type_legal_agreement());
    assert!(document::created_by(doc) == @0xA1);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_create_document_returns_unique_ids() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id_1 = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());
    let doc_id_2 = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    assert!(doc_id_1 != doc_id_2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_create_document_editor_can_create() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add editor
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xED, types::role_editor(), vector[], &clock, scenario.ctx(),
    );

    // Editor creates doc
    scenario.next_tx(@0xED);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());
    assert!(pool::has_document(&pool, doc_id));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_create_document_viewer_cannot_create() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add viewer
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xBB, types::role_viewer(), vector[], &clock, scenario.ctx(),
    );

    // Viewer tries to create → abort
    scenario.next_tx(@0xBB);
    let _doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_create_document_reviewer_cannot_create() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add reviewer
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xCC, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );

    // Reviewer tries to create → abort
    scenario.next_tx(@0xCC);
    let _doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 306)] // EInvalidContentHashLen
fun test_create_document_invalid_hash_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let _id = document_entry::create_document(
        &admin_config, &mut pool,
        0, types::doc_type_legal_agreement(),
        string::utf8(b"Bad Doc"), false, types::role_all(),
        string::utf8(b"blob"),
        b"too_short", // not 32 bytes
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 304)] // EEmptyBlobId
fun test_create_document_empty_blob_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let _id = document_entry::create_document(
        &admin_config, &mut pool,
        0, types::doc_type_legal_agreement(),
        string::utf8(b"Doc"), false, types::role_all(),
        string::utf8(b""), // empty
        HASH_32,
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 303)] // EInvalidDocType
fun test_create_document_invalid_doc_type_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let _id = document_entry::create_document(
        &admin_config, &mut pool,
        0, 99, // invalid doc_type
        string::utf8(b"Doc"), false, types::role_all(),
        string::utf8(b"blob"),
        HASH_32,
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 400)] // EFolderNotFound
fun test_create_document_invalid_folder_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let _id = document_entry::create_document(
        &admin_config, &mut pool,
        999, // non-existent folder
        types::doc_type_legal_agreement(),
        string::utf8(b"Doc"), false, types::role_all(),
        string::utf8(b"blob"),
        HASH_32,
        100,
        string::utf8(b""),
        vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_create_document_when_paused_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());

    // Create a paused admin config
    admin::init_for_testing(scenario.ctx());
    scenario.next_tx(@0xA1);
    let admin_cap = scenario.take_from_sender<admin::AdminCap>();
    let mut admin_config = scenario.take_shared<admin::AdminConfig>();

    admin::pause(&admin_cap, &mut admin_config, &clock, scenario.ctx());

    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let _id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    test_scenario::return_shared(admin_config);
    transfer::public_transfer(admin_cap, @0xA1);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 16: add_version tests
// ============================================================

#[test]
fun test_add_version_success() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Add version 2
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"walrus_blob_v2"),
        HASH_32_V2,
        2048,
        string::utf8(b"Updated content"),
        &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::version_count(doc) == 2);
    assert!(document::current_version(doc) == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_add_multiple_versions() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Add versions 2, 3, 4
    let mut i = 2u64;
    while (i <= 4) {
        document_entry::add_version(
            &admin_config, &mut pool, doc_id,
            string::utf8(b"blob"),
            HASH_32,
            100,
            string::utf8(b"version update"),
            &clock, scenario.ctx(),
        );
        i = i + 1;
    };

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::version_count(doc) == 4);
    assert!(document::current_version(doc) == 4);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 302)] // EDocumentArchived
fun test_add_version_archived_doc_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Archive it
    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());

    // Try to add version → abort
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"),
        HASH_32,
        100,
        string::utf8(b""),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 301)] // EMaxVersionsReached
fun test_add_version_max_reached_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_with_max_versions_for_testing(2, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());
    // version 1 created, max_versions = 2

    // Add version 2 (now at max)
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"), HASH_32, 100,
        string::utf8(b"v2"), &clock, scenario.ctx(),
    );

    // Add version 3 → exceeds max → abort
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v3"), HASH_32, 100,
        string::utf8(b"v3"), &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 304)] // EEmptyBlobId
fun test_add_version_empty_blob_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b""), // empty
        HASH_32,
        100,
        string::utf8(b""),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 306)] // EInvalidContentHashLen
fun test_add_version_invalid_hash_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob"),
        b"short", // not 32 bytes
        100,
        string::utf8(b""),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 17: submit_review tests
// ============================================================

#[test]
fun test_submit_review_approved() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add reviewer
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xCC, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Reviewer submits APPROVED
    scenario.next_tx(@0xCC);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    // Verify review exists
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::has_approved_review(doc, @0xCC));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_submit_review_needs_revision() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xCC, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    scenario.next_tx(@0xCC);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_needs_revision(),
        option::some(HASH_32),
        &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(!document::has_approved_review(doc, @0xCC));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_submit_review_overwrite_existing() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xCC, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // First review: NEEDS_REVISION
    scenario.next_tx(@0xCC);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_needs_revision(),
        option::none(),
        &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(!document::has_approved_review(doc, @0xCC));

    // Overwrite with APPROVED
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    let doc2 = pool::borrow_document(&pool, doc_id);
    assert!(document::has_approved_review(doc2, @0xCC));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_owner_can_review_others_doc() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add editor who creates doc
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xED, types::role_editor(), vector[], &clock, scenario.ctx(),
    );

    scenario.next_tx(@0xED);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Owner reviews (owner has role_owner which is in role_reviewer_up)
    scenario.next_tx(@0xA1);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::has_approved_review(doc, @0xA1));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 801)] // ESelfReview
fun test_self_review_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Owner creates doc then tries to review own doc → abort
    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_viewer_cannot_review() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xBB, types::role_viewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Viewer tries to review → abort
    scenario.next_tx(@0xBB);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 302)] // EDocumentArchived
fun test_review_archived_doc_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xCC, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Archive
    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());

    // Try to review → abort
    scenario.next_tx(@0xCC);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(),
        option::none(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 18: mark_as_required tests
// ============================================================

#[test]
fun test_mark_required_toggle() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Initially required=true (test helper default)
    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::required_flag(doc) == true);

    // Toggle to false
    document_entry::mark_as_required(&admin_config, &mut pool, doc_id, false, &clock, scenario.ctx());
    let doc2 = pool::borrow_document(&pool, doc_id);
    assert!(document::required_flag(doc2) == false);

    // Toggle back to true
    document_entry::mark_as_required(&admin_config, &mut pool, doc_id, true, &clock, scenario.ctx());
    let doc3 = pool::borrow_document(&pool, doc_id);
    assert!(document::required_flag(doc3) == true);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_mark_required_editor_cannot() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xED, types::role_editor(), vector[], &clock, scenario.ctx(),
    );

    scenario.next_tx(@0xED);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Editor tries to mark_as_required → abort (needs OWNER+)
    document_entry::mark_as_required(&admin_config, &mut pool, doc_id, false, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 300)] // EDocumentNotFound
fun test_mark_required_nonexistent_doc_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    // Use pool ID as fake doc_id
    let fake_doc_id = pool::pool_id(&pool);
    document_entry::mark_as_required(&admin_config, &mut pool, fake_doc_id, false, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 19: archive_document tests
// ============================================================

#[test]
fun test_archive_success() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::is_archived(doc) == true);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 302)] // EDocumentArchived
fun test_archive_already_archived_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());
    // Archive again → abort
    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_archive_editor_cannot() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xED, types::role_editor(), vector[], &clock, scenario.ctx(),
    );

    scenario.next_tx(@0xED);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Editor tries to archive → abort (needs OWNER+)
    document_entry::archive_document(&admin_config, &mut pool, doc_id, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 300)] // EDocumentNotFound
fun test_archive_nonexistent_doc_aborts() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let fake_doc_id = pool::pool_id(&pool);
    document_entry::archive_document(&admin_config, &mut pool, fake_doc_id, &clock, scenario.ctx());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Monkey / Edge Case tests
// ============================================================

#[test]
fun test_create_all_doc_types() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    // Test all 10 doc types (0-9)
    let mut dt = 0u8;
    while (dt <= 9) {
        let _id = document_entry::create_document(
            &admin_config, &mut pool,
            0, dt,
            string::utf8(b"Doc"),
            false, types::role_all(),
            string::utf8(b"blob"),
            HASH_32,
            100,
            string::utf8(b""),
            vector[],
            &clock, scenario.ctx(),
        );
        dt = dt + 1;
    };

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_multiple_reviewers() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xC1, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xC2, types::role_reviewer(), vector[], &clock, scenario.ctx(),
    );
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Both reviewers submit
    scenario.next_tx(@0xC1);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    scenario.next_tx(@0xC2);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_needs_revision(), option::some(HASH_32), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::has_approved_review(doc, @0xC1) == true);
    assert!(document::has_approved_review(doc, @0xC2) == false);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_add_version_then_review_new_uploader() {
    // After a new version is uploaded by a different editor,
    // the original uploader should be able to review (they didn't upload current version).
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Add second editor
    scenario.next_tx(@0xA1);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xED, types::role_editor(), vector[], &clock, scenario.ctx(),
    );

    // Owner creates doc (v1 uploader = @0xA1)
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // Editor uploads v2 (v2 uploader = @0xED)
    scenario.next_tx(@0xED);
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"), HASH_32, 200,
        string::utf8(b"v2"), &clock, scenario.ctx(),
    );

    // Owner can now review (not uploader of current version v2)
    scenario.next_tx(@0xA1);
    document_entry::submit_review(
        &admin_config, &mut pool, doc_id,
        types::review_approved(), option::none(), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::has_approved_review(doc, @0xA1));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_create_document_in_custom_folder() {
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    // Create a custom folder
    scenario.next_tx(@0xA1);
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Custom Folder"),
        option::none(),
        types::role_all(),
        &clock, scenario.ctx(),
    );

    // Create doc in custom folder (id starts at 100)
    let doc_id = test_helpers::create_test_document_in_folder(
        &admin_config, &mut pool, 100, &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::folder_id(doc) == 100);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_max_versions_boundary() {
    // Exactly at max_versions should still work
    let mut scenario = test_scenario::begin(@0xA1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_with_max_versions_for_testing(3, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA1, &clock, scenario.ctx());

    scenario.next_tx(@0xA1);
    let doc_id = test_helpers::create_test_document(&admin_config, &mut pool, &clock, scenario.ctx());

    // v2
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v2"), HASH_32, 100,
        string::utf8(b"v2"), &clock, scenario.ctx(),
    );

    // v3 (at max=3 now)
    document_entry::add_version(
        &admin_config, &mut pool, doc_id,
        string::utf8(b"blob_v3"), HASH_32, 100,
        string::utf8(b"v3"), &clock, scenario.ctx(),
    );

    let doc = pool::borrow_document(&pool, doc_id);
    assert!(document::version_count(doc) == 3);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
