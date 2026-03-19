'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConnectModal, useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useWalletLogin } from '@/lib/api/hooks/use-auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export function WalletConnectButton() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signMessage } = useSignPersonalMessage();
  const walletLogin = useWalletLogin();
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(false);

  const performWalletAuth = useCallback(async () => {
    if (!currentAccount) return;
    setIsLoading(true);
    try {
      const challengeRes = await fetch(`${API_BASE}/auth/challenge`, {
        credentials: 'include',
      });
      const challenge = await challengeRes.json();

      const message = `Sign in to BrineVault\nNonce: ${challenge.nonce}\nTimestamp: ${challenge.timestamp}`;
      const { signature } = await signMessage({
        message: new TextEncoder().encode(message),
      });

      walletLogin.mutate(
        { address: currentAccount.address, signature, nonce: challenge.nonce },
        { onSettled: () => setIsLoading(false) },
      );
    } catch (err) {
      console.error('Wallet login failed:', err);
      setIsLoading(false);
    }
  }, [currentAccount, signMessage, walletLogin]);

  useEffect(() => {
    if (currentAccount && pendingAuth) {
      setPendingAuth(false);
      performWalletAuth();
    }
  }, [currentAccount, pendingAuth, performWalletAuth]);

  const handleClick = () => {
    if (currentAccount) {
      performWalletAuth();
    } else {
      setPendingAuth(true);
      setModalOpen(true);
    }
  };

  return (
    <>
      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trigger={
          <button
            onClick={handleClick}
            disabled={isLoading || walletLogin.isPending}
            className="flex w-full items-center gap-3 rounded-[10px] border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-150 ease-out hover:border-primary hover:bg-card disabled:opacity-50"
          >
            {isLoading || walletLogin.isPending ? (
              <div className="size-[18px] animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a4 4 0 00-8 0v2"/>
              </svg>
            )}
            <span>Connect Wallet</span>
          </button>
        }
      />
    </>
  );
}
