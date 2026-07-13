// Tournament lifecycle service — final rankings and automatic reward payout.
//
// Live scoring happens in gameSession.service (tournament races only); this
// module owns what happens when a tournament ENDS: freeze the final ranking
// (with tie-breakers), pay each placement its configured rewards exactly once,
// and flip the tournament to COMPLETED. `settleDueTournaments` is called
// lazily from the player dashboard, so no cron is needed.
import { Op } from 'sequelize';
import { Tournament, TournamentEntry, User } from '../../../models';
import { awardXp } from '../../../engines/xp.engine';
import { contribute } from '../../../engines/leaderboard.engine';
import { eventBus } from '../../../events/eventBus';
import { EVENTS } from '../../../events/events';

/** Final ranking order: score, then stars earned, then who joined first. */
const RANK_ORDER: any = [
  ['score', 'DESC'],
  ['stars_earned', 'DESC'],
  ['joined_at', 'ASC'],
];

/** Re-rank a tournament's entries and persist placements. Returns the entries in final order. */
export async function rankTournamentEntries(tournamentId: string) {
  const ranked: any[] = await TournamentEntry.findAll({ where: { tournamentId }, order: RANK_ORDER });
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].placement !== i + 1) await ranked[i].update({ placement: i + 1 });
  }
  return ranked;
}

/**
 * Finalise one tournament: final ranking, reward payout per placement from
 * rewardConfig ({ "1": { xp, coins, stars }, ... }; the winner also receives
 * the tournament's starReward), then status → COMPLETED. The status flip is
 * the idempotency guard — settle is only ever called on ACTIVE tournaments.
 */
export async function settleTournament(tournament: any) {
  const ranked = await rankTournamentEntries(tournament.id);
  const rewards = tournament.rewardConfig ?? {};

  for (const entry of ranked) {
    const placement = entry.placement;
    const prize = rewards[String(placement)] ?? {};
    const bonusStars = (prize.stars ?? 0) + (placement === 1 ? tournament.starReward ?? 0 : 0);

    if (prize.xp) {
      await awardXp({
        userId: entry.userId,
        organizationId: tournament.organizationId,
        amount: prize.xp,
        source: 'TOURNAMENT_REWARD',
        refType: 'TOURNAMENT',
        refId: tournament.id,
        note: `Placed #${placement} in "${tournament.name}"`,
      });
    }
    if (prize.coins) {
      await User.increment({ coins: prize.coins }, { where: { id: entry.userId } });
    }
    if (bonusStars > 0) {
      await User.increment({ stars: bonusStars }, { where: { id: entry.userId } });
      await contribute({
        userId: entry.userId,
        organizationId: tournament.organizationId,
        metric: 'STARS',
        delta: bonusStars,
      });
    }
  }

  await tournament.update({ status: 'COMPLETED' });
  eventBus.emitSafe(EVENTS.TOURNAMENT_SCORED, {
    tournamentId: tournament.id,
    organizationId: tournament.organizationId,
    settled: true,
  });
  return ranked;
}

/** Settle every ACTIVE tournament in the org whose end date has passed. */
export async function settleDueTournaments(organizationId: string) {
  if (!organizationId) return;
  const due: any[] = await Tournament.findAll({
    where: { organizationId, status: 'ACTIVE', endsAt: { [Op.lt]: new Date() } },
  });
  for (const t of due) {
    await settleTournament(t);
  }
}
