import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env';

export interface JwtUser {
  id: string;
  email: string;
  role: string;
  organizationId: string | null;
}

// --- User session tokens ---
export function signAccessToken(user: {
  id: string;
  email: string;
  role: string;
  organizationId?: string | null;
}) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId ?? null },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl } as jwt.SignOptions,
  );
}

export function signRefreshToken(user: { id: string }) {
  return jwt.sign({ sub: user.id, type: 'refresh' }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshTtl,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): any {
  return jwt.verify(token, env.jwt.accessSecret);
}

export function verifyRefreshToken(token: string): any {
  return jwt.verify(token, env.jwt.refreshSecret);
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// --- Short-lived signed token the "dumb" game client uses per game session ---
export function signGameSessionToken(p: { sessionId: string; userId: string; organizationId: string }) {
  return jwt.sign(
    { sessionId: p.sessionId, sub: p.userId, organizationId: p.organizationId, kind: 'game' },
    env.jwt.gameSessionSecret,
    { expiresIn: '2h' },
  );
}

export function verifyGameSessionToken(token: string): any {
  return jwt.verify(token, env.jwt.gameSessionSecret);
}
