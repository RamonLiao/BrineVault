import { Module } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtService } from './jwt.service.js';
import { SessionService } from './session.service.js';

@Module({
  providers: [AuthService, JwtService, SessionService],
  controllers: [AuthController],
  exports: [AuthService, JwtService, SessionService],
})
export class AuthModule {}
