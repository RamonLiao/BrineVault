import { Global, Module } from '@nestjs/common';
import { SuiTxService } from './sui-tx.service.js';
import { SUI_TX_SERVICE } from '../../common/constants.js';
import { loadEnv } from '../../config/env.js';

@Global()
@Module({
  providers: [
    {
      provide: SUI_TX_SERVICE,
      useFactory: () => {
        const env = loadEnv();
        return new SuiTxService({
          rpcUrl: env.SUI_RPC_URL,
          packageId: env.SUI_PACKAGE_ID,
          platformKeypair: env.PLATFORM_KEYPAIR,
        });
      },
    },
  ],
  exports: [SUI_TX_SERVICE],
})
export class SuiModule {}
