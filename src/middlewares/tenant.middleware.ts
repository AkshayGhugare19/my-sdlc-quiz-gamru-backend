import type { Request, Response, NextFunction } from 'express';
import { runWithTenant } from '../tenancy/context';

// Binds the active organization for the whole request lifecycle.
// Resolution order (gamru tenant.middleware pattern, adapted to row-level):
//   1. Authenticated user's organizationId (from JWT)     — normal case
//   2. `x-organization-id` header                          — super-admin acting on a tenant / S2S
// Everything downstream (repositories, engines) reads the org from ALS, so no
// query can cross the tenant boundary.
export function bindTenant(req: Request, _res: Response, next: NextFunction) {
  const headerOrg = (req.headers['x-organization-id'] as string) || null;
  const role = req.user?.role ?? null;

  let organizationId: string | null = req.user?.organizationId ?? null;

  // Super/Platform admins may target a specific tenant via header.
  if ((role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN') && headerOrg) {
    organizationId = headerOrg;
  }

  return runWithTenant({ organizationId, userId: req.user?.id ?? null, role }, () => next());
}
