// Player-facing gameplay controller — the endpoints the racing client calls.
import type { Request, Response } from 'express';
import { ok } from '../../../utils/responseHandler';
import { AppError } from '../../../utils/AppError';
import {
  Avatar,
  MissionBundle,
  Mission,
  Course,
  CourseMission,
  CourseBundle,
  CourseTournament,
  ContentBlock,
  LearningPath,
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
  IssuedCertificate,
  CertificateTemplate,
  ShopItem,
  ShopOrder,
} from '../../../models';
import { Op } from 'sequelize';
import { unlockAccessory } from '../../../engines/reward.engine';
import { ensureDefaultGameContent } from '../../../engines/defaultContent.engine';
import { startSession, getSessionState, submitAnswer, completeSession } from '../service/gameSession.service';
import { settleDueTournaments } from '../service/tournament.service';
import { recomputeCourseProgress } from '../../../engines/progress.engine';
import { issueCertificate } from '../../../engines/certificate.engine';
import { resolveRank } from '../../../engines/xp.engine';
import { normalizeRole } from '../../../auth/permissions';
import { MissionAccessoryReward } from '../../../models';

// Certificate title configured by the org admin — prefers the template assigned
// to a published pillar (bundle), else any of the org's templates. Null when the
// org has none; the client falls back to its default label.
async function resolveCertificateName(organizationId: string): Promise<string | null> {
  const bundle: any = await MissionBundle.findOne({
    where: { organizationId, isPublished: true, certificateTemplateId: { [Op.ne]: null } },
    order: [['order_index', 'ASC']],
  });
  let tpl: any = bundle?.certificateTemplateId
    ? await CertificateTemplate.findByPk(bundle.certificateTemplateId)
    : null;
  if (!tpl) tpl = await CertificateTemplate.findOne({ where: { organizationId }, order: [['created_at', 'ASC']] });
  const name = tpl ? (tpl.layout?.title || tpl.name || null) : null;
  return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim() : null;
}

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
    // Storyboard briefing attached to this pillar (LearningPath.type = MISSION_BUNDLE).
    learningPathId: b.learningPathId ?? null,
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

// GET /api/play/courses — the player's learning roadmaps (LMS style). Each
// published course lists the missions, mission bundles and tournaments it
// REFERENCES, each with the player's OWN progress on that entity (standalone
// mission progress, bundle progress, tournament entry) plus the course-level
// rollup. Completing everything issues the course certificate (once).
export async function listCourses(req: Request, res: Response) {
  const userId = req.user!.id;
  const organizationId = req.user!.organizationId!;

  const courses = await Course.findAll({
    where: { organizationId, isPublished: true },
    order: [['order_index', 'ASC'], ['created_at', 'ASC']],
  });

  const progressRows = await Progress.findAll({ where: { userId } });
  const pMap = new Map(progressRows.map((p: any) => [`${p.entityType}:${p.entityId}`, p]));
  const myEntries = await TournamentEntry.findAll({ where: { userId } });
  const entryMap = new Map((myEntries as any[]).map((e) => [e.tournamentId, e]));

  const data: any[] = [];
  for (const c of courses as any[]) {
    const [missionLinks, bundleLinks, tournamentLinks] = await Promise.all([
      CourseMission.findAll({ where: { courseId: c.id }, order: [['order_index', 'ASC']] }),
      CourseBundle.findAll({ where: { courseId: c.id }, order: [['order_index', 'ASC']] }),
      CourseTournament.findAll({ where: { courseId: c.id }, order: [['order_index', 'ASC']] }),
    ]);
    const missionIds = (missionLinks as any[]).map((l) => l.missionId);
    const bundleIds = (bundleLinks as any[]).map((l) => l.missionBundleId);
    const tournamentIds = (tournamentLinks as any[]).map((l) => l.tournamentId);
    // A course with no roadmap content is skipped for players (nothing to do).
    if (!missionIds.length && !bundleIds.length && !tournamentIds.length) continue;

    const [missions, bundles, tournaments, bundleMissions] = await Promise.all([
      missionIds.length ? Mission.findAll({ where: { id: missionIds, isPublished: true } }) : [],
      bundleIds.length ? MissionBundle.findAll({ where: { id: bundleIds, isPublished: true } }) : [],
      tournamentIds.length ? Tournament.findAll({ where: { id: tournamentIds } }) : [],
      bundleIds.length ? Mission.findAll({ where: { missionBundleId: bundleIds, isPublished: true }, order: [['order_index', 'ASC']] }) : [],
    ]);
    const missionById = new Map((missions as any[]).map((m) => [m.id, m]));
    const bundleById = new Map((bundles as any[]).map((b) => [b.id, b]));
    const tournamentById = new Map((tournaments as any[]).map((t) => [t.id, t]));
    const missionsByBundle = new Map<string, any[]>();
    for (const m of bundleMissions as any[]) {
      const list = missionsByBundle.get(m.missionBundleId) ?? [];
      list.push(m);
      missionsByBundle.set(m.missionBundleId, list);
    }

    // Roll up (and persist) the course progress, then issue the certificate on
    // first completion — issueCertificate dedupes per (user, source).
    const rollup = await recomputeCourseProgress(userId, organizationId, c.id);
    let certificate: any = await IssuedCertificate.findOne({
      where: { userId, sourceType: 'COURSE', sourceId: c.id },
    });
    if (!certificate && rollup.completed && c.certificateTemplateId) {
      certificate = await issueCertificate({
        userId,
        organizationId,
        templateId: c.certificateTemplateId,
        sourceType: 'COURSE',
        sourceId: c.id,
        data: { title: c.title, completionPct: rollup.completionPct },
      });
    }

    data.push({
      id: c.id,
      title: c.title,
      slug: c.slug,
      summary: c.summary,
      description: c.description,
      coverUrl: c.coverUrl,
      color: c.color,
      difficulty: c.difficulty,
      estimatedMin: c.estimatedMin,
      // Storyboard briefing attached to this course (LearningPath.type = COURSE).
      learningPathId: c.learningPathId ?? null,
      completionPct: rollup.completionPct,
      completed: rollup.completed,
      hasCertificateTemplate: !!c.certificateTemplateId,
      certificateSerial: certificate ? (certificate as any).serial : null,
      // Standalone mission items — played with STANDALONE progress (MISSION).
      missions: missionIds
        .map((id) => missionById.get(id))
        .filter(Boolean)
        .map((m: any) => {
          const p: any = pMap.get(`MISSION:${m.id}`);
          return {
            id: m.id,
            title: m.title,
            difficulty: m.difficulty,
            estimatedMin: m.estimatedMin,
            maxStars: m.maxStars,
            status: p?.status ?? 'AVAILABLE',
            completionPct: p?.completionPct ?? 0,
            starsEarned: p?.starsEarned ?? 0,
          };
        }),
      // Bundle items — played FROM the bundle (BUNDLE_MISSION flow), rolled up
      // to MISSION_BUNDLE progress. Fully separate from the standalone rows.
      bundles: bundleIds
        .map((id) => bundleById.get(id))
        .filter(Boolean)
        .map((b: any) => {
          const p: any = pMap.get(`MISSION_BUNDLE:${b.id}`);
          return {
            id: b.id,
            title: b.title,
            maxStars: b.maxStars,
            status: p?.status ?? 'AVAILABLE',
            completionPct: p?.completionPct ?? 0,
            starsEarned: p?.starsEarned ?? 0,
            missions: (missionsByBundle.get(b.id) ?? []).map((m: any) => {
              const mp: any = pMap.get(`BUNDLE_MISSION:${m.id}`);
              return {
                id: m.id,
                title: m.title,
                maxStars: m.maxStars,
                bundleId: b.id,
                status: mp?.status ?? 'AVAILABLE',
                starsEarned: mp?.starsEarned ?? 0,
              };
            }),
          };
        }),
      tournaments: tournamentIds
        .map((id) => tournamentById.get(id))
        .filter(Boolean)
        .map((t: any) => {
          const entry: any = entryMap.get(t.id);
          // Roadmap requirement state from the rollup: once the player has
          // joined + played, it stays COMPLETED forever, even after the
          // tournament itself ends.
          const item = rollup.items.find((i: any) => i.kind === 'TOURNAMENT' && i.id === t.id);
          return {
            id: t.id,
            name: t.name,
            type: t.type,
            status: t.status,
            metric: t.metric,
            startsAt: t.startsAt,
            endsAt: t.endsAt,
            prizes: t.rewardConfig ?? null,
            learningPathId: t.learningPathId ?? null,
            joined: !!entry,
            requirementMet: item?.done ?? false,
            myScore: entry?.score ?? null,
            myStars: entry?.starsEarned ?? null,
            myPlacement: entry?.placement ?? null,
          };
        }),
    });
  }

  return ok(res, data);
}

// Which learning-path briefing to show for a mission play, decided by the ENTRY
// CONTEXT (outermost wins):
//   • course context (played through a course that HAS a path) → the course path,
//     overriding any bundle/mission path inside it;
//   • bundle context (played from a bundle) → the bundle's path — the mission's
//     OWN path is never shown here (that only appears on direct play);
//   • direct play → the mission's own path.
// A broader context that has no path falls inward, but the mission's own path is
// only reached when the play is effectively direct. All lookups are org-scoped.
async function resolveEffectiveLearningPathId(
  organizationId: string,
  courseId: string | null,
  bundleId: string | null,
  mission: any,
): Promise<string | null> {
  if (courseId) {
    const course: any = await Course.findByPk(courseId);
    if (course && course.organizationId === organizationId && course.learningPathId) {
      return course.learningPathId; // a course path overrides everything inside it
    }
    // course present but has no path → it doesn't impose a briefing; fall inward.
  }
  if (bundleId) {
    const bundle: any = await MissionBundle.findByPk(bundleId);
    if (bundle && bundle.organizationId === organizationId) return bundle.learningPathId ?? null;
    return null; // bundle context (never the mission's own path)
  }
  return mission.learningPathId ?? null; // direct play
}

// GET /api/play/missions/:id/content — the "Learn first" material shown before the
// race. `?missionBundleId=` / `?courseId=` carry the entry context so the right
// briefing (course > bundle > mission) is resolved.
export async function getMissionContent(req: Request, res: Response) {
  const mission: any = await Mission.findByPk(req.params.id);
  if (!mission) throw AppError.notFound('Mission not found');
  let course: any = null;
  let blocks: any[] = [];
  if (mission.courseId) {
    course = await Course.findByPk(mission.courseId);
    blocks = await ContentBlock.findAll({ where: { courseId: mission.courseId }, order: [['order_index', 'ASC']] });
  }

  const ctxCourseId = typeof req.query.courseId === 'string' ? req.query.courseId : null;
  const ctxBundleId = typeof req.query.missionBundleId === 'string' ? req.query.missionBundleId : null;
  const effectiveLpId = await resolveEffectiveLearningPathId(
    req.user!.organizationId!,
    ctxCourseId,
    ctxBundleId,
    mission,
  );

  // Its ordered `points` are the pre-race briefing panels the player sees.
  let learningPath: any = null;
  if (effectiveLpId) {
    const lp: any = await LearningPath.findByPk(effectiveLpId);
    if (lp && lp.organizationId === req.user!.organizationId) {
      learningPath = {
        id: lp.id,
        title: lp.title,
        description: lp.description,
        points: Array.isArray(lp.points) ? lp.points : [],
      };
    }
  }
  return ok(res, { mission: { id: mission.id, title: mission.title }, course, contentBlocks: blocks, learningPath });
}

// GET /api/play/learning-paths/:id — a single storyboard learning path (its
// ordered `points`), scoped to the player's org. Powers the reusable briefing
// screen a mission bundle / course / tournament links to before play.
export async function getLearningPathContent(req: Request, res: Response) {
  const lp: any = await LearningPath.findByPk(req.params.id);
  if (!lp || lp.organizationId !== req.user!.organizationId) throw AppError.notFound('Learning path not found');
  return ok(res, {
    id: lp.id,
    title: lp.title,
    description: lp.description,
    type: lp.type,
    points: Array.isArray(lp.points) ? lp.points : [],
  });
}

// POST /api/play/sessions — start a mission (returns token + first question + HUD).
// Pass tournamentId to race FOR a joined tournament; normal races never count.
// Pass missionBundleId when the mission was launched FROM its bundle — only
// those races feed bundle progress (standalone mission races never do).
// Neither missionId nor tournamentId = quick race (randomized questions; earns
// XP/stars/coins but records no mission or bundle progress).
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

  const [attempts, badges, garageCount, rank, certificateName] = await Promise.all([
    MissionAttempt.findAll({
      where: { userId },
      order: [['startedAt', 'DESC']],
      include: [{ model: Mission, attributes: ['id', 'title'] }],
    }),
    UserBadge.findAll({ where: { userId }, include: [{ model: Badge }] }),
    GarageItem.count({ where: { userId } }),
    resolveRank(user.organizationId, user.totalXp),
    resolveCertificateName(user.organizationId),
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
      learningPathId: b.learningPathId ?? null,
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
  // Participation history from the player's own persistent entries — it must
  // survive tournament settlement, or roadmap steps would flip back to pending
  // the moment a finished tournament drops out of the open list above.
  const tournamentHistory = {
    joinedAny: (myEntries as any[]).length > 0,
    scoredAny: (myEntries as any[]).some((e) => (e.score ?? 0) > 0),
  };
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
      // Storyboard briefing attached to this tournament (LearningPath.type = TOURNAMENT).
      learningPathId: t.learningPathId ?? null,
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
    certificateName,
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
    tournamentHistory,
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
// per item, whether they can afford / already own it. Accessories are NOT
// listed here — they live in their own Accessories Shop (/play/accessories-shop).
export async function getShop(req: Request, res: Response) {
  const user: any = await User.findByPk(req.user!.id);
  if (!user) throw AppError.notFound('User not found');

  const [items, orders, garage] = await Promise.all([
    ShopItem.findAll({
      where: { organizationId: user.organizationId, isActive: true, kind: { [Op.ne]: 'ACCESSORY' } },
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

// GET /api/play/accessories-shop — the dedicated Accessories Shop: ONLY
// purchasable kart accessories. Just SHOP acquisition-type accessories are
// listed — REWARD accessories are earned by playing and never sold here.
// Bought accessories land straight in the player's Accessories Garage.
export async function getAccessoriesShop(req: Request, res: Response) {
  const user: any = await User.findByPk(req.user!.id);
  if (!user) throw AppError.notFound('User not found');

  const [listings, garage] = await Promise.all([
    ShopItem.findAll({
      where: { organizationId: user.organizationId, isActive: true, kind: 'ACCESSORY' },
      order: [['price_coins', 'ASC'], ['price_stars', 'ASC']],
    }),
    GarageItem.findAll({ where: { userId: user.id }, attributes: ['accessoryId'] }),
  ]);
  const accessoryIds = (listings as any[]).map((l) => l.targetId).filter(Boolean);
  const accessories = accessoryIds.length ? await Accessory.findAll({ where: { id: accessoryIds } }) : [];
  const accessoryById = new Map((accessories as any[]).map((a) => [a.id, a]));
  const owned = new Set((garage as any[]).map((g) => g.accessoryId));

  const items = (listings as any[])
    .map((i) => ({ listing: i, accessory: accessoryById.get(i.targetId) as any }))
    // Hide stale listings for accessories that are no longer SHOP-acquired.
    .filter(({ accessory }) => accessory && accessory.unlockType === 'SHOP')
    .map(({ listing: i, accessory: a }) => ({
      id: i.id,
      accessoryId: a.id,
      name: a.name,
      description: i.description,
      slot: a.slot,
      rarity: a.rarity,
      iconUrl: a.iconUrl,
      imageUrl: i.imageUrl,
      priceCoins: i.priceCoins ?? 0,
      priceStars: i.priceStars ?? 0,
      currency: (i.priceStars ?? 0) > 0 ? ((i.priceCoins ?? 0) > 0 ? 'COINS_AND_STARS' : 'STARS') : 'COINS',
      stock: i.stock, // null = unlimited
      soldOut: i.stock != null && i.stock <= 0,
      purchaseLimit: 1, // accessories are unique — one copy per player
      owned: owned.has(a.id),
      canAfford: (user.coins ?? 0) >= (i.priceCoins ?? 0) && (user.stars ?? 0) >= (i.priceStars ?? 0),
    }));

  return ok(res, {
    wallet: { coins: user.coins ?? 0, stars: user.stars ?? 0 },
    demo: normalizeRole(user.role) === 'GUEST',
    items,
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
    // Reward accessories are earned by playing — never purchasable, even if a
    // stale listing survived an acquisition-type change.
    const accessory: any = await Accessory.findByPk(item.targetId);
    if (accessory && accessory.unlockType !== 'SHOP') {
      throw AppError.badRequest(`"${item.name}" is a reward accessory — earn it by playing, it can't be bought.`);
    }
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

  // DEFAULT accessories are starter gear — grant them on first garage view so
  // they never sit behind a padlock with no way to earn them.
  for (const a of accessories as any[]) {
    if (a.unlockType === 'DEFAULT' && !ownedMap.has(a.id)) {
      await unlockAccessory(userId, a.id, 'DEFAULT');
      const granted: any = await GarageItem.findOne({ where: { userId, accessoryId: a.id } });
      if (granted) ownedMap.set(a.id, granted);
    }
  }

  // How each accessory is won: mission rewards and/or shop listings.
  const accessoryIds = (accessories as any[]).map((a) => a.id);
  const [rewardLinks, shopListings] = await Promise.all([
    MissionAccessoryReward.findAll({ where: { accessoryId: accessoryIds } }),
    ShopItem.findAll({ where: { organizationId, kind: 'ACCESSORY', targetId: accessoryIds, isActive: true } }),
  ]);
  const missionIds = [...new Set((rewardLinks as any[]).map((r) => r.missionId))];
  // A mission can be played standalone (MISSION) or from its pillar
  // (BUNDLE_MISSION) — the unlock plan shows the player's BEST progress across
  // both flows, so pillar players don't see a zeroed progress bar.
  const [rewardMissions, missionProgress] = await Promise.all([
    Mission.findAll({ where: { id: missionIds } }),
    Progress.findAll({ where: { userId, entityType: ['MISSION', 'BUNDLE_MISSION'], entityId: missionIds } }),
  ]);
  const missionMap = new Map((rewardMissions as any[]).map((m) => [m.id, m]));
  const progressMap = new Map<string, any>();
  for (const p of missionProgress as any[]) {
    const prev = progressMap.get(p.entityId);
    const better =
      !prev ||
      (p.status === 'COMPLETED' && prev.status !== 'COMPLETED') ||
      (p.status === prev.status && (p.starsEarned ?? 0) > (prev.starsEarned ?? 0));
    if (better) progressMap.set(p.entityId, p);
  }
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
      // How the player got it (SHOP | MISSION | SEED | DEFAULT) — lets the
      // garage page label purchased vs rewarded gear.
      source: ownedMap.get(a.id)?.source ?? null,
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
  const [garage, badges, rank, certificateName] = await Promise.all([
    GarageItem.findAll({ where: { userId: user.id }, include: [{ model: Accessory }] }),
    UserBadge.findAll({ where: { userId: user.id }, include: [{ model: Badge }] }),
    resolveRank(user.organizationId, user.totalXp),
    resolveCertificateName(user.organizationId),
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
    certificateName,
    garage: (garage as any[]).map((g) => ({ accessoryId: g.accessoryId, isEquipped: g.isEquipped, accessory: g.Accessory })),
    badges: (badges as any[]).map((b) => b.Badge),
  });
}
