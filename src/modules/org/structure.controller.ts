// Organizational structure — who's who and who reports to whom:
//   admins → department managers → employees/guests, plus trainers.
// Drives the "Team Structure" view on the admin console and answers
// "where does this employee's progress report to?".
import type { Request, Response } from 'express';
import { ok } from '../../utils/responseHandler';
import { User, Department, Organization } from '../../models';
import { normalizeRole } from '../../auth/permissions';
import { currentOrgId } from '../../tenancy/context';

const card = (u: any) =>
  u
    ? {
        id: u.id,
        name: u.displayName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
        email: u.email,
        role: normalizeRole(u.role),
        avatarUrl: u.avatarUrl,
        status: u.status,
      }
    : null;

async function buildStructure(orgId: string) {
  const [users, departments] = await Promise.all([
    User.findAll({
      where: { organizationId: orgId },
      attributes: ['id', 'displayName', 'firstName', 'lastName', 'email', 'role', 'avatarUrl', 'status', 'departmentId'],
      order: [['first_name', 'ASC']],
    }),
    Department.findAll({ where: { organizationId: orgId }, order: [['name', 'ASC']] }),
  ]);

  const byId = new Map((users as any[]).map((u) => [u.id, u]));
  const admins: any[] = [];
  const managers: any[] = [];
  const trainers: any[] = [];
  const players: any[] = [];
  for (const u of users as any[]) {
    const r = normalizeRole(u.role);
    if (r === 'ADMIN' || r === 'SUPER_ADMIN') admins.push(u);
    else if (r === 'MANAGER') managers.push(u);
    else if (r === 'TRAINER') trainers.push(u);
    else players.push(u); // EMPLOYEE + GUEST
  }

  const adminCards = admins.map(card);

  // Departments with their manager and player roster; each player's progress
  // reports to their department manager first, then the org admin(s).
  const deptBlocks = (departments as any[]).map((d) => {
    const manager = d.managerId ? card(byId.get(d.managerId)) : null;
    return {
      id: d.id,
      name: d.name,
      manager,
      employees: players.filter((p) => p.departmentId === d.id).map(card),
      reportsTo: [...(manager ? [manager] : []), ...adminCards],
    };
  });
  const assigned = new Set((departments as any[]).flatMap((d) => players.filter((p) => p.departmentId === d.id).map((p) => p.id)));
  const unassigned = players.filter((p) => !assigned.has(p.id)).map(card);

  return {
    admins: adminCards,
    managers: managers.map(card),
    trainers: trainers.map(card),
    departments: deptBlocks,
    // Players without a department report straight to the org admin(s).
    unassigned: { employees: unassigned, reportsTo: adminCards },
    totals: {
      admins: admins.length,
      managers: managers.length,
      trainers: trainers.length,
      players: players.length,
      departments: departments.length,
    },
  };
}

// The command chain, top to bottom. Rendered as the hierarchy ladder in the
// admin console and the docs.
const HIERARCHY = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TRAINER', 'EMPLOYEE', 'GUEST'];

// GET /users/structure — full role structure. Org-bound users get their own
// organization; SUPER_ADMIN (no bound org) gets every organization's structure
// unless ?organizationId narrows it.
export async function orgStructure(req: Request, res: Response) {
  // Bound tenant always wins; ?organizationId only applies to platform users
  // with no bound org (SUPER_ADMIN) so tenants can't peek at each other.
  const boundOrg = currentOrgId() ?? req.user!.organizationId ?? null;
  const orgId = boundOrg ?? (req.query.organizationId as string | undefined) ?? null;

  if (orgId) {
    return ok(res, { hierarchy: HIERARCHY, ...(await buildStructure(orgId)) });
  }

  // Platform view: super admins on top, then one structure block per org.
  const [platformAdmins, orgs] = await Promise.all([
    User.findAll({
      where: { organizationId: null as any, role: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] },
      attributes: ['id', 'displayName', 'firstName', 'lastName', 'email', 'role', 'avatarUrl', 'status'],
    }),
    Organization.findAll({ order: [['name', 'ASC']], attributes: ['id', 'name', 'slug'] }),
  ]);
  const organizations = [];
  for (const o of orgs as any[]) {
    organizations.push({ organization: { id: o.id, name: o.name, slug: o.slug }, ...(await buildStructure(o.id)) });
  }
  return ok(res, {
    multi: true,
    hierarchy: HIERARCHY,
    superAdmins: (platformAdmins as any[]).map(card),
    organizations,
  });
}
