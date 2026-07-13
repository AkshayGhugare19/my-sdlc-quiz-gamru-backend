import type { Request, Response } from 'express';
import { ok, created } from '../../../utils/responseHandler';
import * as authService from '../service/auth.service';
import { abilitiesFor, normalizeRole } from '../../../auth/permissions';

function meta(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] as string };
}

// Admin-console sign-in (staff roles; player accounts are turned away).
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const data = await authService.login(email, password, meta(req), 'CONSOLE');
  return ok(res, data, 'Logged in');
}

// Game sign-in (EMPLOYEE/GUEST only; staff roles are turned away).
export async function loginGame(req: Request, res: Response) {
  const { email, password } = req.body;
  const data = await authService.login(email, password, meta(req), 'GAME');
  return ok(res, data, 'Logged in');
}

export async function register(req: Request, res: Response) {
  const data = await authService.register(req.body);
  return created(res, data, 'Registered');
}

export async function refresh(req: Request, res: Response) {
  const data = await authService.refresh(req.body.refreshToken);
  return ok(res, data, 'Token refreshed');
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  return ok(res, null, 'Logged out');
}

export async function me(req: Request, res: Response) {
  const user: any = await authService.me(req.user!.id);
  // Attach the normalized role + ability map so the frontend can drive
  // nav/route/feature/action visibility from the same RBAC matrix.
  return ok(res, {
    ...user,
    effectiveRole: normalizeRole(user.role),
    abilities: abilitiesFor(user.role),
  });
}

export async function permissions(req: Request, res: Response) {
  return ok(res, { role: normalizeRole(req.user!.role), abilities: abilitiesFor(req.user!.role) });
}

export async function organizations(_req: Request, res: Response) {
  return ok(res, await authService.listPublicOrganizations());
}
