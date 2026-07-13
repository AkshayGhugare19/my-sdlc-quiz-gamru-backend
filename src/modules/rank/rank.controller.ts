// Rank builder: levels are managed INSIDE a rank (a rank contains levels, each
// with an XP band [minXp, maxXp)). This is the gamru-style rank→levels flow.
import type { Request, Response } from 'express';
import { ok, created } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import { Rank, Level } from '../../models';
import { currentOrgId } from '../../tenancy/context';

// GET /ranks/:id/levels — levels in this rank (ordered).
export async function listLevels(req: Request, res: Response) {
  const rank = await Rank.findByPk(req.params.id);
  if (!rank) throw AppError.notFound('Rank not found');
  const levels = await Level.findAll({ where: { rankId: req.params.id }, order: [['min_xp', 'ASC']] });
  return ok(res, levels);
}

// POST /ranks/:id/levels { level, minXp, maxXp?, title? } — add a level to a rank.
export async function addLevel(req: Request, res: Response) {
  const rank = await Rank.findByPk(req.params.id);
  if (!rank) throw AppError.notFound('Rank not found');
  const { level, minXp, maxXp, title } = req.body;
  if (level == null) throw AppError.badRequest('level is required');
  if (minXp == null) throw AppError.badRequest('minXp (XP start) is required');
  if (maxXp != null && Number(maxXp) <= Number(minXp)) {
    throw AppError.badRequest('XP end must be greater than XP start');
  }
  const created_ = await Level.create({
    organizationId: currentOrgId(),
    rankId: req.params.id,
    level,
    minXp,
    maxXp: maxXp ?? null,
    title,
  });
  return created(res, created_, 'Level added to rank');
}

// PUT /ranks/:id/levels/:levelId — update a level in a rank.
export async function updateLevel(req: Request, res: Response) {
  const lvl: any = await Level.findByPk(req.params.levelId);
  if (!lvl || lvl.rankId !== req.params.id) throw AppError.notFound('Level not in this rank');
  const { level, minXp, maxXp, title } = req.body;
  if (maxXp != null && minXp != null && Number(maxXp) <= Number(minXp)) {
    throw AppError.badRequest('XP end must be greater than XP start');
  }
  await lvl.update({
    ...(level != null ? { level } : {}),
    ...(minXp != null ? { minXp } : {}),
    ...(maxXp !== undefined ? { maxXp } : {}),
    ...(title !== undefined ? { title } : {}),
  });
  return ok(res, lvl, 'Level updated');
}

// DELETE /ranks/:id/levels/:levelId — remove a level from a rank.
export async function deleteLevel(req: Request, res: Response) {
  const lvl: any = await Level.findByPk(req.params.levelId);
  if (!lvl || lvl.rankId !== req.params.id) throw AppError.notFound('Level not in this rank');
  await lvl.destroy();
  return ok(res, null, 'Level removed');
}
