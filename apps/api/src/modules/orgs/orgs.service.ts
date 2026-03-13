import {
  Injectable,
  Inject,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  OrganizationsRepository,
  UsersRepository,
  InviteCodesRepository,
  users,
} from '@rwa-dataroom/db';
import { eq } from 'drizzle-orm';
import { ROLES, hasRole } from '@rwa-dataroom/shared';
import type { CreateOrgDto, UpdateOrgDto, GenerateInviteDto, JoinOrgDto } from './orgs.schemas.js';
import { DATABASE } from '../../common/constants.js';

@Injectable()
export class OrgsService {
  constructor(
    @Inject(OrganizationsRepository) private readonly orgsRepo: OrganizationsRepository,
    @Inject(UsersRepository) private readonly usersRepo: UsersRepository,
    @Inject(InviteCodesRepository) private readonly inviteCodesRepo: InviteCodesRepository,
    @Inject(DATABASE) private readonly db: any,
  ) {}

  async createOrg(userId: string, dto: CreateOrgDto) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    if (user.orgId !== null) {
      throw new ConflictException({
        code: 'ALREADY_IN_ORG',
        message: 'User already belongs to an organization',
      });
    }

    const org = await this.orgsRepo.create({
      name: dto.name,
      legalName: dto.legalName ?? null,
      createdByUserId: userId,
    });

    await this.usersRepo.update(userId, {
      orgId: org.id,
      roleInOrg: ROLES.ORG_ADMIN,
    });

    return org;
  }

  async getOrg(orgId: string, userOrgId: string | null) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });
    }
    const org = await this.orgsRepo.findById(orgId);
    if (!org) {
      throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }
    return org;
  }

  async updateOrg(orgId: string, userOrgId: string | null, userOrgRole: number, dto: UpdateOrgDto) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });
    }
    if (!hasRole(userOrgRole, ROLES.ORG_ADMIN)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Requires ORG_ADMIN role',
      });
    }
    const rows = await this.orgsRepo.update(orgId, dto);
    return rows[0] ?? null;
  }

  async generateInvite(
    orgId: string,
    userId: string,
    userOrgId: string | null,
    userOrgRole: number,
    dto: GenerateInviteDto,
  ) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });
    }
    if (!hasRole(userOrgRole, ROLES.ORG_ADMIN)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'Requires ORG_ADMIN role',
      });
    }

    const org = await this.orgsRepo.findById(orgId);
    if (!org) {
      throw new NotFoundException({ code: 'ORG_NOT_FOUND', message: 'Organization not found' });
    }

    const code = this.buildInviteCode(org.name);
    const expiresAt = new Date(Date.now() + dto.expiresInHours * 3600000);

    await this.inviteCodesRepo.create({
      orgId,
      code,
      createdByUserId: userId,
      maxUses: dto.maxUses,
      expiresAt,
    });

    return { inviteCode: code, expiresAt, maxUses: dto.maxUses, usedCount: 0, role: dto.role };
  }

  async joinOrg(userId: string, dto: JoinOrgDto) {
    const user = await this.usersRepo.findById(userId);
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }
    if (user.orgId !== null) {
      throw new ConflictException({
        code: 'ALREADY_IN_ORG',
        message: 'User already belongs to an organization',
      });
    }

    const invite = await this.inviteCodesRepo.findByCode(dto.inviteCode);
    if (!invite) {
      throw new NotFoundException({
        code: 'INVALID_INVITE_CODE',
        message: 'Invalid invite code',
      });
    }

    if (invite.expiresAt <= new Date()) {
      throw new NotFoundException({
        code: 'INVITE_CODE_EXPIRED',
        message: 'Invite code has expired',
      });
    }

    if (invite.currentUses >= invite.maxUses) {
      throw new NotFoundException({
        code: 'INVITE_CODE_EXPIRED',
        message: 'Invite code has been fully used',
      });
    }

    const role = ROLES.VIEWER; // default role for joiners
    await this.usersRepo.update(userId, { orgId: invite.orgId, roleInOrg: role });
    await this.inviteCodesRepo.incrementUses(invite.id);

    const org = await this.orgsRepo.findById(invite.orgId);

    return {
      orgId: invite.orgId,
      orgName: org?.name ?? null,
      role,
      joinedAt: new Date().toISOString(),
    };
  }

  async listMembers(orgId: string, userOrgId: string | null, query: { page: number; limit: number }) {
    if (userOrgId !== orgId) {
      throw new ForbiddenException({
        code: 'NOT_IN_ORG',
        message: 'Not a member of this organization',
      });
    }

    const offset = (query.page - 1) * query.limit;

    const rows = await this.db
      .select({
        id: users.id,
        primaryWalletAddress: users.primaryWalletAddress,
        displayName: users.displayName,
        email: users.email,
        roleInOrg: users.roleInOrg,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.orgId, orgId))
      .limit(query.limit)
      .offset(offset);

    return { data: rows, page: query.page, limit: query.limit };
  }

  /** Build invite code: PREFIX-HEX4-HEX4 */
  buildInviteCode(orgName: string): string {
    const raw = orgName.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const prefix = raw.slice(0, 5).padEnd(5, 'X');
    const seg1 = randomBytes(2).toString('hex').toUpperCase();
    const seg2 = randomBytes(2).toString('hex').toUpperCase();
    return `${prefix}-${seg1}-${seg2}`;
  }
}
