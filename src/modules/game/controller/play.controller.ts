// Player-facing gameplay controller — the endpoints the racing client calls.
import type { Request, Response } from 'express';
import { ok } from '../../../utils/responseHandler';
import { AppError } from '../../../utils/AppError';
import {
  Avatar,
  MissionBundle,
  Mission,
  Course,
  ContentBlock,
  Progress,
  GameSession,
  MissionAttempt,
  User,
  GarageItem,
  Accessory,
  UserBadge,
  Badge,
  Department,
  Tournament,
  TournamentEntry,
  ShopItem,
  ShopOrder,
} from '../../../models';
import { unlockAccessory } from '../../../engines/reward.engine';
import { ensureDefaultGameContent } from '../../../engines/defaultContent.engine';
import { startSession, getSessionState, submitAnswer, completeSession } from '../service/gameSession.service';
import { settleDueTournaments } from '../service/tournament.service';
import { resolveRank } from '../../../engines/xp.engine';
import { normalizeRole } from '../../../auth/permissions';
import { MissionAccessoryReward } from '../../../models';

async function assertOwnedSession(req: Request) {
  const session: any = await GameSession.findByPk(req.params.id);
  if (!session) throw AppError.notFound('Session not found');
  if (session.userId !== req.user!.id) throw AppError.forbidden('Not your session');
  return session;
}

// GET /api/play/avatars — pick-your-driver screen (this org's avatars only).
export async function listAvatars(req: Request, res: Response) {
  const avatars = await Avatar.findAll({
    where: { organizationId: req.user!.organizationId! },
    order: [['order_index', 'ASC']],
  });
  return ok(res, avatars);
}

// GET /api/play/pillars — the hub: bundles + their missions with the player's progress.
// Scoped to the player's organization — showing another tenant's missions here
// made race starts fail with "Mission not found". Also self-heals orgs that
// were created before default content provisioning existed.
export async function listPillars(req: Request, res: Response) {
  const userId = req.user!.id;
  const organizationId = req.user!.organizationId!;
  const query = () =>
    MissionBundle.findAll({
      where: { organizationId, isPublished: true },
      order: [['order_index', 'ASC']],
      include: [{ model: Mission, as: 'missions', where: { isPublished: true }, required: false }],
    });

  let bundles = await query();
  if (bundles.length === 0 && organizationId) {
    // Empty org: provision the default SDLC Quest content and retry once.
    await ensureDefaultGameContent(organizationId);
    bundles = await query();
  }

  const progress = await Progress.findAll({ where: { userId } });
  const pMap = new Map(progress.map((p: any) => [`${p.entityType}:${p.entityId}`, p]));

  const data = (bundles as any[]).map((b) => ({
    id: b.id,
    title: b.title,
    slug: b.slug,
    description: b.description,
    coverUrl: b.coverUrl,
    maxStars: b.maxStars,
    starReward: b.starReward,
    progress: pMap.get(`MISSION_BUNDLE:${b.id}`) ?? null,
    missions: (b.missions ?? [])
      .sort((m1: any, m2: any) => m1.orderIndex - m2.orderIndex)
      .map((m: any) => ({
        id: m.id,
        title: m.title,
        slug: m.slug,
        description: m.description,
        difficulty: m.difficulty,
        estimatedMin: m.estimatedMin,
        maxStars: m.maxStars,
        courseId: m.courseId,
        // The hub races missions AS PART OF their bundle, so it shows the
        // bundle-flow progress (isolated from standalone mission progress).
        progress: pMap.get(`BUNDLE_MISSION:${m.id}`) ?? null,
      })),
  }));
  return ok(res, data);
}

// GET /api/play/missions/:id/content — the "Learn first" material shown before the race.
export async function getMissionContent(req: Request, res: Response) {
  const mission: any = await Mission.findByPk(req.params.id);
  if (!mission) throw AppError.notFound('Mission not found');
  let course: any = null;
  let blocks: any[] = [];
  if (mission.courseId) {
    course = await Course.findByPk(mission.courseId);
    blocks = await ContentBlock.findAll({ where: { courseId: mission.courseId }, order: [['order_index', 'ASC']] });
  }
  return ok(res, { mission: { id: mission.id, title: mission.title }, course, contentBlocks: blocks });
}

// POST /api/play/sessions — start a mission (returns token + first question + HUD).
// Pass tournamentId to race FOR a joined tournament; normal races never count.
// Pass missionBundleId when the mission was launched FROM its bundle — only
// those races feed bundle progress (standalone mission races never do).
// Neither missionId nor tournamentId = quick race (randomized, nothing recorded).
export async function createSession(req: Request, res: Response) {
  const { missionId, missionBundleId, avatarId, tournamentId } = req.body;
  const data = await startSession({
    userId: req.user!.id,
    organizationId: req.user!.organizationId!,
    missionId,
    missionBundleId,
    avatarId,
    tournamentId,
  });
  return ok(res, data, 'Session started');
}

// GET /api/play/sessions/:id — current state.
export async function sessionState(req: Request, res: Response) {
  await assertOwnedSession(req);
  return ok(res, await getSessionState(req.params.id));
}

// POST /api/play/sessions/:id/answer — submit the player's move.
export async function answer(req: Request, res: Response) {
  await assertOwnedSession(req);
  const { questionId, chosenLane, optionId, optionIds, value, timeTakenMs } = req.body;
  const data = await submitAnswer({
    sessionId: req.params.id,
    questionId,
    payload: { chosenLane, optionId, optionIds, value },
    timeTakenMs,
  });
  return ok(res, data);
}

// POST /api/play/sessions/:id/complete — force finalize (timeout / quit-to-results).
export async function finish(req: Request, res: Response) {
  await assertOwnedSession(req);
  return ok(res, await completeSession(req.params.id));
}

// GET /api/play/dashboard — the employee's own learning analytics.
export async function getDashboard(req: Request, res: Response) {
  const userId = req.user!.id;
  const user: any = await User.findByPk(userId);
  if (!user) throw AppError.notFound('User not found');

  const [attempts, badges, garageCount, rank] = await Promise.all([
    MissionAttempt.findAll({
      where: { userId },
      order: [['startedAt', 'DESC']],
      include: [{ model: Mission, attributes: ['id', 'title'] }],
    }),
    UserBadge.findAll({ where: { userId }, include: [{ model: Badge }] }),
    GarageItem.count({ where: { userId } }),
    resolveRank(user.organizationId, user.totalXp),
  ]);

  const passed = (attempts as any[]).filter((a) => a.status === 'PASSED');
  const scored = (attempts as any[]).filter((a) => a.status === 'PASSED' || a.status === 'FAILED');
  const avgScore = scored.length ? Math.round(scored.reduce((s, a) => s + a.scorePct, 0) / scored.length) : 0;
  const missionsCompleted = new Set(passed.map((a: any) => a.missionId)).size;
  const allMissions = await Mission.findAll({
    where: { organizationId: user.organizationId, isPublished: true },
    order: [['order_index', 'ASC']],
  });
  const totalMissions = allMissions.length;

  // Per-pillar (bundle) progress for this employee (their org's bundles only).
  const bundles = await MissionBundle.findAll({
    where: { organizationId: user.organizationId, isPublished: true },
    order: [['order_index', 'ASC']],
  });
  const progressRows = await Progress.findAll({ where: { userId } });
  const pMap = new Map(progressRows.map((p: any) => [`${p.entityType}:${p.entityId}`, p]));
  const pillars = (bundles as any[]).map((b) => {
    const bp: any = pMap.get(`MISSION_BUNDLE:${b.id}`);
    return {
      id: b.id,
      title: b.title,
      completionPct: bp?.completionPct ?? 0,
      starsEarned: bp?.starsEarned ?? 0,
      maxStars: b.maxStars,
      status: bp?.status ?? 'AVAILABLE',
    };
  });

  // Every mission the employee can play/join, with their own progress on each.
  // status/stars/pct are the STANDALONE mission progress; bundleProgress is the
  // separate bundle-flow record (races started from the bundle) so the UI can
  // show both without merging them.
  const bundleTitles = new Map((bundles as any[]).map((b) => [b.id, b.title]));
  const missions = (allMissions as any[]).map((m) => {
    const mp: any = pMap.get(`MISSION:${m.id}`);
    const bp: any = m.missionBundleId ? pMap.get(`BUNDLE_MISSION:${m.id}`) : null;
    return {
      id: m.id,
      title: m.title,
      difficulty: m.difficulty,
      estimatedMin: m.estimatedMin,
      maxStars: m.maxStars,
      bundleId: m.missionBundleId,
      bundleTitle: m.missionBundleId ? bundleTitles.get(m.missionBundleId) ?? null : null,
      status: mp?.status ?? 'AVAILABLE',
      starsEarned: mp?.starsEarned ?? 0,
      completionPct: mp?.completionPct ?? 0,
      bestScorePct: mp?.bestScorePct ?? 0,
      bundleProgress: m.missionBundleId
        ? {
            status: bp?.status ?? 'AVAILABLE',
            starsEarned: bp?.starsEarned ?? 0,
            completionPct: bp?.completionPct ?? 0,
            bestScorePct: bp?.bestScorePct ?? 0,
          }
        : null,
    };
  });

  // Settle any tournaments whose end date has passed (final ranking + rewards),
  // then list the org's open tournaments with the player's joined state.
  await settleDueTournaments(user.organizationId).catch(() => {});
  const [openTournaments, myEntries] = await Promise.all([
    Tournament.findAll({
      where: { organizationId: user.organizationId, status: ['ACTIVE', 'SCHEDULED'] },
      order: [['starts_at', 'ASC']],
    }),
    TournamentEntry.findAll({ where: { userId } }),
  ]);
  const entryMap = new Map((myEntries as any[]).map((e) => [e.tournamentId, e]));
  const tournaments = (openTournaments as any[]).map((t) => {
    const entry: any = entryMap.get(t.id);
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      metric: t.metric,
      startsAt: t.startsAt,
      endsAt: t.endsAt,
      // Top-3 prize pool ({ "1": {xp, coins, stars}, … }) — shown to players
      // as motivation; paid automatically at settlement.
      prizes: t.rewardConfig ?? null,
      winnerStarBonus: t.starReward ?? 0,
      joined: !!entry,
      // The player's live progress in this tournament (racing updates it).
      myScore: entry?.score ?? null,
      myStars: entry?.starsEarned ?? null,
      myPlacement: entry?.placement ?? null,
    };
  });

  const role = normalizeRole(user.role);

  return ok(res, {
    profile: {
      displayName: user.displayName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
      avatarUrl: user.avatarUrl,
      totalXp: user.totalXp,
      coins: user.coins,
      stars: user.stars,
      level: user.currentLevel,
      role,
      demo: role === 'GUEST', // guest = demo account, no real rewards
      rank: rank ? { name: (rank as any).name, tier: (rank as any).tier, color: (rank as any).color } : null,
    },
    stats: {
      missionsCompleted,
      totalMissions,
      attempts: attempts.length,
      averageScore: avgScore,
      badges: badges.length,
      accessories: garageCount,
    },
    pillars,
    missions,
    tournaments,
    recentAttempts: (attempts as any[]).slice(0, 5).map((a) => ({
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

const personCard = (u: any) => ({
  id: u.id,
  name: u.displayName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email,
  email: u.email,
  role: normalizeRole(u.role),
  avatarUrl: u.avatarUrl,
});

// GET /api/play/team — who runs your learning in this organization (admins,
// managers, trainers) and the chain your progress reports up to.
export async function getTeam(req: Request, res: Response) {
  const me: any = await User.findByPk(req.user!.id);
  if (!me) throw AppError.notFound('User not found');

  const staff = await User.findAll({
    where: {
      organizationId: me.organizationId,
      role: ['ADMIN', 'ORG_ADMIN', 'MANAGER', 'TRAINER'],
      status: 'ACTIVE',
    },
    attributes: ['id', 'displayName', 'firstName', 'lastName', 'email', 'role', 'avatarUrl', 'departmentId'],
    order: [['first_name', 'ASC']],
  });

  const grouped: any = { admins: [], managers: [], trainers: [] };
  for (const s of staff as any[]) {
    const r = normalizeRole(s.role);
    if (r === 'ADMIN') grouped.admins.push(personCard(s));
    else if (r === 'MANAGER') grouped.managers.push(personCard(s));
    else if (r === 'TRAINER') grouped.trainers.push(personCard(s));
  }

  // Reporting chain: you → your department's manager → the org admin(s).
  const dept: any = me.departmentId ? await Department.findByPk(me.departmentId) : null;
  const deptManager: any = dept?.managerId ? await User.findByPk(dept.managerId) : null;
  const reportsTo: any[] = [];
  if (deptManager) {
    reportsTo.push({ ...personCard(deptManager), why: `Manager of ${dept.name} — reviews your team's progress` });
  }
  for (const a of grouped.admins) {
    reportsTo.push({ ...a, why: 'Organization admin — sees progress across the whole organization' });
  }

  return ok(res, {
    department: dept ? { id: dept.id, name: dept.name } : null,
    ...grouped,
    reportsTo,
  });
}

// POST /api/play/tournaments/:id/join — enter a tournament (players only;
// demo/guest accounts compete for nothing, so they can't join).
export async function joinTournament(req: Request, res: Response) {
  const me: any = await User.findByPk(req.user!.id, { attributes: ['id', 'role'] });
  if (normalizeRole(me?.role) === 'GUEST') {
    throw AppError.forbidden("Demo (guest) accounts can't join tournaments — sign up as an employee to compete for real rewards.");
  }
  const t: any = await Tournament.findByPk(req.params.id);
  if (!t) throw AppError.notFound('Tournament not found');
  if (!['ACTIVE', 'SCHEDULED'].includes(t.status)) {
    throw AppError.badRequest(`"${t.name}" is ${String(t.status).toLowerCase()} — only active or scheduled tournaments can be joined.`);
  }
  const [, isNew] = await TournamentEntry.findOrCreate({
    where: { tournamentId: t.id, userId: me.id },
    defaults: { tournamentId: t.id, userId: me.id },
  });
  return ok(
    res,
    { tournamentId: t.id, joined: true, alreadyJoined: !isNew },
    isNew ? `You joined "${t.name}" — good luck!` : `You're already competing in "${t.name}".`,
  );
}

// GET /api/play/shop — active reward-shop items with the player's wallet and,
// per item, whether they can afford / already own it.
export async function getShop(req: Request, res: Response) {
  const user: any = await User.findByPk(req.user!.id);
  if (!user) throw AppError.notFound('User not found');

  const [items, orders, garage] = await Promise.all([
    ShopItem.findAll({
      where: { organizationId: user.organizationId, isActive: true },
      order: [['price_coins', 'ASC'], ['price_stars', 'ASC']],
    }),
    ShopOrder.findAll({ where: { userId: user.id, status: ['PENDING', 'FULFILLED'] } }),
    GarageItem.findAll({ where: { userId: user.id }, attributes: ['accessoryId'] }),
  ]);
  const orderedItems = new Set((orders as any[]).map((o) => o.shopItemId));
  const ownedAccessories = new Set((garage as any[]).map((g) => g.accessoryId));

  return ok(res, {
    wallet: { coins: user.coins ?? 0, stars: user.stars ?? 0 },
    demo: normalizeRole(user.role) === 'GUEST',
    items: (items as any[]).map((i) => ({
      id: i.id,
      kind: i.kind,
      name: i.name,
      description: i.description,
      imageUrl: i.imageUrl,
      priceCoins: i.priceCoins ?? 0,
      priceStars: i.priceStars ?? 0,
      stock: i.stock,
      soldOut: i.stock != null && i.stock <= 0,
      owned: orderedItems.has(i.id) || (i.kind === 'ACCESSORY' && i.targetId && ownedAccessories.has(i.targetId)),
      canAfford: (user.coins ?? 0) >= (i.priceCoins ?? 0) && (user.stars ?? 0) >= (i.priceStars ?? 0),
    })),
  });
}

// POST /api/play/shop/:id/buy — spend coins/stars on a reward. Accessories go
// straight to the garage; company rewards create a PENDING order for an admin
// to fulfil. Clear error messages for every failure mode.
export async function buyShopItem(req: Request, res: Response) {
  const user: any = await User.findByPk(req.user!.id);
  if (!user) throw AppError.notFound('User not found');
  if (normalizeRole(user.role) === 'GUEST') {
    throw AppError.forbidden("Demo (guest) accounts can't buy rewards — sign up as an employee to earn and spend coins.");
  }

  const item: any = await ShopItem.findOne({ where: { id: req.params.id, organizationId: user.organizationId } });
  if (!item || !item.isActive) throw AppError.notFound('This shop item is no longer available');
  if (item.stock != null && item.stock <= 0) throw AppError.badRequest(`"${item.name}" is sold out.`);

  const coins = user.coins ?? 0;
  const stars = user.stars ?? 0;
  const needCoins = item.priceCoins ?? 0;
  const needStars = item.priceStars ?? 0;
  if (coins < needCoins || stars < needStars) {
    const missing = [
      coins < needCoins ? `${needCoins - coins} more coins` : null,
      stars < needStars ? `${needStars - stars} more stars` : null,
    ].filter(Boolean).join(' and ');
    throw AppError.badRequest(`You can't afford "${item.name}" yet — you need ${missing}. Keep racing to earn more!`);
  }

  if (item.kind === 'ACCESSORY' && item.targetId) {
    const already = await GarageItem.findOne({ where: { userId: user.id, accessoryId: item.targetId } });
    if (already) throw AppError.badRequest(`"${item.name}" is already in your garage.`);
  }

  // Pay, record the order, deliver.
  await user.update({ coins: coins - needCoins, stars: stars - needStars });
  if (item.stock != null) await item.update({ stock: item.stock - 1 });

  const instantly = item.kind === 'ACCESSORY' && item.targetId;
  if (instantly) await unlockAccessory(user.id, item.targetId, 'SHOP');

  const order = await ShopOrder.create({
    organizationId: user.organizationId,
    userId: user.id,
    shopItemId: item.id,
    status: instantly ? 'FULFILLED' : 'PENDING',
    paidCoins: needCoins,
    paidStars: needStars,
  });

  return ok(
    res,
    {
      orderId: (order as any).id,
      status: instantly ? 'FULFILLED' : 'PENDING',
      wallet: { coins: coins - needCoins, stars: stars - needStars },
    },
    instantly
      ? `"${item.name}" is yours — it's been added to your garage!`
      : `Order placed for "${item.name}" — your admin will fulfil it soon.`,
  );
}

// GET /api/play/garage — the FULL accessory catalog with the player's unlock &
// equip state. Locked items are shown too, each with concrete unlock
// requirements + the player's live progress toward them, so the client can
// show a "how do I get this?" modal instead of a bare padlock.
export async function getGarage(req: Request, res: Response) {
  const userId = req.user!.id;
  const organizationId = req.user!.organizationId!;
  const [user, accessories, owned] = await Promise.all([
    User.findByPk(userId, { attributes: ['coins', 'stars'] }) as any,
    Accessory.findAll({ where: { organizationId }, order: [['order_index', 'ASC']] }),
    GarageItem.findAll({ where: { userId } }),
  ]);
  const ownedMap = new Map((owned as any[]).map((g) => [g.accessoryId, g]));

  // How each accessory is won: mission rewards and/or shop listings.
  const accessoryIds = (accessories as any[]).map((a) => a.id);
  const [rewardLinks, shopListings] = await Promise.all([
    MissionAccessoryReward.findAll({ where: { accessoryId: accessoryIds } }),
    ShopItem.findAll({ where: { organizationId, kind: 'ACCESSORY', targetId: accessoryIds, isActive: true } }),
  ]);
  const missionIds = [...new Set((rewardLinks as any[]).map((r) => r.missionId))];
  const [rewardMissions, missionProgress] = await Promise.all([
    Mission.findAll({ where: { id: missionIds } }),
    Progress.findAll({ where: { userId, entityType: 'MISSION', entityId: missionIds } }),
  ]);
  const missionMap = new Map((rewardMissions as any[]).map((m) => [m.id, m]));
  const progressMap = new Map((missionProgress as any[]).map((p) => [p.entityId, p]));
  const linksByAccessory = new Map<string, any[]>();
  for (const link of rewardLinks as any[]) {
    const list = linksByAccessory.get(link.accessoryId) ?? [];
    list.push(link);
    linksByAccessory.set(link.accessoryId, list);
  }
  const shopByAccessory = new Map((shopListings as any[]).map((s) => [s.targetId, s]));

  const coins = user?.coins ?? 0;
  const stars = user?.stars ?? 0;

  // Build the unlock plan for one accessory: why it's locked, every
  // requirement with current/target progress, and where to go next.
  const unlockPlan = (a: any) => {
    const requirements: any[] = [];
    let hint: string | null = null;

    for (const link of linksByAccessory.get(a.id) ?? []) {
      const mission: any = missionMap.get(link.missionId);
      if (!mission) continue;
      const prog: any = progressMap.get(link.missionId);
      requirements.push({
        kind: 'MISSION',
        label:
          link.trigger === 'CORRECT_ANSWER'
            ? `Answer questions correctly in "${mission.title}" (${link.chancePct}% drop per correct answer)`
            : `Complete the "${mission.title}" mission`,
        missionId: mission.id,
        current: prog?.starsEarned ?? 0,
        target: mission.maxStars ?? 5,
        done: prog?.status === 'COMPLETED',
      });
      hint = hint ?? `Race the "${mission.title}" pillar — correct answers can drop this reward.`;
    }

    const listing: any = shopByAccessory.get(a.id);
    if (listing) {
      if (listing.priceCoins > 0) {
        requirements.push({
          kind: 'COINS',
          label: `Save ${listing.priceCoins} coins (earn 10 per new star + first-pass bonuses)`,
          current: Math.min(coins, listing.priceCoins),
          target: listing.priceCoins,
          done: coins >= listing.priceCoins,
        });
      }
      if (listing.priceStars > 0) {
        requirements.push({
          kind: 'STARS',
          label: `Earn ${listing.priceStars} stars (one per correct answer, up to 5 per mission)`,
          current: Math.min(stars, listing.priceStars),
          target: listing.priceStars,
          done: stars >= listing.priceStars,
        });
      }
      hint = hint ?? `Buy it in the Reward Shop for ${listing.priceCoins} coins${listing.priceStars ? ` + ${listing.priceStars} stars` : ''}.`;
    }

    if (!requirements.length) {
      hint = 'Awarded for special achievements — keep racing and completing pillars!';
    }
    return { requirements, hint, shopItemId: listing?.id ?? null };
  };

  const items = (accessories as any[]).map((a) => {
    const unlocked = ownedMap.has(a.id);
    return {
      id: a.id,
      key: a.key,
      name: a.name,
      slot: a.slot,
      rarity: a.rarity,
      iconUrl: a.iconUrl,
      unlockType: a.unlockType,
      unlocked,
      isEquipped: ownedMap.get(a.id)?.isEquipped ?? false,
      unlockedAt: ownedMap.get(a.id)?.unlockedAt ?? null,
      // Only locked items need the plan; unlocked ones already tell their story.
      unlock: unlocked ? null : unlockPlan(a),
    };
  });
  return ok(res, {
    wallet: { coins, stars },
    items,
    unlockedCount: ownedMap.size,
    totalCount: items.length,
  });
}

// POST /api/play/garage/:accessoryId/equip — equip an unlocked accessory on the
// kart (one per slot); calling it on an equipped item unequips it.
export async function equipAccessory(req: Request, res: Response) {
  const userId = req.user!.id;
  const accessory: any = await Accessory.findByPk(req.params.accessoryId);
  if (!accessory) throw AppError.notFound('Accessory not found');

  const item: any = await GarageItem.findOne({ where: { userId, accessoryId: accessory.id } });
  if (!item) {
    throw AppError.forbidden(
      `"${accessory.name}" is still locked — answer questions correctly in missions that reward it to unlock it.`,
    );
  }

  if (item.isEquipped) {
    await item.update({ isEquipped: false });
    return ok(res, { accessoryId: accessory.id, isEquipped: false }, `"${accessory.name}" removed from your kart`);
  }

  // One equipped accessory per slot: unequip any other item in the same slot.
  const slotMates = await Accessory.findAll({
    where: { organizationId: accessory.organizationId, slot: accessory.slot },
    attributes: ['id'],
  });
  await GarageItem.update(
    { isEquipped: false },
    { where: { userId, accessoryId: (slotMates as any[]).map((s) => s.id) } },
  );
  await item.update({ isEquipped: true });
  return ok(
    res,
    { accessoryId: accessory.id, key: accessory.key, name: accessory.name, slot: accessory.slot, isEquipped: true },
    `"${accessory.name}" equipped on your kart`,
  );
}

// GET /api/play/me — the player HUD/profile (xp, level, rank, stars, garage, badges).
export async function getProfile(req: Request, res: Response) {
  const user: any = await User.findByPk(req.user!.id);
  if (!user) throw AppError.notFound('User not found');
  const [garage, badges, rank] = await Promise.all([
    GarageItem.findAll({ where: { userId: user.id }, include: [{ model: Accessory }] }),
    UserBadge.findAll({ where: { userId: user.id }, include: [{ model: Badge }] }),
    resolveRank(user.organizationId, user.totalXp),
  ]);
  const role = normalizeRole(user.role);
  return ok(res, {
    id: user.id,
    displayName: user.displayName || `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
    avatarUrl: user.avatarUrl,
    totalXp: user.totalXp,
    coins: user.coins,
    stars: user.stars,
    level: user.currentLevel,
    role,
    demo: role === 'GUEST',
    rank: rank ? { name: (rank as any).name, tier: (rank as any).tier, color: (rank as any).color } : null,
    garage: (garage as any[]).map((g) => ({ accessoryId: g.accessoryId, isEquipped: g.isEquipped, accessory: g.Accessory })),
    badges: (badges as any[]).map((b) => b.Badge),
  });
}
