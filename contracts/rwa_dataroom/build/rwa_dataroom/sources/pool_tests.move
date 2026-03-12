#[test_only]
module rwa_dataroom::pool_tests;

use sui::test_scenario;
use sui::clock;
use rwa_dataroom::admin::{Self, AdminConfig, AdminCap};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::dataroom;
use rwa_dataroom::types;

const ADMIN: address = @0xAD;
const ALICE: address = @0xA;

// Reusable 32-byte hashes
const ORG_HASH: vector<u8> = x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const BORROWER_HASH: vector<u8> = x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// ============================================================
// Helpers
// ============================================================

#[test_only]
fun setup_admin(scenario: &mut test_scenario::Scenario) {
    scenario.next_tx(ADMIN);
    admin::init_for_testing(scenario.ctx());
}

#[test_only]
fun create_test_pool(scenario: &mut test_scenario::Scenario) {
    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Test Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0, // AES
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
}

// ============================================================
// Tests
// ============================================================

#[test]
fun test_create_pool_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    // Verify pool state
    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        assert!(pool::current_state(&pool) == types::pool_state_draft());
        assert!(pool::created_by(&pool) == ALICE);
        assert!(pool::encryption_scheme(&pool) == 0);

        // Verify DataRoom attached with ALICE as OWNER
        let dr = pool::borrow_dataroom(&pool);
        assert!(dataroom::is_active_member(dr, ALICE));
        assert!(dataroom::get_role(dr, ALICE) == types::role_owner());
        assert!(dataroom::member_count(dr) == 1);
        assert!(dataroom::owner(dr) == ALICE);

        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
#[expected_failure]
fun test_create_pool_invalid_encryption_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Bad Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            99, // invalid encryption scheme
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 603)] // EInvalidHashLength
fun test_create_pool_invalid_hash_length_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            x"aabbccdd", // only 4 bytes, not 32
            b"Bad Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0,
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
#[expected_failure] // EPaused
fun test_create_pool_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);

    // Pause the system
    scenario.next_tx(ADMIN);
    {
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(500);
        admin::pause(&cap, &mut config, &c, scenario.ctx());
        c.destroy_for_testing();
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };

    // Attempt to create pool while paused
    scenario.next_tx(ALICE);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        let mut c = clock::create_for_testing(scenario.ctx());
        c.increment_for_testing(1000);

        pool::create_pool(
            &config,
            ORG_HASH,
            b"Paused Pool".to_string(),
            BORROWER_HASH,
            b"USD".to_string(),
            1_000_000,
            2_000_000_000,
            0,
            vector[],
            &c,
            scenario.ctx(),
        );

        c.destroy_for_testing();
        test_scenario::return_shared(config);
    };
    scenario.end();
}

#[test]
fun test_borrow_dataroom_returns_correct_ref() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        let dr = pool::borrow_dataroom(&pool);

        // DataRoom's pool_id should match Pool's id
        assert!(dataroom::pool_id(dr) == pool::pool_id(&pool));

        // Default folders: 5 folders (IDs 0-4), custom_folder_count starts at 100
        assert!(dataroom::custom_folder_count(dr) == 100);

        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
fun test_pool_assert_role_owner_passes() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        // ALICE is OWNER (bitmask 8), should pass owner role check
        pool::assert_role(&pool, ALICE, types::role_owner());
        test_scenario::return_shared(pool);
    };
    scenario.end();
}

#[test]
#[expected_failure] // ENotMember
fun test_pool_assert_role_non_member_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    setup_admin(&mut scenario);
    create_test_pool(&mut scenario);

    scenario.next_tx(ALICE);
    {
        let pool = test_scenario::take_shared<Pool>(&scenario);
        let bob = @0xB;
        pool::assert_role(&pool, bob, types::role_viewer());
        test_scenario::return_shared(pool);
    };
    scenario.end();
}
