// Generic tenant-scoped CRUD router factory.
// Inspired by gamru's gamification factory (one router per feature). Every admin
// resource (orgs, users, courses, missions, questions, rewards, badges, ranks,
// avatars, accessories, shop, tournaments, campaigns, media, …) is exposed with
// consistent list/get/create/update/delete semantics and role guards.
import { Router } from 'express';
import type { ModelStatic, Model } from 'sequelize';
import { Op } from 'sequelize';
import { BaseRepository } from './models/base.repository';
import { authenticate } from '../middlewares/auth.middleware';
import { bindTenant } from '../middlewares/tenant.middleware';
import { Role } from '../middlewares/role.middleware';
import { authorizeCrud } from '../middlewares/permission.middleware';
import { asyncHandler, ok, created } from '../utils/responseHandler';
import { AppError } from '../utils/AppError';

export interface CrudOptions {
  tenantScoped?: boolean;
  /** @deprecated authorization now comes from the RBAC permission matrix. */
  readRoles?: Role[];
  /** @deprecated authorization now comes from the RBAC permission matrix. */
  writeRoles?: Role[];
  /** Query params that map straight to equality filters. */
  filterable?: string[];
  /** Fields matched with ILIKE when `?search=` is present. */
  searchable?: string[];
  /** Default ordering, e.g. [['order_index','ASC']]. */
  order?: any;
  /** Mutate/validate the create/update payload before persisting. */
  beforeWrite?: (data: any, req: any) => any;
  /** Run after a create/update with the saved row + original body (e.g. attach
   *  related records like a bundle's missions). */
  afterWrite?: (row: any, body: any, req: any) => Promise<void> | void;
  /** Run before a delete (e.g. cascade nested rows like a rank's levels). */
  beforeDelete?: (id: string, req: any) => Promise<void> | void;
}

export function crudRouter<M extends Model>(model: ModelStatic<M>, options: CrudOptions = {}) {
  const repo = new BaseRepository<M>(model, options.tenantScoped ?? true);

  const router = Router();
  // Authenticate, bind tenant, then enforce the RBAC matrix. `authorizeCrud`
  // derives the resource from the mount path and the action from the HTTP verb.
  router.use(authenticate, bindTenant, authorizeCrud());

  // LIST (paginated + filters + search)
  router.get(
    '/',
    asyncHandler(async (req: any, res: any) => {
      const where: any = {};
      for (const f of options.filterable ?? []) {
        if (req.query[f] !== undefined) {
          const v = req.query[f];
          // Comma-separated values become an IN filter (e.g. ?role=EMPLOYEE,GUEST).
          where[f] = typeof v === 'string' && v.includes(',') ? v.split(',') : v;
        }
      }
      if (req.query.search && options.searchable?.length) {
        where[Op.or as any] = options.searchable.map((c) => ({ [c]: { [Op.iLike]: `%${req.query.search}%` } }));
      }
      const result = await repo.paginate({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 20),
        where,
        order: options.order,
      });
      return ok(res, result);
    }),
  );

  // GET ONE
  router.get(
    '/:id',
    asyncHandler(async (req: any, res: any) => {
      const row = await repo.findById(req.params.id);
      if (!row) throw AppError.notFound();
      return ok(res, row);
    }),
  );

  // CREATE
  router.post(
    '/',
    asyncHandler(async (req: any, res: any) => {
      const data = options.beforeWrite ? await options.beforeWrite(req.body, req) : req.body;
      const row = await repo.create(data);
      if (options.afterWrite) await options.afterWrite(row, req.body, req);
      return created(res, row);
    }),
  );

  // UPDATE
  router.put(
    '/:id',
    asyncHandler(async (req: any, res: any) => {
      const data = options.beforeWrite ? await options.beforeWrite(req.body, req) : req.body;
      const count = Object.keys(data).length ? await repo.updateById(req.params.id, data) : 0;
      // A 0-count isn't necessarily missing — the patch may be empty or identical
      // (e.g. a rank update that only changes its nested levels).
      const row = await repo.findById(req.params.id);
      if (!count && !row) throw AppError.notFound();
      if (options.afterWrite) await options.afterWrite(row, req.body, req);
      return ok(res, row, 'Updated');
    }),
  );

  // DELETE
  router.delete(
    '/:id',
    asyncHandler(async (req: any, res: any) => {
      if (options.beforeDelete) await options.beforeDelete(req.params.id, req);
      const count = await repo.deleteById(req.params.id);
      if (!count) throw AppError.notFound();
      return ok(res, null, 'Deleted');
    }),
  );

  return router;
}
