export interface JwtPayload {
  sub: string; // Sui address
  orgId: string;
  role: number; // global org role, not pool-specific
  sessionId: string;
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
