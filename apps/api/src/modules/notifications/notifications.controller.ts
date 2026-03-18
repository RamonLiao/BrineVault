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
