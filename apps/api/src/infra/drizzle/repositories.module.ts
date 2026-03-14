import { Global, Module } from '@nestjs/common';
import {
  UsersRepository,
  OrganizationsRepository,
  InviteCodesRepository,
  MembersRepository,
  PoolsRepository,
  DataroomsRepository,
  DocumentsRepository,
  DocumentVersionsRepository,
} from '@rwa-dataroom/db';
import type { Database } from '@rwa-dataroom/db';
import { DATABASE } from '../../common/constants.js';

const repositories = [
  UsersRepository,
  OrganizationsRepository,
  InviteCodesRepository,
  MembersRepository,
  PoolsRepository,
  DataroomsRepository,
  DocumentsRepository,
  DocumentVersionsRepository,
];

@Global()
@Module({
  providers: repositories.map((Repo) => ({
    provide: Repo,
    useFactory: (db: Database) => new Repo(db),
    inject: [DATABASE],
  })),
  exports: repositories,
})
export class RepositoriesModule {}
