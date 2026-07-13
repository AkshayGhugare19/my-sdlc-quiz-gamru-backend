import { Router } from 'express';
import Joi from 'joi';
import { authenticate } from '../../middlewares/auth.middleware';
import { bindTenant } from '../../middlewares/tenant.middleware';
import { authorize } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/responseHandler';
import * as play from './controller/play.controller';

const router = Router();

// Every gameplay route requires an authenticated player + bound tenant + the
// 'play' permission on the 'gameplay' resource (all playing roles have it).
router.use(authenticate, bindTenant, authorize('gameplay', 'play'));

const startSchema = Joi.object({
  // Mission race (missionId), tournament race (tournamentId only — questions
  // come from the tournament's own configured pool), or both for
  // bundle-scoped tournaments. missionBundleId marks a mission race launched
  // FROM its bundle (feeds bundle progress instead of standalone progress).
  // Nothing at all = quick race: random questions every attempt, nothing recorded.
  missionId: Joi.string().optional(),
  missionBundleId: Joi.string().optional(),
  avatarId: Joi.string().optional(),
  tournamentId: Joi.string().optional(),
});

const answerSchema = Joi.object({
  questionId: Joi.string().required(),
  chosenLane: Joi.number().integer().min(0).optional(),
  optionId: Joi.string().optional(),
  optionIds: Joi.array().items(Joi.string()).optional(),
  value: Joi.any().optional(),
  timeTakenMs: Joi.number().integer().min(0).optional(),
}).or('chosenLane', 'optionId', 'optionIds', 'value');

router.get('/avatars', asyncHandler(play.listAvatars));
router.get('/pillars', asyncHandler(play.listPillars));
router.get('/courses', asyncHandler(play.listCourses));
router.get('/me', asyncHandler(play.getProfile));
router.get('/dashboard', asyncHandler(play.getDashboard));
router.get('/garage', asyncHandler(play.getGarage));
router.post('/garage/:accessoryId/equip', asyncHandler(play.equipAccessory));
router.get('/team', asyncHandler(play.getTeam));
router.post('/tournaments/:id/join', asyncHandler(play.joinTournament));
router.get('/shop', asyncHandler(play.getShop));
router.post('/shop/:id/buy', asyncHandler(play.buyShopItem));
router.get('/missions/:id/content', asyncHandler(play.getMissionContent));

router.post('/sessions', validate(startSchema), asyncHandler(play.createSession));
router.get('/sessions/:id', asyncHandler(play.sessionState));
router.post('/sessions/:id/answer', validate(answerSchema), asyncHandler(play.answer));
router.post('/sessions/:id/complete', asyncHandler(play.finish));

export default router;
