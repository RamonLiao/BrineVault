module rwa_dataroom::dataroom_entry;

use sui::clock::Clock;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;
use rwa_dataroom::admin::{Self, AdminConfig};
use rwa_dataroom::pool::{Self, Pool};
use rwa_dataroom::dataroom;

// ============================================================
// Task 10: add_member
// ============================================================

/// Add a new member to the pool's dataroom, or reactivate a revoked member.
/// Caller must be OWNER or ORG_ADMIN.
public entry fun add_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    role: u8,
    tags: vector<String>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    let dr = pool::borrow_dataroom_mut(pool);

    // Auth: caller must be OWNER or ORG_ADMIN
    dataroom::assert_member_role(dr, caller, types::role_owner_up());

    // Validate role bitmask
    assert!(types::is_valid_role(role), errors::invalid_role());

    if (dataroom::has_member(dr, member_addr)) {
        // If active -> abort duplicate
        assert!(!dataroom::is_active_member(dr, member_addr), errors::member_already_exists());
        // Revoked member -> reactivate
        dataroom::reactivate_member(dr, member_addr, role, caller, tags, clock);
    } else {
        // New member — check max_members
        let member_count = dataroom::member_count(dr);
        let max_members = admin::max_members(admin_config);
        assert!(member_count < max_members, errors::max_members_reached());
        dataroom::add_member(dr, member_addr, role, caller, tags, clock);
    };

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_member_added(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 11: remove_member
// ============================================================

/// Soft-remove a member (set inactive, record revoked_at).
/// Cannot remove the DataRoom owner.
public entry fun remove_member(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    let dr = pool::borrow_dataroom_mut(pool);

    // Auth: caller must be OWNER or ORG_ADMIN
    dataroom::assert_member_role(dr, caller, types::role_owner_up());

    // Cannot remove the owner
    assert!(member_addr != dataroom::owner(dr), errors::cannot_remove_owner());

    // Soft-revoke
    dataroom::revoke_member(dr, member_addr, caller, clock);

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_member_removed(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 12: update_member_role
// ============================================================

/// Update a member's role bitmask.
/// Cannot demote the owner below OWNER role.
public entry fun update_member_role(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    member_addr: address,
    new_role: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    let dr = pool::borrow_dataroom_mut(pool);

    // Auth: caller must be OWNER or ORG_ADMIN
    dataroom::assert_member_role(dr, caller, types::role_owner_up());

    // Validate role bitmask
    assert!(types::is_valid_role(new_role), errors::invalid_role());

    // Cannot demote owner below OWNER
    if (member_addr == dataroom::owner(dr)) {
        assert!(
            types::has_role(new_role, types::role_owner()),
            errors::cannot_demote_owner(),
        );
    };

    // Update role, get old_role for event
    let old_role = dataroom::update_member_role(dr, member_addr, new_role, clock);

    // Events
    let pool_id = pool::pool_id(pool);
    let dr_ref = pool::borrow_dataroom(pool);
    let dataroom_id = dataroom::dataroom_id(dr_ref);
    events::emit_member_role_updated(dataroom_id, member_addr, old_role, new_role, caller, now);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_member_role_updated(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 13: create_custom_folder
// ============================================================

/// Create a custom folder in the dataroom.
/// Caller must be EDITOR or above.
public entry fun create_custom_folder(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    // Validate name non-empty
    assert!(!name.is_empty(), errors::empty_name());

    let dr = pool::borrow_dataroom_mut(pool);

    // Auth: EDITOR+
    dataroom::assert_member_role(dr, caller, types::role_editor_up());

    // Create folder (validates parent internally)
    let _folder_id = dataroom::create_custom_folder(dr, name, parent_id, visible_to_roles, caller, clock);

    // Audit event
    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_folder_created(),
        option::none(),
        now,
        option::none(),
    );
}

// ============================================================
// Task 14: store_encrypted_folder_key
// ============================================================

/// Store an encrypted AES key for a specific folder+member pair.
/// Idempotent: overwrites if the key already exists.
public entry fun store_encrypted_folder_key(
    admin_config: &AdminConfig,
    pool: &mut Pool,
    folder_id: u64,
    member_addr: address,
    encrypted_key: vector<u8>,
    clock: &Clock,
    ctx: &TxContext,
) {
    admin::assert_not_paused(admin_config);
    let caller = ctx.sender();
    let now = clock.timestamp_ms();

    let dr = pool::borrow_dataroom_mut(pool);

    // Auth: OWNER or ORG_ADMIN
    dataroom::assert_member_role(dr, caller, types::role_owner_up());

    // Validate folder exists
    assert!(dataroom::folder_exists(dr, folder_id), errors::folder_not_found());

    // Validate member exists and is active
    assert!(dataroom::is_active_member(dr, member_addr), errors::not_member());

    // Store key (idempotent)
    dataroom::set_folder_key(dr, folder_id, member_addr, encrypted_key);

    // Events
    let dr_ref = pool::borrow_dataroom(pool);
    let dataroom_id = dataroom::dataroom_id(dr_ref);
    events::emit_folder_key_stored(dataroom_id, folder_id, member_addr, caller, now);

    let pool_id = pool::pool_id(pool);
    events::emit_audit_event(
        pool_id,
        caller,
        types::action_member_added(), // closest action type for folder key
        option::none(),
        now,
        option::none(),
    );
}
