import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLE_KEY = 'requiredRole';
export const RequireRole = (role: number) => SetMetadata(REQUIRED_ROLE_KEY, role);
