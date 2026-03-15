# S5 Session 3b: Notification + Billing + Background Workers

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Notification module (5 endpoints), Billing module (5 endpoints), and 4 background workers to the NestJS API.

**Architecture:** Pure DB read/write modules (no on-chain TX). Notification & Billing follow the same Controller → Service → Repository pattern as existing modules. Background workers use `@nestjs/schedule` (`@Cron()` decorators) for cron jobs and an injectable `NotificationDispatcherService` for event-driven notifications. All work happens in the `.worktrees/s5-backend-api` worktree on branch `feat/s5-backend-api`.

**Tech Stack:** NestJS 11, `@nestjs/schedule`, Drizzle ORM, Vitest, Zod, ioredis

**Worktree:** `.worktrees/s5-backend-api`
**Branch:** `feat/s5-backend-api`

---

## File Structure

### New files to create

```
# DB layer (packages/db)
packages/db/src/repositories/notification-preferences.repository.ts   — CRUD for notification_preferences table

# API modules (apps/api/src/modules)
apps/api/src/modules/notifications/notifications.module.ts
apps/api/src/modules/notifications/notifications.controller.ts
apps/api/src/modules/notifications/notifications.service.ts
apps/api/src/modules/notifications/notifications.schemas.ts

apps/api/src/modules/billing/billing.module.ts
apps/api/src/modules/billing/billing.controller.ts
apps/api/src/modules/billing/billing.service.ts
apps/api/src/modules/billing/billing.schemas.ts

# Background workers
apps/api/src/workers/notification-dispatcher.service.ts    — Event-driven: called by other services
apps/api/src/workers/subscription-monitor.service.ts       — Cron: daily subscription lifecycle
apps/api/src/workers/walrus-renewal.service.ts             — Cron: daily blob renewal (stub)
apps/api/src/workers/cost-tracker.service.ts               — Cron: daily Walrus cost aggregation (stub)
apps/api/src/workers/workers.module.ts                     — NestJS module registering ScheduleModule + workers

# Unit tests
apps/api/src/test/notifications/notifications.service.spec.ts
apps/api/src/test/notifications/notifications.controller.spec.ts
apps/api/src/test/billing/billing.service.spec.ts
apps/api/src/test/billing/billing.controller.spec.ts
apps/api/src/test/workers/notification-dispatcher.spec.ts
apps/api/src/test/workers/subscription-monitor.spec.ts

# E2E tests
apps/api/test/e2e/notifications.e2e-spec.ts
apps/api/test/e2e/billing.e2e-spec.ts
apps/api/test/e2e/monkey-s3b.e2e-spec.ts
```

### Files to modify

```
packages/db/src/repositories/index.ts                      — export NotificationPreferencesRepository
apps/api/src/infra/drizzle/repositories.module.ts           — add NotificationsRepository, NotificationPreferencesRepository, SubscriptionsRepository
apps/api/src/app.module.ts                                  — import NotificationsModule, BillingModule, WorkersModule
apps/api/src/common/constants.ts                            — (no change needed — repos use class tokens)
apps/api/test/helpers/mock-providers.ts                     — add notificationsRepo, notificationPrefsRepo, subscriptionsRepo
apps/api/test/helpers/create-app.ts                         — add new controllers, services, repos; register ScheduleModule
apps/api/package.json                                       — add @nestjs/schedule dependency
```

---

## Chunk 1: DB Layer + Notification Module

### Task 1: Create NotificationPreferencesRepository

**Files:**
- Create: `packages/db/src/repositories/notification-preferences.repository.ts`
- Modify: `packages/db/src/repositories/index.ts`

- [ ] **Step 1: Create NotificationPreferencesRepository**

```typescript
// packages/db/src/repositories/notification-preferences.repository.ts
import { eq } from "drizzle-orm";
import { notificationPreferences } from "../schema/notification-preferences.js";
import { BaseRepository } from "./base.js";

/** Read-write repository for notification_preferences table. */
export class NotificationPreferencesRepository extends BaseRepository {
  async findByUserId(userId: string) {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, data: Partial<typeof notificationPreferences.$inferInsert>) {
    const existing = await this.findByUserId(userId);
    if (existing) {
      const rows = await this.db
        .update(notificationPreferences)
        .set(data)
        .where(eq(notificationPreferences.userId, userId))
        .returning();
      return rows[0]!;
    }
    const rows = await this.db
      .insert(notificationPreferences)
      .values({ userId, ...data })
      .returning();
    return rows[0]!;
  }
}
```

- [ ] **Step 2: Export from repositories/index.ts**

Add to `packages/db/src/repositories/index.ts` in the off-chain section:

```typescript
export { NotificationPreferencesRepository } from "./notification-preferences.repository.js";
```

- [ ] **Step 3: Verify build**

```bash
cd packages/db && pnpm build
```
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/repositories/notification-preferences.repository.ts packages/db/src/repositories/index.ts
git commit -m "feat(db): add NotificationPreferencesRepository"
```

---

### Task 2: Install @nestjs/schedule

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install dependency**

```bash
cd apps/api && pnpm add @nestjs/schedule
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/package.json
# Also add pnpm-lock.yaml if changed at worktree root
git commit -m "chore(api): add @nestjs/schedule dependency"
```

---

### Task 3: Wire new repos into RepositoriesModule

**Files:**
- Modify: `apps/api/src/infra/drizzle/repositories.module.ts`

- [ ] **Step 1: Add NotificationsRepository, NotificationPreferencesRepository, SubscriptionsRepository**

Add imports and add to the `repositories` array:

```typescript
import {
  // ... existing imports ...
  NotificationsRepository,
  NotificationPreferencesRepository,
  SubscriptionsRepository,
} from '@rwa-dataroom/db';

const repositories = [
  // ... existing repos ...
  NotificationsRepository,
  NotificationPreferencesRepository,
  SubscriptionsRepository,
];
```

- [ ] **Step 2: Verify typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/infra/drizzle/repositories.module.ts
git commit -m "feat(api): register Notifications + Billing repos in DI"
```

---

### Task 4: Notification Module — Schemas

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.schemas.ts`

- [ ] **Step 1: Write Zod schemas**

```typescript
// apps/api/src/modules/notifications/notifications.schemas.ts
import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  read: z.enum(['true', 'false']).optional(),
  type: z.string().optional(),
});

export type NotificationsQueryDto = z.infer<typeof notificationsQuerySchema>;

const perTypePreference = z.object({
  email: z.boolean().optional(),
  in_app: z.boolean().optional(),
});

export const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  preferences: z.record(z.string(), perTypePreference).optional(),
});

export type UpdatePreferencesDto = z.infer<typeof updatePreferencesSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.schemas.ts
git commit -m "feat(notifications): add Zod validation schemas"
```

---

### Task 5: Notification Module — Service

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.service.ts`
- Test: `apps/api/src/test/notifications/notifications.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/notifications/notifications.service.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../modules/notifications/notifications.service.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: any;
  let prefsRepo: any;

  const userId = 'user-001';

  const mockNotif = (overrides: any = {}) => ({
    id: 'notif-001',
    userId,
    type: 'pool_state_changed',
    title: 'Pool state changed',
    body: 'Pool moved to REVIEW',
    relatedPoolId: 'pool-001',
    relatedDocumentId: null,
    isRead: false,
    createdAt: new Date('2026-03-15'),
    ...overrides,
  });

  const mockPrefs = (overrides: any = {}) => ({
    id: 'pref-001',
    userId,
    emailEnabled: true,
    inAppEnabled: true,
    preferences: {},
    ...overrides,
  });

  beforeEach(() => {
    notifRepo = {
      findByUserId: vi.fn(),
      create: vi.fn(),
      markAsRead: vi.fn(),
      markAsReadForUser: vi.fn(),
      markAllAsRead: vi.fn(),
    };
    prefsRepo = {
      findByUserId: vi.fn(),
      upsert: vi.fn(),
    };
    service = new NotificationsService(notifRepo, prefsRepo);
  });

  // ─── listNotifications ───────────────────────────────────

  describe('listNotifications', () => {
    it('returns paginated notifications for user', async () => {
      const notifs = [mockNotif()];
      notifRepo.findByUserId.mockResolvedValue(notifs);

      const result = await service.listNotifications(userId, { page: 1, limit: 20 });

      expect(result.data).toEqual(notifs);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 20, offset: 0 });
    });

    it('computes correct offset for page 3', async () => {
      notifRepo.findByUserId.mockResolvedValue([]);

      await service.listNotifications(userId, { page: 3, limit: 10 });

      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 10, offset: 20 });
    });
  });

  // ─── markAsRead ──────────────────────────────────────────

  describe('markAsRead', () => {
    it('calls repo.markAsReadForUser with id and userId', async () => {
      notifRepo.markAsReadForUser.mockResolvedValue(undefined);

      await service.markAsRead('notif-001', userId);

      expect(notifRepo.markAsReadForUser).toHaveBeenCalledWith('notif-001', userId);
    });
  });

  // ─── markAllAsRead ───────────────────────────────────────

  describe('markAllAsRead', () => {
    it('calls repo.markAllAsRead with userId', async () => {
      notifRepo.markAllAsRead.mockResolvedValue(undefined);

      await service.markAllAsRead(userId);

      expect(notifRepo.markAllAsRead).toHaveBeenCalledWith(userId);
    });
  });

  // ─── getPreferences ──────────────────────────────────────

  describe('getPreferences', () => {
    it('returns existing preferences', async () => {
      prefsRepo.findByUserId.mockResolvedValue(mockPrefs());

      const result = await service.getPreferences(userId);

      expect(result).toEqual(mockPrefs());
    });

    it('returns defaults when no preferences exist', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);

      const result = await service.getPreferences(userId);

      expect(result).toEqual({
        userId,
        emailEnabled: true,
        inAppEnabled: true,
        preferences: {},
      });
    });
  });

  // ─── updatePreferences ───────────────────────────────────

  describe('updatePreferences', () => {
    it('upserts preferences with merged JSONB', async () => {
      const existing = mockPrefs({ preferences: { pool_state_changed: { email: true, in_app: true } } });
      prefsRepo.findByUserId.mockResolvedValue(existing);
      prefsRepo.upsert.mockResolvedValue({
        ...existing,
        preferences: {
          pool_state_changed: { email: true, in_app: true },
          member_added: { email: false, in_app: true },
        },
      });

      const result = await service.updatePreferences(userId, {
        preferences: { member_added: { email: false, in_app: true } },
      });

      expect(prefsRepo.upsert).toHaveBeenCalledWith(userId, {
        preferences: {
          pool_state_changed: { email: true, in_app: true },
          member_added: { email: false, in_app: true },
        },
      });
    });

    it('upserts emailEnabled/inAppEnabled without touching preferences', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      prefsRepo.upsert.mockResolvedValue(mockPrefs({ emailEnabled: false }));

      await service.updatePreferences(userId, { emailEnabled: false });

      expect(prefsRepo.upsert).toHaveBeenCalledWith(userId, {
        emailEnabled: false,
        preferences: {},
      });
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('listNotifications page=999 limit=100 → offset 99800', async () => {
      notifRepo.findByUserId.mockResolvedValue([]);

      await service.listNotifications(userId, { page: 999, limit: 100 });

      expect(notifRepo.findByUserId).toHaveBeenCalledWith(userId, { limit: 100, offset: 99800 });
    });

    it('updatePreferences deep-merges nested preferences', async () => {
      const existing = mockPrefs({
        preferences: {
          pool_state_changed: { email: true, in_app: false },
          member_added: { email: true, in_app: true },
        },
      });
      prefsRepo.findByUserId.mockResolvedValue(existing);
      prefsRepo.upsert.mockImplementation((_uid: string, data: any) => Promise.resolve({ ...existing, ...data }));

      await service.updatePreferences(userId, {
        preferences: { pool_state_changed: { email: false } },
      });

      // Should merge, not replace
      const call = prefsRepo.upsert.mock.calls[0][1];
      expect(call.preferences.pool_state_changed).toEqual({ email: false, in_app: false });
      expect(call.preferences.member_added).toEqual({ email: true, in_app: true });
    });

    it('markAsRead and markAllAsRead do not throw on empty results', async () => {
      notifRepo.markAsReadForUser.mockResolvedValue(undefined);
      notifRepo.markAllAsRead.mockResolvedValue(undefined);

      await expect(service.markAsRead('nonexistent', userId)).resolves.not.toThrow();
      await expect(service.markAllAsRead(userId)).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/notifications/notifications.service.spec.ts
```
Expected: FAIL — `NotificationsService` module not found.

- [ ] **Step 3: Implement NotificationsService**

```typescript
// apps/api/src/modules/notifications/notifications.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { NotificationsRepository, NotificationPreferencesRepository } from '@rwa-dataroom/db';
import type { NotificationsQueryDto, UpdatePreferencesDto } from './notifications.schemas.js';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository) private readonly notifRepo: NotificationsRepository,
    @Inject(NotificationPreferencesRepository) private readonly prefsRepo: NotificationPreferencesRepository,
  ) {}

  async listNotifications(userId: string, query: NotificationsQueryDto) {
    const offset = (query.page - 1) * query.limit;
    const data = await this.notifRepo.findByUserId(userId, { limit: query.limit, offset });
    return { data, page: query.page, limit: query.limit };
  }

  async markAsRead(id: string, userId: string) {
    await this.notifRepo.markAsReadForUser(id, userId);
    return { id, isRead: true };
  }

  async markAllAsRead(userId: string) {
    await this.notifRepo.markAllAsRead(userId);
    return { success: true };
  }

  async getPreferences(userId: string) {
    const prefs = await this.prefsRepo.findByUserId(userId);
    if (!prefs) {
      return { userId, emailEnabled: true, inAppEnabled: true, preferences: {} };
    }
    return prefs;
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const existing = await this.prefsRepo.findByUserId(userId);
    const existingPrefs = (existing?.preferences as Record<string, any>) ?? {};

    // Deep merge preferences: per notification type
    const merged: Record<string, any> = { ...existingPrefs };
    if (dto.preferences) {
      for (const [key, val] of Object.entries(dto.preferences)) {
        merged[key] = { ...(existingPrefs[key] ?? {}), ...val };
      }
    }

    const updateData: Record<string, any> = { preferences: merged };
    if (dto.emailEnabled !== undefined) updateData.emailEnabled = dto.emailEnabled;
    if (dto.inAppEnabled !== undefined) updateData.inAppEnabled = dto.inAppEnabled;

    return this.prefsRepo.upsert(userId, updateData);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/notifications/notifications.service.spec.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.service.ts apps/api/src/test/notifications/notifications.service.spec.ts
git commit -m "feat(notifications): add NotificationsService with unit tests"
```

---

### Task 6: Notification Module — Controller

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.controller.ts`
- Test: `apps/api/src/test/notifications/notifications.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/notifications/notifications.controller.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsController } from '../../modules/notifications/notifications.controller.js';
import type { NotificationsService } from '../../modules/notifications/notifications.service.js';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notifService: Record<string, any>;

  const userId = 'user-001';
  const mockUser = {
    sub: userId,
    address: '0x' + 'a'.repeat(64),
    orgId: 'org-001',
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockPaginated = { data: [], page: 1, limit: 20 };
  const mockPrefs = { userId, emailEnabled: true, inAppEnabled: true, preferences: {} };

  beforeEach(() => {
    notifService = {
      listNotifications: vi.fn().mockResolvedValue(mockPaginated),
      markAsRead: vi.fn().mockResolvedValue({ id: 'notif-001', isRead: true }),
      markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
      getPreferences: vi.fn().mockResolvedValue(mockPrefs),
      updatePreferences: vi.fn().mockResolvedValue(mockPrefs),
    };
    controller = new NotificationsController(notifService as unknown as NotificationsService);
  });

  // ─── GET /notifications ──────────────────────────────────

  describe('GET /notifications', () => {
    it('delegates to service.listNotifications with user.sub', async () => {
      const query = { page: 1, limit: 20 };
      const result = await controller.listNotifications(mockUser as any, query);

      expect(notifService.listNotifications).toHaveBeenCalledWith(userId, query);
      expect(result).toEqual(mockPaginated);
    });
  });

  // ─── PATCH /notifications/:id/read ───────────────────────

  describe('PATCH /notifications/:id/read', () => {
    it('delegates to service.markAsRead', async () => {
      const result = await controller.markAsRead('notif-001', mockUser as any);

      expect(notifService.markAsRead).toHaveBeenCalledWith('notif-001', userId);
      expect(result).toEqual({ id: 'notif-001', isRead: true });
    });
  });

  // ─── POST /notifications/read-all ────────────────────────

  describe('POST /notifications/read-all', () => {
    it('delegates to service.markAllAsRead', async () => {
      const result = await controller.markAllAsRead(mockUser as any);

      expect(notifService.markAllAsRead).toHaveBeenCalledWith(userId);
      expect(result).toEqual({ success: true });
    });
  });

  // ─── GET /notification-preferences ───────────────────────

  describe('GET /notification-preferences', () => {
    it('delegates to service.getPreferences', async () => {
      const result = await controller.getPreferences(mockUser as any);

      expect(notifService.getPreferences).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockPrefs);
    });
  });

  // ─── PATCH /notification-preferences ─────────────────────

  describe('PATCH /notification-preferences', () => {
    it('delegates to service.updatePreferences', async () => {
      const dto = { emailEnabled: false };
      const result = await controller.updatePreferences(mockUser as any, dto);

      expect(notifService.updatePreferences).toHaveBeenCalledWith(userId, dto);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('listNotifications propagates service errors', async () => {
      notifService.listNotifications.mockRejectedValue(new Error('DB failed'));

      await expect(controller.listNotifications(mockUser as any, { page: 1, limit: 20 })).rejects.toThrow('DB failed');
    });

    it('markAsRead propagates service errors', async () => {
      notifService.markAsRead.mockRejectedValue(new Error('DB failed'));

      await expect(controller.markAsRead('notif-001', mockUser as any)).rejects.toThrow('DB failed');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/notifications/notifications.controller.spec.ts
```
Expected: FAIL — `NotificationsController` not found.

- [ ] **Step 3: Implement NotificationsController**

```typescript
// apps/api/src/modules/notifications/notifications.controller.ts
import { Controller, Get, Patch, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { notificationsQuerySchema, updatePreferencesSchema } from './notifications.schemas.js';

interface JwtPayload {
  sub: string;
  address: string;
  orgId: string | null;
  orgRole: number;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('notifications')
  async listNotifications(
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(notificationsQuerySchema)) query: any,
  ) {
    return this.notificationsService.listNotifications(user.sub, query);
  }

  @Patch('notifications/:id/read')
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  @Get('notification-preferences')
  async getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Patch('notification-preferences')
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(updatePreferencesSchema)) dto: any,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/notifications/notifications.controller.spec.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.controller.ts apps/api/src/test/notifications/notifications.controller.spec.ts
git commit -m "feat(notifications): add NotificationsController with unit tests"
```

---

### Task 7: Notification Module — Wire Up

**Files:**
- Create: `apps/api/src/modules/notifications/notifications.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create module**

```typescript
// apps/api/src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

- [ ] **Step 2: Add to app.module.ts**

Add import and register in `imports` array:

```typescript
import { NotificationsModule } from './modules/notifications/notifications.module.js';

// In @Module imports array, after AuditModule:
NotificationsModule,
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/notifications/notifications.module.ts apps/api/src/app.module.ts
git commit -m "feat(notifications): wire NotificationsModule into AppModule"
```

---

## Chunk 2: Billing Module

### Task 8: Billing Module — Schemas

**Files:**
- Create: `apps/api/src/modules/billing/billing.schemas.ts`

- [ ] **Step 1: Write Zod schemas**

```typescript
// apps/api/src/modules/billing/billing.schemas.ts
import { z } from 'zod';

export const renewSubscriptionSchema = z.object({
  plan: z.enum(['free_trial', 'pro', 'enterprise']),
  durationMonths: z.coerce.number().int().min(1).max(36).default(12),
});

export type RenewSubscriptionDto = z.infer<typeof renewSubscriptionSchema>;

export const invoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).optional(),
});

export type InvoicesQueryDto = z.infer<typeof invoicesQuerySchema>;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/billing/billing.schemas.ts
git commit -m "feat(billing): add Zod validation schemas"
```

---

### Task 9: Billing Module — Service

**Files:**
- Create: `apps/api/src/modules/billing/billing.service.ts`
- Test: `apps/api/src/test/billing/billing.service.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/billing/billing.service.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { BillingService } from '../../modules/billing/billing.service.js';

describe('BillingService', () => {
  let service: BillingService;
  let subsRepo: any;
  let orgsRepo: any;

  const orgId = 'org-001';
  const userOrgId = 'org-001';

  const mockSub = (overrides: any = {}) => ({
    id: 'sub-001',
    orgId,
    plan: 'pro',
    status: 'active',
    trialStartAt: null,
    trialEndAt: null,
    currentPeriodStart: new Date('2026-01-01'),
    currentPeriodEnd: new Date('2027-01-01'),
    gracePeriodEnd: null,
    penaltyRate: '1.30',
    amount: '1200.00',
    currency: 'SGD',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockInvoice = (overrides: any = {}) => ({
    id: 'inv-001',
    orgId,
    subscriptionId: 'sub-001',
    amount: '1200.00',
    currency: 'SGD',
    status: 'pending',
    penaltyApplied: false,
    issuedAt: new Date(),
    dueAt: new Date('2026-04-01'),
    paidAt: null,
    ...overrides,
  });

  beforeEach(() => {
    subsRepo = {
      findByOrgId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findInvoicesByOrgId: vi.fn(),
      findInvoiceById: vi.fn(),
      createInvoice: vi.fn(),
      updateInvoice: vi.fn(),
    };
    orgsRepo = {
      findById: vi.fn(),
    };
    service = new BillingService(subsRepo, orgsRepo);
  });

  // ─── getSubscription ─────────────────────────────────────

  describe('getSubscription', () => {
    it('returns subscription for org', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());

      const result = await service.getSubscription(orgId, userOrgId);

      expect(result).toEqual(mockSub());
      expect(subsRepo.findByOrgId).toHaveBeenCalledWith(orgId);
    });

    it('throws NOT_FOUND if no subscription', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);

      await expect(service.getSubscription(orgId, userOrgId)).rejects.toThrow(NotFoundException);
    });

    it('throws FORBIDDEN if user is not in org', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());

      await expect(service.getSubscription(orgId, 'other-org')).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── renewSubscription ───────────────────────────────────

  describe('renewSubscription', () => {
    it('creates subscription + invoice for renewal', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());
      subsRepo.update.mockResolvedValue([mockSub({ status: 'active' })]);
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());

      const result = await service.renewSubscription(orgId, userOrgId, { plan: 'pro', durationMonths: 12 });

      expect(subsRepo.update).toHaveBeenCalled();
      expect(subsRepo.createInvoice).toHaveBeenCalled();
      expect(result).toHaveProperty('invoice');
      expect(result).toHaveProperty('subscription');
    });

    it('creates new subscription if none exists', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);
      subsRepo.create.mockResolvedValue(mockSub());
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());

      const result = await service.renewSubscription(orgId, userOrgId, { plan: 'pro', durationMonths: 12 });

      expect(subsRepo.create).toHaveBeenCalled();
    });

    it('throws FORBIDDEN if user is not in org', async () => {
      await expect(
        service.renewSubscription(orgId, 'other-org', { plan: 'pro', durationMonths: 12 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── listInvoices ────────────────────────────────────────

  describe('listInvoices', () => {
    it('returns paginated invoices', async () => {
      subsRepo.findInvoicesByOrgId.mockResolvedValue([mockInvoice()]);

      const result = await service.listInvoices(orgId, userOrgId, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockInvoice()]);
      expect(result.page).toBe(1);
    });

    it('throws FORBIDDEN if user is not in org', async () => {
      await expect(service.listInvoices(orgId, 'other-org', { page: 1, limit: 20 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── getInvoice ──────────────────────────────────────────

  describe('getInvoice', () => {
    it('returns single invoice', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice());

      const result = await service.getInvoice(orgId, 'inv-001', userOrgId);

      expect(result).toEqual(mockInvoice());
    });

    it('throws NOT_FOUND for missing invoice', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(null);

      await expect(service.getInvoice(orgId, 'inv-999', userOrgId)).rejects.toThrow(NotFoundException);
    });

    it('throws FORBIDDEN if invoice belongs to different org', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId: 'other-org' }));

      await expect(service.getInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── payInvoice ──────────────────────────────────────────

  describe('payInvoice', () => {
    it('marks invoice as paid', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId }));
      subsRepo.updateInvoice.mockResolvedValue([mockInvoice({ status: 'paid', paidAt: new Date() })]);

      const result = await service.payInvoice(orgId, 'inv-001', userOrgId);

      expect(subsRepo.updateInvoice).toHaveBeenCalledWith('inv-001', expect.objectContaining({ status: 'paid' }));
    });

    it('throws BAD_REQUEST if invoice already paid', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId, status: 'paid' }));

      await expect(service.payInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(BadRequestException);
    });

    it('throws NOT_FOUND if invoice not found', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(null);

      await expect(service.payInvoice(orgId, 'inv-999', userOrgId)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('getSubscription — null userOrgId never matches', async () => {
      subsRepo.findByOrgId.mockResolvedValue(mockSub());

      await expect(service.getSubscription(orgId, null as any)).rejects.toThrow(ForbiddenException);
    });

    it('renewSubscription — 36 months is max, accepted', async () => {
      subsRepo.findByOrgId.mockResolvedValue(null);
      subsRepo.create.mockResolvedValue(mockSub());
      subsRepo.createInvoice.mockResolvedValue(mockInvoice());

      await expect(
        service.renewSubscription(orgId, userOrgId, { plan: 'enterprise', durationMonths: 36 }),
      ).resolves.not.toThrow();
    });

    it('payInvoice — cancelled invoice throws BAD_REQUEST', async () => {
      subsRepo.findInvoiceById.mockResolvedValue(mockInvoice({ orgId, status: 'cancelled' }));

      await expect(service.payInvoice(orgId, 'inv-001', userOrgId)).rejects.toThrow(BadRequestException);
    });

    it('listInvoices — page 50 computes offset 980', async () => {
      subsRepo.findInvoicesByOrgId.mockResolvedValue([]);

      await service.listInvoices(orgId, userOrgId, { page: 50, limit: 20 });

      expect(subsRepo.findInvoicesByOrgId).toHaveBeenCalledWith(orgId, { limit: 20, offset: 980 });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/billing/billing.service.spec.ts
```
Expected: FAIL — `BillingService` not found.

- [ ] **Step 3: Implement BillingService**

Note: The existing `SubscriptionsRepository` does not have `findInvoiceById` or paginated `findInvoicesByOrgId`. We need to add these methods first.

**3a. Add methods to SubscriptionsRepository:**

In `packages/db/src/repositories/subscriptions.repository.ts`, add:

```typescript
async findInvoiceById(id: string) {
  const rows = await this.db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return rows[0] ?? null;
}

async findInvoicesByOrgId(orgId: string, opts?: { limit?: number; offset?: number }) {
  return this.db
    .select()
    .from(invoices)
    .where(eq(invoices.orgId, orgId))
    .limit(opts?.limit ?? 20)
    .offset(opts?.offset ?? 0);
}
```

Also add `desc` import and ordering:

```typescript
import { eq, desc } from "drizzle-orm";
```

**3b. Implement BillingService:**

```typescript
// apps/api/src/modules/billing/billing.service.ts
import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionsRepository, OrganizationsRepository } from '@rwa-dataroom/db';
import type { RenewSubscriptionDto, InvoicesQueryDto } from './billing.schemas.js';

@Injectable()
export class BillingService {
  constructor(
    @Inject(SubscriptionsRepository) private readonly subsRepo: SubscriptionsRepository,
    @Inject(OrganizationsRepository) private readonly orgsRepo: OrganizationsRepository,
  ) {}

  private assertOrgAccess(orgId: string, userOrgId: string | null) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Not a member of this organization' });
    }
  }

  async getSubscription(orgId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const sub = await this.subsRepo.findByOrgId(orgId);
    if (!sub) throw new NotFoundException({ code: 'SUBSCRIPTION_NOT_FOUND', message: 'No subscription found' });
    return sub;
  }

  async renewSubscription(orgId: string, userOrgId: string | null, dto: RenewSubscriptionDto) {
    this.assertOrgAccess(orgId, userOrgId);

    const now = new Date();
    let sub = await this.subsRepo.findByOrgId(orgId);

    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + dto.durationMonths);

    if (!sub) {
      // Create new subscription
      sub = await this.subsRepo.create({
        orgId,
        plan: dto.plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        amount: '0', // Pricing logic would go here
        currency: 'SGD',
      });
    } else {
      // Extend existing subscription
      const rows = await this.subsRepo.update(sub.id, {
        plan: dto.plan,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      sub = rows[0] ?? sub;
    }

    // Create invoice
    const dueAt = new Date(now);
    dueAt.setDate(dueAt.getDate() + 30);

    const invoice = await this.subsRepo.createInvoice({
      orgId,
      subscriptionId: sub.id,
      amount: sub.amount ?? '0',
      currency: sub.currency ?? 'SGD',
      status: 'pending',
      dueAt,
    });

    return { subscription: sub, invoice };
  }

  async listInvoices(orgId: string, userOrgId: string | null, query: InvoicesQueryDto) {
    this.assertOrgAccess(orgId, userOrgId);
    const offset = (query.page - 1) * query.limit;
    const data = await this.subsRepo.findInvoicesByOrgId(orgId, { limit: query.limit, offset });
    return { data, page: query.page, limit: query.limit };
  }

  async getInvoice(orgId: string, invoiceId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const invoice = await this.subsRepo.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    if (invoice.orgId !== orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Invoice does not belong to this org' });
    return invoice;
  }

  async payInvoice(orgId: string, invoiceId: string, userOrgId: string | null) {
    this.assertOrgAccess(orgId, userOrgId);
    const invoice = await this.subsRepo.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundException({ code: 'INVOICE_NOT_FOUND', message: 'Invoice not found' });
    if (invoice.orgId !== orgId) throw new ForbiddenException({ code: 'NOT_IN_ORG', message: 'Invoice does not belong to this org' });
    if (invoice.status === 'paid' || invoice.status === 'cancelled') {
      throw new BadRequestException({ code: 'INVOICE_NOT_PAYABLE', message: `Invoice is already ${invoice.status}` });
    }

    const rows = await this.subsRepo.updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date(),
    });
    return rows[0] ?? invoice;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/billing/billing.service.spec.ts
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/subscriptions.repository.ts apps/api/src/modules/billing/billing.service.ts apps/api/src/test/billing/billing.service.spec.ts
git commit -m "feat(billing): add BillingService with unit tests"
```

---

### Task 10: Billing Module — Controller

**Files:**
- Create: `apps/api/src/modules/billing/billing.controller.ts`
- Test: `apps/api/src/test/billing/billing.controller.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/billing/billing.controller.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingController } from '../../modules/billing/billing.controller.js';
import type { BillingService } from '../../modules/billing/billing.service.js';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: Record<string, any>;

  const orgId = 'org-001';
  const mockUser = {
    sub: 'user-001',
    address: '0x' + 'a'.repeat(64),
    orgId,
    orgRole: 32,
    sid: 'sid-1',
    jti: 'jti-1',
    iat: 1700000000,
    exp: 1700001000,
  };

  const mockSub = { id: 'sub-001', orgId, plan: 'pro', status: 'active' };
  const mockInvoice = { id: 'inv-001', orgId, amount: '1200.00', status: 'pending' };

  beforeEach(() => {
    billingService = {
      getSubscription: vi.fn().mockResolvedValue(mockSub),
      renewSubscription: vi.fn().mockResolvedValue({ subscription: mockSub, invoice: mockInvoice }),
      listInvoices: vi.fn().mockResolvedValue({ data: [mockInvoice], page: 1, limit: 20 }),
      getInvoice: vi.fn().mockResolvedValue(mockInvoice),
      payInvoice: vi.fn().mockResolvedValue({ ...mockInvoice, status: 'paid' }),
    };
    controller = new BillingController(billingService as unknown as BillingService);
  });

  describe('GET /orgs/:orgId/subscription', () => {
    it('delegates to billingService.getSubscription', async () => {
      const result = await controller.getSubscription(orgId, mockUser as any);

      expect(billingService.getSubscription).toHaveBeenCalledWith(orgId, mockUser.orgId);
      expect(result).toEqual(mockSub);
    });
  });

  describe('POST /orgs/:orgId/subscription/renew', () => {
    it('delegates to billingService.renewSubscription', async () => {
      const dto = { plan: 'pro' as const, durationMonths: 12 };
      const result = await controller.renewSubscription(orgId, mockUser as any, dto);

      expect(billingService.renewSubscription).toHaveBeenCalledWith(orgId, mockUser.orgId, dto);
      expect(result).toHaveProperty('subscription');
      expect(result).toHaveProperty('invoice');
    });
  });

  describe('GET /orgs/:orgId/invoices', () => {
    it('delegates to billingService.listInvoices', async () => {
      const query = { page: 1, limit: 20 };
      const result = await controller.listInvoices(orgId, mockUser as any, query);

      expect(billingService.listInvoices).toHaveBeenCalledWith(orgId, mockUser.orgId, query);
    });
  });

  describe('GET /orgs/:orgId/invoices/:id', () => {
    it('delegates to billingService.getInvoice', async () => {
      const result = await controller.getInvoice(orgId, 'inv-001', mockUser as any);

      expect(billingService.getInvoice).toHaveBeenCalledWith(orgId, 'inv-001', mockUser.orgId);
    });
  });

  describe('POST /orgs/:orgId/invoices/:id/pay', () => {
    it('delegates to billingService.payInvoice', async () => {
      const result = await controller.payInvoice(orgId, 'inv-001', mockUser as any);

      expect(billingService.payInvoice).toHaveBeenCalledWith(orgId, 'inv-001', mockUser.orgId);
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('all methods propagate service errors', async () => {
      const err = new Error('DB failed');
      billingService.getSubscription.mockRejectedValue(err);
      billingService.renewSubscription.mockRejectedValue(err);
      billingService.listInvoices.mockRejectedValue(err);
      billingService.getInvoice.mockRejectedValue(err);
      billingService.payInvoice.mockRejectedValue(err);

      await expect(controller.getSubscription(orgId, mockUser as any)).rejects.toThrow('DB failed');
      await expect(controller.renewSubscription(orgId, mockUser as any, { plan: 'pro', durationMonths: 12 })).rejects.toThrow('DB failed');
      await expect(controller.listInvoices(orgId, mockUser as any, { page: 1, limit: 20 })).rejects.toThrow('DB failed');
      await expect(controller.getInvoice(orgId, 'inv-001', mockUser as any)).rejects.toThrow('DB failed');
      await expect(controller.payInvoice(orgId, 'inv-001', mockUser as any)).rejects.toThrow('DB failed');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/billing/billing.controller.spec.ts
```

- [ ] **Step 3: Implement BillingController**

```typescript
// apps/api/src/modules/billing/billing.controller.ts
import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { renewSubscriptionSchema, invoicesQuerySchema } from './billing.schemas.js';

interface JwtPayload {
  sub: string;
  address: string;
  orgId: string | null;
  orgRole: number;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('orgs/:orgId/subscription')
  async getSubscription(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.getSubscription(orgId, user.orgId);
  }

  @Post('orgs/:orgId/subscription/renew')
  async renewSubscription(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(renewSubscriptionSchema)) dto: any,
  ) {
    return this.billingService.renewSubscription(orgId, user.orgId, dto);
  }

  @Get('orgs/:orgId/invoices')
  async listInvoices(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query(new ZodValidationPipe(invoicesQuerySchema)) query: any,
  ) {
    return this.billingService.listInvoices(orgId, user.orgId, query);
  }

  @Get('orgs/:orgId/invoices/:id')
  async getInvoice(
    @Param('orgId') orgId: string,
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.getInvoice(orgId, invoiceId, user.orgId);
  }

  @Post('orgs/:orgId/invoices/:id/pay')
  @HttpCode(HttpStatus.OK)
  async payInvoice(
    @Param('orgId') orgId: string,
    @Param('id') invoiceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.billingService.payInvoice(orgId, invoiceId, user.orgId);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/billing/billing.controller.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/billing/billing.controller.ts apps/api/src/test/billing/billing.controller.spec.ts
git commit -m "feat(billing): add BillingController with unit tests"
```

---

### Task 11: Billing Module — Wire Up

**Files:**
- Create: `apps/api/src/modules/billing/billing.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create module**

```typescript
// apps/api/src/modules/billing/billing.module.ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
```

- [ ] **Step 2: Add to app.module.ts**

```typescript
import { BillingModule } from './modules/billing/billing.module.js';

// In @Module imports array, after NotificationsModule:
BillingModule,
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/billing/billing.module.ts apps/api/src/app.module.ts
git commit -m "feat(billing): wire BillingModule into AppModule"
```

---

## Chunk 3: Background Workers

### Task 12: NotificationDispatcherService (event-driven)

**Files:**
- Create: `apps/api/src/workers/notification-dispatcher.service.ts`
- Test: `apps/api/src/test/workers/notification-dispatcher.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/workers/notification-dispatcher.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationDispatcherService } from '../../workers/notification-dispatcher.service.js';

describe('NotificationDispatcherService', () => {
  let dispatcher: NotificationDispatcherService;
  let notifRepo: any;
  let prefsRepo: any;

  beforeEach(() => {
    notifRepo = { create: vi.fn().mockResolvedValue({ id: 'notif-001' }) };
    prefsRepo = { findByUserId: vi.fn() };
    dispatcher = new NotificationDispatcherService(notifRepo, prefsRepo);
  });

  describe('dispatch', () => {
    it('creates notification for each recipient', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null); // defaults = all enabled

      await dispatcher.dispatch({
        type: 'pool_state_changed',
        title: 'Pool moved to REVIEW',
        body: 'Pool X moved to REVIEW state',
        recipientUserIds: ['user-1', 'user-2'],
        relatedPoolId: 'pool-001',
      });

      expect(notifRepo.create).toHaveBeenCalledTimes(2);
      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          type: 'pool_state_changed',
          title: 'Pool moved to REVIEW',
        }),
      );
    });

    it('skips dispatch if user has disabled in_app for this type', async () => {
      prefsRepo.findByUserId.mockResolvedValue({
        inAppEnabled: true,
        preferences: { pool_state_changed: { in_app: false } },
      });

      await dispatcher.dispatch({
        type: 'pool_state_changed',
        title: 'test',
        recipientUserIds: ['user-1'],
      });

      expect(notifRepo.create).not.toHaveBeenCalled();
    });

    it('skips dispatch if user has globally disabled in_app', async () => {
      prefsRepo.findByUserId.mockResolvedValue({
        inAppEnabled: false,
        preferences: {},
      });

      await dispatcher.dispatch({
        type: 'pool_state_changed',
        title: 'test',
        recipientUserIds: ['user-1'],
      });

      expect(notifRepo.create).not.toHaveBeenCalled();
    });

    it('still dispatches if no preferences exist (defaults enabled)', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);

      await dispatcher.dispatch({
        type: 'member_added',
        title: 'Welcome',
        recipientUserIds: ['user-1'],
      });

      expect(notifRepo.create).toHaveBeenCalledTimes(1);
    });

    it('handles empty recipientUserIds gracefully', async () => {
      await dispatcher.dispatch({
        type: 'test',
        title: 'test',
        recipientUserIds: [],
      });

      expect(notifRepo.create).not.toHaveBeenCalled();
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('does not throw if create fails for one recipient', async () => {
      prefsRepo.findByUserId.mockResolvedValue(null);
      notifRepo.create
        .mockResolvedValueOnce({ id: 'n1' })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 'n3' });

      // Should not throw — fire-and-forget pattern
      await expect(
        dispatcher.dispatch({
          type: 'test',
          title: 'test',
          recipientUserIds: ['u1', 'u2', 'u3'],
        }),
      ).resolves.not.toThrow();

      expect(notifRepo.create).toHaveBeenCalledTimes(3);
    });

    it('subscription notifications cannot be disabled', async () => {
      prefsRepo.findByUserId.mockResolvedValue({
        inAppEnabled: false,
        preferences: { subscription_expiring: { in_app: false } },
      });

      await dispatcher.dispatch({
        type: 'subscription_expiring',
        title: 'Sub expiring',
        recipientUserIds: ['user-1'],
      });

      // subscription notifications bypass preferences
      expect(notifRepo.create).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/workers/notification-dispatcher.spec.ts
```

- [ ] **Step 3: Implement NotificationDispatcherService**

```typescript
// apps/api/src/workers/notification-dispatcher.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { NotificationsRepository, NotificationPreferencesRepository } from '@rwa-dataroom/db';

export interface DispatchPayload {
  type: string;
  title: string;
  body?: string;
  recipientUserIds: string[];
  relatedPoolId?: string;
  relatedDocumentId?: string;
}

// These notification types CANNOT be disabled by user preferences
const MANDATORY_TYPES = new Set([
  'subscription_expiring',
  'subscription_expired',
  'invoice_overdue',
]);

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    @Inject(NotificationsRepository) private readonly notifRepo: NotificationsRepository,
    @Inject(NotificationPreferencesRepository) private readonly prefsRepo: NotificationPreferencesRepository,
  ) {}

  async dispatch(payload: DispatchPayload): Promise<void> {
    for (const userId of payload.recipientUserIds) {
      try {
        const shouldSend = await this.shouldSendInApp(userId, payload.type);
        if (!shouldSend) continue;

        await this.notifRepo.create({
          userId,
          type: payload.type,
          title: payload.title,
          body: payload.body ?? null,
          relatedPoolId: payload.relatedPoolId ?? null,
          relatedDocumentId: payload.relatedDocumentId ?? null,
        });
      } catch (err) {
        this.logger.error(`Failed to dispatch notification to ${userId}`, err);
      }
    }
  }

  private async shouldSendInApp(userId: string, type: string): Promise<boolean> {
    if (MANDATORY_TYPES.has(type)) return true;

    const prefs = await this.prefsRepo.findByUserId(userId);
    if (!prefs) return true; // defaults = all enabled

    if (!prefs.inAppEnabled) return false;

    const typePrefs = (prefs.preferences as Record<string, any>)?.[type];
    if (typePrefs && typePrefs.in_app === false) return false;

    return true;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/workers/notification-dispatcher.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/notification-dispatcher.service.ts apps/api/src/test/workers/notification-dispatcher.spec.ts
git commit -m "feat(workers): add NotificationDispatcherService with unit tests"
```

---

### Task 13: SubscriptionMonitorService (cron)

**Files:**
- Create: `apps/api/src/workers/subscription-monitor.service.ts`
- Test: `apps/api/src/test/workers/subscription-monitor.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/test/workers/subscription-monitor.spec.ts
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionMonitorService } from '../../workers/subscription-monitor.service.js';

describe('SubscriptionMonitorService', () => {
  let monitor: SubscriptionMonitorService;
  let subsRepo: any;
  let dispatcher: any;

  const mockSub = (overrides: any = {}) => ({
    id: 'sub-001',
    orgId: 'org-001',
    plan: 'pro',
    status: 'active',
    currentPeriodEnd: new Date('2026-03-20'),
    gracePeriodEnd: null,
    penaltyRate: '1.30',
    ...overrides,
  });

  beforeEach(() => {
    subsRepo = {
      findExpiring: vi.fn().mockResolvedValue([]),
      findGracePeriodExpired: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue([]),
    };
    dispatcher = {
      dispatch: vi.fn().mockResolvedValue(undefined),
    };
    monitor = new SubscriptionMonitorService(subsRepo, dispatcher);
  });

  describe('handleCron', () => {
    it('does nothing when no expiring subscriptions', async () => {
      subsRepo.findExpiring.mockResolvedValue([]);
      subsRepo.findGracePeriodExpired.mockResolvedValue([]);

      await monitor.handleCron();

      expect(subsRepo.update).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('transitions expired active subs to grace_period', async () => {
      const expiredSub = mockSub({ status: 'active', currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([expiredSub]);

      await monitor.handleCron();

      expect(subsRepo.update).toHaveBeenCalledWith(
        'sub-001',
        expect.objectContaining({ status: 'grace_period' }),
      );
    });

    it('transitions grace_period expired subs to suspended', async () => {
      const graceSub = mockSub({
        status: 'grace_period',
        gracePeriodEnd: new Date('2026-03-10'),
      });
      subsRepo.findGracePeriodExpired.mockResolvedValue([graceSub]);

      await monitor.handleCron();

      expect(subsRepo.update).toHaveBeenCalledWith('sub-001', expect.objectContaining({ status: 'suspended' }));
    });

    it('dispatches notification for expiring subscriptions', async () => {
      const expiringSub = mockSub({ currentPeriodEnd: new Date('2026-03-10') });
      subsRepo.findExpiring.mockResolvedValue([expiringSub]);

      await monitor.handleCron();

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'subscription_expiring' }),
      );
    });
  });

  // ─── Monkey tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('handles repo errors gracefully without crashing', async () => {
      subsRepo.findExpiring.mockRejectedValue(new Error('DB down'));

      await expect(monitor.handleCron()).resolves.not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx vitest run src/test/workers/subscription-monitor.spec.ts
```

- [ ] **Step 3: Implement SubscriptionMonitorService**

Note: The existing `SubscriptionsRepository` does not have `findExpiring` or `findGracePeriodExpired` methods. Add them:

**3a. Add methods to SubscriptionsRepository:**

```typescript
// Add these to packages/db/src/repositories/subscriptions.repository.ts
import { eq, and, lte, inArray } from "drizzle-orm";

async findExpiring(beforeDate: Date) {
  return this.db
    .select()
    .from(subscriptions)
    .where(
      and(
        inArray(subscriptions.status, ['active', 'trial']),
        lte(subscriptions.currentPeriodEnd, beforeDate),
      ),
    );
}

async findGracePeriodExpired(beforeDate: Date) {
  return this.db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'grace_period'),
        lte(subscriptions.gracePeriodEnd, beforeDate),
      ),
    );
}
```

**3b. Implement SubscriptionMonitorService:**

```typescript
// apps/api/src/workers/subscription-monitor.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsRepository } from '@rwa-dataroom/db';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';

@Injectable()
export class SubscriptionMonitorService {
  private readonly logger = new Logger(SubscriptionMonitorService.name);

  constructor(
    @Inject(SubscriptionsRepository) private readonly subsRepo: SubscriptionsRepository,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    try {
      await this.checkExpiring();
      await this.checkGracePeriodExpired();
    } catch (err) {
      this.logger.error('Subscription monitor failed', err);
    }
  }

  private async checkExpiring() {
    const now = new Date();
    const expiring = await this.subsRepo.findExpiring(now);

    for (const sub of expiring) {
      const gracePeriodEnd = new Date(now);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 14);

      await this.subsRepo.update(sub.id, {
        status: 'grace_period',
        gracePeriodEnd,
      });

      // Notify org admins — for now use orgId as placeholder
      // In production, would look up org admin user IDs
      await this.dispatcher.dispatch({
        type: 'subscription_expiring',
        title: `Subscription expired for org ${sub.orgId}`,
        body: `Your ${sub.plan} subscription has expired. You have a 14-day grace period.`,
        recipientUserIds: [sub.orgId], // TODO: resolve to actual user IDs
      });
    }
  }

  private async checkGracePeriodExpired() {
    const now = new Date();
    const expired = await this.subsRepo.findGracePeriodExpired(now);

    for (const sub of expired) {
      await this.subsRepo.update(sub.id, { status: 'suspended' });

      await this.dispatcher.dispatch({
        type: 'subscription_expired',
        title: `Account suspended for org ${sub.orgId}`,
        body: 'Your grace period has ended. Account is now suspended.',
        recipientUserIds: [sub.orgId],
      });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && npx vitest run src/test/workers/subscription-monitor.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repositories/subscriptions.repository.ts apps/api/src/workers/subscription-monitor.service.ts apps/api/src/test/workers/subscription-monitor.spec.ts
git commit -m "feat(workers): add SubscriptionMonitorService with daily cron"
```

---

### Task 14: Walrus Renewal + Cost Tracker Stubs

**Files:**
- Create: `apps/api/src/workers/walrus-renewal.service.ts`
- Create: `apps/api/src/workers/cost-tracker.service.ts`

- [ ] **Step 1: Create WalrusRenewalService stub**

```typescript
// apps/api/src/workers/walrus-renewal.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WalrusRenewalService {
  private readonly logger = new Logger(WalrusRenewalService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCron() {
    this.logger.log('Walrus renewal check — stub (no Walrus deployed yet)');
    // TODO: Phase 2 — check blobs expiring within 30 days, renew via WalrusClient
  }
}
```

- [ ] **Step 2: Create CostTrackerService stub**

```typescript
// apps/api/src/workers/cost-tracker.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CostTrackerService {
  private readonly logger = new Logger(CostTrackerService.name);

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleCron() {
    this.logger.log('Cost tracker aggregation — stub (no Walrus deployed yet)');
    // TODO: Phase 2 — aggregate Walrus storage costs per pool per billing period
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/workers/walrus-renewal.service.ts apps/api/src/workers/cost-tracker.service.ts
git commit -m "feat(workers): add Walrus renewal + cost tracker stubs"
```

---

### Task 15: Workers Module — Wire Up

**Files:**
- Create: `apps/api/src/workers/workers.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create WorkersModule**

```typescript
// apps/api/src/workers/workers.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationDispatcherService } from './notification-dispatcher.service.js';
import { SubscriptionMonitorService } from './subscription-monitor.service.js';
import { WalrusRenewalService } from './walrus-renewal.service.js';
import { CostTrackerService } from './cost-tracker.service.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    NotificationDispatcherService,
    SubscriptionMonitorService,
    WalrusRenewalService,
    CostTrackerService,
  ],
  exports: [NotificationDispatcherService],
})
export class WorkersModule {}
```

- [ ] **Step 2: Add to app.module.ts**

```typescript
import { WorkersModule } from './workers/workers.module.js';

// In @Module imports array, after BillingModule:
WorkersModule,
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/workers/workers.module.ts apps/api/src/app.module.ts
git commit -m "feat(workers): wire WorkersModule with ScheduleModule into AppModule"
```

---

## Chunk 4: E2E Tests + Integration

### Task 16: Update E2E Test Helpers

**Files:**
- Modify: `apps/api/test/helpers/mock-providers.ts`
- Modify: `apps/api/test/helpers/create-app.ts`

- [ ] **Step 1: Add new repos to MockRepos interface and createMockRepos()**

In `mock-providers.ts`, add to `MockRepos` interface:

```typescript
notificationsRepo: Record<string, ReturnType<typeof vi.fn>>;
notificationPrefsRepo: Record<string, ReturnType<typeof vi.fn>>;
subscriptionsRepo: Record<string, ReturnType<typeof vi.fn>>;
```

Add to `createMockRepos()`:

```typescript
notificationsRepo: {
  findByUserId: vi.fn(),
  create: vi.fn(),
  markAsRead: vi.fn(),
  markAsReadForUser: vi.fn(),
  markAllAsRead: vi.fn(),
},
notificationPrefsRepo: {
  findByUserId: vi.fn(),
  upsert: vi.fn(),
},
subscriptionsRepo: {
  findByOrgId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findInvoicesByOrgId: vi.fn(),
  findInvoiceById: vi.fn(),
  createInvoice: vi.fn(),
  updateInvoice: vi.fn(),
  findExpiring: vi.fn(),
  findGracePeriodExpired: vi.fn(),
},
```

- [ ] **Step 2: Update create-app.ts**

Add imports:

```typescript
import { NotificationsController } from '../../src/modules/notifications/notifications.controller.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { BillingController } from '../../src/modules/billing/billing.controller.js';
import { BillingService } from '../../src/modules/billing/billing.service.js';
import { NotificationDispatcherService } from '../../src/workers/notification-dispatcher.service.js';
import {
  // ... existing imports ...
  NotificationsRepository,
  NotificationPreferencesRepository,
  SubscriptionsRepository,
} from '@rwa-dataroom/db';
```

Add to controllers array:

```typescript
NotificationsController,
BillingController,
```

Add to providers array (services):

```typescript
NotificationsService,
BillingService,
NotificationDispatcherService,
```

Add to providers array (mock repos):

```typescript
{ provide: NotificationsRepository, useValue: repos.notificationsRepo },
{ provide: NotificationPreferencesRepository, useValue: repos.notificationPrefsRepo },
{ provide: SubscriptionsRepository, useValue: repos.subscriptionsRepo },
```

- [ ] **Step 3: Verify E2E test helpers compile**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/helpers/mock-providers.ts apps/api/test/helpers/create-app.ts
git commit -m "test: update E2E test helpers with Notification + Billing mocks"
```

---

### Task 17: Notification E2E Tests

**Files:**
- Create: `apps/api/test/e2e/notifications.e2e-spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// apps/api/test/e2e/notifications.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const mockNotif = (overrides: any = {}) => ({
  id: 'notif-001',
  userId: 'user-001',
  type: 'pool_state_changed',
  title: 'Pool state changed',
  body: 'Pool moved to REVIEW',
  relatedPoolId: 'pool-001',
  relatedDocumentId: null,
  isRead: false,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const mockPrefs = {
  id: 'pref-001',
  userId: 'user-001',
  emailEnabled: true,
  inAppEnabled: true,
  preferences: {},
};

describe('Notifications E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;
  let csrf: string;

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    resetMockRepos(t.repos);
    await t.redis.flushall();
    csrf = auth.getCsrfToken();
  });

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': csrf,
    };
  }

  // ─── GET /v1/notifications ───────────────────────────────

  describe('GET /v1/notifications', () => {
    it('200 — returns notifications for authenticated user', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([mockNotif()]);

      const res = await t.agent
        .get('/v1/notifications')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.page).toBe(1);
    });

    it('401 — no token', async () => {
      await t.agent.get('/v1/notifications').expect(401);
    });

    it('200 — pagination params forwarded', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.findByUserId.mockResolvedValue([]);

      await t.agent
        .get('/v1/notifications?page=2&limit=5')
        .set(authHeaders(user))
        .expect(200);

      expect(t.repos.notificationsRepo.findByUserId).toHaveBeenCalledWith(
        user.userId,
        { limit: 5, offset: 5 },
      );
    });
  });

  // ─── PATCH /v1/notifications/:id/read ────────────────────

  describe('PATCH /v1/notifications/:id/read', () => {
    it('200 — marks notification as read', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAsReadForUser.mockResolvedValue(undefined);

      const res = await t.agent
        .patch('/v1/notifications/notif-001/read')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toEqual({ id: 'notif-001', isRead: true });
    });

    it('403 — no CSRF token on mutation', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notifications/notif-001/read')
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .expect(403);
    });
  });

  // ─── POST /v1/notifications/read-all ─────────────────────

  describe('POST /v1/notifications/read-all', () => {
    it('200 — marks all as read', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAllAsRead.mockResolvedValue(undefined);

      const res = await t.agent
        .post('/v1/notifications/read-all')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toEqual({ success: true });
    });
  });

  // ─── GET /v1/notification-preferences ────────────────────

  describe('GET /v1/notification-preferences', () => {
    it('200 — returns user preferences', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);

      const res = await t.agent
        .get('/v1/notification-preferences')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body).toHaveProperty('emailEnabled');
    });

    it('200 — returns defaults when no preferences exist', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(null);

      const res = await t.agent
        .get('/v1/notification-preferences')
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.emailEnabled).toBe(true);
      expect(res.body.inAppEnabled).toBe(true);
    });
  });

  // ─── PATCH /v1/notification-preferences ──────────────────

  describe('PATCH /v1/notification-preferences', () => {
    it('200 — updates preferences', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(mockPrefs);
      t.repos.notificationPrefsRepo.upsert.mockResolvedValue({ ...mockPrefs, emailEnabled: false });

      const res = await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ emailEnabled: false })
        .expect(200);

      expect(res.body.emailEnabled).toBe(false);
    });

    it('400 — invalid body', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({ emailEnabled: 'not-a-boolean' })
        .expect(400);
    });
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
cd apps/api && npx vitest run -c vitest.config.e2e.ts test/e2e/notifications.e2e-spec.ts
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/e2e/notifications.e2e-spec.ts
git commit -m "test(e2e): add Notifications E2E tests"
```

---

### Task 18: Billing E2E Tests

**Files:**
- Create: `apps/api/test/e2e/billing.e2e-spec.ts`

- [ ] **Step 1: Write E2E tests**

```typescript
// apps/api/test/e2e/billing.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const ORG_ID = 'org-001';

const mockSub = (overrides: any = {}) => ({
  id: 'sub-001',
  orgId: ORG_ID,
  plan: 'pro',
  status: 'active',
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date('2027-01-01').toISOString(),
  amount: '1200.00',
  currency: 'SGD',
  ...overrides,
});

const mockInvoice = (overrides: any = {}) => ({
  id: 'inv-001',
  orgId: ORG_ID,
  subscriptionId: 'sub-001',
  amount: '1200.00',
  currency: 'SGD',
  status: 'pending',
  penaltyApplied: false,
  issuedAt: new Date().toISOString(),
  dueAt: new Date('2026-04-01').toISOString(),
  paidAt: null,
  ...overrides,
});

describe('Billing E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;
  let csrf: string;

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    resetMockRepos(t.repos);
    await t.redis.flushall();
    csrf = auth.getCsrfToken();
  });

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': csrf,
    };
  }

  // ─── GET /v1/orgs/:orgId/subscription ────────────────────

  describe('GET /v1/orgs/:orgId/subscription', () => {
    it('200 — returns subscription', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(mockSub());

      const res = await t.agent
        .get(`/v1/orgs/${ORG_ID}/subscription`)
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.plan).toBe('pro');
    });

    it('404 — no subscription', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(null);

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/subscription`)
        .set(authHeaders(user))
        .expect(404);
    });

    it('403 — user not in org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(mockSub());

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/subscription`)
        .set(authHeaders(user))
        .expect(403);
    });

    it('401 — no token', async () => {
      await t.agent.get(`/v1/orgs/${ORG_ID}/subscription`).expect(401);
    });
  });

  // ─── POST /v1/orgs/:orgId/subscription/renew ────────────

  describe('POST /v1/orgs/:orgId/subscription/renew', () => {
    it('201 — creates/renews subscription + invoice', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findByOrgId.mockResolvedValue(null);
      t.repos.subscriptionsRepo.create.mockResolvedValue(mockSub());
      t.repos.subscriptionsRepo.createInvoice.mockResolvedValue(mockInvoice());

      const res = await t.agent
        .post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user))
        .send({ plan: 'pro', durationMonths: 12 })
        .expect(201);

      expect(res.body).toHaveProperty('subscription');
      expect(res.body).toHaveProperty('invoice');
    });

    it('403 — wrong org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user))
        .send({ plan: 'pro', durationMonths: 12 })
        .expect(403);
    });

    it('400 — invalid plan', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user))
        .send({ plan: 'invalid_plan', durationMonths: 12 })
        .expect(400);
    });
  });

  // ─── GET /v1/orgs/:orgId/invoices ────────────────────────

  describe('GET /v1/orgs/:orgId/invoices', () => {
    it('200 — returns invoices', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoicesByOrgId.mockResolvedValue([mockInvoice()]);

      const res = await t.agent
        .get(`/v1/orgs/${ORG_ID}/invoices`)
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });

    it('403 — wrong org', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: 'other-org' });

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/invoices`)
        .set(authHeaders(user))
        .expect(403);
    });
  });

  // ─── GET /v1/orgs/:orgId/invoices/:id ────────────────────

  describe('GET /v1/orgs/:orgId/invoices/:id', () => {
    it('200 — returns single invoice', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(mockInvoice());

      const res = await t.agent
        .get(`/v1/orgs/${ORG_ID}/invoices/inv-001`)
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.id).toBe('inv-001');
    });

    it('404 — not found', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(null);

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/invoices/inv-999`)
        .set(authHeaders(user))
        .expect(404);
    });
  });

  // ─── POST /v1/orgs/:orgId/invoices/:id/pay ──────────────

  describe('POST /v1/orgs/:orgId/invoices/:id/pay', () => {
    it('200 — marks as paid', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(mockInvoice());
      t.repos.subscriptionsRepo.updateInvoice.mockResolvedValue([
        mockInvoice({ status: 'paid', paidAt: new Date().toISOString() }),
      ]);

      const res = await t.agent
        .post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set(authHeaders(user))
        .expect(200);

      expect(res.body.status).toBe('paid');
    });

    it('400 — already paid', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue(
        mockInvoice({ orgId: ORG_ID, status: 'paid' }),
      );

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set(authHeaders(user))
        .expect(400);
    });

    it('403 — no CSRF', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set({ Authorization: `Bearer ${user.accessToken}` })
        .expect(403);
    });
  });
});
```

- [ ] **Step 2: Run E2E tests**

```bash
cd apps/api && npx vitest run -c vitest.config.e2e.ts test/e2e/billing.e2e-spec.ts
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/e2e/billing.e2e-spec.ts
git commit -m "test(e2e): add Billing E2E tests"
```

---

### Task 19: Monkey E2E Tests

**Files:**
- Create: `apps/api/test/e2e/monkey-s3b.e2e-spec.ts`

- [ ] **Step 1: Write monkey E2E tests**

Focus on edge cases and adversarial inputs:

```typescript
// apps/api/test/e2e/monkey-s3b.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestApp, type TestApp } from '../helpers/create-app.js';
import { AuthHelper, type AuthUser } from '../helpers/auth.helper.js';
import { resetMockRepos } from '../helpers/mock-providers.js';

const ORG_ID = 'org-001';

describe('S3b Monkey E2E', () => {
  let t: TestApp;
  let auth: AuthHelper;
  let csrf: string;

  beforeAll(async () => {
    t = await createTestApp();
    auth = new AuthHelper(t.app);
  });

  afterAll(async () => {
    await t.app.close();
  });

  beforeEach(async () => {
    resetMockRepos(t.repos);
    await t.redis.flushall();
    csrf = auth.getCsrfToken();
  });

  function authHeaders(user: AuthUser) {
    return {
      Authorization: `Bearer ${user.accessToken}`,
      'x-csrf-token': csrf,
    };
  }

  // ─── Notifications ───────────────────────────────────────

  describe('Notifications monkey', () => {
    it('GET /notifications with page=0 → 400 validation error', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .get('/v1/notifications?page=0')
        .set(authHeaders(user))
        .expect(400);
    });

    it('GET /notifications with limit=999 → 400 (max 100)', async () => {
      const user = await auth.createAuthenticatedUser();

      await t.agent
        .get('/v1/notifications?limit=999')
        .set(authHeaders(user))
        .expect(400);
    });

    it('PATCH /notification-preferences with XSS in preferences key → sanitized/accepted', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationPrefsRepo.findByUserId.mockResolvedValue(null);
      t.repos.notificationPrefsRepo.upsert.mockImplementation((_uid: string, data: any) =>
        Promise.resolve({ userId: user.userId, emailEnabled: true, inAppEnabled: true, ...data }),
      );

      const res = await t.agent
        .patch('/v1/notification-preferences')
        .set(authHeaders(user))
        .send({
          preferences: { '<script>alert(1)</script>': { email: true } },
        })
        .expect(200);

      // Key is stored as-is (Zod z.record allows any string key) — XSS prevention is frontend responsibility
      expect(res.body.preferences).toHaveProperty('<script>alert(1)</script>');
    });

    it('PATCH /notifications/:id/read — SQL injection in id → no crash', async () => {
      const user = await auth.createAuthenticatedUser();
      t.repos.notificationsRepo.markAsRead.mockResolvedValue(undefined);

      await t.agent
        .patch("/v1/notifications/'; DROP TABLE notifications;--/read")
        .set(authHeaders(user))
        .expect(200);
    });
  });

  // ─── Billing ─────────────────────────────────────────────

  describe('Billing monkey', () => {
    it('POST /subscription/renew with durationMonths=0 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user))
        .send({ plan: 'pro', durationMonths: 0 })
        .expect(400);
    });

    it('POST /subscription/renew with durationMonths=37 → 400 (max 36)', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/subscription/renew`)
        .set(authHeaders(user))
        .send({ plan: 'pro', durationMonths: 37 })
        .expect(400);
    });

    it('GET /subscription with null orgId user → 403', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: null });

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/subscription`)
        .set(authHeaders(user))
        .expect(403);
    });

    it('POST /invoices/:id/pay — double pay attempt → 400 on second', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-001',
        orgId: ORG_ID,
        status: 'paid',
      });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set(authHeaders(user))
        .expect(400);
    });

    it('POST /invoices/:id/pay — cancelled invoice → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });
      t.repos.subscriptionsRepo.findInvoiceById.mockResolvedValue({
        id: 'inv-001',
        orgId: ORG_ID,
        status: 'cancelled',
      });

      await t.agent
        .post(`/v1/orgs/${ORG_ID}/invoices/inv-001/pay`)
        .set(authHeaders(user))
        .expect(400);
    });

    it('GET /invoices with page=-1 → 400', async () => {
      const user = await auth.createAuthenticatedUser({ orgId: ORG_ID });

      await t.agent
        .get(`/v1/orgs/${ORG_ID}/invoices?page=-1`)
        .set(authHeaders(user))
        .expect(400);
    });
  });
});
```

- [ ] **Step 2: Run monkey E2E tests**

```bash
cd apps/api && npx vitest run -c vitest.config.e2e.ts test/e2e/monkey-s3b.e2e-spec.ts
```
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/e2e/monkey-s3b.e2e-spec.ts
git commit -m "test(e2e): add S3b monkey E2E tests"
```

---

### Task 20: Run Full Test Suite + Typecheck

- [ ] **Step 1: Typecheck**

```bash
cd apps/api && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 2: Run all unit tests**

```bash
cd apps/api && npx vitest run
```
Expected: ALL PASS (previous ~397 + ~80 new ≈ ~477 unit tests)

- [ ] **Step 3: Run all E2E tests**

```bash
cd apps/api && npx vitest run -c vitest.config.e2e.ts
```
Expected: ALL PASS (previous ~199 + ~50 new ≈ ~249 E2E tests)

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A && git commit -m "fix: test fixups for S5 Session 3b"
```

---

## Summary

| Component | Files | Endpoints | Tests (est.) |
|-----------|-------|-----------|-------------|
| Notification module | 4 src + 2 test | 5 | ~30 unit + ~15 E2E |
| Billing module | 4 src + 2 test | 5 | ~30 unit + ~15 E2E |
| Workers | 4 src + 2 test | 0 (cron) | ~20 unit |
| E2E monkey | 1 test | — | ~12 E2E |
| **Total new** | **14 src + 8 test** | **10** | **~80 unit + ~42 E2E** |
| **Running total** | — | **~60 endpoints** | **~477 unit + ~241 E2E ≈ 718** |

**Dependencies to install:** `@nestjs/schedule`
**DB changes:** 1 new repository (NotificationPreferencesRepository), 4 new methods on SubscriptionsRepository, 1 new method on NotificationsRepository (`markAsReadForUser` — ownership-scoped variant of `markAsRead`)

**Review fixes applied:**
- `markAsRead` uses `markAsReadForUser(id, userId)` to scope updates to the notification owner (prevents users marking others' notifications as read)
- `POST /notifications/read-all` and `POST /invoices/:id/pay` should use `@HttpCode(HttpStatus.OK)` since they are update operations (NestJS defaults POST to 201)
- Response shape (camelCase vs snake_case, missing `meta`/`total`) deferred to Phase 2 serialization layer — all existing modules have the same pattern
