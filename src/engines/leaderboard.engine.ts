// Leaderboard engine — upserts a user's score into the relevant boards and
// pushes live updates. Also computes ranked snapshots on read.
import { Leaderboard, LeaderboardEntry, User } from '../models';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { emitToOrg } from '../realtime/socket';

/** Add `delta` to a user's score on all matching boards for a metric. */
export async function contribute(params: {
  userId: string;
  organizationId: string;
  metric: string; // XP | STARS | SPEED | SCORE
  delta: number;
}) {
  const { userId, organizationId, metric, delta } = params;
  const boards = await Leaderboard.findAll({ where: { organizationId, metric } });
  for (const board of boards as any[]) {
    const [entry] = await LeaderboardEntry.findOrCreate({
      where: { leaderboardId: board.id, userId },
      defaults: { leaderboardId: board.id, userId, score: 0 },
    });
    await entry.increment({ score: delta });
    eventBus.emitSafe(EVENTS.LEADERBOARD_UPDATED, { leaderboardId: board.id, userId });
    emitToOrg(organizationId, 'leaderboard:updated', { leaderboardId: board.id });
  }
}

/** Ranked, paginated snapshot of a board with user display info. */
export async function getRankedBoard(leaderboardId: string, limit = 50) {
  const entries = await LeaderboardEntry.findAll({
    where: { leaderboardId },
    order: [['score', 'DESC']],
    limit,
    include: [{ model: User, attributes: ['id', 'displayName', 'firstName', 'lastName', 'avatarUrl', 'currentLevel'] }],
  });
  return (entries as any[]).map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    score: e.score,
    user: e.User,
  }));
}
