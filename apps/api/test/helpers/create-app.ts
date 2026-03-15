import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import RedisMock from 'ioredis-mock';
import cookieParser from 'cookie-parser';
import supertest from 'supertest';

// Individual components — NOT module classes (avoids DrizzleModule/RedisModule)
import { HealthController } from '../../src/modules/health/health.controller.js';
import { AuthController } from '../../src/modules/auth/auth.controller.js';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { JwtService } from '../../src/modules/auth/jwt.service.js';
import { SessionService } from '../../src/modules/auth/session.service.js';
import { OrgsController } from '../../src/modules/orgs/orgs.controller.js';
import { OrgsService } from '../../src/modules/orgs/orgs.service.js';
import { PoolsController } from '../../src/modules/pools/pools.controller.js';
import { PoolsService } from '../../src/modules/pools/pools.service.js';
import { DataroomsController } from '../../src/modules/datarooms/datarooms.controller.js';
import { DataroomsService } from '../../src/modules/datarooms/datarooms.service.js';
import { DocumentsController } from '../../src/modules/documents/documents.controller.js';
import { DocumentsService } from '../../src/modules/documents/documents.service.js';
import { ReviewsController } from '../../src/modules/reviews/reviews.controller.js';
import { ReviewsService } from '../../src/modules/reviews/reviews.service.js';
import { ICDecisionsController } from '../../src/modules/ic-decisions/ic-decisions.controller.js';
import { ICDecisionsService } from '../../src/modules/ic-decisions/ic-decisions.service.js';
import { ChecklistController } from '../../src/modules/checklist/checklist.controller.js';
import { ChecklistService } from '../../src/modules/checklist/checklist.service.js';
import { AuditController } from '../../src/modules/audit/audit.controller.js';
import { AuditService } from '../../src/modules/audit/audit.service.js';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter.js';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor.js';
import { AuthGuard } from '../../src/common/guards/auth.guard.js';
import { CsrfGuard } from '../../src/common/guards/csrf.guard.js';
import { DATABASE, REDIS, SUI_TX_SERVICE } from '../../src/common/constants.js';
import {
  UsersRepository,
  OrganizationsRepository,
  InviteCodesRepository,
  MembersRepository,
  PoolsRepository,
  DataroomsRepository,
  DocumentsRepository,
  DocumentVersionsRepository,
  DocumentReviewsRepository,
  ICDecisionsRepository,
  ChecklistRepository,
  AuditEventsRepository,
} from '@rwa-dataroom/db';

import {
  createMockRepos,
  createMockDb,
  createMockSuiTxService,
  type MockRepos,
} from './mock-providers.js';

// ─── Public API ──────────────────────────────────────────────

export interface TestApp {
  app: INestApplication;
  agent: ReturnType<typeof supertest>;
  repos: MockRepos;
  db: ReturnType<typeof createMockDb>;
  redis: InstanceType<typeof RedisMock>;
  suiTxService: ReturnType<typeof createMockSuiTxService>;
}

export async function createTestApp(overrides?: {
  dbOverrides?: { execute?: any; select?: any };
  extraControllers?: any[];
  extraProviders?: any[];
}): Promise<TestApp> {
  const repos = createMockRepos();
  const db = createMockDb(overrides?.dbOverrides);
  const redis = new RedisMock();
  const suiTxService = createMockSuiTxService();

  const moduleRef = await Test.createTestingModule({
    controllers: [
      HealthController,
      AuthController,
      OrgsController,
      PoolsController,
      DataroomsController,
      DocumentsController,
      ReviewsController,
      ICDecisionsController,
      ChecklistController,
      AuditController,
      ...(overrides?.extraControllers ?? []),
    ],
    providers: [
      // Real services (use DI-injected mocks)
      AuthService,
      JwtService,
      SessionService,
      OrgsService,
      PoolsService,
      DataroomsService,
      DocumentsService,
      ReviewsService,
      ICDecisionsService,
      ChecklistService,
      AuditService,
      // Mock infrastructure
      { provide: DATABASE, useValue: db },
      { provide: REDIS, useValue: redis },
      // Mock repositories
      { provide: UsersRepository, useValue: repos.usersRepo },
      { provide: OrganizationsRepository, useValue: repos.orgsRepo },
      { provide: InviteCodesRepository, useValue: repos.inviteCodesRepo },
      { provide: MembersRepository, useValue: repos.membersRepo },
      { provide: PoolsRepository, useValue: repos.poolsRepo },
      { provide: DataroomsRepository, useValue: repos.dataroomsRepo },
      { provide: DocumentsRepository, useValue: repos.documentsRepo },
      { provide: DocumentVersionsRepository, useValue: repos.documentVersionsRepo },
      { provide: DocumentReviewsRepository, useValue: repos.documentReviewsRepo },
      { provide: ICDecisionsRepository, useValue: repos.icDecisionsRepo },
      { provide: ChecklistRepository, useValue: repos.checklistRepo },
      { provide: AuditEventsRepository, useValue: repos.auditEventsRepo },
      { provide: SUI_TX_SERVICE, useValue: suiTxService },
      // Global middleware
      { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
      { provide: APP_GUARD, useClass: AuthGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
      // Extra providers from caller
      ...(overrides?.extraProviders ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('v1');
  await app.init();

  const agent = supertest(app.getHttpServer());

  return { app, agent, repos, db, redis, suiTxService };
}
