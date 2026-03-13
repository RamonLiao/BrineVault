import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { JwtService } from '../../modules/auth/jwt.service.js';
import { SessionService } from '../../modules/auth/session.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'No auth token',
      });
    }

    try {
      const payload = await this.jwtService.verifyAccessToken(token);

      // Check blacklist
      if (await this.sessionService.isTokenBlacklisted(payload.jti)) {
        throw new UnauthorizedException({
          code: 'TOKEN_REVOKED',
          message: 'Token has been revoked',
        });
      }

      // Check session exists
      const session = await this.sessionService.getSession(payload.sid);
      if (!session) {
        throw new UnauthorizedException({
          code: 'SESSION_EXPIRED',
          message: 'Session expired',
        });
      }

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  }

  private extractToken(request: any): string | null {
    const auth = request.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }
}
