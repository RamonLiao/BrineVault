'use client';

import type { ReactNode } from 'react';
import { Web3Provider } from './web3-provider';

/**
 * Root-level client providers.
 * Keeps app/layout.tsx as a Server Component (preserves metadata exports).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <Web3Provider>
      {children}
    </Web3Provider>
  );
}
