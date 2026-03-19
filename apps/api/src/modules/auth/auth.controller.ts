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
import { authVerifyRequestSchema, verifyZkLoginRequestSchema } from '@rwa-dataroom/shared';
import type { AuthVerifyRequest, VerifyZkLoginRequest } from '@rwa-dataroom/shared';
import { Public } from '../../common/decorators/public.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('challenge')
  async getChallenge(@Req() req: Request) {
    return this.authService.generateChallenge(req.ip ?? '0.0.0.0');
  }

  @Public()
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

  @Public()
  @Post('verify-zklogin')
  @UsePipes(new ZodValidationPipe(verifyZkLoginRequestSchema))
  async verifyZkLogin(
    @Body() dto: VerifyZkLoginRequest,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.authService.verifyZkLogin(
      dto, req.ip ?? '0.0.0.0', req.headers['user-agent'] ?? '',
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

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response) {
    const refreshToken = (req as any).cookies?.refresh_token as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN', message: 'No refresh token' });
    }

    // Try to extract sid from Authorization header (optional — for backward compat)
    let sid: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { decodeJwt } = await import('jose');
        const payload = decodeJwt(authHeader.slice(7));
        sid = payload.sid as string;
      } catch {
        // Token may be expired/malformed — that's OK, we'll look up by hash
      }
    }

    const result = sid
      ? await this.authService.refresh(refreshToken, sid)
      : await this.authService.refreshByCookie(refreshToken);

    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/v1/auth',
    });
    return res.json({ access_token: result.accessToken, user: result.user });
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

  @Public()
  @Get('csrf-token')
  async getCsrfToken() {
    return { token: this.authService.generateCsrfToken() };
  }
}
