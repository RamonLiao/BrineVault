import { Global, Module, DynamicModule } from '@nestjs/common';
import { createDb } from '@rwa-dataroom/db';
import { DATABASE } from '../../common/constants.js';

@Global()
@Module({})
export class DrizzleModule {
  static forRoot(url: string): DynamicModule {
    return {
      module: DrizzleModule,
      providers: [
        {
          provide: DATABASE,
          useFactory: () => {
            const { db } = createDb({ url });
            return db;
          },
        },
      ],
      exports: [DATABASE],
    };
  }
}
