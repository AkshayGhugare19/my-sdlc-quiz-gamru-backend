// Generic repository with built-in ROW-LEVEL tenant scoping.
// Extends gamru's base.repository idea: every query is automatically filtered
// by the active organizationId (from the ALS tenant context) for tenant-scoped
// models, so a service can never accidentally read another org's data.
import { Model, ModelStatic, WhereOptions, FindOptions, Order } from 'sequelize';
import { currentOrgId, isSuperContext } from '../../tenancy/context';

export interface PaginateOptions {
  page?: number;
  pageSize?: number;
  where?: WhereOptions;
  order?: Order;
  include?: any[];
}

export class BaseRepository<M extends Model> {
  constructor(
    protected model: ModelStatic<M>,
    /** Whether this model carries organization_id and must be tenant-filtered. */
    protected tenantScoped = true,
  ) {}

  /** Merge the active org into a where clause (skipped for super-admin ctx). */
  protected scope(where: WhereOptions = {}): WhereOptions {
    if (!this.tenantScoped || isSuperContext()) return where;
    const orgId = currentOrgId();
    if (!orgId) return where;
    return { organizationId: orgId, ...where } as WhereOptions;
  }

  /** Ensure create payloads inherit the active org. */
  protected stampOrg<T extends Record<string, any>>(data: T): T {
    if (!this.tenantScoped || isSuperContext()) return data;
    const orgId = currentOrgId();
    if (orgId && data.organizationId === undefined) return { ...data, organizationId: orgId };
    return data;
  }

  findAll(options: FindOptions = {}) {
    return this.model.findAll({ ...options, where: this.scope(options.where) });
  }

  findOne(where: WhereOptions = {}, options: FindOptions = {}) {
    return this.model.findOne({ ...options, where: this.scope(where) });
  }

  findById(id: string, options: FindOptions = {}) {
    return this.model.findOne({ ...options, where: this.scope({ id } as WhereOptions) });
  }

  count(where: WhereOptions = {}) {
    return this.model.count({ where: this.scope(where) });
  }

  create(data: any) {
    return this.model.create(this.stampOrg(data));
  }

  bulkCreate(rows: any[]) {
    return this.model.bulkCreate(rows.map((r) => this.stampOrg(r)));
  }

  async updateById(id: string, data: any) {
    const [count] = await this.model.update(data, { where: this.scope({ id } as WhereOptions) });
    return count;
  }

  async updateWhere(where: WhereOptions, data: any) {
    const [count] = await this.model.update(data, { where: this.scope(where) });
    return count;
  }

  deleteById(id: string) {
    return this.model.destroy({ where: this.scope({ id } as WhereOptions) });
  }

  deleteWhere(where: WhereOptions) {
    return this.model.destroy({ where: this.scope(where) });
  }

  async paginate(opts: PaginateOptions = {}) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 20));
    const { rows, count } = await this.model.findAndCountAll({
      where: this.scope(opts.where),
      order: opts.order ?? [['created_at', 'DESC']],
      include: opts.include,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return {
      items: rows,
      pagination: { page, pageSize, total: count, totalPages: Math.ceil(count / pageSize) },
    };
  }
}
