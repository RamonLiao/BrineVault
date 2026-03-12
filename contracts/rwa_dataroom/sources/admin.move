module rwa_dataroom::admin;

use sui::clock::Clock;
use rwa_dataroom::errors;
use rwa_dataroom::events;

// ========== Structs ==========

/// Shared object — one per deployment.
public struct AdminConfig has key {
    id: UID,
    paused: bool,
    pause_authority: address,
    platform_address: address,
    max_members_per_room: u64,
    max_doc_versions: u64,
}

/// Owned capability — held by deployer multi-sig.
public struct AdminCap has key, store {
    id: UID,
}

// ========== Module Initializer ==========

/// Called once on publish. Creates AdminConfig (shared) and AdminCap (to sender).
fun init(ctx: &mut TxContext) {
    let sender = ctx.sender();

    let config = AdminConfig {
        id: object::new(ctx),
        paused: false,
        pause_authority: sender,
        platform_address: sender,
        max_members_per_room: 200,
        max_doc_versions: 500,
    };
    transfer::share_object(config);

    let cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(cap, sender);
}

// ========== Entry Functions ==========

/// Emergency pause — blocks all state-changing entry functions.
public entry fun pause(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(!config.paused, errors::already_paused());
    config.paused = true;

    events::emit_admin_pause_toggled(
        true,
        ctx.sender(),
        clock.timestamp_ms(),
    );
}

/// Resume operations.
public entry fun unpause(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(config.paused, errors::not_paused());
    config.paused = false;

    events::emit_admin_pause_toggled(
        false,
        ctx.sender(),
        clock.timestamp_ms(),
    );
}

/// Update tunable parameters.
public entry fun update_config(
    _cap: &AdminCap,
    config: &mut AdminConfig,
    max_members_per_room: u64,
    max_doc_versions: u64,
    platform_address: address,
    pause_authority: address,
    _ctx: &TxContext,
) {
    assert!(max_members_per_room > 0, errors::invalid_config());
    assert!(max_doc_versions > 0, errors::invalid_config());

    config.max_members_per_room = max_members_per_room;
    config.max_doc_versions = max_doc_versions;
    config.platform_address = platform_address;
    config.pause_authority = pause_authority;
}

// ========== Package-internal Helpers ==========

/// Aborts with EPoolPaused if paused. Called by every state-changing function.
public(package) fun assert_not_paused(config: &AdminConfig) {
    assert!(!config.paused, errors::pool_paused());
}

/// Read accessor: max members per room.
public(package) fun max_members(config: &AdminConfig): u64 {
    config.max_members_per_room
}

/// Read accessor: max document versions.
public(package) fun max_versions(config: &AdminConfig): u64 {
    config.max_doc_versions
}

/// Read accessor: is paused.
public fun is_paused(config: &AdminConfig): bool {
    config.paused
}

/// Read accessor: platform address.
public(package) fun platform_address(config: &AdminConfig): address {
    config.platform_address
}

/// Read accessor: pause authority.
public(package) fun pause_authority(config: &AdminConfig): address {
    config.pause_authority
}

// ========== Test-only ==========

#[test_only]
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun create_admin_config_for_testing(ctx: &mut TxContext): AdminConfig {
    AdminConfig {
        id: object::new(ctx),
        paused: false,
        pause_authority: ctx.sender(),
        platform_address: ctx.sender(),
        max_members_per_room: 200,
        max_doc_versions: 500,
    }
}

#[test_only]
public fun create_admin_config_with_max_members_for_testing(
    max_members: u64,
    ctx: &mut TxContext,
): AdminConfig {
    AdminConfig {
        id: object::new(ctx),
        paused: false,
        pause_authority: ctx.sender(),
        platform_address: ctx.sender(),
        max_members_per_room: max_members,
        max_doc_versions: 500,
    }
}

#[test_only]
public fun create_admin_config_with_max_versions_for_testing(
    max_versions: u64,
    ctx: &mut TxContext,
): AdminConfig {
    AdminConfig {
        id: object::new(ctx),
        paused: false,
        pause_authority: ctx.sender(),
        platform_address: ctx.sender(),
        max_members_per_room: 200,
        max_doc_versions: max_versions,
    }
}

#[test_only]
public fun destroy_admin_config_for_testing(config: AdminConfig) {
    let AdminConfig { id, .. } = config;
    object::delete(id);
}
