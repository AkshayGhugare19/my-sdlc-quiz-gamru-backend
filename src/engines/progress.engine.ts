// Progress engine — maintains per-user Progress rows for missions, bundles,
// courses and learning paths (drives the hub "ticks & locks" in the game).
import { Progress, Mission, MissionBundle } from '../models';

export async function markProgress(params: {
  userId: string;
  organizationId: string;
  entityType: string; // MISSION | MISSION_BUNDLE | COURSE | LEARNING_PATH
  entityId: string;
  status?: string;
  completionPct?: number;
  starsEarned?: number;
  bestScorePct?: number;
  incrementAttempts?: boolean;
}) {
  const { userId, organizationId, entityType, entityId } = params;
  const [row] = await Progress.findOrCreate({
    where: { userId, entityType, entityId },
    defaults: { userId, organizationId, entityType, entityId, status: 'IN_PROGRESS', firstStartedAt: new Date() },
  });

  const patch: any = {};
  if (params.status) patch.status = params.status;
  if (params.completionPct != null) patch.completionPct = params.completionPct;
  if (params.starsEarned != null) patch.starsEarned = Math.max((row as any).starsEarned ?? 0, params.starsEarned);
  if (params.bestScorePct != null) patch.bestScorePct = Math.max((row as any).bestScorePct ?? 0, params.bestScorePct);
  if (params.incrementAttempts) patch.attempts = ((row as any).attempts ?? 0) + 1;
  if (params.status === 'COMPLETED') patch.completedAt = new Date();

  await row.update(patch);
  return row;
}

/**
 * Recompute a bundle's completion from its missions' BUNDLE-FLOW progress
 * (entityType BUNDLE_MISSION — races started from the bundle). Standalone
 * mission progress (entityType MISSION) is a separate record and never counts
 * here. When every published mission in the bundle is COMPLETED, mark the
 * bundle COMPLETED and return { completed: true, stars, maxStars } so the
 * caller can grant bundle rewards + certificate. Also aggregates the bundle
 * star meter.
 */
export async function recomputeBundleProgress(userId: string, organizationId: string, bundleId: string) {
  const bundle: any = await MissionBundle.findByPk(bundleId);
  if (!bundle) return { completed: false };

  const missions = await Mission.findAll({ where: { organizationId, missionBundleId: bundleId, isPublished: true } });
  if (missions.length === 0) return { completed: false };

  const missionIds = missions.map((m: any) => m.id);
  const progressRows = await Progress.findAll({
    where: { userId, entityType: 'BUNDLE_MISSION', entityId: missionIds },
  });

  const completed = progressRows.filter((p: any) => p.status === 'COMPLETED');
  const stars = progressRows.reduce((sum: number, p: any) => sum + (p.starsEarned ?? 0), 0);
  const completionPct = Math.round((completed.length / missions.length) * 100);
  const isComplete = completed.length === missions.length;

  await markProgress({
    userId,
    organizationId,
    entityType: 'MISSION_BUNDLE',
    entityId: bundleId,
    status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
    completionPct,
    starsEarned: stars,
  });

  return { completed: isComplete, stars, maxStars: bundle.maxStars, completionPct };
}
