import { Module } from '@nestjs/common';
import { ICDecisionsController } from './ic-decisions.controller.js';
import { ICDecisionsService } from './ic-decisions.service.js';

@Module({
  controllers: [ICDecisionsController],
  providers: [ICDecisionsService],
  exports: [ICDecisionsService],
})
export class ICDecisionsModule {}
