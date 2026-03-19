'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useZkLogin } from '@/lib/api/hooks/use-auth';
import { Shield, Loader2 } from 'lucide-react';

export default function CallbackPage() {
  const router = useRouter();
  const zkLogin = useZkLogin();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');

    if (!idToken) {
      router.replace('/login');
      return;
    }

    zkLogin.mutate(idToken, {
      onSuccess: (data) => {
        router.replace(data.user.orgId ? '/dashboard' : '/onboarding');
      },
      onError: () => {
        router.replace('/login');
      },
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <Shield className="size-8 text-primary" />
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Completing sign-in...</span>
      </div>
      {zkLogin.isError && (
        <p className="text-sm text-destructive">
          Authentication service temporarily unavailable. Redirecting...
        </p>
      )}
    </div>
  );
}
