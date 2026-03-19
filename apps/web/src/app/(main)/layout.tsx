import type { ReactNode } from 'react';
import { AuthProvider } from '@/providers/auth-provider';
import { MainLayout } from '@/components/layout/main-layout';

export default function MainGroupLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MainLayout>{children}</MainLayout>
    </AuthProvider>
  );
}
