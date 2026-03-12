module rwa_dataroom::ic_decision;

use std::string::String;
use rwa_dataroom::errors;

// ============================================================
// Structs
// ============================================================

public struct ICDecision has store, drop {
    index: u64,
    decision_type: u8,
    decision_text: String,
    decision_pdf_blob_id: String,
    created_by: address,
    committee_members: vector<address>,
    votes: vector<u8>,
    created_at: u64,
    related_doc_ids: vector<ID>,
}

// ============================================================
// Constructor (package-only)
// ============================================================

public(package) fun new(
    index: u64,
    decision_type: u8,
    decision_text: String,
    decision_pdf_blob_id: String,
    created_by: address,
    committee_members: vector<address>,
    votes: vector<u8>,
    created_at: u64,
    related_doc_ids: vector<ID>,
): ICDecision {
    assert!(decision_type <= 2, errors::invalid_config());
    assert!(committee_members.length() == votes.length(), errors::invalid_config());
    assert!(!committee_members.is_empty(), errors::empty_committee());
    ICDecision {
        index,
        decision_type,
        decision_text,
        decision_pdf_blob_id,
        created_by,
        committee_members,
        votes,
        created_at,
        related_doc_ids,
    }
}

// ============================================================
// Accessors
// ============================================================

public fun index(d: &ICDecision): u64 { d.index }
public fun decision_type(d: &ICDecision): u8 { d.decision_type }
public fun decision_text(d: &ICDecision): &String { &d.decision_text }
public fun decision_pdf_blob_id(d: &ICDecision): &String { &d.decision_pdf_blob_id }
public fun created_by(d: &ICDecision): address { d.created_by }
public fun committee_members(d: &ICDecision): &vector<address> { &d.committee_members }
public fun votes(d: &ICDecision): &vector<u8> { &d.votes }
public fun created_at(d: &ICDecision): u64 { d.created_at }
public fun related_doc_ids(d: &ICDecision): &vector<ID> { &d.related_doc_ids }
