'use client';

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { completeZkLogin, clearZkLoginSession } from '@/lib/sui/zklogin';
import type { AuthMethod } from '@/types';

export function useWalletLogin() {
  const { login, apiClient } = useAuth();

  return useMutation({
    mutationFn: async ({ address, signature, nonce }: {
      address: string;
      signature: string;
      nonce: string;
    }) => {
      const data = await apiClient.post<{
        access_token: string;
        user: { id: string; address: string; orgId: string | null; roleInOrg: number };
      }>('/auth/verify', { address, signature, nonce });
      return data;
    },
    onSuccess: (data) => {
      login(
        {
          id: data.user.id,
          address: data.user.address,
          displayName: null,
          email: null,
          authMethod: 'wallet' as AuthMethod,
        },
        data.access_token,
        'wallet',
        null,
      );
    },
  });
}

export function useZkLogin() {
  const { login, apiClient } = useAuth();

  return useMutation({
    mutationFn: async (idToken: string) => {
      const zkResult = await completeZkLogin(idToken);
      const data = await apiClient.post<{
        access_token: string;
        user: { id: string; address: string; orgId: string | null; roleInOrg: number };
      }>('/auth/verify-zklogin', {
        jwt: zkResult.jwt,
        zkProof: zkResult.zkProof,
        ephemeralPubKey: zkResult.ephemeralPubKey,
        maxEpoch: zkResult.maxEpoch,
        salt: zkResult.salt,
      });
      clearZkLoginSession();
      return data;
    },
    onSuccess: (data) => {
      login(
        {
          id: data.user.id,
          address: data.user.address,
          displayName: null,
          email: null,
          authMethod: 'zklogin' as AuthMethod,
        },
        data.access_token,
        'zklogin',
        null,
      );
    },
  });
}

export function useLogout() {
  const { logout, apiClient } = useAuth();

  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSettled: () => {
      clearZkLoginSession();
      logout();
    },
  });
}
