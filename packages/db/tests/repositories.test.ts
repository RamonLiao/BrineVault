import { describe, it, expect } from "vitest";
import {
  PoolsRepository,
  DataroomsRepository,
  MembersRepository,
  DocumentsRepository,
  DocumentVersionsRepository,
  DocumentReviewsRepository,
  ICDecisionsRepository,
  AuditEventsRepository,
  OrganizationsRepository,
  UsersRepository,
  CommentsRepository,
  NotificationsRepository,
  ChecklistRepository,
  SubscriptionsRepository,
  InviteCodesRepository,
  IndexerCheckpointsRepository,
} from "../src/repositories/index.js";

describe("Repository classes", () => {
  // These tests verify the repository classes can be instantiated
  // and have the expected methods. Integration tests with real DB
  // require PostgreSQL (run via docker compose).

  const mockDb = {} as any;

  it("PoolsRepository has expected methods", () => {
    const repo = new PoolsRepository(mockDb);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findBySuiObjectId).toBeInstanceOf(Function);
    expect(repo.findByOrgId).toBeInstanceOf(Function);
    expect(repo.countByOrgId).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
    expect(repo.updateStateFromEvent).toBeInstanceOf(Function);
  });

  it("DataroomsRepository has expected methods", () => {
    const repo = new DataroomsRepository(mockDb);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findBySuiObjectId).toBeInstanceOf(Function);
    expect(repo.findByPoolId).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
  });

  it("MembersRepository has expected methods", () => {
    const repo = new MembersRepository(mockDb);
    expect(repo.findByDataroomAndAddress).toBeInstanceOf(Function);
    expect(repo.findActiveByPoolId).toBeInstanceOf(Function);
    expect(repo.upsertFromEvent).toBeInstanceOf(Function);
    expect(repo.deactivate).toBeInstanceOf(Function);
    expect(repo.updateRole).toBeInstanceOf(Function);
  });

  it("DocumentsRepository has expected methods", () => {
    const repo = new DocumentsRepository(mockDb);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findBySuiObjectId).toBeInstanceOf(Function);
    expect(repo.findByPoolId).toBeInstanceOf(Function);
    expect(repo.countByPoolId).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
    expect(repo.updateVersionInfo).toBeInstanceOf(Function);
  });

  it("DocumentVersionsRepository has expected methods", () => {
    const repo = new DocumentVersionsRepository(mockDb);
    expect(repo.findByDocumentId).toBeInstanceOf(Function);
    expect(repo.findByDocumentAndVersion).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
  });

  it("DocumentReviewsRepository has expected methods", () => {
    const repo = new DocumentReviewsRepository(mockDb);
    expect(repo.findByDocumentId).toBeInstanceOf(Function);
    expect(repo.findByDocumentAndReviewer).toBeInstanceOf(Function);
    expect(repo.upsertFromEvent).toBeInstanceOf(Function);
  });

  it("ICDecisionsRepository has expected methods", () => {
    const repo = new ICDecisionsRepository(mockDb);
    expect(repo.findByPoolId).toBeInstanceOf(Function);
    expect(repo.findByPoolAndIndex).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
  });

  it("AuditEventsRepository has expected methods", () => {
    const repo = new AuditEventsRepository(mockDb);
    expect(repo.findByPoolId).toBeInstanceOf(Function);
    expect(repo.findByActorAddress).toBeInstanceOf(Function);
    expect(repo.existsByTxSeq).toBeInstanceOf(Function);
    expect(repo.insertFromEvent).toBeInstanceOf(Function);
  });

  it("OrganizationsRepository has CRUD methods (read-write)", () => {
    const repo = new OrganizationsRepository(mockDb);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
  });

  it("UsersRepository has CRUD methods (read-write)", () => {
    const repo = new UsersRepository(mockDb);
    expect(repo.findById).toBeInstanceOf(Function);
    expect(repo.findByWalletAddress).toBeInstanceOf(Function);
    expect(repo.upsertByWallet).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
  });

  it("CommentsRepository has CRUD methods (read-write)", () => {
    const repo = new CommentsRepository(mockDb);
    expect(repo.findByDocumentId).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
    expect(repo.delete).toBeInstanceOf(Function);
  });

  it("NotificationsRepository has CRUD methods (read-write)", () => {
    const repo = new NotificationsRepository(mockDb);
    expect(repo.findByUserId).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.markAsRead).toBeInstanceOf(Function);
    expect(repo.markAllAsRead).toBeInstanceOf(Function);
  });

  it("ChecklistRepository has template and item methods", () => {
    const repo = new ChecklistRepository(mockDb);
    expect(repo.findAllTemplates).toBeInstanceOf(Function);
    expect(repo.createTemplate).toBeInstanceOf(Function);
    expect(repo.findItemsByPoolId).toBeInstanceOf(Function);
    expect(repo.createItem).toBeInstanceOf(Function);
    expect(repo.updateItem).toBeInstanceOf(Function);
    expect(repo.deleteItem).toBeInstanceOf(Function);
  });

  it("SubscriptionsRepository has subscription and invoice methods", () => {
    const repo = new SubscriptionsRepository(mockDb);
    expect(repo.findByOrgId).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.update).toBeInstanceOf(Function);
    expect(repo.findInvoicesByOrgId).toBeInstanceOf(Function);
    expect(repo.createInvoice).toBeInstanceOf(Function);
    expect(repo.updateInvoice).toBeInstanceOf(Function);
  });

  it("InviteCodesRepository has CRUD methods", () => {
    const repo = new InviteCodesRepository(mockDb);
    expect(repo.findByCode).toBeInstanceOf(Function);
    expect(repo.findByOrgId).toBeInstanceOf(Function);
    expect(repo.create).toBeInstanceOf(Function);
    expect(repo.incrementUses).toBeInstanceOf(Function);
  });

  it("IndexerCheckpointsRepository has checkpoint methods", () => {
    const repo = new IndexerCheckpointsRepository(mockDb);
    expect(repo.getCheckpoint).toBeInstanceOf(Function);
    expect(repo.upsertCheckpoint).toBeInstanceOf(Function);
  });
});

describe("Repository access patterns", () => {
  it("core repositories are read-only from API perspective", () => {
    // Core repos: Pools, Datarooms, Members, Documents, DocVersions, DocReviews, ICDecisions, AuditEvents
    // They have insertFromEvent/upsertFromEvent methods but these are for indexer use only.
    // The API should never call these — enforced by convention (not code).
    const mockDb = {} as any;
    const poolRepo = new PoolsRepository(mockDb);
    // Verify read methods exist
    expect(poolRepo.findById).toBeInstanceOf(Function);
    expect(poolRepo.findBySuiObjectId).toBeInstanceOf(Function);
    // Indexer methods also exist (used by indexer only)
    expect(poolRepo.insertFromEvent).toBeInstanceOf(Function);
  });

  it("off-chain repositories have full CRUD", () => {
    const mockDb = {} as any;
    const orgRepo = new OrganizationsRepository(mockDb);
    expect(orgRepo.create).toBeInstanceOf(Function);
    expect(orgRepo.update).toBeInstanceOf(Function);
    expect(orgRepo.findById).toBeInstanceOf(Function);
  });
});
