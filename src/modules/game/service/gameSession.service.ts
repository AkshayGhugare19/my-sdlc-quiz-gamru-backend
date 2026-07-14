// Game-session engine — SERVER-AUTHORITATIVE gameplay.
//
// The racing client is deliberately dumb: it asks for a session, renders the
// current question + lanes, and posts the player's raw move (which lane they
// steered into). This engine owns the mission timer, question order, grading,
// stars, accessory unlocks, scoring and every reward/XP/badge/progress side
// effect. Nothing the browser sends can change a business rule.
import crypto from 'node:crypto';
import {
  Mission,
  MissionBundle,
  Question,
  QuestionOption,
  MissionQuestion,
  MissionAttempt,
  GameSession,
  AnswerEvent,
  MissionAccessoryReward,
  Accessory,
  GarageItem,
  User,
  Progress,
  Tournament,
  TournamentEntry,
} from '../../../models';
import { AppError } from '../../../utils/AppError';
import { normalizeRole } from '../../../auth/permissions';
import { signGameSessionToken } from '../../../utils/tokens';
import { awardXp } from '../../../engines/xp.engine';
import { applyRewardRules, unlockAccessory } from '../../../engines/reward.engine';
import { evaluateBadges, awardBadge } from '../../../engines/badge.engine';
import { markProgress, recomputeBundleProgress } from '../../../engines/progress.engine';
import { contribute } from '../../../engines/leaderboard.engine';
import { rankTournamentEntries } from './tournament.service';
import { issueCertificate } from '../../../engines/certificate.engine';
import { eventBus } from '../../../events/eventBus';
import { EVENTS } from '../../../events/events';

// ── helpers ────────────────────────────────────────────────────────────────

/** Deterministic seeded shuffle so a session's order is reproducible/auditable. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  let h = crypto.createHash('sha256').update(seed).digest();
  let idx = 0;
  const rand = () => {
    if (idx >= h.length - 4) {
      h = crypto.createHash('sha256').update(h).digest();
      idx = 0;
    }
    const v = h.readUInt32BE(idx) / 0xffffffff;
    idx += 4;
    return v;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** GUEST accounts play in DEMO mode: full gameplay, zero real rewards. */
async function isDemoPlayer(userId: string) {
  const player: any = await User.findByPk(userId, { attributes: ['role'] });
  return normalizeRole(player?.role) === 'GUEST';
}

/** Engine defaults for tournament-only races; the admin overrides any subset
 *  per tournament via Tournament.gameConfig. */
const TOURNAMENT_RACE_DEFAULTS = {
  questionCount: 5,
  timerSec: 180,
  correctBonusSec: 10,
  laneCount: 3,
  xpPerQuestion: 20,
  passingScorePct: 60,
  maxStars: 5,
  categories: [] as string[],
  difficulty: null as string | null,
};

function tournamentRaceConfig(tournament: any) {
  return { ...TOURNAMENT_RACE_DEFAULTS, ...((tournament?.gameConfig as any) ?? {}) };
}

/** Resolve a session's gameplay rules: mission-backed OR tournament-only. */
async function sessionRules(session: any) {
  if (session.missionId) {
    const mission: any = await Mission.findByPk(session.missionId);
    return {
      mission,
      tournament: null as any,
      title: mission?.title ?? 'Mission',
      laneCount: mission?.laneCount ?? 3,
      correctBonusSec: mission?.correctBonusSec ?? 10,
      maxStars: mission?.maxStars ?? 5,
      passingScorePct: mission?.passingScorePct ?? 60,
      xpPerQuestion: 0,
    };
  }
  const tournament: any = session.tournamentId ? await Tournament.findByPk(session.tournamentId) : null;
  const cfg = tournamentRaceConfig(tournament);
  return {
    mission: null as any,
    tournament,
    title: tournament?.name ?? (session.tournamentId ? 'Tournament race' : 'Quick race'),
    laneCount: cfg.laneCount,
    correctBonusSec: cfg.correctBonusSec,
    maxStars: cfg.maxStars,
    passingScorePct: cfg.passingScorePct,
    xpPerQuestion: cfg.xpPerQuestion,
  };
}

function ratingFor(scorePct: number): string {
  if (scorePct >= 90) return 'GOLD';
  if (scorePct >= 75) return 'SILVER';
  if (scorePct >= 50) return 'BRONZE';
  return 'NONE';
}

/** Strip correctness before sending a question to the untrusted client. */
async function serializeQuestion(question: any, laneCount: number) {
  const options = await QuestionOption.findAll({
    where: { questionId: question.id },
    order: [['order_index', 'ASC']],
  });
  const lanes = (options as any[]).slice(0, laneCount).map((o, i) => ({
    id: o.id,
    lane: i, // 0=A, 1=B, 2=C
    label: o.label,
    mediaId: o.mediaId,
  }));
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    mediaId: question.mediaId,
    timeLimitSec: question.timeLimitSec,
    lanes,
  };
}

/** The mission's accessory rewards with the player's unlock state — sent to the
 *  race HUD so unlocked gear shows as earned and locked gear motivates. */
async function accessoryLineup(missionId: string, userId: string) {
  const rewards = await MissionAccessoryReward.findAll({ where: { missionId } });
  if (!rewards.length) return [];
  const ids = (rewards as any[]).map((r) => r.accessoryId);
  const [accessories, owned] = await Promise.all([
    Accessory.findAll({ where: { id: ids } }),
    GarageItem.findAll({ where: { userId, accessoryId: ids } }),
  ]);
  const accMap = new Map((accessories as any[]).map((a) => [a.id, a]));
  const ownedSet = new Set((owned as any[]).map((g) => g.accessoryId));
  return (rewards as any[]).map((r) => {
    const a: any = accMap.get(r.accessoryId);
    return {
      accessoryId: r.accessoryId,
      key: a?.key,
      name: a?.name ?? 'Accessory',
      slot: a?.slot,
      rarity: a?.rarity,
      iconUrl: a?.iconUrl,
      trigger: r.trigger,
      unlocked: ownedSet.has(r.accessoryId),
    };
  });
}

function hud(session: any, mission: any) {
  return {
    questionIndex: session.currentIndex,
    questionTotal: session.questionOrder.length,
    timeRemainingSec: session.timeRemainingSec,
    starsEarned: session.starsEarned,
    maxStars: mission.maxStars,
    correctCount: session.correctCount,
  };
}

// ── public API ───────────────────────────────────────────────────────────

/**
 * Create a session and return the token + first question + HUD. Three modes:
 *  - Mission race:     `missionId` set — questions come from the mission pool.
 *    With `missionBundleId` also set, the race is played AS PART OF that bundle
 *    and feeds bundle progress only; without it, it is a standalone mission
 *    race and feeds mission progress only. The two are fully isolated.
 *  - Tournament race:  `tournamentId` set, no mission — questions are drawn
 *    from the org question bank per the tournament's admin-configured
 *    gameConfig (categories / difficulty / count / timer / lanes).
 *  - Quick race:       neither set — a casual practice race with questions
 *    drawn at random from the org bank, re-randomized on EVERY attempt. No
 *    progress, XP, stars or rewards are recorded.
 * A missionId + tournamentId combo is also allowed (bundle-scoped tournaments).
 */
export async function startSession(params: {
  userId: string;
  organizationId: string;
  missionId?: string | null;
  missionBundleId?: string | null;
  avatarId?: string | null;
  tournamentId?: string | null;
}) {
  const { userId, organizationId, missionId } = params;

  // Tournament races are explicit: the player must have JOINED the tournament
  // and it must be running. Normal races never feed tournaments.
  let tournament: any = null;
  if (params.tournamentId) {
    tournament = await Tournament.findOne({ where: { id: params.tournamentId, organizationId } });
    if (!tournament) throw AppError.notFound('Tournament not found');
    const now = new Date();
    if (
      tournament.status !== 'ACTIVE' ||
      (tournament.startsAt && now < tournament.startsAt) ||
      (tournament.endsAt && now > tournament.endsAt)
    ) {
      throw AppError.badRequest(`"${tournament.name}" is not currently running — tournament races only count while it's live.`);
    }
    const entry = await TournamentEntry.findOne({ where: { tournamentId: tournament.id, userId } });
    if (!entry) {
      throw AppError.forbidden(`Join "${tournament.name}" from your dashboard first — only joined players can race for tournament points.`);
    }
  }

  let mission: any = null;
  if (missionId) {
    mission = await Mission.findOne({ where: { id: missionId, organizationId } });
    if (!mission) {
      throw AppError.notFound(
        'Mission not found — it may belong to another organization or has been unpublished. Head back to the hub and pick a pillar from there.',
      );
    }
    if (tournament?.missionBundleId && tournament.missionBundleId !== mission.missionBundleId) {
      throw AppError.badRequest(`"${tournament.name}" only counts missions from its own pillar bundle — pick one of those missions.`);
    }
  }

  // Bundle context is explicit: the client only sends missionBundleId when the
  // race was launched FROM the bundle (pillar) flow. Validated against the
  // mission's own bundle so progress can never leak to an unrelated bundle.
  let bundleContextId: string | null = null;
  if (params.missionBundleId) {
    if (!mission || mission.missionBundleId !== params.missionBundleId) {
      throw AppError.badRequest('This mission does not belong to that bundle — start it from its own pillar.');
    }
    bundleContextId = params.missionBundleId;
  }

  // No mission and no tournament = quick race (casual practice run).
  const tCfg = tournament ? tournamentRaceConfig(tournament) : mission ? null : { ...TOURNAMENT_RACE_DEFAULTS };
  const seed = crypto.randomBytes(16).toString('hex');
  let ordered: string[];
  let attempt: any = null;

  if (mission) {
    // Enforce retry limit.
    const attemptNo = (await MissionAttempt.count({ where: { userId, missionId: mission.id } })) + 1;
    if (mission.retryLimit != null && attemptNo > mission.retryLimit + 1) {
      throw AppError.forbidden(
        `You have used all ${mission.retryLimit + 1} attempts allowed for "${mission.title}". Ask your trainer to reset it if you need another try.`,
      );
    }

    // Resolve the question pool: pinned first, then a seeded selection.
    const links = await MissionQuestion.findAll({ where: { missionId: mission.id }, order: [['order_index', 'ASC']] });
    const pinned = (links as any[]).filter((l) => l.isPinned).map((l) => l.questionId);
    const pool = (links as any[]).map((l) => l.questionId);

    if (mission.randomizeQuestions) {
      const rest = seededShuffle(pool.filter((id) => !pinned.includes(id)), seed);
      ordered = [...pinned, ...rest];
    } else {
      ordered = pool;
    }
    // A misconfigured questionCount of 0 (or less) must never silently produce an
    // empty race for a mission that DOES have questions — fall back to the whole pool.
    const cap = mission.questionCount > 0 ? mission.questionCount : ordered.length;
    ordered = ordered.slice(0, cap);
    if (ordered.length === 0) {
      throw AppError.badRequest(
        `"${mission.title}" has no questions yet — an admin needs to attach questions to this mission before it can be played.`,
      );
    }

    attempt = await MissionAttempt.create({
      organizationId,
      userId,
      missionId: mission.id,
      status: 'IN_PROGRESS',
      questionsTotal: ordered.length,
      attemptNo,
      startedAt: new Date(),
    });
  } else {
    // Tournament-only race OR quick race: random draw from the org question
    // bank (tournaments filter it by their configured categories/difficulty).
    // Every session gets a fresh seeded shuffle, so questions differ run to run.
    const where: any = { organizationId, isActive: true };
    if (tCfg!.categories?.length) where.category = tCfg!.categories;
    if (tCfg!.difficulty) where.difficulty = tCfg!.difficulty;
    let bank: any[] = await Question.findAll({ where, attributes: ['id'] });
    if (!bank.length) {
      // A misconfigured pool must never block play — fall back to the full bank.
      bank = await Question.findAll({ where: { organizationId, isActive: true }, attributes: ['id'] });
    }
    ordered = seededShuffle(bank.map((q) => q.id), seed).slice(0, tCfg!.questionCount);
    if (ordered.length === 0) {
      throw AppError.badRequest(
        `${tournament ? `"${tournament.name}" has` : 'There are'} no questions available yet — an admin needs to add questions to the question bank.`,
      );
    }
  }

  const laneCount = mission ? mission.laneCount : tCfg!.laneCount;
  const session: any = await GameSession.create({
    organizationId,
    userId,
    missionId: mission?.id ?? null,
    missionBundleId: bundleContextId,
    attemptId: attempt?.id ?? null,
    avatarId: params.avatarId ?? null,
    tournamentId: tournament?.id ?? null,
    status: 'ACTIVE',
    serverSeed: seed,
    questionOrder: ordered,
    currentIndex: 0,
    timeRemainingSec: mission ? mission.timerSec : tCfg!.timerSec,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  });

  if (mission) {
    // Bundle-context races and standalone mission races keep fully separate
    // progress records (BUNDLE_MISSION vs MISSION) — one never updates the other.
    await markProgress({
      userId,
      organizationId,
      entityType: bundleContextId ? 'BUNDLE_MISSION' : 'MISSION',
      entityId: mission.id,
      status: 'IN_PROGRESS',
      incrementAttempts: true,
    });
    eventBus.emitSafe(EVENTS.MISSION_STARTED, { userId, organizationId, missionId: mission.id, sessionId: session.id });
  }

  const firstQuestion = await Question.findByPk(ordered[0]);
  const token = signGameSessionToken({ sessionId: session.id, userId, organizationId });

  return {
    sessionToken: token,
    session: {
      id: session.id,
      missionId: mission?.id ?? null,
      countdownSec: 3, // 3-2-1-GO
    },
    // Tournament-only and quick races present themselves as the "mission" so
    // the racing client needs no special casing.
    mission: mission
      ? {
          id: mission.id,
          title: mission.title,
          timerSec: mission.timerSec,
          correctBonusSec: mission.correctBonusSec,
          laneCount: mission.laneCount,
          maxStars: mission.maxStars,
        }
      : {
          id: null,
          title: tournament?.name ?? 'Quick Race',
          timerSec: tCfg!.timerSec,
          correctBonusSec: tCfg!.correctBonusSec,
          laneCount: tCfg!.laneCount,
          maxStars: tCfg!.maxStars,
        },
    hud: hud(session, mission ?? tCfg),
    question: await serializeQuestion(firstQuestion, laneCount),
    // Unlockable gear for this mission — the client shows locked ones as
    // motivation and lights them up when the player wins them.
    accessories: mission ? await accessoryLineup(mission.id, userId) : [],
    // Present only for tournament races, so the HUD can badge the run.
    tournament: tournament
      ? { id: tournament.id, name: tournament.name, metric: tournament.metric }
      : null,
  };
}

/** Return the current HUD + current question (resume / poll). */
export async function getSessionState(sessionId: string) {
  const session: any = await GameSession.findByPk(sessionId);
  if (!session) throw AppError.notFound('Session not found');
  const rules = await sessionRules(session);

  if (session.currentIndex >= session.questionOrder.length || session.status === 'COMPLETED') {
    return { finished: true, hud: hud(session, rules) };
  }
  const question = await Question.findByPk(session.questionOrder[session.currentIndex]);
  return {
    finished: false,
    hud: hud(session, rules),
    question: await serializeQuestion(question, rules.laneCount),
    accessories: session.missionId ? await accessoryLineup(session.missionId, session.userId) : [],
  };
}

/**
 * Grade one answer. `payload` carries the raw client move — for the racing loop
 * that's { chosenLane } or { optionId }. Returns feedback and the next question
 * (or triggers completion).
 */
export async function submitAnswer(params: {
  sessionId: string;
  questionId: string;
  payload: { chosenLane?: number; optionId?: string; optionIds?: string[]; value?: any };
  timeTakenMs?: number;
}) {
  const session: any = await GameSession.findByPk(params.sessionId);
  if (!session) throw AppError.notFound('Session not found');
  if (session.status !== 'ACTIVE') throw AppError.badRequest('Session is not active');

  const rules = await sessionRules(session);
  const expectedId = session.questionOrder[session.currentIndex];
  if (expectedId !== params.questionId) {
    throw AppError.badRequest('Answer does not match the current question');
  }

  const question: any = await Question.findByPk(params.questionId);
  const options = await QuestionOption.findAll({
    where: { questionId: question.id },
    order: [['order_index', 'ASC']],
  });
  const lanes = (options as any[]).slice(0, rules.laneCount);

  // ── grade (authoritative) ──
  const { isCorrect, correctOption } = grade(question, lanes, params.payload);

  // Timer: correct answers add the configured bonus seconds.
  let bonusSec = 0;
  if (isCorrect) {
    bonusSec = rules.correctBonusSec;
    session.timeRemainingSec += bonusSec;
    session.correctCount += 1;
  }

  // Stars: one per correct answer up to the configured maxStars.
  let starAwarded = false;
  if (isCorrect && session.starsEarned < rules.maxStars) {
    session.starsEarned += 1;
    starAwarded = true;
  }

  // Accessory unlock chance on correct answers (mission races only).
  let accessoryUnlocked: any = null;
  if (isCorrect && session.missionId) {
    accessoryUnlocked = await maybeUnlockAccessory(session, session.missionId);
  }

  await AnswerEvent.create({
    gameSessionId: session.id,
    attemptId: session.attemptId,
    questionId: question.id,
    payload: params.payload,
    chosenLane: params.payload.chosenLane ?? null,
    isCorrect,
    timeTakenMs: params.timeTakenMs ?? null,
    bonusSecAwarded: bonusSec,
    starAwarded,
  });

  session.currentIndex += 1;
  await session.save();

  eventBus.emitSafe(EVENTS.ANSWER_RECORDED, { sessionId: session.id, questionId: question.id, isCorrect });

  const finished = session.currentIndex >= session.questionOrder.length || session.timeRemainingSec <= 0;

  const feedback = {
    isCorrect,
    correctOptionId: correctOption?.id ?? null,
    correctLabel: correctOption?.label ?? null,
    explanation: question.explanation ?? null,
    bonusSec,
    starAwarded,
    accessoryUnlocked,
    hud: hud(session, rules),
  };

  if (finished) {
    const result = await completeSession(session.id);
    return { ...feedback, finished: true, result };
  }

  const nextQuestion = await Question.findByPk(session.questionOrder[session.currentIndex]);
  return { ...feedback, finished: false, nextQuestion: await serializeQuestion(nextQuestion, rules.laneCount) };
}

/** Finalise a session: score, rewards, XP, badges, progress, bundle, certificate. */
export async function completeSession(sessionId: string) {
  const session: any = await GameSession.findByPk(sessionId);
  if (!session) throw AppError.notFound('Session not found');
  const rules = await sessionRules(session);
  const mission: any = rules.mission;
  const attempt: any = session.attemptId ? await MissionAttempt.findByPk(session.attemptId) : null;

  if (session.status === 'COMPLETED') {
    return mission ? buildResult(session, mission, attempt) : buildTournamentResult(session, rules);
  }

  // GUEST = demo mode: full play-through, but no XP, stars, coins, badges,
  // reward rules, leaderboard entries or certificates are ever credited.
  const demo = await isDemoPlayer(session.userId);

  // ── Tournament-only race: XP for effort + tournament standings. No mission
  // progress, wallet stars or coins — tournament prizes are paid at settlement.
  // ── Quick race (no mission, no tournament): scored like a real run — XP
  // (levels recompute inside awardXp), stars and coins are credited to the
  // wallet — but no mission/bundle progress is ever recorded.
  if (!mission) {
    const quickRace = !session.tournamentId;
    const total = session.questionOrder.length;
    const scorePct = total ? Math.round((session.correctCount / total) * 100) : 0;
    const passed = scorePct >= rules.passingScorePct;
    const xpBase = (rules.xpPerQuestion ?? 20) * total;
    const xpEarned = demo ? 0 : passed ? xpBase : Math.round(xpBase * (scorePct / 100));

    session.status = 'COMPLETED';
    session.completedAt = new Date();
    await session.save();

    let starsGained = 0;
    let coinsEarned = 0;
    if (!demo && quickRace) {
      starsGained = session.starsEarned;
      coinsEarned = starsGained * 10;
      if (xpEarned > 0) {
        await awardXp({ userId: session.userId, organizationId: session.organizationId, amount: xpEarned, source: 'QUICK_RACE', note: 'Quick race' });
        await contribute({ userId: session.userId, organizationId: session.organizationId, metric: 'XP', delta: xpEarned });
      }
      if (starsGained > 0) {
        await User.increment({ stars: starsGained }, { where: { id: session.userId } });
        await contribute({ userId: session.userId, organizationId: session.organizationId, metric: 'STARS', delta: starsGained });
      }
      if (coinsEarned > 0) {
        await User.increment({ coins: coinsEarned }, { where: { id: session.userId } });
      }
    }

    if (!demo && !quickRace) {
      if (xpEarned > 0) {
        await awardXp({ userId: session.userId, organizationId: session.organizationId, amount: xpEarned, source: 'TOURNAMENT', refType: 'TOURNAMENT', refId: session.tournamentId });
        await contribute({ userId: session.userId, organizationId: session.organizationId, metric: 'XP', delta: xpEarned });
      }
      await updateTournamentProgress(session, null, {
        xpEarned,
        starsGained: session.starsEarned,
        scorePct,
        timeRemainingSec: session.timeRemainingSec,
      });
    }

    return { ...buildTournamentResult(session, rules, { scorePct, xpEarned, passed }), starsGained, coinsEarned, demo };
  }

  const total = session.questionOrder.length;
  const scorePct = total ? Math.round((session.correctCount / total) * 100) : 0;
  const passed = scorePct >= mission.passingScorePct;
  const rating = ratingFor(scorePct);
  const xpEarned = demo ? 0 : passed ? mission.xpReward : Math.round(mission.xpReward * (scorePct / 100));

  // Bundle-context races and standalone races track against their OWN progress
  // record — the two flows never read or update each other.
  const progressType = session.missionBundleId ? 'BUNDLE_MISSION' : 'MISSION';

  // Stars gained = improvement over the player's previous best on this mission
  // (within this flow), so replays never double-credit the star wallet or the
  // leaderboards.
  const prevProgress: any = await Progress.findOne({
    where: { userId: session.userId, entityType: progressType, entityId: mission.id },
  });
  const starsGained = demo ? 0 : Math.max(0, session.starsEarned - (prevProgress?.starsEarned ?? 0));

  // Coins fund the reward shop: 10 per newly-gained star plus a first-pass
  // bonus. Tied to improvement so replay-farming earns nothing.
  const firstPass = passed && prevProgress?.status !== 'COMPLETED';
  const coinsEarned = demo ? 0 : starsGained * 10 + (firstPass ? 50 : 0);

  await attempt.update({
    status: passed ? 'PASSED' : 'FAILED',
    correctCount: session.correctCount,
    starsEarned: session.starsEarned,
    xpEarned,
    timeRemainingSec: session.timeRemainingSec,
    scorePct,
    rating,
    completedAt: new Date(),
  });
  session.status = 'COMPLETED';
  session.completedAt = new Date();
  await session.save();

  const ctx = {
    userId: session.userId,
    organizationId: session.organizationId,
    sourceType: 'MISSION',
    sourceId: mission.id,
    stats: { stars: session.starsEarned, scorePct, correctCount: session.correctCount },
  };

  // Award mission XP + declarative reward rules + auto badges (real players only).
  if (!demo) {
    await awardXp({ userId: session.userId, organizationId: session.organizationId, amount: xpEarned, source: 'MISSION_COMPLETE', refType: 'MISSION', refId: mission.id });
    await applyRewardRules(ctx, { missionId: mission.id });
    await evaluateBadges({ userId: session.userId, organizationId: session.organizationId, attempt });
    if (mission.badgeId) await awardBadge(session.userId, session.organizationId, { badgeId: mission.badgeId });
  }

  // Progress + leaderboard contributions.
  await markProgress({
    userId: session.userId,
    organizationId: session.organizationId,
    entityType: progressType,
    entityId: mission.id,
    status: passed ? 'COMPLETED' : 'IN_PROGRESS',
    completionPct: passed ? 100 : scorePct,
    starsEarned: session.starsEarned,
    bestScorePct: scorePct,
  });
  // Credit the newly-gained stars to the player's star wallet + leaderboards
  // (real players only — demo runs never touch wallets or leaderboards).
  if (!demo) {
    if (starsGained > 0) {
      await User.increment({ stars: starsGained }, { where: { id: session.userId } });
    }
    if (coinsEarned > 0) {
      await User.increment({ coins: coinsEarned }, { where: { id: session.userId } });
    }
    await contribute({ userId: session.userId, organizationId: session.organizationId, metric: 'XP', delta: xpEarned });
    await contribute({ userId: session.userId, organizationId: session.organizationId, metric: 'STARS', delta: starsGained });
    // Live tournament progress from this race.
    await updateTournamentProgress(session, mission, {
      xpEarned,
      starsGained,
      scorePct,
      timeRemainingSec: session.timeRemainingSec,
    });
  }

  eventBus.emitSafe(EVENTS.MISSION_COMPLETED, { userId: session.userId, organizationId: session.organizationId, missionId: mission.id, scorePct, rating });

  // Bundle completion → bundle rewards + certificate. ONLY races started from
  // the bundle flow feed bundle progress — a standalone run of the same mission
  // never advances (or resets) the bundle. Demo players still see the bundle
  // finish, but earn no bundle rewards or certificate.
  let bundle: any = null;
  if (session.missionBundleId && passed) {
    if (demo) {
      const status = await recomputeBundleProgress(session.userId, session.organizationId, session.missionBundleId);
      bundle = status.completed
        ? { bundleCompleted: true, stars: status.stars, maxStars: status.maxStars, certificateSerial: null }
        : { bundleCompleted: false, ...status };
    } else {
      bundle = await handleBundleCompletion(session.userId, session.organizationId, session.missionBundleId);
    }
  }

  return { ...buildResult(session, mission, attempt, bundle), starsGained, coinsEarned, demo };
}

/**
 * Score a finished TOURNAMENT race. Only sessions started for a tournament
 * (session.tournamentId set, which requires the player to have joined) count —
 * normal races never touch tournament progress. The entry's score grows by the
 * tournament's metric (XP earned, stars gained, score %, or seconds left for
 * speed races) and placements are re-ranked live with tie-breakers
 * (score → stars → earliest joiner).
 */
async function updateTournamentProgress(
  session: any,
  mission: any,
  gains: { xpEarned: number; starsGained: number; scorePct: number; timeRemainingSec: number },
) {
  if (!session.tournamentId) return;
  const entry: any = await TournamentEntry.findOne({
    where: { tournamentId: session.tournamentId, userId: session.userId },
  });
  if (!entry) return;

  const t: any = await Tournament.findByPk(session.tournamentId);
  const now = new Date();
  if (!t || t.status !== 'ACTIVE') return;
  if (t.startsAt && now < t.startsAt) return;
  if (t.endsAt && now > t.endsAt) return;
  // Bundle-scoped tournaments only count missions from that bundle (tournament-
  // only races have no mission — they always count).
  if (t.missionBundleId && mission && t.missionBundleId !== mission.missionBundleId) return;

  let delta = 0;
  switch (t.metric) {
    case 'STARS':
      delta = gains.starsGained;
      break;
    case 'SCORE':
      delta = gains.scorePct;
      break;
    case 'SPEED':
      delta = Math.max(0, gains.timeRemainingSec ?? 0);
      break;
    case 'XP':
    default:
      delta = gains.xpEarned;
      break;
  }
  if (delta <= 0 && gains.starsGained <= 0) return;

  await entry.increment({ score: delta, starsEarned: gains.starsGained });
  await rankTournamentEntries(t.id);
  eventBus.emitSafe(EVENTS.TOURNAMENT_SCORED, {
    tournamentId: t.id,
    userId: session.userId,
    delta,
  });
}

async function handleBundleCompletion(userId: string, organizationId: string, bundleId: string) {
  // Grant bundle rewards only on the FIRST completion — replaying a mission
  // inside an already-finished bundle must not re-issue XP/stars/certificates.
  const prevBundleProgress: any = await Progress.findOne({
    where: { userId, entityType: 'MISSION_BUNDLE', entityId: bundleId },
  });
  const alreadyCompleted = prevBundleProgress?.status === 'COMPLETED';

  const status = await recomputeBundleProgress(userId, organizationId, bundleId);
  if (!status.completed) return { bundleCompleted: false, ...status };
  if (alreadyCompleted) {
    return { bundleCompleted: true, stars: status.stars, maxStars: status.maxStars, certificateSerial: null };
  }

  const bundle: any = await MissionBundle.findByPk(bundleId);
  const ctx = { userId, organizationId, sourceType: 'BUNDLE', sourceId: bundleId, stats: { stars: status.stars } };

  if (bundle.xpReward) await awardXp({ userId, organizationId, amount: bundle.xpReward, source: 'BONUS', refType: 'MISSION_BUNDLE', refId: bundleId });
  if (bundle.starReward) {
    await User.increment({ stars: bundle.starReward }, { where: { id: userId } });
    await contribute({ userId, organizationId, metric: 'STARS', delta: bundle.starReward });
  }
  await applyRewardRules(ctx, { missionBundleId: bundleId });
  if (bundle.badgeId) await awardBadge(userId, organizationId, { badgeId: bundle.badgeId });

  let certificate: any = null;
  if (bundle.certificateTemplateId) {
    certificate = await issueCertificate({
      userId,
      organizationId,
      templateId: bundle.certificateTemplateId,
      sourceType: 'MISSION_BUNDLE',
      sourceId: bundleId,
      data: { title: bundle.title, stars: status.stars, maxStars: status.maxStars },
    });
  }

  eventBus.emitSafe(EVENTS.BUNDLE_COMPLETED, { userId, organizationId, bundleId });
  return {
    bundleCompleted: true,
    stars: status.stars,
    maxStars: status.maxStars,
    certificateSerial: certificate ? (certificate as any).serial : null,
  };
}

async function maybeUnlockAccessory(session: any, missionId: string) {
  // Demo (GUEST) players never win real accessories.
  if (await isDemoPlayer(session.userId)) return null;
  const rewards = await MissionAccessoryReward.findAll({ where: { missionId, trigger: 'CORRECT_ANSWER' } });
  const already: string[] = session.accessoriesUnlocked || [];
  for (const r of rewards as any[]) {
    if (already.includes(r.accessoryId)) continue;
    // chancePct roll using session correctCount as deterministic-ish gate
    const roll = (crypto.randomBytes(1)[0] / 255) * 100;
    if (roll <= r.chancePct) {
      const newly = await unlockAccessory(session.userId, r.accessoryId, 'MISSION');
      if (newly) {
        session.accessoriesUnlocked = [...already, r.accessoryId];
        // Send the full accessory so the client can celebrate it by name.
        const accessory: any = await Accessory.findByPk(r.accessoryId);
        return {
          accessoryId: r.accessoryId,
          key: accessory?.key,
          name: accessory?.name ?? 'New accessory',
          slot: accessory?.slot,
          iconUrl: accessory?.iconUrl,
          message: `You unlocked "${accessory?.name ?? 'a new accessory'}" — equip it from your garage!`,
        };
      }
    }
  }
  return null;
}

/** Result payload for a tournament-only or quick race (no mission attempt behind it). */
function buildTournamentResult(
  session: any,
  rules: any,
  extra: { scorePct?: number; xpEarned?: number; passed?: boolean } = {},
) {
  const total = session.questionOrder.length;
  const scorePct = extra.scorePct ?? (total ? Math.round((session.correctCount / total) * 100) : 0);
  return {
    missionId: null,
    tournamentId: session.tournamentId,
    missionTitle: session.tournamentId ? `🏆 ${rules.title}` : `🏁 ${rules.title}`,
    questionsAnswered: session.currentIndex,
    questionsTotal: total,
    correctAnswers: session.correctCount,
    starsEarned: session.starsEarned,
    maxStars: rules.maxStars,
    timeRemainingSec: session.timeRemainingSec,
    scorePct,
    xpEarned: extra.xpEarned ?? 0,
    rating: ratingFor(scorePct),
    passed: extra.passed ?? scorePct >= rules.passingScorePct,
    bundle: null,
  };
}

function buildResult(session: any, mission: any, attempt: any, bundle: any = null) {
  return {
    missionId: mission.id,
    missionTitle: mission.title,
    questionsAnswered: attempt.correctCount + (attempt.questionsTotal - attempt.correctCount),
    questionsTotal: attempt.questionsTotal,
    correctAnswers: attempt.correctCount,
    starsEarned: attempt.starsEarned,
    maxStars: mission.maxStars,
    timeRemainingSec: attempt.timeRemainingSec,
    scorePct: attempt.scorePct,
    xpEarned: attempt.xpEarned,
    rating: attempt.rating,
    passed: attempt.status === 'PASSED',
    bundle,
  };
}

// ── grading per question type ───────────────────────────────────────────────
function grade(question: any, lanes: any[], payload: any): { isCorrect: boolean; correctOption: any } {
  const correctOptions = lanes.filter((o) => o.isCorrect);
  const correctOption = correctOptions[0] ?? null;

  switch (question.type) {
    case 'MULTIPLE_CHOICE': {
      const chosen = new Set(payload.optionIds ?? []);
      const correctIds = new Set(correctOptions.map((o) => o.id));
      const isCorrect = chosen.size === correctIds.size && [...chosen].every((id) => correctIds.has(id));
      return { isCorrect, correctOption };
    }
    case 'FILL_IN_BLANK':
    case 'SCENARIO_BASED':
    case 'ARRANGE_ORDER':
    case 'MATCH_PAIR': {
      // Fallback to option-id matching where applicable.
      const chosenId = payload.optionId;
      return { isCorrect: chosenId === correctOption?.id, correctOption };
    }
    case 'SINGLE_CHOICE':
    case 'TRUE_FALSE':
    case 'IMAGE_CHOICE':
    case 'TIMED_QUESTION':
    case 'VIDEO_QUESTION':
    default: {
      // Racing lanes: player steered into `chosenLane`, or picked an optionId.
      let chosen: any = null;
      if (payload.optionId) chosen = lanes.find((o) => o.id === payload.optionId);
      else if (payload.chosenLane != null) chosen = lanes[payload.chosenLane];
      return { isCorrect: !!chosen?.isCorrect, correctOption };
    }
  }
}
