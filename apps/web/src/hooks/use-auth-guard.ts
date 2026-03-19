'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';

export function useAuthGuard() {
  const { isAuthenticated, isLoading, currentOrg } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (!currentOrg && pathname !== '/onboarding') {
      router.replace('/onboarding');
    }
  }, [isAuthenticated, isLoading, currentOrg, pathname, router]);

  return { isLoading, isAuthenticated };
}
