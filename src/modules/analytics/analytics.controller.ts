import type { Request, Response } from 'express';
import { fn, col, literal, Op } from 'sequelize';
import { ok } from '../../utils/responseHandler';
import { currentOrgId } from '../../tenancy/context';
import {
  User,
  Mission,
  MissionBundle,
  MissionAttempt,
  Course,
  Question,
  AnswerEvent,
  Progress,
} from '../../models';

// GET /api/analytics/overview — admin dashboard KPIs.
export async function overview(_req: Request, res: Response) {
  const organizationId = currentOrgId();
  const scope = organizationId ? { organizationId } : {};

  const [employees, missions, bundles, courses, questions, attempts, passed] = await Promise.all([
    User.count({ where: { ...scope, role: 'EMPLOYEE' } }),
    Mission.count({ where: scope }),
    MissionBundle.count({ where: scope }),
    Course.count({ where: scope }),
    Question.count({ where: scope }),
    MissionAttempt.count({ where: scope }),
    MissionAttempt.count({ where: { ...scope, status: 'PASSED' } }),
  ]);

  const avgScoreRow: any = await MissionAttempt.findOne({
    where: { ...scope, status: { [Op.in]: ['PASSED', 'FAILED'] } },
    attributes: [[fn('AVG', col('score_pct')), 'avg'], [fn('AVG', col('time_remaining_sec')), 'avgTime']],
    raw: true,
  });

  return ok(res, {
    counts: { employees, missions, bundles, courses, questions, attempts },
    completionRate: attempts ? Math.round((passed / attempts) * 100) : 0,
    averageScore: Math.round(Number(avgScoreRow?.avg ?? 0)),
    averageTimeRemaining: Math.round(Number(avgScoreRow?.avgTime ?? 0)),
  });
}

// GET /api/analytics/pillars — per-pillar (bundle) completion & score.
export async function pillarStats(_req: Request, res: Response) {
  const organizationId = currentOrgId();
  const scope = organizationId ? { organizationId } : {};
  const bundles = await MissionBundle.findAll({ where: scope });

  const data = [];
  for (const bundle of bundles as any[]) {
    const missions = await Mission.findAll({ where: { ...scope, missionBundleId: bundle.id } });
    const missionIds = missions.map((m: any) => m.id);
    const attempts = missionIds.length
      ? await MissionAttempt.findAll({ where: { missionId: { [Op.in]: missionIds } } })
      : [];
    const passedCount = (attempts as any[]).filter((a) => a.status === 'PASSED').length;
    const avgScore = attempts.length
      ? Math.round((attempts as any[]).reduce((s, a) => s + a.scorePct, 0) / attempts.length)
      : 0;
    data.push({
      bundleId: bundle.id,
      title: bundle.title,
      missions: missions.length,
      attempts: attempts.length,
      completionRate: attempts.length ? Math.round((passedCount / attempts.length) * 100) : 0,
      averageScore: avgScore,
    });
  }
  return ok(res, data);
}

// GET /api/analytics/questions/hardest — most-missed questions.
export async function hardestQuestions(_req: Request, res: Response) {
  const rows: any = await AnswerEvent.findAll({
    attributes: [
      'questionId',
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal('CASE WHEN is_correct THEN 1 ELSE 0 END')), 'correct'],
      [fn('SUM', literal('CASE WHEN is_correct THEN 0 ELSE 1 END')), 'wrong'],
    ],
    group: ['question_id'],
    order: [[literal('wrong'), 'DESC']],
    raw: true,
    limit: 20,
  }).catch(() => []);
  return ok(res, rows);
}
