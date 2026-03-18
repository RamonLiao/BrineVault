import { Module } from '@nestjs/common';
import { DataroomsController } from './datarooms.controller.js';
import { DataroomsService } from './datarooms.service.js';

@Module({
  controllers: [DataroomsController],
  providers: [DataroomsService],
  exports: [DataroomsService],
})
export class DataroomsModule {}
