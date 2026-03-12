module rwa_dataroom::dataroom;

use sui::clock::Clock;
use sui::table::{Self, Table};

/// DataRoom — attached to a Pool via dynamic_object_field.
public struct DataRoom has key, store {
    id: UID,
    pool_id: ID,
    members: Table<address, MemberRecord>,
    member_count: u64,
    folder_count: u64,
    created_at: u64,
}

/// Per-member record inside the DataRoom.
public struct MemberRecord has store, drop {
    role: u8,
    added_at: u64,
    added_by: address,
    active: bool,
}

/// Create a new DataRoom (package-internal).
public(package) fun new(
    pool_id: ID,
    creator: address,
    clock: &Clock,
    ctx: &mut TxContext,
): DataRoom {
    let now = clock.timestamp_ms();
    let mut members = table::new<address, MemberRecord>(ctx);
    // Add creator as OWNER
    members.add(creator, MemberRecord {
        role: 8, // ROLE_OWNER
        added_at: now,
        added_by: creator,
        active: true,
    });
    DataRoom {
        id: object::new(ctx),
        pool_id,
        members,
        member_count: 1,
        folder_count: 0,
        created_at: now,
    }
}

#[test_only]
public fun destroy_for_testing(dataroom: DataRoom) {
    let DataRoom { id, members, .. } = dataroom;
    members.drop();
    object::delete(id);
}
