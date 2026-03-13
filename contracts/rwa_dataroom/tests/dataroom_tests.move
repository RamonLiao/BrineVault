#[test_only]
module rwa_dataroom::dataroom_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::admin;
use rwa_dataroom::pool;
use rwa_dataroom::dataroom;
use rwa_dataroom::dataroom_entry;
use rwa_dataroom::types;
use rwa_dataroom::test_helpers;

// ============================================================
// Task 10: add_member tests
// ============================================================

#[test]
fun test_add_member_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // ALICE adds BOB as EDITOR
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config,
        &mut pool,
        @0xB,
        types::role_editor(),
        vector[string::utf8(b"team-a")],
        &clock,
        scenario.ctx(),
    );

    // Assert: BOB is now an active member
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::is_active_member(dr, @0xB));
    assert!(dataroom::member_count(dr) == 2); // ALICE + BOB

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_add_member_not_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as VIEWER first
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    // BOB (VIEWER) tries to add CAROL -> should abort
    scenario.next_tx(@0xB);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xC, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 200)] // EMemberAlreadyExists
fun test_add_member_already_exists_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );
    // Add BOB again -> abort
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 203)] // EMaxMembersReached
fun test_add_member_max_reached_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    // Create admin config with max_members = 2
    let admin_config = admin::create_admin_config_with_max_members_for_testing(2, scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Pool already has ALICE (count=1). Add BOB (count=2 = max).
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );
    // Add CAROL -> exceeds max -> abort
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xC, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_reactivate_revoked_member() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add then remove BOB
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xB, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(!dataroom::is_active_member(dr, @0xB));
    assert!(dataroom::member_count(dr) == 1); // only ALICE

    // Reactivate BOB with EDITOR role
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(),
        vector[string::utf8(b"reinstated")],
        &clock, scenario.ctx(),
    );

    let dr2 = pool::borrow_dataroom(&pool);
    assert!(dataroom::is_active_member(dr2, @0xB));
    assert!(dataroom::get_role(dr2, @0xB) == types::role_editor());
    assert!(dataroom::member_count(dr2) == 2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 601)] // EInvalidRole
fun test_add_member_invalid_role_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, 0, vector[], // role 0 is invalid
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 11: remove_member tests
// ============================================================

#[test]
fun test_remove_member_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );

    // Remove BOB
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xB, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(!dataroom::is_active_member(dr, @0xB));
    assert!(dataroom::member_count(dr) == 1);
    // Record still exists
    assert!(dataroom::has_member(dr, @0xB));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 202)] // ECannotRemoveOwner
fun test_remove_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // ALICE tries to remove herself (owner)
    scenario.next_tx(@0xA);
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xA, &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 2)] // ENotMember
fun test_remove_nonexistent_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xB, &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 12: update_member_role tests
// ============================================================

#[test]
fun test_update_role_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    // Promote BOB to EDITOR
    dataroom_entry::update_member_role(
        &admin_config, &mut pool, @0xB, types::role_editor(),
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::get_role(dr, @0xB) == types::role_editor());

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 802)] // ECannotDemoteOwner
fun test_demote_owner_below_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Try to demote ALICE (owner) to VIEWER
    scenario.next_tx(@0xA);
    dataroom_entry::update_member_role(
        &admin_config, &mut pool, @0xA, types::role_viewer(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 2)] // ENotMember
fun test_update_role_nonexistent_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::update_member_role(
        &admin_config, &mut pool, @0xB, types::role_editor(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 13: create_custom_folder tests
// ============================================================

#[test]
fun test_create_folder_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::create_custom_folder(
        &admin_config,
        &mut pool,
        string::utf8(b"Legal Documents"),
        option::none(),
        types::role_viewer(), // visible to all roles
        &clock,
        scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::folder_exists(dr, 100)); // first custom folder
    assert!(dataroom::custom_folder_count(dr) == 101);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_create_folder_with_parent() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    // Create parent folder (id=100)
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Parent"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );
    // Create child folder (id=101) under parent 100
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Child"),
        option::some(100),
        types::role_editor(),
        &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::folder_exists(dr, 101));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 602)] // EEmptyName
fun test_create_folder_empty_name_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b""), // empty
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 400)] // EFolderNotFound
fun test_create_folder_invalid_parent_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Orphan"),
        option::some(999), // nonexistent parent
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_create_folder_viewer_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as VIEWER
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    // BOB (VIEWER) tries to create folder -> should abort
    scenario.next_tx(@0xB);
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Unauthorized"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Task 14: store_encrypted_folder_key tests
// ============================================================

#[test]
fun test_store_folder_key_success() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB and create a folder
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Encrypted Folder"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    // Store encrypted key for BOB on folder 100
    let fake_key = b"encrypted_aes_key_data_32_bytes!";
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 100, @0xB, fake_key, &clock, scenario.ctx(),
    );

    // Verify key stored
    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::has_folder_key(dr, 100, @0xB));
    let stored_key = dataroom::get_folder_key(dr, 100, @0xB);
    assert!(*stored_key == fake_key);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
fun test_store_folder_key_overwrite() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Folder"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    let key_v1 = b"old_key_padding__old_key_padding!";
    let key_v2 = b"new_key_padding__new_key_padding!";

    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 100, @0xB, key_v1, &clock, scenario.ctx(),
    );
    // Overwrite
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 100, @0xB, key_v2, &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    let stored = dataroom::get_folder_key(dr, 100, @0xB);
    assert!(*stored == key_v2);

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 3)] // EInsufficientRole
fun test_store_folder_key_not_owner_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Folder"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );

    // BOB (EDITOR, not OWNER) tries to store key -> abort
    scenario.next_tx(@0xB);
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 100, @0xB, b"key_data_here___key_data_here___!", &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 400)] // EFolderNotFound
fun test_store_folder_key_nonexistent_folder_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );

    // Try to store key for nonexistent folder 999
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 999, @0xB, b"key_data_here___key_data_here___!", &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 2)] // ENotMember
fun test_store_folder_key_inactive_member_aborts() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );
    dataroom_entry::create_custom_folder(
        &admin_config, &mut pool,
        string::utf8(b"Folder"),
        option::none(),
        types::role_viewer(),
        &clock, scenario.ctx(),
    );
    // Remove BOB
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xB, &clock, scenario.ctx(),
    );

    // Try to store key for revoked BOB
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 100, @0xB, b"key_data_here___key_data_here___!", &clock, scenario.ctx(),
    );

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// store_encrypted_folder_key on default folder (id 0-4)
// ============================================================

#[test]
fun test_store_folder_key_on_default_folder() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Store key for ALICE on default folder 0 ("Legal")
    scenario.next_tx(@0xA);
    dataroom_entry::store_encrypted_folder_key(
        &admin_config, &mut pool, 0, @0xA, b"default_folder_key__padding_here", &clock, scenario.ctx(),
    );

    let dr = pool::borrow_dataroom(&pool);
    assert!(dataroom::has_folder_key(dr, 0, @0xA));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
