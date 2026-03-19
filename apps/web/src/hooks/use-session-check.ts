'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

/** Lightweight session check for (auth) routes — no AuthProvider needed */
export function useSessionCheck() {
  const [hasSession, setHasSession] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => setHasSession(res.ok))
      .catch(() => setHasSession(false))
      .finally(() => setIsLoading(false));
  }, []);

  return { hasSession, isLoading };
}
