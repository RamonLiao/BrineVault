# BrineVault

> **Institutional-grade data vault for Real-World Assets** — securing due diligence, legal docs, and asset proofs in a single encrypted workspace.

BrineVault is a compliance-grade, on-chain Virtual Data Room (VDR) and Deal Hub purpose-built for tokenised private credit. Like a deep-ocean brine layer that remains undisturbed, BrineVault isolates sensitive institutional data behind client-side encryption, immutable audit trails, and blockchain-enforced access control.

## Why BrineVault?

Tokenised private credit represents ≈ USD 140B (65 % of the total RWA market) and is growing 30 %+ year-over-year. Existing solutions fall short:

| | Web2 VDRs (Firmex, Datasite) | RWA Infrastructure (Centrifuge, Goldfinch) | **BrineVault** |
|---|---|---|---|
| Document + contract binding | No on-chain integration | Minimal doc layer | **On-chain state machine tied to documents** |
| Encryption | Server-side | Varies | **Zero-trust, client-side** |
| Compliance automation | Manual workflows | Varies | **Policy-as-code (Seal)** |
| Audit trail | Proprietary logs | On-chain but unstructured | **Immutable, on-chain events** |
| UX | Mature | Raw blockchain UX | **Web2-grade** |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend — Next.js + React + Sui dApp Kit                      │
│  (client-side encryption, wallet signing, Walrus direct upload) │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST API
┌──────────────────────────▼──────────────────────────────────────┐
│  Backend API — NestJS (12 modules, 50+ endpoints)               │
│  Auth · Pool · DataRoom · Document · Review · IC Decision       │
│  Checklist · Audit · Notification · Billing · Admin · Workers   │
└──────┬──────────────┬───────────────────────┬───────────────────┘
       │              │                       │
       ▼              ▼                       ▼
┌──────────┐   ┌─────────────┐   ┌───────────────────────────────┐
│ PostgreSQL│   │    Redis    │   │ Sui Network (Move contracts)  │
│ (read     │   │ (sessions,  │   │ 9 modules: pool, dataroom,    │
│  cache)   │   │  rate limit,│   │ document, review, ic_decision,│
│           │   │  cache)     │   │ seal_policy, events, types,   │
└─────▲─────┘   └─────────────┘   │ errors, admin                │
      │                           └───────────────┬───────────────┘
      │                                           │ events
┌─────┴──────────────────────┐                    │
│  Event Indexer             │◄───────────────────┘
│  (gRPC/JSON-RPC, cursor-  │
│   based, idempotent)       │
└────────────────────────────┘

┌────────────────────────────┐
│  Walrus (decentralised     │
│  blob storage for          │
│  encrypted documents)      │
└────────────────────────────┘
```

### Core Principles

1. **Zero-Trust Client-Side Encryption** — The backend never touches plaintext files or encryption keys.
2. **On-Chain Single Source of Truth** — Sui smart contracts govern permissions, pool state, document metadata, and audit events.
3. **Eventual Consistency** — PostgreSQL is a read-optimised cache; when DB and chain diverge, chain wins.
4. **Dual-Engine Encryption** — AES-256-GCM (production) + Seal threshold encryption (beta) behind an abstraction layer.
5. **Hybrid Signing** — High-privilege operations require user wallet signatures; routine metadata writes are backend-sponsored.
6. **Deal Hub, Not File Store** — DD Checklists, Gate Conditions, and a state machine drive structured workflows.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | **Sui Move** — 9 modules, 160+ tests |
| Backend | **NestJS** (TypeScript) — REST API + cron workers |
| Frontend | **Next.js** + React + Sui dApp Kit |
| Database | **PostgreSQL 16+** — read cache synced via Event Indexer |
| Cache / Session | **Redis 7+** — sessions, rate limiting, cache invalidation |
| Storage | **Walrus** — decentralised blob storage for encrypted files |
| Encryption | **AES-256-GCM** (prod) + **Seal** (beta) — dual-engine |
| Auth | Wallet signature (Ed25519) + JWT session |
| Build | **pnpm** workspaces + **Turborepo** |
| Monitoring | Grafana + Prometheus |

## Monorepo Structure

```
BrineVault/
├── contracts/rwa_dataroom/   # Sui Move smart contracts (9 modules)
├── packages/
│   ├── shared/               # TypeScript types, constants, Zod schemas
│   ├── db/                   # Drizzle schema, migrations, repositories
│   ├── encryption-sdk/       # AES-256-GCM + Seal encryption engine
│   └── walrus-sdk/           # Walrus upload/download/extend
├── apps/
│   ├── api/                  # NestJS backend (12 modules, 50+ endpoints)
│   ├── indexer/              # Sui event indexer → PostgreSQL
│   └── web/                  # Next.js frontend
├── tests/                    # Integration & E2E tests
├── infra/                    # Docker, Terraform, CI/CD, monitoring
└── specs/                    # Architecture specifications
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Sui CLI** (for Move contract development)
- **PostgreSQL** 16+
- **Redis** 7+
- **Docker** (optional, for local dev stack)

### Installation

```bash
# Clone the repository
git clone git@github.com:RamonLiao/BrineVault.git
cd BrineVault

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

```bash
# Start local infrastructure (PostgreSQL + Redis)
docker compose -f infra/docker/docker-compose.yml up -d

# Run all tests
pnpm test

# Run Move contract tests
cd contracts/rwa_dataroom && sui move test

# Run backend API in dev mode
pnpm --filter @rwa-dataroom/api dev

# Run frontend in dev mode
pnpm --filter @rwa-dataroom/web dev
```

### Useful Commands

```bash
pnpm build        # Build all packages in dependency order
pnpm test         # Run all tests
pnpm lint         # Lint all packages
pnpm typecheck    # Type-check all TypeScript packages
pnpm clean        # Clean all build artefacts
```

## Pool Lifecycle State Machine

```
  ┌───────┐     ┌────────────────┐     ┌───────────┐     ┌───────────────────┐
  │ Draft │────▶│ DD In Progress │────▶│ IC Review │────▶│ Approved Internal │
  └───┬───┘     └────────────────┘     └─────┬─────┘     └─────────┬─────────┘
      │                                      │                     │
      │                                      ▼                     ▼
      │                               ┌──────────┐        ┌──────────────┐
      └──────────────────────────────▶│ Cancelled │        │ Ready to     │
                                      └──────────┘        │ Issue        │
                                      ┌──────────┐        └──────────────┘
                                      │ Rejected │
                                      └──────────┘
```

Each state transition is governed by **Gate Conditions** (e.g., all required documents uploaded, DD checklist complete, IC quorum reached) enforced both on-chain and off-chain.

## Security Model

- **Client-side encryption**: Files are encrypted in the browser before upload. The backend and Walrus only ever see ciphertext.
- **Role-based access**: Bitmask roles (Viewer, Reviewer, Editor, Owner, Auditor, Org Admin) enforced on-chain.
- **Immutable audit trail**: Every action emits a Sui event, indexed into PostgreSQL for queryable compliance reporting.
- **Key rotation**: When a member is removed, folder keys are rotated and documents re-encrypted for remaining members.
- **Wallet-based auth**: Ed25519 challenge-response — no passwords, no email/password databases to breach.

## Roadmap

| Phase | Timeline | Scope |
|-------|----------|-------|
| **Phase 1** | 0–6 months | Due diligence data room, state machine, document management |
| **Phase 2** | 6–12 months | Investor onboarding, KYC/AML, Seal graduated rollout, tokenisation bridge |
| **Phase 3** | 12–24 months | Post-issuance lifecycle, servicing events, open API/SDK |

## Licence

This project is proprietary software. All rights reserved.
