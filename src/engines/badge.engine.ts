// Badge engine — awards badges (idempotent) and evaluates auto-grant criteria.
import { Badge, UserBadge, MissionAttempt } from '../models';
import { eventBus } from '../events/eventBus';
import { EVENTS } from '../events/events';
import { emitToUser } from '../realtime/socket';

export async function awardBadge(
  userId: string,
  organizationId: string,
  opts: { badgeId?: string; code?: string; context?: any },
) {
  let badge: any = null;
  if (opts.badgeId) badge = await Badge.findByPk(opts.badgeId);
  else if (opts.code) badge = await Badge.findOne({ where: { organizationId, code: opts.code } });
  if (!badge) return null;

  const [record, created] = await UserBadge.findOrCreate({
    where: { userId, badgeId: badge.id },
    defaults: { userId, badgeId: badge.id, context: opts.context ?? null },
  });
  if (created) {
    eventBus.emitSafe(EVENTS.BADGE_AWARDED, { userId, organizationId, badgeId: badge.id, code: badge.code });
    emitToUser(userId, 'badge:awarded', { code: badge.code, name: badge.name, iconUrl: badge.iconUrl });
  }
  return { badge, created, record };
}

/**
 * Evaluate common auto-grant badge criteria after a mission attempt.
 * Criteria shape examples: { type: "FIRST_MISSION" } | { type: "PERFECT_SCORE" }
 * | { type: "FAST_LEARNER", maxTimeSec } | { type: "SCORE_STREAK", count }.
 */
export async function evaluateBadges(params: {
  userId: string;
  organizationId: string;
  attempt: any;
}) {
  const { userId, organizationId, attempt } = params;
  const badges = await Badge.findAll({ where: { organizationId, isAutoGranted: true } });

  for (const badge of badges as any[]) {
    const c = badge.criteria || {};
    let pass = false;
    switch (c.type) {
      case 'FIRST_MISSION': {
        const count = await MissionAttempt.count({ where: { userId, status: 'PASSED' } });
        pass = count >= 1;
        break;
      }
      case 'PERFECT_SCORE':
        pass = attempt.scorePct >= 100;
        break;
      case 'FAST_LEARNER':
        pass = attempt.status === 'PASSED' && attempt.timeRemainingSec >= (c.minTimeRemaining ?? 60);
        break;
      case 'GOLD_CHAMPION':
        pass = attempt.rating === 'GOLD' || attempt.rating === 'GOLD_CHAMPION';
        break;
      default:
        pass = false;
    }
    if (pass) await awardBadge(userId, organizationId, { badgeId: badge.id, context: { attemptId: attempt.id } });
  }
}
