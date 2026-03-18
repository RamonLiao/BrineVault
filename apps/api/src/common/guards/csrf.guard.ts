import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { AuthService } from '../../modules/auth/auth.service.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only check mutation methods
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS')
      return true;

    // Skip for public routes (like POST /auth/verify, POST /auth/refresh)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const csrfToken = request.headers['x-csrf-token'];
    if (!csrfToken || !this.authService.verifyCsrfToken(csrfToken)) {
      throw new ForbiddenException({
        code: 'CSRF_INVALID',
        message: 'Invalid or missing CSRF token',
      });
    }

    return true;
  }
}
