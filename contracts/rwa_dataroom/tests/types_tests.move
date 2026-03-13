#[test_only]
module rwa_dataroom::types_tests;

use rwa_dataroom::types;

// ========== has_role tests ==========

#[test]
fun test_has_role_single_match() {
    assert!(types::has_role(types::role_viewer(), types::role_viewer()));
    assert!(types::has_role(types::role_owner(), types::role_owner()));
}

#[test]
fun test_has_role_no_match() {
    assert!(!types::has_role(types::role_viewer(), types::role_editor()));
    assert!(!types::has_role(types::role_reviewer(), types::role_owner()));
}

#[test]
fun test_has_role_multi_bit_match() {
    // User has EDITOR | OWNER (12), check against OWNER
    let combined = types::role_editor() | types::role_owner();
    assert!(types::has_role(combined, types::role_owner()));
    assert!(types::has_role(combined, types::role_editor()));
    assert!(!types::has_role(combined, types::role_auditor()));
}

#[test]
fun test_has_role_reviewer_up() {
    // ROLE_REVIEWER_UP = REVIEWER | OWNER | ORG_ADMIN = 42
    assert!(types::has_role(types::role_reviewer(), types::role_reviewer_up()));
    assert!(types::has_role(types::role_owner(), types::role_reviewer_up()));
    assert!(types::has_role(types::role_org_admin(), types::role_reviewer_up()));
    // EDITOR is lateral, not in reviewer_up
    assert!(!types::has_role(types::role_editor(), types::role_reviewer_up()));
    assert!(!types::has_role(types::role_viewer(), types::role_reviewer_up()));
    assert!(!types::has_role(types::role_auditor(), types::role_reviewer_up()));
}

#[test]
fun test_has_role_editor_up() {
    // ROLE_EDITOR_UP = EDITOR | OWNER = 12
    assert!(types::has_role(types::role_editor(), types::role_editor_up()));
    assert!(types::has_role(types::role_owner(), types::role_editor_up()));
    assert!(!types::has_role(types::role_viewer(), types::role_editor_up()));
    assert!(!types::has_role(types::role_reviewer(), types::role_editor_up()));
}

#[test]
fun test_has_role_owner_up() {
    // ROLE_OWNER_UP = OWNER | ORG_ADMIN = 40
    assert!(types::has_role(types::role_owner(), types::role_owner_up()));
    assert!(types::has_role(types::role_org_admin(), types::role_owner_up()));
    assert!(!types::has_role(types::role_editor(), types::role_owner_up()));
}

#[test]
fun test_has_role_all() {
    assert!(types::has_role(types::role_viewer(), types::role_all()));
    assert!(types::has_role(types::role_reviewer(), types::role_all()));
    assert!(types::has_role(types::role_editor(), types::role_all()));
    assert!(types::has_role(types::role_owner(), types::role_all()));
    assert!(types::has_role(types::role_auditor(), types::role_all()));
    assert!(types::has_role(types::role_org_admin(), types::role_all()));
}

#[test]
fun test_has_role_zero() {
    assert!(!types::has_role(0, types::role_viewer()));
    assert!(!types::has_role(0, types::role_all()));
}

// ========== Validation function tests ==========

#[test]
fun test_is_valid_pool_state() {
    let mut i: u8 = 0;
    while (i <= 8) {
        assert!(types::is_valid_pool_state(i));
        i = i + 1;
    };
    assert!(!types::is_valid_pool_state(9));
    assert!(!types::is_valid_pool_state(255));
}

#[test]
fun test_is_valid_encryption_scheme() {
    assert!(types::is_valid_encryption_scheme(0));
    assert!(types::is_valid_encryption_scheme(1));
    assert!(!types::is_valid_encryption_scheme(2));
    assert!(!types::is_valid_encryption_scheme(255));
}

#[test]
fun test_is_valid_doc_type() {
    let mut i: u8 = 0;
    while (i <= 9) {
        assert!(types::is_valid_doc_type(i));
        i = i + 1;
    };
    assert!(!types::is_valid_doc_type(10));
    assert!(!types::is_valid_doc_type(255));
}

// ========== Accessor value correctness ==========

#[test]
fun test_role_bitmask_values() {
    assert!(types::role_viewer()    == 1);
    assert!(types::role_reviewer()  == 2);
    assert!(types::role_editor()    == 4);
    assert!(types::role_owner()     == 8);
    assert!(types::role_auditor()   == 16);
    assert!(types::role_org_admin() == 32);
    assert!(types::role_reviewer_up() == 42); // REVIEWER | OWNER | ORG_ADMIN
    assert!(types::role_editor_up() == 12);
    assert!(types::role_owner_up()  == 40);
    assert!(types::role_all()       == 63);
}

#[test]
fun test_pool_state_values() {
    assert!(types::pool_state_draft()             == 0);
    assert!(types::pool_state_dd_in_progress()    == 1);
    assert!(types::pool_state_ic_review()         == 2);
    assert!(types::pool_state_approved_internal() == 3);
    assert!(types::pool_state_ready_to_issue()    == 4);
    assert!(types::pool_state_rejected()          == 5);
    assert!(types::pool_state_cancelled()         == 6);
    assert!(types::pool_state_issued()            == 7);
    assert!(types::pool_state_closed()            == 8);
}

#[test]
fun test_ic_decision_values() {
    assert!(types::ic_approve()         == 0);
    assert!(types::ic_reject()          == 1);
    assert!(types::ic_request_changes() == 2);
}
