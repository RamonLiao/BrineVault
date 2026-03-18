import {
  Global,
  Module,
  DynamicModule,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS } from '../../common/constants.js';

@Global()
@Module({})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  static forRoot(url: string): DynamicModule {
    return {
      module: RedisModule,
      providers: [
        {
          provide: REDIS,
          useFactory: () => new Redis(url),
        },
      ],
      exports: [REDIS],
    };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
