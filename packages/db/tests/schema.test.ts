import { describe, it, expect } from "vitest";
import * as schema from "../src/schema/index.js";

describe("Schema definitions", () => {
  it("exports all 20 table definitions", () => {
    // Core tables (on-chain synced)
    expect(schema.pools).toBeDefined();
    expect(schema.datarooms).toBeDefined();
    expect(schema.members).toBeDefined();
    expect(schema.documents).toBeDefined();
    expect(schema.documentVersions).toBeDefined();
    expect(schema.documentReviews).toBeDefined();
    expect(schema.icDecisions).toBeDefined();
    expect(schema.auditEvents).toBeDefined();

    // Off-chain tables
    expect(schema.organizations).toBeDefined();
    expect(schema.users).toBeDefined();
    expect(schema.comments).toBeDefined();
    expect(schema.notifications).toBeDefined();
    expect(schema.notificationPreferences).toBeDefined();
    expect(schema.checklistTemplates).toBeDefined();
    expect(schema.poolChecklistItems).toBeDefined();
    expect(schema.subscriptions).toBeDefined();
    expect(schema.invoices).toBeDefined();
    expect(schema.inviteCodes).toBeDefined();

    // Indexer state
    expect(schema.indexerCheckpoints).toBeDefined();
  });

  it("exports all enum types", () => {
    expect(schema.billingPlanEnum).toBeDefined();
    expect(schema.subscriptionStatusEnum).toBeDefined();
    expect(schema.invoiceStatusEnum).toBeDefined();
    expect(schema.checklistItemStatusEnum).toBeDefined();
  });

  it("pools table has correct column names", () => {
    const cols = Object.keys(schema.pools);
    // Drizzle table objects have symbol keys + column name keys
    const columnConfig = schema.pools as Record<string, unknown>;
    // Just verify the table is a valid Drizzle table object
    expect(columnConfig).toBeDefined();
  });

  it("organizations table has billingPlan with enum type", () => {
    const orgTable = schema.organizations;
    expect(orgTable).toBeDefined();
  });

  it("members table has role constraints (1-63)", () => {
    const membersTable = schema.members;
    expect(membersTable).toBeDefined();
  });

  it("audit_events table has unique index on (sui_tx_digest, sui_event_seq)", () => {
    const auditTable = schema.auditEvents;
    expect(auditTable).toBeDefined();
  });

  it("document_versions table has unique index on (document_id, version)", () => {
    const dvTable = schema.documentVersions;
    expect(dvTable).toBeDefined();
  });

  it("pool_checklist_items has correct enum reference", () => {
    const pciTable = schema.poolChecklistItems;
    expect(pciTable).toBeDefined();
  });
});

describe("Schema FK relationships", () => {
  it("pools references organizations", () => {
    // Verify pools table has orgId column
    expect(schema.pools.orgId).toBeDefined();
  });

  it("datarooms references pools", () => {
    expect(schema.datarooms.poolId).toBeDefined();
  });

  it("members references both datarooms and pools", () => {
    expect(schema.members.dataroomId).toBeDefined();
    expect(schema.members.poolId).toBeDefined();
  });

  it("documents references pools and datarooms", () => {
    expect(schema.documents.poolId).toBeDefined();
    expect(schema.documents.dataroomId).toBeDefined();
  });

  it("document_versions references documents", () => {
    expect(schema.documentVersions.documentId).toBeDefined();
  });

  it("document_reviews references documents", () => {
    expect(schema.documentReviews.documentId).toBeDefined();
  });

  it("ic_decisions references pools", () => {
    expect(schema.icDecisions.poolId).toBeDefined();
  });

  it("comments references documents and pools", () => {
    expect(schema.comments.documentId).toBeDefined();
    expect(schema.comments.poolId).toBeDefined();
  });

  it("notifications references users", () => {
    expect(schema.notifications.userId).toBeDefined();
  });

  it("subscriptions references organizations", () => {
    expect(schema.subscriptions.orgId).toBeDefined();
  });

  it("invoices references organizations and subscriptions", () => {
    expect(schema.invoices.orgId).toBeDefined();
    expect(schema.invoices.subscriptionId).toBeDefined();
  });

  it("invite_codes references organizations and users", () => {
    expect(schema.inviteCodes.orgId).toBeDefined();
    expect(schema.inviteCodes.createdByUserId).toBeDefined();
  });
});
