import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_ROLE_KEY } from '../decorators/require-role.decorator.js';
import { MembersRepository } from '@rwa-dataroom/db';
import { hasRole } from '@rwa-dataroom/shared';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(MembersRepository)
    private readonly membersRepo: MembersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<number>(
      REQUIRED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRole === undefined) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'NO_USER',
        message: 'User not authenticated',
      });
    }

    // For org-level checks, use user.orgRole
    if (hasRole(user.orgRole, requiredRole)) return true;

    // For pool-level checks, look at route params
    const poolId = request.params?.poolId;
    if (poolId) {
      const member = await this.membersRepo.findByDataroomAndAddress(
        poolId,
        user.address,
      );
      if (member && hasRole(member.role, requiredRole)) return true;
    }

    throw new ForbiddenException({
      code: 'INSUFFICIENT_ROLE',
      message: 'Insufficient permissions',
    });
  }
}
