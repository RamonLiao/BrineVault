import { Module } from '@nestjs/common';
import { OrgsService } from './orgs.service.js';
import { OrgsController } from './orgs.controller.js';

@Module({
  providers: [OrgsService],
  controllers: [OrgsController],
  exports: [OrgsService],
})
export class OrgsModule {}
