// Progress engine — maintains per-user Progress rows for missions, bundles,
// courses and learning paths (drives the hub "ticks & locks" in the game).
import {
  Progress,
  Mission,
  MissionBundle,
  Course,
  CourseMission,
  CourseBundle,
  CourseTournament,
  Tournament,
  TournamentEntry,
  GameSession,
} from '../models';

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

/**
 * Recompute a COURSE'S roadmap completion from its referenced content's OWN
 * progress records — the LMS rollup. A course never owns progress of its own:
 *  - a mission item is done when its STANDALONE progress (MISSION) is COMPLETED,
 *  - a bundle item is done when the bundle (MISSION_BUNDLE) is COMPLETED,
 *  - a tournament item is done when the player has an entry and has PLAYED at
 *    least one tournament race (or scored, or the tournament has been settled).
 *    Participation is judged from the player's own persistent records
 *    (TournamentEntry + completed tournament GameSessions), never from the
 *    tournament's lifecycle status — so the item stays COMPLETED permanently
 *    even after the tournament ends or expires.
 * Those records stay fully independent — this only READS them and writes the
 * separate COURSE row, so nothing ever overwrites anything else.
 * Returns per-item detail so player/admin UIs can show the roadmap.
 */
export async function recomputeCourseProgress(userId: string, organizationId: string, courseId: string) {
  const course: any = await Course.findByPk(courseId);
  if (!course) return { completed: false, completionPct: 0, items: [] as any[] };

  const [missionLinks, bundleLinks, tournamentLinks] = await Promise.all([
    CourseMission.findAll({ where: { courseId }, order: [['order_index', 'ASC']] }),
    CourseBundle.findAll({ where: { courseId }, order: [['order_index', 'ASC']] }),
    CourseTournament.findAll({ where: { courseId }, order: [['order_index', 'ASC']] }),
  ]);

  const missionIds = (missionLinks as any[]).map((l) => l.missionId);
  const bundleIds = (bundleLinks as any[]).map((l) => l.missionBundleId);
  const tournamentIds = (tournamentLinks as any[]).map((l) => l.tournamentId);

  const [missionProgress, bundleProgress, entries, tournaments, playedSessions] = await Promise.all([
    missionIds.length ? Progress.findAll({ where: { userId, entityType: 'MISSION', entityId: missionIds } }) : [],
    bundleIds.length ? Progress.findAll({ where: { userId, entityType: 'MISSION_BUNDLE', entityId: bundleIds } }) : [],
    tournamentIds.length ? TournamentEntry.findAll({ where: { userId, tournamentId: tournamentIds } }) : [],
    tournamentIds.length ? Tournament.findAll({ where: { id: tournamentIds } }) : [],
    tournamentIds.length
      ? GameSession.findAll({
          where: { userId, tournamentId: tournamentIds, status: 'COMPLETED' },
          attributes: ['tournamentId'],
        })
      : [],
  ]);
  const mMap = new Map((missionProgress as any[]).map((p) => [p.entityId, p]));
  const bMap = new Map((bundleProgress as any[]).map((p) => [p.entityId, p]));
  const eMap = new Map((entries as any[]).map((e) => [e.tournamentId, e]));
  const tMap = new Map((tournaments as any[]).map((t) => [t.id, t]));
  const playedSet = new Set((playedSessions as any[]).map((s) => s.tournamentId));

  const items = [
    ...missionIds.map((id) => {
      const p: any = mMap.get(id);
      return { kind: 'MISSION' as const, id, done: p?.status === 'COMPLETED', pct: p?.completionPct ?? 0 };
    }),
    ...bundleIds.map((id) => {
      const p: any = bMap.get(id);
      return { kind: 'MISSION_BUNDLE' as const, id, done: p?.status === 'COMPLETED', pct: p?.completionPct ?? 0 };
    }),
    ...tournamentIds.map((id) => {
      const entry: any = eMap.get(id);
      const t: any = tMap.get(id);
      // Joined + played once is enough — and permanent. score>0 and settled-
      // tournament checks are kept so previously-done items never regress.
      const done = !!entry && (playedSet.has(id) || (entry.score ?? 0) > 0 || t?.status === 'COMPLETED');
      return { kind: 'TOURNAMENT' as const, id, done, pct: done ? 100 : entry ? 50 : 0 };
    }),
  ];

  if (items.length === 0) return { completed: false, completionPct: 0, items };

  const doneCount = items.filter((i) => i.done).length;
  const completionPct = Math.round((doneCount / items.length) * 100);
  const isComplete = doneCount === items.length;

  // Only persist once the player has actually completed something — merely
  // viewing the course list must not create noise Progress rows.
  if (doneCount > 0) {
    await markProgress({
      userId,
      organizationId,
      entityType: 'COURSE',
      entityId: courseId,
      status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
      completionPct,
    });
  }

  return { completed: isComplete, completionPct, items };
}
