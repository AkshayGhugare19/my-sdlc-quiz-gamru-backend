import type { Request, Response } from 'express';
import { ok } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import { Leaderboard, Tournament, TournamentEntry, User } from '../../models';
import { getRankedBoard } from '../../engines/leaderboard.engine';

// GET /api/leaderboards/:id/rankings
export async function boardRankings(req: Request, res: Response) {
  const board = await Leaderboard.findByPk(req.params.id);
  if (!board) throw AppError.notFound('Leaderboard not found');
  const rankings = await getRankedBoard(req.params.id, Number(req.query.limit ?? 50));
  return ok(res, { board, rankings });
}

// POST /api/tournaments/:id/join
export async function joinTournament(req: Request, res: Response) {
  const tournament: any = await Tournament.findByPk(req.params.id);
  if (!tournament) throw AppError.notFound('Tournament not found');
  if (tournament.status !== 'ACTIVE' && tournament.status !== 'SCHEDULED') {
    throw AppError.badRequest('Tournament is not open for entries');
  }
  const [entry] = await TournamentEntry.findOrCreate({
    where: { tournamentId: tournament.id, userId: req.user!.id },
    defaults: { tournamentId: tournament.id, userId: req.user!.id },
  });
  return ok(res, entry, 'Joined tournament');
}

// POST /api/tournaments/:id/score  { points, stars }
export async function scoreTournament(req: Request, res: Response) {
  const entry: any = await TournamentEntry.findOne({
    where: { tournamentId: req.params.id, userId: req.user!.id },
  });
  if (!entry) throw AppError.badRequest('Join the tournament first');
  await entry.increment({ score: req.body.points ?? 0, starsEarned: req.body.stars ?? 0 });
  await entry.reload();
  return ok(res, entry, 'Score recorded');
}

// GET /api/tournaments/:id/rankings — live standings with player names (kept
// current by the game engine as players race).
export async function tournamentRankings(req: Request, res: Response) {
  const entries = await TournamentEntry.findAll({
    where: { tournamentId: req.params.id },
    order: [['score', 'DESC']],
    limit: Number(req.query.limit ?? 100),
    include: [{ model: User, attributes: ['id', 'displayName', 'firstName', 'lastName', 'avatarUrl'] }],
  });
  const ranked = (entries as any[]).map((e, i) => ({
    rank: i + 1,
    ...e.toJSON(),
    name: e.User?.displayName || `${e.User?.firstName ?? ''} ${e.User?.lastName ?? ''}`.trim() || '—',
    avatarUrl: e.User?.avatarUrl ?? null,
  }));
  return ok(res, ranked);
}
