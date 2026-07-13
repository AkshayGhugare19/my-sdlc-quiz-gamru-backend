// Mission-bundle builder: a bundle is assembled from ALREADY-CREATED missions.
// Missions are a separate feature (created first); here we attach/detach/order
// them into a bundle. A mission belongs to at most one bundle (Mission.missionBundleId).
// Player progress is tracked per flow: standalone mission play writes MISSION
// rows; bundle-context play writes BUNDLE_MISSION rows, which the bundle
// aggregates — see progress.engine.recomputeBundleProgress.
import type { Request, Response } from 'express';
import { Op } from 'sequelize';
import { ok, created } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import { MissionBundle, Mission, Progress } from '../../models';
import { currentOrgId } from '../../tenancy/context';

// GET /mission-bundles/:id/missions — missions in this bundle (ordered).
export async function listMissions(req: Request, res: Response) {
  const bundle = await MissionBundle.findByPk(req.params.id);
  if (!bundle) throw AppError.notFound('Mission bundle not found');
  const missions = await Mission.findAll({
    where: { missionBundleId: req.params.id },
    order: [['order_index', 'ASC']],
  });
  return ok(res, missions);
}

// GET /mission-bundles/:id/available-missions — missions not yet in a bundle
// (or already in this one) so the picker can offer them.
export async function availableMissions(req: Request, res: Response) {
  const orgId = currentOrgId();
  const missions = await Mission.findAll({
    where: {
      ...(orgId ? { organizationId: orgId } : {}),
      [Op.or]: [{ missionBundleId: null }, { missionBundleId: req.params.id }],
    } as any,
    order: [['title', 'ASC']],
  });
  return ok(res, missions);
}

// POST /mission-bundles/:id/missions { missionId, orderIndex? } — attach a mission.
export async function attachMission(req: Request, res: Response) {
  const bundle = await MissionBundle.findByPk(req.params.id);
  if (!bundle) throw AppError.notFound('Mission bundle not found');
  const mission: any = await Mission.findByPk(req.body.missionId);
  if (!mission) throw AppError.notFound('Mission not found');

  const count = await Mission.count({ where: { missionBundleId: req.params.id } });
  await mission.update({
    missionBundleId: req.params.id,
    orderIndex: req.body.orderIndex ?? count,
  });
  return created(res, mission, 'Mission added to bundle');
}

// PUT /mission-bundles/:id/missions/:missionId { orderIndex } — reorder.
export async function reorderMission(req: Request, res: Response) {
  const mission: any = await Mission.findByPk(req.params.missionId);
  if (!mission || mission.missionBundleId !== req.params.id) throw AppError.notFound('Mission not in this bundle');
  await mission.update({ orderIndex: req.body.orderIndex ?? mission.orderIndex });
  return ok(res, mission, 'Reordered');
}

// DELETE /mission-bundles/:id/missions/:missionId — detach (mission is kept).
export async function detachMission(req: Request, res: Response) {
  const mission: any = await Mission.findByPk(req.params.missionId);
  if (!mission || mission.missionBundleId !== req.params.id) throw AppError.notFound('Mission not in this bundle');
  await mission.update({ missionBundleId: null });
  return ok(res, null, 'Mission removed from bundle');
}

// GET /mission-bundles/:id/progress — per-mission + aggregate progress across
// players (admin insight: how each separate mission in the bundle is doing).
// Reads the bundle-flow records (BUNDLE_MISSION) — standalone mission play is
// tracked separately and does not count toward the bundle.
export async function bundleProgress(req: Request, res: Response) {
  const missions = await Mission.findAll({ where: { missionBundleId: req.params.id }, order: [['order_index', 'ASC']] });
  const data = [];
  for (const m of missions as any[]) {
    const rows = await Progress.findAll({ where: { entityType: 'BUNDLE_MISSION', entityId: m.id } });
    const completed = rows.filter((p: any) => p.status === 'COMPLETED').length;
    const avgStars = rows.length ? rows.reduce((s: number, p: any) => s + (p.starsEarned ?? 0), 0) / rows.length : 0;
    data.push({
      missionId: m.id,
      title: m.title,
      orderIndex: m.orderIndex,
      maxStars: m.maxStars,
      learners: rows.length,
      completed,
      completionRate: rows.length ? Math.round((completed / rows.length) * 100) : 0,
      averageStars: Math.round(avgStars * 10) / 10,
    });
  }
  return ok(res, data);
}
