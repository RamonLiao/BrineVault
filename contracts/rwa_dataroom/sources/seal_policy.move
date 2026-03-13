module rwa_dataroom::seal_policy;

use rwa_dataroom::dataroom;
use rwa_dataroom::types;
use rwa_dataroom::pool::{Self, Pool};

/// Check if caller is an active member with at least min_role.
/// Used by Seal to gate decryption of pool-level content.
/// Returns false (no abort) for non-members.
public fun can_access(
    pool: &Pool,
    caller: address,
    min_role: u8,
): bool {
    let dataroom = pool::borrow_dataroom(pool);
    if (!dataroom::is_active_member(dataroom, caller)) return false;
    types::has_role(dataroom::get_role(dataroom, caller), min_role)
}

/// Check if caller can access a specific folder based on role visibility mask.
/// Used by Seal to gate decryption of folder-specific encrypted keys.
/// Returns false (no abort) for non-members.
public fun can_access_folder(
    pool: &Pool,
    caller: address,
    folder_visible_to_roles: u8,
): bool {
    let dataroom = pool::borrow_dataroom(pool);
    if (!dataroom::is_active_member(dataroom, caller)) return false;
    types::has_role(dataroom::get_role(dataroom, caller), folder_visible_to_roles)
}
