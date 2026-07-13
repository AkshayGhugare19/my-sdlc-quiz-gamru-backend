// API route registry — all resources mounted under /api.
// Custom controllers where behaviour is non-trivial; the generic crudRouter for
// standard admin management resources (gamru factory-router pattern).
import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '../middlewares/auth.middleware';
import { bindTenant } from '../middlewares/tenant.middleware';
import { authorize } from '../middlewares/permission.middleware';
import { asyncHandler } from '../utils/responseHandler';
import { crudRouter } from '../core/crud.factory';
import { AppError } from '../utils/AppError';
import { currentOrgId } from '../tenancy/context';

import authRoutes from '../modules/auth/auth.routes';
import playRoutes from '../modules/game/play.routes';
import * as analytics from '../modules/analytics/analytics.controller';
import * as media from '../modules/media/media.controller';
import * as mission from '../modules/mission/mission.controller';
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
  ContentBlock,
  LearningPath,
  MissionBundle,
  Mission,
  Question,
  QuestionOption,
  Level,
  Rank,
  Badge,
  Achievement,
  RewardRule,
  Avatar,
  Accessory,
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

api.use('/courses', crudRouter(Course, { filterable: ['category', 'isPublished'], searchable: ['title', 'slug'], order: [['order_index', 'ASC']], beforeWrite: withSlug }));
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
      const keep = new Set(body.missionIds);
      const current = await Mission.findAll({ where: { missionBundleId: bundleRow.id } });
      for (const m of current as any[]) if (!keep.has(m.id)) await m.update({ missionBundleId: null });
      let i = 0;
      for (const mid of body.missionIds) {
        const m: any = await Mission.findByPk(mid);
        if (m) await m.update({ missionBundleId: bundleRow.id, orderIndex: i++ });
      }
    },
  }),
);
api.use('/missions', crudRouter(Mission, { filterable: ['missionBundleId', 'isPublished', 'difficulty'], searchable: ['title', 'slug'], order: [['order_index', 'ASC']], beforeWrite: withSlug }));
// Questions carry their answer options inline (body.options: [{ id?, label,
// isCorrect }]) — the racing lanes. Validated up front, reconciled after save.
const SINGLE_ANSWER_TYPES = ['SINGLE_CHOICE', 'TRUE_FALSE', 'IMAGE_CHOICE', 'TIMED_QUESTION', 'VIDEO_QUESTION'];
const validateQuestionOptions = (data: any) => {
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
api.use('/badges', crudRouter(Badge, { searchable: ['name', 'code'], beforeWrite: withCode }));
api.use('/achievements', crudRouter(Achievement, { searchable: ['name', 'code'], beforeWrite: withCode }));
api.use('/reward-rules', crudRouter(RewardRule, { filterable: ['refType', 'missionId', 'missionBundleId'] }));

api.use('/avatars', crudRouter(Avatar, { order: [['order_index', 'ASC']], beforeWrite: withKey }));
api.use('/accessories', crudRouter(Accessory, { filterable: ['slot'], order: [['order_index', 'ASC']], beforeWrite: withKey }));
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

api.use('/campaigns', crudRouter(Campaign, { filterable: ['status', 'channel'], searchable: ['name'] }));
api.use('/notifications', crudRouter(Notification, { filterable: ['status', 'userId'] }));
api.use('/certificate-templates', crudRouter(CertificateTemplate, { searchable: ['name'], beforeWrite: (d: any) => (d.layout ? d : { ...d, layout: { title: d.name || 'Certificate' } }) }));

export default api;
