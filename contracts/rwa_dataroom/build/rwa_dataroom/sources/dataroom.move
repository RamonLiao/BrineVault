module rwa_dataroom::dataroom;

use sui::table::{Self, Table};
use sui::clock::Clock;
use sui::dynamic_field as df;
use std::string::String;
use rwa_dataroom::types;
use rwa_dataroom::errors;
use rwa_dataroom::events;

// ============================================================
// Constants
// ============================================================

const CUSTOM_FOLDER_START_ID: u64 = 100;

// ============================================================
// Structs
// ============================================================

public struct DataRoom has key, store {
    id: UID,
    pool_id: ID,
    owner: address,
    member_count: u64,
    members: Table<address, Membership>,
    default_folders: vector<String>,
    custom_folder_count: u64,
    seal_policy_id: Option<ID>,
    created_at: u64,
    last_updated_at: u64,
}

public struct Membership has store, drop, copy {
    role: u8,
    added_by: address,
    added_at: u64,
    is_active: bool,
    revoked_at: Option<u64>,
    tags: vector<String>,
}

public struct FolderMeta has store, drop {
    name: String,
    folder_id: u64,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    created_at: u64,
    created_by: address,
}

/// Dynamic-field key for per-member folder encryption keys.
public struct FolderKeyTag has copy, drop, store {
    folder_id: u64,
    member: address,
}

// ============================================================
// Constructor (package-only)
// ============================================================

public(package) fun new(
    pool_id: ID,
    owner: address,
    clock: &Clock,
    ctx: &mut TxContext,
): DataRoom {
    let now = clock.timestamp_ms();
    let mut dataroom = DataRoom {
        id: object::new(ctx),
        pool_id,
        owner,
        member_count: 1,
        members: table::new(ctx),
        default_folders: vector[],
        custom_folder_count: CUSTOM_FOLDER_START_ID,
        seal_policy_id: option::none(),
        created_at: now,
        last_updated_at: now,
    };

    // Add creator as OWNER member
    let membership = Membership {
        role: types::role_owner(),
        added_by: owner,
        added_at: now,
        is_active: true,
        revoked_at: option::none(),
        tags: vector[],
    };
    dataroom.members.add(owner, membership);

    // Create default folders
    create_default_folders(&mut dataroom, owner, now);

    events::emit_member_added(pool_id, owner, types::role_owner(), owner, now);

    dataroom
}

// ============================================================
// Default Folders
// ============================================================

fun create_default_folders(
    dataroom: &mut DataRoom,
    creator: address,
    now: u64,
) {
    let names = vector[
        b"Financial".to_string(),
        b"Legal".to_string(),
        b"KYC".to_string(),
        b"Collateral".to_string(),
        b"Reports".to_string(),
    ];

    let mut i = 0u64;
    while (i < names.length()) {
        let meta = FolderMeta {
            name: names[i],
            folder_id: i,
            parent_id: option::none(),
            visible_to_roles: types::role_all(),
            created_at: now,
            created_by: creator,
        };
        df::add(&mut dataroom.id, i, meta);
        dataroom.default_folders.push_back(names[i]);
        i = i + 1;
    };
}

// ============================================================
// Membership Helpers (package-only)
// ============================================================

public(package) fun assert_member_role(
    dataroom: &DataRoom,
    caller: address,
    required_role: u8,
) {
    assert!(dataroom.members.contains(caller), errors::not_member());
    let m = &dataroom.members[caller];
    assert!(m.is_active, errors::not_member());
    assert!(
        types::has_role(m.role, required_role),
        errors::insufficient_role(),
    );
}

public(package) fun get_role(dataroom: &DataRoom, addr: address): u8 {
    assert!(dataroom.members.contains(addr), errors::not_member());
    let m = &dataroom.members[addr];
    m.role
}

public(package) fun is_active_member(dataroom: &DataRoom, addr: address): bool {
    if (!dataroom.members.contains(addr)) return false;
    let m = &dataroom.members[addr];
    m.is_active
}

// ============================================================
// Member Management (package-only, called by entry fns)
// ============================================================

public(package) fun add_member(
    dataroom: &mut DataRoom,
    addr: address,
    role: u8,
    added_by: address,
    tags: vector<String>,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    assert!(!dataroom.members.contains(addr), errors::member_already_exists());
    assert!(role > 0 && role <= types::role_all(), errors::invalid_role());

    let membership = Membership {
        role,
        added_by,
        added_at: now,
        is_active: true,
        revoked_at: option::none(),
        tags,
    };
    dataroom.members.add(addr, membership);
    dataroom.member_count = dataroom.member_count + 1;
    dataroom.last_updated_at = now;

    events::emit_member_added(dataroom.pool_id, addr, role, added_by, now);
}

public(package) fun revoke_member(
    dataroom: &mut DataRoom,
    addr: address,
    removed_by: address,
    clock: &Clock,
) {
    let now = clock.timestamp_ms();
    assert!(dataroom.members.contains(addr), errors::not_member());
    let m = &mut dataroom.members[addr];
    assert!(m.is_active, errors::not_member());
    m.is_active = false;
    m.revoked_at = option::some(now);
    dataroom.member_count = dataroom.member_count - 1;
    dataroom.last_updated_at = now;

    events::emit_member_removed(dataroom.pool_id, addr, removed_by, now);
}

// ============================================================
// Folder Management (package-only)
// ============================================================

public(package) fun create_custom_folder(
    dataroom: &mut DataRoom,
    name: String,
    parent_id: Option<u64>,
    visible_to_roles: u8,
    creator: address,
    clock: &Clock,
): u64 {
    let now = clock.timestamp_ms();
    let folder_id = dataroom.custom_folder_count;
    dataroom.custom_folder_count = folder_id + 1;

    // If parent_id is set, verify it exists
    if (parent_id.is_some()) {
        let pid = *parent_id.borrow();
        assert!(df::exists_(&dataroom.id, pid), errors::folder_not_found());
    };

    let meta = FolderMeta {
        name,
        folder_id,
        parent_id,
        visible_to_roles,
        created_at: now,
        created_by: creator,
    };
    df::add(&mut dataroom.id, folder_id, meta);
    dataroom.last_updated_at = now;

    events::emit_folder_created(dataroom.pool_id, folder_id, name, parent_id, creator, now);

    folder_id
}

public(package) fun folder_exists(dataroom: &DataRoom, folder_id: u64): bool {
    df::exists_(&dataroom.id, folder_id)
}

// ============================================================
// Folder Key Management (package-only)
// ============================================================

public(package) fun set_folder_key(
    dataroom: &mut DataRoom,
    folder_id: u64,
    member: address,
    encrypted_key: vector<u8>,
) {
    let tag = FolderKeyTag { folder_id, member };
    if (df::exists_(&dataroom.id, tag)) {
        let existing: &mut vector<u8> = df::borrow_mut(&mut dataroom.id, tag);
        *existing = encrypted_key;
    } else {
        df::add(&mut dataroom.id, tag, encrypted_key);
    };
}

public(package) fun get_folder_key(
    dataroom: &DataRoom,
    folder_id: u64,
    member: address,
): &vector<u8> {
    let tag = FolderKeyTag { folder_id, member };
    df::borrow(&dataroom.id, tag)
}

public(package) fun has_folder_key(
    dataroom: &DataRoom,
    folder_id: u64,
    member: address,
): bool {
    let tag = FolderKeyTag { folder_id, member };
    df::exists_(&dataroom.id, tag)
}

// ============================================================
// Seal Policy
// ============================================================

public(package) fun set_seal_policy_id(
    dataroom: &mut DataRoom,
    policy_id: ID,
    clock: &Clock,
) {
    dataroom.seal_policy_id = option::some(policy_id);
    dataroom.last_updated_at = clock.timestamp_ms();
}

// ============================================================
// Accessors
// ============================================================

public fun pool_id(dr: &DataRoom): ID { dr.pool_id }
public fun owner(dr: &DataRoom): address { dr.owner }
public fun member_count(dr: &DataRoom): u64 { dr.member_count }
public fun custom_folder_count(dr: &DataRoom): u64 { dr.custom_folder_count }
public fun seal_policy_id(dr: &DataRoom): &Option<ID> { &dr.seal_policy_id }
public fun created_at(dr: &DataRoom): u64 { dr.created_at }
public fun last_updated_at(dr: &DataRoom): u64 { dr.last_updated_at }
public(package) fun uid(dr: &DataRoom): &UID { &dr.id }
public(package) fun uid_mut(dr: &mut DataRoom): &mut UID { &mut dr.id }

// ============================================================
// Test-only
// ============================================================

#[test_only]
public fun destroy_for_testing(dataroom: DataRoom) {
    let DataRoom { id, members, .. } = dataroom;
    members.drop();
    object::delete(id);
}
