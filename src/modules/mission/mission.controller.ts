// Mission-builder helpers beyond plain CRUD: manage a mission's question pool
// and its accessory rewards.
import type { Request, Response } from 'express';
import { ok, created } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import { Mission, MissionQuestion, Question, MissionAccessoryReward } from '../../models';

// GET /api/missions/:id/questions
export async function listQuestions(req: Request, res: Response) {
  const mission = await Mission.findByPk(req.params.id);
  if (!mission) throw AppError.notFound('Mission not found');
  const links = await MissionQuestion.findAll({
    where: { missionId: req.params.id },
    order: [['order_index', 'ASC']],
    include: [{ model: Question, include: [{ association: 'options' }] }],
  });
  return ok(res, links);
}

// POST /api/missions/:id/questions  { questionId, orderIndex?, isPinned?, weight? }
export async function attachQuestion(req: Request, res: Response) {
  const mission = await Mission.findByPk(req.params.id);
  if (!mission) throw AppError.notFound('Mission not found');
  const [link] = await MissionQuestion.findOrCreate({
    where: { missionId: req.params.id, questionId: req.body.questionId },
    defaults: {
      missionId: req.params.id,
      questionId: req.body.questionId,
      orderIndex: req.body.orderIndex ?? 0,
      isPinned: req.body.isPinned ?? false,
      weight: req.body.weight ?? 1,
    },
  });
  return created(res, link, 'Question attached');
}

// DELETE /api/missions/:id/questions/:questionId
export async function detachQuestion(req: Request, res: Response) {
  const count = await MissionQuestion.destroy({
    where: { missionId: req.params.id, questionId: req.params.questionId },
  });
  if (!count) throw AppError.notFound('Link not found');
  return ok(res, null, 'Question detached');
}

// POST /api/missions/:id/accessory-rewards  { accessoryId, trigger?, chancePct? }
export async function addAccessoryReward(req: Request, res: Response) {
  const [reward] = await MissionAccessoryReward.findOrCreate({
    where: { missionId: req.params.id, accessoryId: req.body.accessoryId },
    defaults: {
      missionId: req.params.id,
      accessoryId: req.body.accessoryId,
      trigger: req.body.trigger ?? 'CORRECT_ANSWER',
      chancePct: req.body.chancePct ?? 100,
    },
  });
  return created(res, reward, 'Accessory reward added');
}
