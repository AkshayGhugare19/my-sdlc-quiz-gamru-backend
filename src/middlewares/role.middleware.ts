import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN', // legacy alias → SUPER_ADMIN (see auth/permissions)
  ADMIN: 'ADMIN', // organization administrator
  ORG_ADMIN: 'ORG_ADMIN', // legacy alias → ADMIN
  TRAINER: 'TRAINER',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  GUEST: 'GUEST',
} as const;

export type Role = keyof typeof ROLES;

// RBAC guard (gamru role.middleware pattern): 401 if unauthenticated, 403 if
// the user's role isn't in the allow-list.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role as Role)) return next(AppError.forbidden('Insufficient role'));
    return next();
  };
}

// Common bundles
export const platformAdmins = requireRole('SUPER_ADMIN', 'PLATFORM_ADMIN');
export const orgAdmins = requireRole('SUPER_ADMIN', 'PLATFORM_ADMIN', 'ORG_ADMIN');
export const contentAuthors = requireRole('SUPER_ADMIN', 'PLATFORM_ADMIN', 'ORG_ADMIN', 'TRAINER');
export const managers = requireRole('SUPER_ADMIN', 'PLATFORM_ADMIN', 'ORG_ADMIN', 'MANAGER');
