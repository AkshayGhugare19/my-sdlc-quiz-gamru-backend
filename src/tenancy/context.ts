// Per-request tenant context via AsyncLocalStorage.
// Mirrors gamru's tenancy/context.ts. Because this platform uses ROW-LEVEL
// isolation (a single database with organization_id on every tenant table),
// the ALS store carries the active organizationId used to scope every query,
// rather than a per-tenant DB name.
import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantStore {
  organizationId: string | null;
  userId: string | null;
  role: string | null;
}

const als = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return als.run(
    {
      organizationId: store.organizationId ?? null,
      userId: store.userId ?? null,
      role: store.role ?? null,
    },
    fn,
  );
}

export function getTenant(): TenantStore {
  return als.getStore() ?? { organizationId: null, userId: null, role: null };
}

export function currentOrgId(): string | null {
  return getTenant().organizationId ?? null;
}

export function isSuperContext(): boolean {
  const role = getTenant().role;
  return role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
}

/** Assert a tenant is bound; throws for tenant-scoped ops that run unscoped. */
export function requireOrgId(): string {
  const id = currentOrgId();
  if (!id) {
    const err: any = new Error('No organization bound to this request');
    err.statusCode = 400;
    throw err;
  }
  return id;
}
