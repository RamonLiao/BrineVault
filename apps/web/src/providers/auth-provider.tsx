'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AuthMethod, AuthState, Organisation, User } from '@/types';
import { ApiClient } from '@/lib/api/client';

interface AuthContextValue extends AuthState {
  login: (user: User, token: string, method: AuthMethod, org: Organisation | null) => void;
  logout: () => void;
  setOrg: (org: Organisation) => void;
  getToken: () => string | null;
  isLoading: boolean;
  apiClient: ApiClient;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // JWT stored in ref — never in localStorage/sessionStorage.
  const tokenRef = useRef<string | null>(null);

  const login = useCallback(
    (u: User, token: string, method: AuthMethod, org: Organisation | null) => {
      setUser(u);
      setAuthMethod(method);
      setCurrentOrg(org);
      tokenRef.current = token;
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setAuthMethod(null);
    setCurrentOrg(null);
    tokenRef.current = null;
  }, []);

  const setOrg = useCallback((org: Organisation) => {
    setCurrentOrg(org);
  }, []);

  const getToken = useCallback(() => tokenRef.current, []);

  const onTokenRefreshed = useCallback((token: string) => {
    tokenRef.current = token;
  }, []);

  const apiClient = useMemo(
    () => new ApiClient(getToken, logout, onTokenRefreshed),
    [getToken, logout, onTokenRefreshed],
  );

  // On mount: attempt session restore via refresh cookie.
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        tokenRef.current = data.access_token;
        if (data.user) {
          setUser({
            id: data.user.id,
            address: data.user.address,
            displayName: data.user.displayName ?? null,
            email: null,
            authMethod: 'wallet',
          });
          if (data.user.orgId) {
            setCurrentOrg({ id: data.user.orgId, name: '', legalName: null, billingPlan: 'free_trial' });
          }
        }
      })
      .catch(() => { /* no valid session */ })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: null, // Always null — use getToken() instead.
        authMethod,
        currentOrg,
        isAuthenticated: !!user,
        login,
        logout,
        setOrg,
        getToken,
        isLoading,
        apiClient,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
