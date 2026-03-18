import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../constants.js';

export const RateLimit = (limit: number, windowSeconds: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, window: windowSeconds });
