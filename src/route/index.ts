// API route registry — all resources mounted under /api.
// Custom controllers where behaviour is non-trivial; the generic crudRouter for
// standard admin management resources (gamru factory-router pattern).
import { Router } from 'express';
import multer from 'multer';
import { fn, col, Op } from 'sequelize';

import { authenticate } from '../middlewares/auth.middleware';
import { bindTenant } from '../middlewares/tenant.middleware';
import { authorize } from '../middlewares/permission.middleware';
import { asyncHandler, ok } from '../utils/responseHandler';
import { crudRouter } from '../core/crud.factory';
import { AppError } from '../utils/AppError';
import { currentOrgId } from '../tenancy/context';
import { can } from '../auth/permissions';
import { seedFeatureDefaults, DEFAULTABLE_FEATURES } from '../engines/defaultContent.engine';

import authRoutes from '../modules/auth/auth.routes';
import playRoutes from '../modules/game/play.routes';
import * as analytics from '../modules/analytics/analytics.controller';
import * as media from '../modules/media/media.controller';
import * as mission from '../modules/mission/mission.controller';
import * as course from '../modules/course/course.controller';
import * as bundle from '../modules/missionBundle/missionBundle.controller';
import * as rank from '../modules/rank/rank.controller';
import * as adminProgress from '../modules/progress/adminProgress.controller';
import * as orgStructure from '../modules/org/structure.controller';
import * as competition from '../modules/competition/competition.controller';
import { hashPassword } from '../utils/password';

import {
  Organization,
  Department,
  User,
  Course,
  CourseMission,
  CourseBundle,
  CourseTournament,
  ContentBlock,
  LearningPath,
  MissionBundle,
  Mission,
  MissionQuestion,
  Question,
  QuestionOption,
  Level,
  Rank,
  Badge,
  Achievement,
  RewardRule,
  Avatar,
  Accessory,
  MissionAccessoryReward,
  ShopItem,
  Leaderboard,
  Tournament,
  Campaign,
  Notification,
  CertificateTemplate,
} from '../models';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

const api = Router();
const authed = [authenticate, bindTenant];

// ── beforeWrite helpers — forgiving payload normalisation so admin "create"
// works without the user having to know internal field rules. ──
const slugify = (s = '') =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `item-${Date.now()}`;

// Auto-generate a slug from title/name when the (required) slug is blank.
const withSlug = (data: any) => (data.slug ? data : { ...data, slug: slugify(data.title || data.name) });
// Auto-generate a machine key from name when blank.
const withKey = (data: any) => (data.key ? data : { ...data, key: slugify(data.name) });
// Badge code from name (UPPER_SNAKE).
const withCode = (data: any) => (data.code ? data : { ...data, code: slugify(data.name).replace(/-/g, '_').toUpperCase() });

// ── Auth & gameplay ────────────────────────────────────────────────────────
api.use('/auth', authRoutes);
api.use('/play', playRoutes); // the racing client talks here directly

// ── Analytics ────────────────────────────────────────────────────────────────
api.get('/analytics/overview', ...authed, authorize('analytics', 'view'), asyncHandler(analytics.overview));
api.get('/analytics/pillars', ...authed, authorize('analytics', 'view'), asyncHandler(analytics.pillarStats));
api.get('/analytics/questions/hardest', ...authed, authorize('analytics', 'view'), asyncHandler(analytics.hardestQuestions));

// ── Media library (upload) ───────────────────────────────────────────────────
api.get('/media', ...authed, authorize('media', 'view'), asyncHandler(media.list));
api.post('/media', ...authed, authorize('media', 'create'), upload.single('file'), asyncHandler(media.upload));
api.delete('/media/:id', ...authed, authorize('media', 'delete'), asyncHandler(media.remove));

// ── Mission builder (question pool + accessory rewards) ─────────────────────
api.get('/missions/:id/questions', ...authed, authorize('missions', 'view'), asyncHandler(mission.listQuestions));
api.post('/missions/:id/questions', ...authed, authorize('missions', 'update'), asyncHandler(mission.attachQuestion));
api.delete('/missions/:id/questions/:questionId', ...authed, authorize('missions', 'update'), asyncHandler(mission.detachQuestion));
api.post('/missions/:id/accessory-rewards', ...authed, authorize('missions', 'update'), asyncHandler(mission.addAccessoryReward));

// ── Mission-bundle builder — attach ALREADY-CREATED missions to a bundle ─────
// (missions are a separate feature, created first; a bundle assembles them).
api.get('/mission-bundles/:id/missions', ...authed, authorize('mission-bundles', 'view'), asyncHandler(bundle.listMissions));
api.get('/mission-bundles/:id/available-missions', ...authed, authorize('mission-bundles', 'view'), asyncHandler(bundle.availableMissions));
api.get('/mission-bundles/:id/progress', ...authed, authorize('mission-bundles', 'view'), asyncHandler(bundle.bundleProgress));
api.post('/mission-bundles/:id/missions', ...authed, authorize('mission-bundles', 'update'), asyncHandler(bundle.attachMission));
api.put('/mission-bundles/:id/missions/:missionId', ...authed, authorize('mission-bundles', 'update'), asyncHandler(bundle.reorderMission));
api.delete('/mission-bundles/:id/missions/:missionId', ...authed, authorize('mission-bundles', 'update'), asyncHandler(bundle.detachMission));

// ── Admin insight: participation, progress & standings ──────────────────────
// NOTE: /users/structure must be registered before the /users crud mount.
api.get('/users/structure', ...authed, authorize('users', 'view'), asyncHandler(orgStructure.orgStructure));
api.get('/missions/:id/players', ...authed, authorize('missions', 'view'), asyncHandler(adminProgress.missionPlayers));
api.get('/mission-bundles/:id/leaderboard', ...authed, authorize('mission-bundles', 'view'), asyncHandler(adminProgress.bundleLeaderboard));
api.get('/users/:id/progress', ...authed, authorize('users', 'view'), asyncHandler(adminProgress.userProgress));

// ── Rank builder — levels are nested inside a rank (XP bands) ────────────────
api.get('/ranks/:id/levels', ...authed, authorize('ranks', 'view'), asyncHandler(rank.listLevels));
api.post('/ranks/:id/levels', ...authed, authorize('ranks', 'update'), asyncHandler(rank.addLevel));
api.put('/ranks/:id/levels/:levelId', ...authed, authorize('ranks', 'update'), asyncHandler(rank.updateLevel));
api.delete('/ranks/:id/levels/:levelId', ...authed, authorize('ranks', 'update'), asyncHandler(rank.deleteLevel));

// ── Competition (leaderboard & tournament play) ─────────────────────────────
api.get('/leaderboards/:id/rankings', ...authed, authorize('leaderboards', 'view'), asyncHandler(competition.boardRankings));
api.post('/tournaments/:id/join', ...authed, authorize('tournaments', 'assign'), asyncHandler(competition.joinTournament));
api.post('/tournaments/:id/score', ...authed, authorize('tournaments', 'assign'), asyncHandler(competition.scoreTournament));
api.get('/tournaments/:id/rankings', ...authed, authorize('tournaments', 'view'), asyncHandler(competition.tournamentRankings));

// ── Generic CRUD admin resources ────────────────────────────────────────────
// Organizations are platform-level (super/platform admins only).
api.use('/organizations', crudRouter(Organization, { tenantScoped: false, searchable: ['name', 'slug'], beforeWrite: withSlug }));

api.use('/departments', crudRouter(Department, { searchable: ['name', 'code'], order: [['name', 'ASC']] }));
api.use(
  '/users',
  crudRouter(User, {
    filterable: ['role', 'status', 'departmentId'],
    searchable: ['email', 'firstName', 'lastName', 'displayName'],
    // Hash a plaintext password into passwordHash; ignore blank on update.
    beforeWrite: async (data: any) => {
      const { password, ...rest } = data;
      if (password) rest.passwordHash = await hashPassword(password);
      if (!rest.displayName && (rest.firstName || rest.lastName)) {
        rest.displayName = [rest.firstName, rest.lastName].filter(Boolean).join(' ');
      }
      return rest;
    },
  }),
);

// ── Course roadmap builder — a course SELECTS existing missions, bundles and
// tournaments (LMS style). These read endpoints power the form's preselects.
api.get('/courses/:id/missions', ...authed, authorize('courses', 'view'), asyncHandler(course.listMissions));
api.get('/courses/:id/bundles', ...authed, authorize('courses', 'view'), asyncHandler(course.listBundles));
api.get('/courses/:id/tournaments', ...authed, authorize('courses', 'view'), asyncHandler(course.listTournaments));

// Reconcile one course↔content join table from an array of ids sent by the
// course form (missionIds / missionBundleIds / tournamentIds). Only runs when
// the form actually sends that array — content is referenced, never owned, so
// removing a reference never deletes the mission/bundle/tournament itself.
const reconcileCourseLinks = async (
  model: any,
  courseId: string,
  fk: string,
  ids: unknown,
) => {
  if (!Array.isArray(ids)) return;
  const wanted = ids.map(String);
  const keep = new Set(wanted);
  const existing: any[] = await model.findAll({ where: { courseId } });
  for (const link of existing) if (!keep.has(String(link[fk]))) await link.destroy();
  let i = 0;
  for (const targetId of wanted) {
    const [link]: any = await model.findOrCreate({
      where: { courseId, [fk]: targetId },
      defaults: { courseId, [fk]: targetId, orderIndex: i },
    });
    await link.update({ orderIndex: i });
    i++;
  }
};
const reconcileCourseContent = async (courseRow: any, body: any) => {
  if (!courseRow) return;
  await reconcileCourseLinks(CourseMission, courseRow.id, 'missionId', body?.missionIds);
  await reconcileCourseLinks(CourseBundle, courseRow.id, 'missionBundleId', body?.missionBundleIds);
  await reconcileCourseLinks(CourseTournament, courseRow.id, 'tournamentId', body?.tournamentIds);
};
api.use(
  '/courses',
  crudRouter(Course, {
    filterable: ['category', 'isPublished', 'difficulty'],
    searchable: ['title', 'slug'],
    order: [['order_index', 'ASC']],
    beforeWrite: withSlug,
    afterWrite: reconcileCourseContent,
    // Deleting a course removes only its references — never the content.
    beforeDelete: async (id: string) => {
      await CourseMission.destroy({ where: { courseId: id } });
      await CourseBundle.destroy({ where: { courseId: id } });
      await CourseTournament.destroy({ where: { courseId: id } });
    },
  }),
);
api.use('/content-blocks', crudRouter(ContentBlock, { tenantScoped: false, filterable: ['courseId'], order: [['order_index', 'ASC']] }));
api.use('/learning-paths', crudRouter(LearningPath, { searchable: ['title'], beforeWrite: withSlug }));

api.use(
  '/mission-bundles',
  crudRouter(MissionBundle, {
    filterable: ['isPublished'],
    searchable: ['title', 'slug'],
    order: [['order_index', 'ASC']],
    beforeWrite: withSlug,
    // Optional multi-select of missions on the create/edit form: attach the
    // chosen missions to this bundle (and detach any removed) via Mission.missionBundleId.
    afterWrite: async (bundleRow: any, body: any) => {
      if (!Array.isArray(body?.missionIds)) return;
      const current = await Mission.findAll({ where: { missionBundleId: bundleRow.id } });
      // Guard: an EMPTY selection on a bundle that already has missions is almost
      // always a form that submitted before its current selection finished
      // loading — never silently dismantle a working bundle. To intentionally
      // empty a bundle, detach its missions one by one in the bundle builder.
      if (body.missionIds.length === 0 && current.length > 0) return;
      const keep = new Set(body.missionIds);
      for (const m of current as any[]) if (!keep.has(m.id)) await m.update({ missionBundleId: null });
      let i = 0;
      for (const mid of body.missionIds) {
        const m: any = await Mission.findByPk(mid);
        if (m) await m.update({ missionBundleId: bundleRow.id, orderIndex: i++ });
      }
    },
  }),
);
// A mission draws its questions from ONE question category (e.g. "Environment").
// When the mission form sends `questionCategory`, every ACTIVE question in that
// category is attached via the MissionQuestion join — the SAME rows the seeder
// writes (each seeded pillar links its whole category), so a UI-built mission
// becomes playable exactly like a seeded one instead of coming up "no questions
// yet". Advanced users can still fine-tune pins/order in the Mission Builder.
// (`questionIds` is still honoured if a caller sends an explicit list instead.)
const reconcileMissionQuestions = async (missionRow: any, body: any) => {
  if (!missionRow) return;

  const category = typeof body?.questionCategory === 'string' ? body.questionCategory.trim() : '';
  let targetIds: string[] | null = null;
  if (category) {
    const qs: any[] = await Question.findAll({
      where: { organizationId: missionRow.organizationId, category, isActive: true },
      attributes: ['id'],
    });
    targetIds = qs.map((q) => String(q.id));
  } else if (Array.isArray(body?.questionIds)) {
    targetIds = body.questionIds.map(String);
  }
  // Neither a category nor an explicit list was sent → this write isn't managing
  // the question pool (e.g. a status-only edit); leave the existing links alone.
  if (targetIds === null) return;

  const existing: any[] = await MissionQuestion.findAll({ where: { missionId: missionRow.id } });
  // Guard: resolving to an empty set on a mission that already HAS questions is
  // almost always the edit form submitting before its category finished loading,
  // or a category that has no questions yet. Never silently wipe a working pool
  // and bring back "no questions yet" — detach explicitly in the Mission Builder.
  if (targetIds.length === 0 && existing.length > 0) return;

  const keep = new Set(targetIds);
  for (const link of existing) if (!keep.has(String(link.questionId))) await link.destroy();
  let i = 0;
  for (const questionId of targetIds) {
    const [link]: any = await MissionQuestion.findOrCreate({
      where: { missionId: missionRow.id, questionId },
      // First question is pinned (always shown) — mirrors the seeder's convention.
      defaults: { missionId: missionRow.id, questionId, orderIndex: i, isPinned: i === 0 },
    });
    await link.update({ orderIndex: i });
    i++;
  }
};
api.use('/missions', crudRouter(Mission, { filterable: ['missionBundleId', 'isPublished', 'difficulty'], searchable: ['title', 'slug'], order: [['order_index', 'ASC']], beforeWrite: withSlug, afterWrite: reconcileMissionQuestions }));
// Questions carry their answer options inline (body.options: [{ id?, label,
// isCorrect }]) — the racing lanes. Validated up front, reconciled after save.
const SINGLE_ANSWER_TYPES = ['SINGLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'TIMED_QUESTION', 'VIDEO_QUESTION'];
const validateQuestionOptions = (data: any, req: any) => {
  if (data.options !== undefined && !Array.isArray(data.options)) throw AppError.badRequest('options must be an array');
  if (Array.isArray(data.options)) {
    const opts = data.options.filter((o: any) => String(o.label ?? '').trim() !== '');
    if (opts.length < 2) throw AppError.badRequest('Add at least 2 answer options so players have lanes to choose from');
    const correct = opts.filter((o: any) => !!o.isCorrect).length;
    if (correct === 0) throw AppError.badRequest('Tick which option is the correct answer');
    if (data.type && SINGLE_ANSWER_TYPES.includes(data.type) && correct > 1) {
      throw AppError.badRequest(`${data.type} questions must have exactly one correct option — untick the extras`);
    }
  }
  const { options, ...rest } = data; // Question itself has no `options` column
  // Stamp the author on create so the bank shows who added each question
  // (updates keep the original author).
  if (req?.method === 'POST' && !rest.createdById && req?.user?.id) rest.createdById = req.user.id;
  return rest;
};
const reconcileQuestionOptions = async (row: any, body: any) => {
  if (!Array.isArray(body?.options)) return;
  const list = body.options.filter((o: any) => String(o.label ?? '').trim() !== '');
  const existing: any[] = await QuestionOption.findAll({ where: { questionId: row.id } });
  const keep = new Set(list.map((o: any) => o.id).filter(Boolean));
  for (const e of existing) if (!keep.has(e.id)) await e.destroy();
  let i = 0;
  for (const o of list) {
    const attrs = { label: String(o.label).trim(), isCorrect: !!o.isCorrect, orderIndex: i++ };
    const e = o.id ? existing.find((x) => x.id === o.id) : null;
    if (e) await e.update(attrs);
    else await QuestionOption.create({ ...attrs, questionId: row.id } as any);
  }
};
// Distinct question categories for the active org (+counts). Powers the
// "Question Category" picker on the mission form and the tournament pool config,
// so admins choose from real categories instead of guessing free text. MUST be
// registered before the `/questions` crud mount (else `categories` looks like an id).
api.get(
  '/questions/categories',
  ...authed,
  authorize('questions', 'view'),
  asyncHandler(async (_req: any, res: any) => {
    const organizationId = currentOrgId();
    if (!organizationId) return ok(res, []);
    const rows: any[] = await Question.findAll({
      where: { organizationId, isActive: true, category: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } } as any,
      attributes: ['category', [fn('COUNT', col('id')), 'count']],
      group: ['category'],
      order: [['category', 'ASC']],
    });
    const data = rows
      .map((r) => ({ category: String(r.category), count: Number(r.get('count')) }))
      .filter((r) => r.category.trim() !== '');
    return ok(res, data);
  }),
);
api.use(
  '/questions',
  crudRouter(Question, {
    filterable: ['type', 'category', 'isActive'],
    searchable: ['prompt', 'category'],
    beforeWrite: validateQuestionOptions,
    afterWrite: reconcileQuestionOptions,
    // Deleting a question removes its options too.
    beforeDelete: async (id: string) => {
      await QuestionOption.destroy({ where: { questionId: id } });
    },
  }),
);
api.use('/question-options', crudRouter(QuestionOption, { tenantScoped: false, filterable: ['questionId'], order: [['order_index', 'ASC']] }));

// Levels are NOT a standalone resource — they are managed inside a rank
// (see /ranks/:id/levels above). The rank create/edit form can also define its
// levels inline via body.levels: [{ id?, level, minXp, maxXp?, title? }].
const validateRankLevels = (data: any) => {
  if (data.levels !== undefined && !Array.isArray(data.levels)) throw AppError.badRequest('levels must be an array');
  for (const l of data.levels ?? []) {
    if (l.level == null || l.level === '') throw AppError.badRequest('Each level needs a level number');
    if (l.minXp == null || l.minXp === '') throw AppError.badRequest(`Level ${l.level}: XP start is required`);
    if (l.maxXp != null && l.maxXp !== '' && Number(l.maxXp) <= Number(l.minXp)) {
      throw AppError.badRequest(`Level ${l.level}: XP end must be greater than XP start`);
    }
  }
  const { levels, ...rest } = data; // Rank itself has no `levels` column
  return rest;
};
const reconcileRankLevels = async (rankRow: any, body: any) => {
  if (!Array.isArray(body?.levels)) return;
  const existing: any[] = await Level.findAll({ where: { rankId: rankRow.id } });
  const keep = new Set(body.levels.map((l: any) => l.id).filter(Boolean));
  for (const row of existing) if (!keep.has(row.id)) await row.destroy();
  for (const l of body.levels) {
    const attrs = {
      level: Number(l.level),
      minXp: Number(l.minXp),
      maxXp: l.maxXp == null || l.maxXp === '' ? null : Number(l.maxXp),
      title: l.title || `Level ${l.level}`,
    };
    const row = l.id ? existing.find((e) => e.id === l.id) : null;
    if (row) await row.update(attrs);
    else await Level.create({ ...attrs, rankId: rankRow.id, organizationId: rankRow.organizationId ?? currentOrgId() } as any);
  }
};
api.use(
  '/ranks',
  crudRouter(Rank, {
    order: [['tier', 'ASC']],
    beforeWrite: validateRankLevels,
    afterWrite: reconcileRankLevels,
    // Levels live inside the rank — deleting the rank removes its levels too.
    beforeDelete: async (id: string) => {
      await Level.destroy({ where: { rankId: id } });
    },
  }),
);
// The badge form sends its auto-grant rule as flat fields (criteriaType +
// minTimeRemaining); fold them into the `criteria` JSONB the badge engine
// evaluates after every race — so an admin-created badge auto-awards exactly
// like a seeded one instead of silently never triggering.
const composeBadgeCriteria = (data: any) => {
  const { criteriaType, minTimeRemaining, ...rest } = withCode(data);
  if (criteriaType !== undefined) {
    if (!criteriaType) {
      rest.criteria = null;
    } else {
      const criteria: any = { type: criteriaType };
      if (criteriaType === 'FAST_LEARNER' && minTimeRemaining != null && minTimeRemaining !== '') {
        criteria.minTimeRemaining = Number(minTimeRemaining);
      }
      rest.criteria = criteria;
    }
  }
  return rest;
};
api.use('/badges', crudRouter(Badge, { searchable: ['name', 'code'], beforeWrite: composeBadgeCriteria }));
api.use('/achievements', crudRouter(Achievement, { searchable: ['name', 'code'], beforeWrite: withCode }));
api.use('/reward-rules', crudRouter(RewardRule, { filterable: ['refType', 'missionId', 'missionBundleId'] }));

api.use('/avatars', crudRouter(Avatar, { order: [['order_index', 'ASC']], beforeWrite: withKey }));

// ── Accessories — keep their unlock paths WIRED, the way the seeder does. ────
// An accessory is only obtainable through a MissionAccessoryReward link (REWARD)
// or an active ACCESSORY shop listing (SHOP). The admin form sends the unlock
// wiring as flat fields; syncing it here means a UI-created accessory unlocks
// exactly like a seeded one instead of staying locked forever.
// The form's "Reward Mission" preselect reads the current link from here.
api.get(
  '/accessories/:id/reward-mission',
  ...authed,
  authorize('accessories', 'view'),
  asyncHandler(async (req: any, res: any) => {
    const link: any = await MissionAccessoryReward.findOne({ where: { accessoryId: req.params.id } });
    return ok(res, link ? link.missionId : '');
  }),
);
const stripAccessoryUnlockFields = (data: any) => {
  const { rewardMissionId, rewardChancePct, ...rest } = withKey(data);
  return rest; // unlock wiring is reconciled after save — not accessory columns
};
const syncAccessoryUnlocks = async (row: any, body: any) => {
  if (!row) return;
  // SHOP unlocks need a purchasable listing: create/update it from the price.
  if (row.unlockType === 'SHOP') {
    const price = Number(row.shopPriceCoins ?? 0) || 0;
    const [listing, created] = await ShopItem.findOrCreate({
      where: { organizationId: row.organizationId, kind: 'ACCESSORY', targetId: row.id },
      defaults: {
        organizationId: row.organizationId,
        kind: 'ACCESSORY',
        targetId: row.id,
        name: row.name,
        description: `Kart accessory — ${row.name}`,
        priceCoins: price,
        priceStars: 0,
        isActive: true,
      },
    });
    if (!created) await listing.update({ name: row.name, priceCoins: price, isActive: true });
  }
  // REWARD unlocks need a mission link: correct answers there can drop it.
  // Only reconciled when the form actually sent a mission (a blank/failed
  // preselect never touches existing links).
  if (typeof body?.rewardMissionId === 'string' && body.rewardMissionId) {
    const missionId = body.rewardMissionId;
    const chance =
      body.rewardChancePct != null && body.rewardChancePct !== ''
        ? Math.min(100, Math.max(1, Number(body.rewardChancePct) || 100))
        : 100;
    // The form manages ONE reward mission per accessory — retarget any others.
    await MissionAccessoryReward.destroy({ where: { accessoryId: row.id, missionId: { [Op.ne]: missionId } } });
    const [link, created] = await MissionAccessoryReward.findOrCreate({
      where: { accessoryId: row.id, missionId },
      defaults: { accessoryId: row.id, missionId, trigger: 'CORRECT_ANSWER', chancePct: chance },
    });
    if (!created) await link.update({ trigger: 'CORRECT_ANSWER', chancePct: chance });
  }
};
api.use(
  '/accessories',
  crudRouter(Accessory, {
    filterable: ['slot'],
    order: [['order_index', 'ASC']],
    beforeWrite: stripAccessoryUnlockFields,
    afterWrite: syncAccessoryUnlocks,
    // Removing an accessory also removes its unlock wiring (never the missions).
    beforeDelete: async (id: string) => {
      await MissionAccessoryReward.destroy({ where: { accessoryId: id } });
      await ShopItem.destroy({ where: { kind: 'ACCESSORY', targetId: id } });
    },
  }),
);
api.use('/shop-items', crudRouter(ShopItem, { filterable: ['kind', 'isActive'], searchable: ['name'], beforeWrite: (d: any) => (d.kind ? d : { ...d, kind: 'CUSTOM' }) }));

api.use('/leaderboards', crudRouter(Leaderboard, { filterable: ['scope', 'period', 'metric'] }));
// The tournament form sends its race settings and top-3 prize pool as flat
// fields; fold them into the gameConfig / rewardConfig JSONB the engine reads.
const composeTournamentGameConfig = (data: any) => {
  const {
    questionCount, questionCategories, questionDifficulty, timerSec, laneCount, xpPerQuestion,
    place1Xp, place1Coins, place1Stars,
    place2Xp, place2Coins, place2Stars,
    place3Xp, place3Coins, place3Stars,
    ...rest
  } = data;

  const patch: any = {};
  if (questionCount != null && questionCount !== '') patch.questionCount = Number(questionCount);
  if (questionCategories != null) {
    patch.categories = String(questionCategories).split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (questionDifficulty !== undefined) patch.difficulty = questionDifficulty || null;
  if (timerSec != null && timerSec !== '') patch.timerSec = Number(timerSec);
  if (laneCount != null && laneCount !== '') patch.laneCount = Number(laneCount);
  if (xpPerQuestion != null && xpPerQuestion !== '') patch.xpPerQuestion = Number(xpPerQuestion);
  if (Object.keys(patch).length) rest.gameConfig = { ...(rest.gameConfig ?? {}), ...patch };

  // Prize pool: { "1": { xp, coins, stars }, "2": …, "3": … } — settled
  // automatically to the top 3 placements when the tournament ends.
  const prizeInput = [
    [place1Xp, place1Coins, place1Stars],
    [place2Xp, place2Coins, place2Stars],
    [place3Xp, place3Coins, place3Stars],
  ];
  const sentAnyPrize = prizeInput.flat().some((v) => v != null && v !== '');
  if (sentAnyPrize) {
    const num = (v: any) => (v == null || v === '' ? 0 : Math.max(0, Number(v) || 0));
    const rewardConfig: any = {};
    prizeInput.forEach(([xp, coins, stars], i) => {
      const prize: any = {};
      if (num(xp)) prize.xp = num(xp);
      if (num(coins)) prize.coins = num(coins);
      if (num(stars)) prize.stars = num(stars);
      if (Object.keys(prize).length) rewardConfig[String(i + 1)] = prize;
    });
    rest.rewardConfig = rewardConfig;
  }
  return rest;
};
api.use('/tournaments', crudRouter(Tournament, { filterable: ['status', 'type'], searchable: ['name'], beforeWrite: composeTournamentGameConfig }));

// ── Per-feature default data ────────────────────────────────────────────────
// "Add Default Data" in the admin console: seed ONE feature's example rows for
// the acting organization. Idempotent — existing records are skipped, never
// overwritten — and gated by the same create permission as the feature itself.
api.post(
  '/defaults/:feature',
  ...authed,
  asyncHandler(async (req: any, res: any) => {
    const feature = String(req.params.feature);
    if (!(DEFAULTABLE_FEATURES as readonly string[]).includes(feature)) {
      throw AppError.badRequest(`No default data is available for "${feature}"`);
    }
    if (!can(req.user.role, feature, 'create')) {
      throw AppError.forbidden(`Not permitted to create ${feature}`);
    }
    const organizationId = currentOrgId();
    if (!organizationId) {
      throw AppError.badRequest('Act as an organization first — defaults are seeded per organization.');
    }
    const result = await seedFeatureDefaults(organizationId, feature);
    return ok(res, result, `${result.added} added, ${result.skipped} already existed (skipped)`);
  }),
);

api.use('/campaigns', crudRouter(Campaign, { filterable: ['status', 'channel'], searchable: ['name'] }));
api.use('/notifications', crudRouter(Notification, { filterable: ['status', 'userId'] }));
api.use('/certificate-templates', crudRouter(CertificateTemplate, { searchable: ['name'], beforeWrite: (d: any) => (d.layout ? d : { ...d, layout: { title: d.name || 'Certificate' } }) }));

export default api;
