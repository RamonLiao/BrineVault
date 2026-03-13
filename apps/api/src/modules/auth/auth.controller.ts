import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UsePipes,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { authVerifyRequestSchema } from '@rwa-dataroom/shared';
import type { AuthVerifyRequest } from '@rwa-dataroom/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // TODO: Add @Public() decorator (Task 8) to skip AuthGuard
  @Get('challenge')
  async getChallenge(@Req() req: Request) {
    return this.authService.generateChallenge(req.ip ?? '0.0.0.0');
  }

  // TODO: Add @Public() decorator (Task 8)
  @Post('verify')
  @UsePipes(new ZodValidationPipe(authVerifyRequestSchema))
  async verify(@Body() dto: AuthVerifyRequest, @Req() req: Request, @Res() res: Response) {
    const result = await this.authService.verifyAndLogin(
      dto,
      req.ip ?? '0.0.0.0',
      req.headers['user-agent'] ?? '',
    );
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/v1/auth',
    });
    return res.json({ access_token: result.accessToken, user: result.user });
  }

  // TODO: Add @Public() decorator (Task 8)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req as any).cookies?.refresh_token as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token' });
    }

    // Extract sid from the (possibly expired) access token in Authorization header
    const authHeader = req.headers.authorization;
    let sid: string;
    if (authHeader?.startsWith('Bearer ')) {
      const { decodeJwt } = await import('jose');
      const payload = decodeJwt(authHeader.slice(7));
      sid = payload.sid as string;
    } else {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'No access token for session reference',
      });
    }

    const result = await this.authService.refresh(refreshToken, sid);
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/v1/auth',
    });
    return res.json({ access_token: result.accessToken });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // req.user will be set by AuthGuard (Task 8). For now, decode from header.
    const user = (req as any).user;
    if (!user) {
      throw new UnauthorizedException({ code: 'NOT_AUTHENTICATED', message: 'Not authenticated' });
    }
    await this.authService.logout(user.sid, user.jti, user.exp);
    res.clearCookie('refresh_token', { path: '/v1/auth' });
    return res.status(204).send();
  }

  @Get('csrf-token')
  async getCsrfToken() {
    return { token: this.authService.generateCsrfToken() };
  }
}
