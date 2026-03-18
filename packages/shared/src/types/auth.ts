export interface JwtPayload {
  sub: string;          // userId (uuid)
  address: string;      // Sui wallet address
  orgId: string | null; // nullable for new users
  orgRole: number;      // roleInOrg bitmask
  sid: string;          // session ID
  jti: string;          // unique token ID (for blacklisting)
  iat: number;
  exp: number;
}

export interface Session {
  id: string;
  userId: string;
  address: string;
  orgId: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  userAgent: string;
  ip: string;
  refreshTokenHash: string;
}

export interface AuthChallenge {
  nonce: string;
  timestamp: number;
  expiresAt: number;
}

export interface AuthVerifyRequest {
  address: string;
  signature: string;
  nonce: string;
}

export interface AuthVerifyResponse {
  accessToken: string;
  user: {
    address: string;
    displayName: string | null;
    orgId: string | null;
  };
}
