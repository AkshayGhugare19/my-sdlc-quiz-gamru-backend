// Reward engine — grants concrete rewards (coins, stars, badges, accessories)
// and writes the RewardGrant ledger. Reads declarative RewardRule rows attached
// to missions/bundles/tournaments and applies those whose conditions pass.
import { User, RewardGrant, RewardRule, GarageItem, Accessory } from '../models';
import { awardXp } from './xp.engine';
import { awardBadge } from './badge.engine';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { emitToUser } from '../realtime/socket';

interface GrantContext {
  userId: string;
  organizationId: string;
  sourceType: string; // MISSION | BUNDLE | TOURNAMENT | SHOP
  sourceId?: string;
  stats?: { stars?: number; scorePct?: number; correctCount?: number };
}

/** Grant a single typed reward and record it in the ledger. */
export async function grantReward(
  ctx: GrantContext,
  reward: { type: string; amount?: number; targetId?: string | null },
) {
  const { userId, organizationId } = ctx;
  const amount = reward.amount ?? 0;

  switch (reward.type) {
    case 'XP':
      await awardXp({ userId, organizationId, amount, source: 'BONUS', refType: ctx.sourceType, refId: ctx.sourceId });
      break;
    case 'COINS':
      await User.increment({ coins: amount }, { where: { id: userId } });
      emitToUser(userId, 'coins:awarded', { amount });
      break;
    case 'STARS':
      await User.increment({ stars: amount }, { where: { id: userId } });
      emitToUser(userId, 'stars:awarded', { amount });
      break;
    case 'BADGE':
      if (reward.targetId) await awardBadge(userId, organizationId, { badgeId: reward.targetId, context: ctx });
      break;
    case 'ACCESSORY':
      if (reward.targetId) await unlockAccessory(userId, reward.targetId, ctx.sourceType);
      break;
    default:
      break;
  }

  const grant = await RewardGrant.create({
    organizationId,
    userId,
    type: reward.type,
    amount,
    targetId: reward.targetId ?? null,
    sourceType: ctx.sourceType,
    sourceId: ctx.sourceId,
  });
  return grant;
}

/** Add an accessory to a player's garage (idempotent). Returns true if newly unlocked. */
export async function unlockAccessory(userId: string, accessoryId: string, source = 'MISSION') {
  const existing = await GarageItem.findOne({ where: { userId, accessoryId } });
  if (existing) return false;
  await GarageItem.create({ userId, accessoryId, source });
  const accessory = await Accessory.findByPk(accessoryId);
  eventBus.emitSafe(EVENTS.ACCESSORY_UNLOCKED, { userId, accessoryId });
  emitToUser(userId, 'accessory:unlocked', { accessoryId, name: (accessory as any)?.name, key: (accessory as any)?.key });
  return true;
}

/** Apply every RewardRule whose condition passes for a completion event. */
export async function applyRewardRules(ctx: GrantContext, where: { missionId?: string; missionBundleId?: string }) {
  const rules = await RewardRule.findAll({
    where: {
      organizationId: ctx.organizationId,
      ...(where.missionId ? { missionId: where.missionId } : {}),
      ...(where.missionBundleId ? { missionBundleId: where.missionBundleId } : {}),
    },
  });

  const granted = [];
  for (const rule of rules as any[]) {
    if (!conditionPasses(rule.condition, ctx.stats)) continue;
    granted.push(await grantReward(ctx, { type: rule.type, amount: rule.amount, targetId: rule.targetId }));
  }
  return granted;
}

function conditionPasses(condition: any, stats?: GrantContext['stats']) {
  if (!condition) return true;
  if (condition.minStars != null && (stats?.stars ?? 0) < condition.minStars) return false;
  if (condition.minScorePct != null && (stats?.scorePct ?? 0) < condition.minScorePct) return false;
  if (condition.minCorrect != null && (stats?.correctCount ?? 0) < condition.minCorrect) return false;
  return true;
}
