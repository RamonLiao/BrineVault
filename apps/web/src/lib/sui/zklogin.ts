import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, jwtToAddress } from '@mysten/sui/zklogin';
import { createSaltProvider } from './salt-provider';
import type { ZkLoginProof } from '@/types';

const PROVING_SERVICE_URL = 'https://prover-dev.mystenlabs.com/v1';

interface ZkLoginSession {
  ephemeralKeyPair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  nonce: string;
}

/** Store ephemeral session to sessionStorage */
export function storeZkLoginSession(session: ZkLoginSession): void {
  sessionStorage.setItem('zklogin_session', JSON.stringify({
    secretKey: session.ephemeralKeyPair.getSecretKey(),
    maxEpoch: session.maxEpoch,
    randomness: session.randomness,
    nonce: session.nonce,
  }));
}

export function loadZkLoginSession(): ZkLoginSession | null {
  const raw = sessionStorage.getItem('zklogin_session');
  if (!raw) return null;
  const data = JSON.parse(raw);
  return {
    ephemeralKeyPair: Ed25519Keypair.fromSecretKey(data.secretKey),
    maxEpoch: data.maxEpoch,
    randomness: data.randomness,
    nonce: data.nonce,
  };
}

export function clearZkLoginSession(): void {
  sessionStorage.removeItem('zklogin_session');
}

/**
 * Step 1: Prepare OAuth redirect.
 * Generates ephemeral keypair, computes nonce, stores in sessionStorage.
 * Returns the OAuth URL to redirect to.
 */
export async function prepareZkLoginRedirect(
  provider: 'google' | 'apple',
  currentEpoch: number,
): Promise<string> {
  const maxEpoch = currentEpoch + 2;
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  storeZkLoginSession({ ephemeralKeyPair, maxEpoch, randomness, nonce });

  const redirectUri = `${window.location.origin}/callback`;
  const clientId = provider === 'google'
    ? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
    : process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!;

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email',
      nonce,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Apple
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email',
    nonce,
    response_mode: 'fragment',
  });
  return `https://appleid.apple.com/auth/authorize?${params}`;
}

/**
 * Step 2: Complete zkLogin after OAuth callback.
 * Called from the callback page with the id_token.
 */
export async function completeZkLogin(idToken: string): Promise<{
  jwt: string;
  zkProof: ZkLoginProof;
  ephemeralPubKey: string;
  maxEpoch: number;
  salt: string;
  address: string;
}> {
  const session = loadZkLoginSession();
  if (!session) throw new Error('No zkLogin session found');

  // Get salt
  const saltProvider = createSaltProvider();
  const salt = await saltProvider.getSalt(idToken);

  // Get ZK proof from proving service
  const proofRes = await fetch(PROVING_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jwt: idToken,
      extendedEphemeralPublicKey: session.ephemeralKeyPair.getPublicKey().toBase64(),
      maxEpoch: session.maxEpoch,
      jwtRandomness: session.randomness,
      salt,
      keyClaimName: 'sub',
    }),
  });
  if (!proofRes.ok) {
    const err = await proofRes.text();
    throw new Error(`Proving service error: ${err}`);
  }
  const zkProof: ZkLoginProof = await proofRes.json();

  // Derive address
  const address = jwtToAddress(idToken, salt, false);

  return {
    jwt: idToken,
    zkProof,
    ephemeralPubKey: session.ephemeralKeyPair.getPublicKey().toBase64(),
    maxEpoch: session.maxEpoch,
    salt,
    address,
  };
}
