// Course-roadmap builder helpers beyond plain CRUD. A course is a learning
// roadmap that only REFERENCES reusable content (missions, mission bundles,
// tournaments) through join tables — it never owns or duplicates it, so the
// same mission can appear in any number of courses. These endpoints return a
// course's current selections (they power the admin form's preselected
// checkboxes); the selections themselves are written by the /courses CRUD
// afterWrite reconcile (route/index.ts).
import type { Request, Response } from 'express';
import { ok } from '../../utils/responseHandler';
import { AppError } from '../../utils/AppError';
import {
  Course,
  CourseMission,
  CourseBundle,
  CourseTournament,
  Mission,
  MissionBundle,
  Tournament,
} from '../../models';

async function mustFindCourse(id: string) {
  const course = await Course.findByPk(id);
  if (!course) throw AppError.notFound('Course not found');
  return course;
}

// GET /courses/:id/missions — the missions this course references (ordered).
export async function listMissions(req: Request, res: Response) {
  await mustFindCourse(req.params.id);
  const links = await CourseMission.findAll({ where: { courseId: req.params.id }, order: [['order_index', 'ASC']] });
  const ids = (links as any[]).map((l) => l.missionId);
  const rows = ids.length ? await Mission.findAll({ where: { id: ids } }) : [];
  const byId = new Map((rows as any[]).map((m) => [m.id, m]));
  return ok(res, ids.map((id) => byId.get(id)).filter(Boolean));
}

// GET /courses/:id/bundles — the mission bundles this course references (ordered).
export async function listBundles(req: Request, res: Response) {
  await mustFindCourse(req.params.id);
  const links = await CourseBundle.findAll({ where: { courseId: req.params.id }, order: [['order_index', 'ASC']] });
  const ids = (links as any[]).map((l) => l.missionBundleId);
  const rows = ids.length ? await MissionBundle.findAll({ where: { id: ids } }) : [];
  const byId = new Map((rows as any[]).map((b) => [b.id, b]));
  return ok(res, ids.map((id) => byId.get(id)).filter(Boolean));
}

// GET /courses/:id/tournaments — the tournaments this course references (ordered).
export async function listTournaments(req: Request, res: Response) {
  await mustFindCourse(req.params.id);
  const links = await CourseTournament.findAll({ where: { courseId: req.params.id }, order: [['order_index', 'ASC']] });
  const ids = (links as any[]).map((l) => l.tournamentId);
  const rows = ids.length ? await Tournament.findAll({ where: { id: ids } }) : [];
  const byId = new Map((rows as any[]).map((t) => [t.id, t]));
  return ok(res, ids.map((id) => byId.get(id)).filter(Boolean));
}
