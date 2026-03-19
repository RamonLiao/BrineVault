'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSignTransaction } from '@mysten/dapp-kit';
import { useAuth } from '@/providers/auth-provider';
import { queryKeys } from '@/lib/api/query-keys';

interface CreatePoolInput {
  name: string;
  borrowerEntity: string;
  targetNotional: string;
  currency: string;
  maturityDate: string;
  encryptionScheme: 0 | 1;
  tags: string[];
  members: { address: string; role: number }[];
}

interface BuildTxResponse {
  txBytes: string;
  poolId: string;
}

interface SubmitTxResponse {
  txDigest: string;
}

/** SHA-256 hash a string → 64-char hex (no 0x prefix) */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useCreatePool() {
  const { apiClient, currentOrg, authMethod } = useAuth();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const queryClient = useQueryClient();

  const adminConfigId =
    process.env.NEXT_PUBLIC_ADMIN_CONFIG_ID ?? '';

  return useMutation({
    mutationFn: async (input: CreatePoolInput): Promise<string> => {
      // 0. Guard: zkLogin signing deferred to Session 7
      if (authMethod === 'zklogin') {
        throw new Error('Pool creation requires wallet connection. zkLogin signing coming soon.');
      }

      // 1. Transform form data to backend DTO
      const orgIdHash = await sha256Hex(currentOrg?.id ?? '');
      const borrowerNameHash = await sha256Hex(input.borrowerEntity);
      const maturityTimestamp = Math.floor(
        new Date(input.maturityDate).getTime() / 1000,
      );

      // 2. Build unsigned TX
      const { txBytes, poolId } = await apiClient.post<BuildTxResponse>(
        '/pools',
        {
          adminConfigId,
          orgIdHash,
          name: input.name,
          borrowerNameHash,
          currency: input.currency,
          targetNotional: input.targetNotional,
          expectedMaturityDate: maturityTimestamp,
          encryptionScheme: input.encryptionScheme,
          tags: input.tags,
        },
      );

      // 3. Sign TX via wallet
      const { signature } = await signTransaction({
        transaction: txBytes as any,
      });

      // 4. Submit signed TX
      await apiClient.post<SubmitTxResponse>(`/pools/${poolId}/sign`, {
        txBytes,
        signature,
      });

      // 5. Add members (if any) — non-blocking failures
      for (const member of input.members) {
        try {
          await apiClient.post(`/pools/${poolId}/dataroom/members`, {
            adminConfigId,
            address: member.address,
            role: member.role,
            tags: [],
          });
        } catch {
          // Best-effort — pool already created, member add failure is non-fatal
          console.warn(`Failed to add member ${member.address}`);
        }
      }

      // 6. Invalidate pool list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.pools.all });

      return poolId;
    },
  });
}
