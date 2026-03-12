#[test_only]
module rwa_dataroom::admin_tests;

use sui::test_scenario;
use sui::clock;
use rwa_dataroom::admin::{Self, AdminConfig, AdminCap};

const ADMIN: address = @0xAD;

#[test]
fun test_init_creates_config_and_cap() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let config = test_scenario::take_shared<AdminConfig>(&scenario);
        assert!(!admin::is_paused(&config));
        assert!(admin::max_members(&config) == 200);
        assert!(admin::max_versions(&config) == 500);
        test_scenario::return_shared(config);

        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_pause_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        assert!(admin::is_paused(&config));

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 500)] // EAlreadyPaused
fun test_pause_when_already_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        // Second pause should abort
        admin::pause(&cap, &mut config, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_unpause_success() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        assert!(admin::is_paused(&config));

        admin::unpause(&cap, &mut config, &clk, scenario.ctx());
        assert!(!admin::is_paused(&config));

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 501)] // ENotPaused
fun test_unpause_when_not_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        // Config starts unpaused, unpause should abort
        admin::unpause(&cap, &mut config, &clk, scenario.ctx());

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
fun test_update_config() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            100, // max_members_per_room
            250, // max_doc_versions
            @0xBEEF, // platform_address
            @0xCAFE, // pause_authority
            scenario.ctx(),
        );

        assert!(admin::max_members(&config) == 100);
        assert!(admin::max_versions(&config) == 250);

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 502)] // EInvalidConfig
fun test_update_config_zero_members_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            0, // invalid: zero max_members
            250,
            @0xBEEF,
            @0xCAFE,
            scenario.ctx(),
        );

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 502)] // EInvalidConfig
fun test_update_config_zero_versions_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);

        admin::update_config(
            &cap,
            &mut config,
            100,
            0, // invalid: zero max_doc_versions
            @0xBEEF,
            @0xCAFE,
            scenario.ctx(),
        );

        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}

#[test]
#[expected_failure(abort_code = 101)] // EPoolPaused
fun test_assert_not_paused_when_paused_aborts() {
    let mut scenario = test_scenario::begin(ADMIN);
    {
        admin::init_for_testing(scenario.ctx());
    };
    scenario.next_tx(ADMIN);
    {
        let cap = test_scenario::take_from_sender<AdminCap>(&scenario);
        let mut config = test_scenario::take_shared<AdminConfig>(&scenario);
        let clk = clock::create_for_testing(scenario.ctx());

        admin::pause(&cap, &mut config, &clk, scenario.ctx());
        admin::assert_not_paused(&config); // should abort

        clock::destroy_for_testing(clk);
        test_scenario::return_shared(config);
        test_scenario::return_to_sender(&scenario, cap);
    };
    scenario.end();
}
