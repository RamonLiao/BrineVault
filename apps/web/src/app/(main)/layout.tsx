'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';
import { AuthGuardWrapper } from './auth-guard-wrapper';

export default function MainGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGuardWrapper>
        <MainLayout>{children}</MainLayout>
      </AuthGuardWrapper>
    </AuthProvider>
  );
}
