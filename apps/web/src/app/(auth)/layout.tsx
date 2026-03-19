'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSessionCheck } from '@/hooks/use-session-check';

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { hasSession, isLoading } = useSessionCheck();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && hasSession) {
      router.replace('/dashboard');
    }
  }, [hasSession, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (hasSession) return null; // redirecting

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      {children}
    </div>
  );
}
