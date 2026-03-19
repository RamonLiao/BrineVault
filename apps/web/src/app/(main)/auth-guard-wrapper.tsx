'use client';

import type { ReactNode } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';

export function AuthGuardWrapper({ children }: { children: ReactNode }) {
  const { isLoading } = useAuthGuard();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
