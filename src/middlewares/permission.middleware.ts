// Permission guards built on the RBAC matrix (src/auth/permissions.ts).
// These complement the existing `requireRole` guard — every protected API is
// gated by an explicit (resource, action) permission rather than an ad-hoc role
// list, so authorization stays consistent and auditable.
import type { Request, Response, NextFunction } from 'express';
import { can, Action } from '../auth/permissions';
import { AppError } from '../utils/AppError';

/** Require an explicit permission on a named resource. */
export function authorize(resource: string, action: Action) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!can(req.user.role, resource, action)) {
      return next(AppError.forbidden(`Not permitted to ${action} ${resource}`));
    }
    return next();
  };
}

// Map HTTP verbs to CRUD actions for the generic resource router.
const METHOD_ACTION: Record<string, Action> = {
  GET: 'view',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * Derive the resource from the mount path (req.baseUrl, e.g. '/api/missions')
 * and the action from the HTTP verb. Lets the generic CRUD factory enforce the
 * matrix without hard-coding a resource name at each of 20+ call sites.
 */
export function authorizeCrud() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(AppError.unauthorized());
    const resource = req.baseUrl.split('/').filter(Boolean).pop() || '';
    const action = METHOD_ACTION[req.method] ?? 'view';
    if (!can(req.user.role, resource, action)) {
      return next(AppError.forbidden(`Not permitted to ${action} ${resource}`));
    }
    return next();
  };
}
