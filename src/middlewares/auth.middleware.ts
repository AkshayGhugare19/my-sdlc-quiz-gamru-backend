import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { AppError } from '../utils/AppError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; role: string; organizationId: string | null };
    }
  }
}

function extract(req: Request): string | null {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extract(req);
  if (!token) return next(AppError.unauthorized('Missing access token'));
  try {
    const p = verifyAccessToken(token);
    req.user = { id: p.sub, email: p.email, role: p.role, organizationId: p.organizationId ?? null };
    return next();
  } catch {
    return next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extract(req);
  if (token) {
    try {
      const p = verifyAccessToken(token);
      req.user = { id: p.sub, email: p.email, role: p.role, organizationId: p.organizationId ?? null };
    } catch {
      /* ignore */
    }
  }
  return next();
}
