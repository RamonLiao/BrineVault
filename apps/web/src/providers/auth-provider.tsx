'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { AuthMethod, AuthState, Organisation, User } from '@/types';

interface AuthContextValue extends AuthState {
  login: (user: User, token: string, method: AuthMethod, org: Organisation | null) => void;
  logout: () => void;
  setOrg: (org: Organisation) => void;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Organisation | null>(null);
  // JWT stored in ref — never in localStorage/sessionStorage.
  // Consumers must use getToken() to read the current value.
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

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken: null, // Always null — use getToken() instead. Kept for interface compat.
        authMethod,
        currentOrg,
        isAuthenticated: !!user,
        login,
        logout,
        setOrg,
        getToken,
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
