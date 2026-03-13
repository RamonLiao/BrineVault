import type { Database } from "../client.js";
import { organizations } from "../schema/organizations.js";
import { users } from "../schema/users.js";
import { checklistTemplates } from "../schema/checklist-templates.js";
import { indexerCheckpoints } from "../schema/indexer-checkpoints.js";

/**
 * Seed development data. Idempotent — uses ON CONFLICT DO NOTHING.
 */
export async function seedDev(db: Database) {
  // 1. Checklist templates
  await db
    .insert(checklistTemplates)
    .values([
      {
        name: "Standard Private Credit DD",
        description: "Default due diligence checklist for private credit deals",
        items: [
          { folder: "KYC", item_name: "Certificate of Incorporation", required_default: true },
          { folder: "KYC", item_name: "Board Resolution", required_default: true },
          { folder: "KYC", item_name: "Shareholders Register", required_default: true },
          { folder: "KYC", item_name: "Director ID Copies", required_default: true },
          { folder: "Financial", item_name: "Audited Financial Statements (3Y)", required_default: true },
          { folder: "Financial", item_name: "Management Accounts (Latest Quarter)", required_default: true },
          { folder: "Financial", item_name: "Cash Flow Projections", required_default: true },
          { folder: "Financial", item_name: "Debt Schedule", required_default: false },
          { folder: "Collateral", item_name: "Collateral Valuation Report", required_default: false },
          { folder: "Collateral", item_name: "Insurance Certificates", required_default: false },
          { folder: "Legal", item_name: "Loan Agreement Draft", required_default: true },
          { folder: "Legal", item_name: "Security Agreement", required_default: true },
          { folder: "Legal", item_name: "Legal Opinion", required_default: false },
          { folder: "Compliance", item_name: "AML/KYC Screening Report", required_default: true },
          { folder: "Compliance", item_name: "Sanctions Check", required_default: true },
        ],
      },
      {
        name: "Simplified DD (SME)",
        description: "Simplified checklist for small/medium enterprise deals",
        items: [
          { folder: "KYC", item_name: "Certificate of Incorporation", required_default: true },
          { folder: "KYC", item_name: "Director ID Copies", required_default: true },
          { folder: "Financial", item_name: "Financial Statements (2Y)", required_default: true },
          { folder: "Financial", item_name: "Bank Statements (6M)", required_default: true },
          { folder: "Legal", item_name: "Loan Agreement Draft", required_default: true },
          { folder: "Compliance", item_name: "AML/KYC Screening Report", required_default: true },
        ],
      },
    ])
    .onConflictDoNothing();

  // 2. Indexer checkpoint seed
  await db
    .insert(indexerCheckpoints)
    .values({
      id: 1,
      chainId: "sui:testnet",
      lastEventSeq: BigInt(0),
    })
    .onConflictDoNothing();

  console.log("[seed] Development seed data inserted.");
}
