// Admin insight into learner participation & standings:
//  • who played a mission and how they did (ranked)
//  • a mission-bundle leaderboard (which employee is on top)
//  • a single employee's full progress
// (Tournament rankings live in competition.controller; org leaderboard rankings
//  in competition.boardRankings.)
import type { Request, Response } from 'express';
import { ok } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import {
  Mission,
  MissionBundle,
  MissionAttempt,
  Progress,
  User,
  UserBadge,
  Badge,
  TournamentEntry,
  Tournament,
  GameSession,
  AnswerEvent,
  GarageItem,
} from '../../models';
import { resolveRank } from '../../engines/xp.engine';

const USER_ATTRS = ['id', 'displayName', 'firstName', 'lastName', 'avatarUrl', 'currentLevel'];
const userName = (u: any) => u?.displayName || `${u?.firstName ?? ''} ${u?.lastName ?? ''}`.trim() || '—';

// GET /missions/:id/players — every learner who attempted this mission, ranked
// by best score, with their progress.
export async function missionPlayers(req: Request, res: Response) {
  const mission: any = await Mission.findByPk(req.params.id);
  if (!mission) throw AppError.notFound('Mission not found');

  const attempts = await MissionAttempt.findAll({
    where: { missionId: req.params.id },
    include: [{ model: User, attributes: USER_ATTRS }],
    order: [['startedAt', 'DESC']],
  });

  const byUser = new Map<string, any>();
  for (const a of attempts as any[]) {
    const cur = byUser.get(a.userId);
    const passed = a.status === 'PASSED';
    if (!cur) {
      byUser.set(a.userId, {
        userId: a.userId,
        name: userName(a.User),
        avatarUrl: a.User?.avatarUrl,
        level: a.User?.currentLevel,
        bestScore: a.scorePct,
        stars: a.starsEarned,
        passed,
        attempts: 1,
        lastPlayedAt: a.startedAt,
      });
    } else {
      cur.attempts += 1;
      cur.bestScore = Math.max(cur.bestScore, a.scorePct);
      cur.stars = Math.max(cur.stars, a.starsEarned);
      cur.passed = cur.passed || passed;
      if (a.startedAt > cur.lastPlayedAt) cur.lastPlayedAt = a.startedAt;
    }
  }

  const players = [...byUser.values()]
    .sort((x, y) => y.bestScore - x.bestScore || y.stars - x.stars)
    .map((p, i) => ({ rank: i + 1, ...p, status: p.passed ? 'PASSED' : 'IN_PROGRESS' }));

  return ok(res, { mission: { id: mission.id, title: mission.title, maxStars: mission.maxStars }, players });
}

// GET /mission-bundles/:id/leaderboard — employees ranked by stars & completion
// across the bundle's missions.
export async function bundleLeaderboard(req: Request, res: Response) {
  const bundle: any = await MissionBundle.findByPk(req.params.id);
  if (!bundle) throw AppError.notFound('Mission bundle not found');

  const missions = await Mission.findAll({ where: { missionBundleId: req.params.id } });
  const missionIds = missions.map((m: any) => m.id);

  // Bundle standings come from bundle-flow records only (BUNDLE_MISSION) —
  // standalone runs of the same missions are a separate progress track.
  const rows = missionIds.length
    ? await Progress.findAll({
        where: { entityType: 'BUNDLE_MISSION', entityId: missionIds },
        include: [{ model: User, attributes: USER_ATTRS }],
      })
    : [];

  const byUser = new Map<string, any>();
  for (const p of rows as any[]) {
    const cur = byUser.get(p.userId) || {
      userId: p.userId,
      name: userName(p.User),
      avatarUrl: p.User?.avatarUrl,
      stars: 0,
      completed: 0,
      scoreSum: 0,
      scoreN: 0,
    };
    cur.stars += p.starsEarned || 0;
    if (p.status === 'COMPLETED') cur.completed += 1;
    cur.scoreSum += p.bestScorePct || 0;
    cur.scoreN += 1;
    byUser.set(p.userId, cur);
  }

  const leaderboard = [...byUser.values()]
    .map((c) => ({
      userId: c.userId,
      name: c.name,
      avatarUrl: c.avatarUrl,
      stars: c.stars,
      completed: c.completed,
      totalMissions: missionIds.length,
      completionPct: missionIds.length ? Math.round((c.completed / missionIds.length) * 100) : 0,
      averageScore: c.scoreN ? Math.round(c.scoreSum / c.scoreN) : 0,
    }))
    .sort((a, b) => b.stars - a.stars || b.completed - a.completed)
    .map((c, i) => ({ rank: i + 1, ...c }));

  return ok(res, { bundle: { id: bundle.id, title: bundle.title, maxStars: bundle.maxStars }, leaderboard });
}

// GET /users/:id/progress — one employee's full progress (admin view).
export async function userProgress(req: Request, res: Response) {
  const user: any = await User.findByPk(req.params.id);
  if (!user) throw AppError.notFound('User not found');

  const [progress, attempts, badges, rank] = await Promise.all([
    Progress.findAll({ where: { userId: user.id } }),
    MissionAttempt.findAll({
      where: { userId: user.id },
      order: [['startedAt', 'DESC']],
      include: [{ model: Mission, attributes: ['id', 'title'] }],
    }),
    UserBadge.findAll({ where: { userId: user.id }, include: [{ model: Badge }] }),
    resolveRank(user.organizationId, user.totalXp),
  ]);

  const mIds = (progress as any[]).filter((p) => p.entityType === 'MISSION').map((p) => p.entityId);
  const bIds = (progress as any[]).filter((p) => p.entityType === 'MISSION_BUNDLE').map((p) => p.entityId);
  const [missions, bundles] = await Promise.all([
    mIds.length ? Mission.findAll({ where: { id: mIds } }) : [],
    bIds.length ? MissionBundle.findAll({ where: { id: bIds } }) : [],
  ]);
  const mMap = new Map((missions as any[]).map((m) => [m.id, m.title]));
  const bMap = new Map((bundles as any[]).map((b) => [b.id, b.title]));

  const mapProgress = (type: string, titleMap: Map<string, string>) =>
    (progress as any[])
      .filter((p) => p.entityType === type)
      .map((p) => ({
        title: titleMap.get(p.entityId) || '—',
        status: p.status,
        completionPct: p.completionPct,
        starsEarned: p.starsEarned,
        bestScorePct: p.bestScorePct,
        attempts: p.attempts,
      }));

  // Tournaments joined.
  const tEntries = await TournamentEntry.findAll({
    where: { userId: user.id },
    include: [{ model: Tournament, attributes: ['id', 'name', 'type', 'status'] }],
  });
  const tournaments = (tEntries as any[]).map((e) => ({
    name: e.Tournament?.name,
    type: e.Tournament?.type,
    status: e.Tournament?.status,
    score: e.score,
    stars: e.starsEarned,
    placement: e.placement,
  }));

  // Question accuracy: total answered / correct / wrong across all their sessions.
  const sessions = await GameSession.findAll({ where: { userId: user.id }, attributes: ['id'] });
  const sessionIds = (sessions as any[]).map((s) => s.id);
  const answers = sessionIds.length
    ? await AnswerEvent.findAll({ where: { gameSessionId: sessionIds }, attributes: ['isCorrect'] })
    : [];
  const answered = answers.length;
  const correct = (answers as any[]).filter((a) => a.isCorrect).length;
  const questionStats = { answered, correct, wrong: answered - correct, accuracy: answered ? Math.round((correct / answered) * 100) : 0 };

  const accessories = await GarageItem.count({ where: { userId: user.id } });

  return ok(res, {
    user: {
      id: user.id,
      name: userName(user),
      email: user.email,
      role: user.role,
      totalXp: user.totalXp,
      level: user.currentLevel,
      stars: user.stars,
      coins: user.coins,
      rank: rank ? { name: (rank as any).name, tier: (rank as any).tier, color: (rank as any).color } : null,
    },
    stats: {
      missionsJoined: mIds.length,
      bundlesJoined: bIds.length,
      tournamentsJoined: tournaments.length,
      accessories,
      badges: (badges as any[]).length,
      ...questionStats, // answered, correct, wrong, accuracy
    },
    missionProgress: mapProgress('MISSION', mMap),
    bundleProgress: mapProgress('MISSION_BUNDLE', bMap),
    tournaments,
    recentAttempts: (attempts as any[]).slice(0, 10).map((a) => ({
      missionTitle: a.Mission?.title ?? 'Mission',
      scorePct: a.scorePct,
      stars: a.starsEarned,
      rating: a.rating,
      status: a.status,
      completedAt: a.completedAt,
    })),
    badges: (badges as any[]).map((b) => b.Badge),
  });
}
