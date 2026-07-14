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
  if (!req.body.questionId) throw AppError.badRequest('questionId is required');
  const question = await Question.findByPk(req.body.questionId);
  if (!question) throw AppError.notFound('Question not found');
  // Upsert semantics: re-attaching an existing link updates it — this is how
  // the builder toggles isPinned and reorders (findOrCreate alone silently
  // ignored those updates, which made pin/attach look broken).
  const existing: any = await MissionQuestion.findOne({
    where: { missionId: req.params.id, questionId: req.body.questionId },
  });
  if (existing) {
    const patch: any = {};
    if (req.body.orderIndex !== undefined) patch.orderIndex = req.body.orderIndex;
    if (req.body.isPinned !== undefined) patch.isPinned = req.body.isPinned;
    if (req.body.weight !== undefined) patch.weight = req.body.weight;
    if (Object.keys(patch).length) await existing.update(patch);
    return ok(res, existing, 'Question updated');
  }
  // NEW links are capped by the mission's Question Count — the pool set when
  // the mission was created is the intended size, so the builder can't grow it
  // past the limit (updates above are exempt: pin/reorder must always work).
  const limit = Number((mission as any).questionCount) || 0;
  if (limit) {
    const poolSize = await MissionQuestion.count({ where: { missionId: req.params.id } });
    if (poolSize >= limit) {
      throw AppError.badRequest(
        `This mission's Question Count is ${limit} and ${poolSize} question${poolSize === 1 ? ' is' : 's are'} already attached. ` +
          'Detach a question first, or raise the Question Count on the mission edit form to attach more.',
      );
    }
  }
  const link = await MissionQuestion.create({
    missionId: req.params.id,
    questionId: req.body.questionId,
    orderIndex: req.body.orderIndex ?? 0,
    isPinned: req.body.isPinned ?? false,
    weight: req.body.weight ?? 1,
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
