// XP engine — the authoritative source of experience points, levels and ranks.
// Every XP change writes an immutable XpTransaction ledger row and keeps the
// denormalised User.totalXp / currentLevel counters in sync. (Re-implements the
// real shape sdlcgames/gamru externalised — here it lives in-engine.)
import { User, XpTransaction, Level, Rank } from '../models';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { emitToUser } from '../realtime/socket';

export interface AwardXpInput {
  userId: string;
  organizationId: string;
  amount: number;
  source: string; // XpSource
  refType?: string;
  refId?: string;
  note?: string;
}

export async function awardXp(input: AwardXpInput) {
  const { userId, organizationId, amount } = input;
  if (!amount) return null;

  const user = await User.findByPk(userId);
  if (!user) return null;

  const balanceAfter = (user.totalXp ?? 0) + amount;

  const tx = await XpTransaction.create({
    organizationId,
    userId,
    amount,
    balanceAfter,
    source: input.source,
    refType: input.refType,
    refId: input.refId,
    note: input.note,
  });

  // Recompute level from the org's Level bands (levels live inside ranks; a
  // level owns the XP band [minXp, maxXp)). New level = highest level whose
  // minXp (XP start) is satisfied.
  const previousLevel = user.currentLevel ?? 1;
  const levels = await Level.findAll({
    where: { organizationId },
    order: [['min_xp', 'ASC']],
  });
  let newLevel = previousLevel;
  for (const lvl of levels) {
    if (balanceAfter >= (lvl as any).minXp) newLevel = (lvl as any).level;
  }

  await user.update({ totalXp: balanceAfter, currentLevel: newLevel });

  eventBus.emitSafe(EVENTS.XP_AWARDED, { userId, organizationId, amount, balanceAfter });
  emitToUser(userId, 'xp:awarded', { amount, total: balanceAfter, level: newLevel });

  if (newLevel > previousLevel) {
    eventBus.emitSafe(EVENTS.LEVEL_UP, { userId, organizationId, level: newLevel });
    emitToUser(userId, 'level:up', { level: newLevel });
    await maybeRankUp(userId, organizationId, balanceAfter);
  }

  return { transaction: tx, totalXp: balanceAfter, level: newLevel };
}

async function maybeRankUp(userId: string, organizationId: string, totalXp: number) {
  const ranks = await Rank.findAll({ where: { organizationId }, order: [['tier', 'ASC']] });
  let current: any = null;
  for (const r of ranks) if (totalXp >= (r as any).minXp) current = r;
  if (current) {
    eventBus.emitSafe(EVENTS.RANK_UP, { userId, organizationId, rank: current.name, tier: current.tier });
    emitToUser(userId, 'rank:up', { rank: current.name, tier: current.tier });
  }
}

/** Current rank for a given XP total (used by profile/leaderboard views). */
export async function resolveRank(organizationId: string, totalXp: number) {
  const ranks = await Rank.findAll({ where: { organizationId }, order: [['tier', 'ASC']] });
  let current: any = null;
  for (const r of ranks) if (totalXp >= (r as any).minXp) current = r;
  return current;
}
