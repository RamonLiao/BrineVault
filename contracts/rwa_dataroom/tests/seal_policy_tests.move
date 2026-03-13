#[test_only]
module rwa_dataroom::seal_policy_tests;

use sui::test_scenario;
use sui::clock;
use std::string;
use rwa_dataroom::admin;
use rwa_dataroom::types;
use rwa_dataroom::dataroom_entry;
use rwa_dataroom::seal_policy;
use rwa_dataroom::test_helpers;

// ============================================================
// Test 1: Active OWNER can access at all role levels
// ============================================================

#[test]
fun test_can_access_active_member() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // ALICE (@0xA) is OWNER (bitmask=8) — matches OWNER bit only
    assert!(seal_policy::can_access(&pool, @0xA, types::role_owner()));
    // OWNER bit matches role_all() since 8 & 63 > 0
    assert!(seal_policy::can_access(&pool, @0xA, types::role_all()));
    // OWNER bit does NOT match VIEWER/EDITOR/REVIEWER (different bits)
    assert!(!seal_policy::can_access(&pool, @0xA, types::role_viewer()));
    assert!(!seal_policy::can_access(&pool, @0xA, types::role_editor()));
    assert!(!seal_policy::can_access(&pool, @0xA, types::role_reviewer()));

    test_helpers::destroy_pool(pool);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Test 2: Non-member returns false, no abort
// ============================================================

#[test]
fun test_can_access_non_member_returns_false() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // @0xD (dave) was never added — must return false, not abort
    assert!(!seal_policy::can_access(&pool, @0xD, types::role_viewer()));
    assert!(!seal_policy::can_access_folder(&pool, @0xD, types::role_all()));

    test_helpers::destroy_pool(pool);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Test 3: Inactive (removed) member returns false
// ============================================================

#[test]
fun test_can_access_inactive_member_returns_false() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as EDITOR
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );

    // Verify BOB can access (EDITOR bit matches EDITOR)
    assert!(seal_policy::can_access(&pool, @0xB, types::role_editor()));

    // Remove BOB
    scenario.next_tx(@0xA);
    dataroom_entry::remove_member(
        &admin_config, &mut pool, @0xB, &clock, scenario.ctx(),
    );

    // BOB is now inactive — should return false
    assert!(!seal_policy::can_access(&pool, @0xB, types::role_viewer()));
    assert!(!seal_policy::can_access_folder(&pool, @0xB, types::role_all()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Test 4: Insufficient role returns false
// ============================================================

#[test]
fun test_can_access_insufficient_role_returns_false() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as VIEWER (role=1)
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    // VIEWER can access VIEWER level
    assert!(seal_policy::can_access(&pool, @0xB, types::role_viewer()));

    // VIEWER cannot access EDITOR level
    assert!(!seal_policy::can_access(&pool, @0xB, types::role_editor()));

    // VIEWER cannot access OWNER level
    assert!(!seal_policy::can_access(&pool, @0xB, types::role_owner()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Test 5: can_access_folder with role match
// ============================================================

#[test]
fun test_can_access_folder_with_role_match() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as EDITOR (role=4)
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_editor(), vector[],
        &clock, scenario.ctx(),
    );

    // Folder visible to EDITOR (4) — BOB has EDITOR, bitmask match
    assert!(seal_policy::can_access_folder(&pool, @0xB, types::role_editor()));

    // Folder visible to VIEWER (1) — BOB has EDITOR (4), no overlap → false
    assert!(!seal_policy::can_access_folder(&pool, @0xB, types::role_viewer()));

    // Folder visible to ALL (63) — BOB has EDITOR (4), 4 & 63 > 0 → true
    assert!(seal_policy::can_access_folder(&pool, @0xB, types::role_all()));

    // Folder visible to EDITOR|VIEWER (5) — BOB has EDITOR (4), 4 & 5 > 0 → true
    assert!(seal_policy::can_access_folder(&pool, @0xB, 5));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}

// ============================================================
// Test 6: can_access_folder role mismatch + non-member
// ============================================================

#[test]
fun test_can_access_folder_role_mismatch() {
    let mut scenario = test_scenario::begin(@0x1);
    let clock = clock::create_for_testing(scenario.ctx());
    let admin_config = admin::create_admin_config_for_testing(scenario.ctx());
    let mut pool = test_helpers::create_test_pool(@0xA, &clock, scenario.ctx());

    // Add BOB as VIEWER (role=1)
    scenario.next_tx(@0xA);
    dataroom_entry::add_member(
        &admin_config, &mut pool, @0xB, types::role_viewer(), vector[],
        &clock, scenario.ctx(),
    );

    // Folder visible to OWNER only (8) — BOB is VIEWER (1), 1 & 8 = 0 → false
    assert!(!seal_policy::can_access_folder(&pool, @0xB, types::role_owner()));

    // Folder visible to EDITOR only (4) — BOB is VIEWER (1), 1 & 4 = 0 → false
    assert!(!seal_policy::can_access_folder(&pool, @0xB, types::role_editor()));

    // Non-member can't access any folder
    assert!(!seal_policy::can_access_folder(&pool, @0xD, types::role_viewer()));
    assert!(!seal_policy::can_access_folder(&pool, @0xD, types::role_all()));

    test_helpers::destroy_pool(pool);
    admin::destroy_admin_config_for_testing(admin_config);
    clock::destroy_for_testing(clock);
    scenario.end();
}
