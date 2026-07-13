// ============================================================================
// RBAC — single source of truth for the permission matrix.
//
// Canonical roles: SUPER_ADMIN, ADMIN, MANAGER, TRAINER, EMPLOYEE, GUEST.
// Legacy roles already in the DB are normalised so nothing breaks:
//   PLATFORM_ADMIN → SUPER_ADMIN   (platform-level staff)
//   ORG_ADMIN      → ADMIN         (organization administrator)
//
// `can(role, resource, action)` is the one function every guard uses (backend
// middleware + frontend gating both read this same matrix shape).
// ============================================================================

export type Action =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'manage'
  | 'configure'
  | 'export'
  | 'assign'
  | 'play';

export const ALL = '*' as const;

// Resource keys match the kebab-case API mount paths (e.g. '/api/mission-bundles')
// plus a few feature areas (analytics, media, settings, integrations, gameplay).
type ResourceMap = Record<string, Action[] | typeof ALL>;
type Matrix = Record<string, ResourceMap | typeof ALL>;

const CONTENT = ['view', 'create', 'update', 'delete', 'manage'] as Action[];
const FULL = ['view', 'create', 'update', 'delete', 'manage', 'approve', 'assign', 'configure', 'export'] as Action[];

export const ROLE_PERMISSIONS: Matrix = {
  // Full, unrestricted access to everything.
  SUPER_ADMIN: ALL,

  // Organization administrator — everything within their tenant, but NOT
  // platform-wide organization management, system integrations, or super config.
  ADMIN: {
    users: ['view', 'create', 'update', 'delete', 'assign'],
    departments: ['view', 'create', 'update', 'delete'],
    courses: FULL,
    'content-blocks': FULL,
    'learning-paths': [...FULL, 'assign'],
    'mission-bundles': FULL,
    missions: FULL,
    questions: FULL,
    'question-options': FULL,
    levels: ['view', 'create', 'update', 'delete'],
    ranks: ['view', 'create', 'update', 'delete'],
    badges: ['view', 'create', 'update', 'delete'],
    achievements: ['view', 'create', 'update', 'delete'],
    'reward-rules': ['view', 'create', 'update', 'delete'],
    avatars: ['view', 'create', 'update', 'delete'],
    accessories: ['view', 'create', 'update', 'delete'],
    'shop-items': ['view', 'create', 'update', 'delete'],
    leaderboards: ['view', 'create', 'update', 'delete', 'export'],
    tournaments: [...FULL],
    campaigns: [...FULL],
    notifications: ['view', 'create', 'update', 'delete'],
    'certificate-templates': ['view', 'create', 'update', 'delete'],
    media: ['view', 'create', 'update', 'delete'],
    analytics: ['view', 'export'],
    settings: ['view', 'configure'],
    // NOTE: platform-wide `organizations` management is SUPER_ADMIN only.
    gameplay: ['play'],
  },

  // Team leader — manages assigned teams, assigns learning, views team reports,
  // approves requests. No org-wide administration.
  MANAGER: {
    users: ['view'],
    departments: ['view'],
    'learning-paths': ['view', 'assign'],
    courses: ['view', 'assign'],
    'mission-bundles': ['view', 'assign'],
    missions: ['view', 'assign'],
    tournaments: ['view', 'approve', 'assign'],
    leaderboards: ['view'],
    campaigns: ['view'],
    notifications: ['view', 'create'],
    analytics: ['view', 'export'],
    gameplay: ['play'],
  },

  // Content author — creates & manages training content and assessments, tracks
  // learners. No user or system management.
  TRAINER: {
    courses: CONTENT,
    'content-blocks': CONTENT,
    'learning-paths': CONTENT,
    'mission-bundles': CONTENT,
    missions: CONTENT,
    questions: CONTENT,
    'question-options': CONTENT,
    media: ['view', 'create', 'update', 'delete'],
    'certificate-templates': CONTENT,
    badges: ['view'],
    achievements: ['view'],
    accessories: ['view'],
    avatars: ['view'],
    ranks: ['view'],
    levels: ['view'],
    'reward-rules': ['view'],
    'shop-items': ['view'],
    leaderboards: ['view'],
    tournaments: ['view'],
    analytics: ['view'],
    gameplay: ['play'],
  },

  // Learner / player — plays, views own progress/achievements. No admin.
  EMPLOYEE: {
    courses: ['view'],
    'mission-bundles': ['view'],
    missions: ['view'],
    leaderboards: ['view'],
    tournaments: ['view', 'assign'], // 'assign' = join a tournament
    notifications: ['view'],
    gameplay: ['play'],
  },

  // Very limited — public/demo only.
  GUEST: {
    courses: ['view'],
    gameplay: ['play'],
  },
};

const ROLE_ALIASES: Record<string, string> = {
  PLATFORM_ADMIN: 'SUPER_ADMIN',
  ORG_ADMIN: 'ADMIN',
};

export const CANONICAL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'TRAINER', 'EMPLOYEE', 'GUEST'] as const;

export function normalizeRole(role?: string | null): string {
  if (!role) return 'GUEST';
  return ROLE_ALIASES[role] ?? role;
}

/** The one authorization check used everywhere. */
export function can(role: string | null | undefined, resource: string, action: Action): boolean {
  const perms = ROLE_PERMISSIONS[normalizeRole(role)];
  if (!perms) return false;
  if (perms === ALL) return true;
  const res = perms[resource];
  if (!res) return false;
  if (res === ALL) return true;
  return res.includes(action);
}

/**
 * A serialisable ability map for the frontend to drive nav/route/feature/action
 * visibility. SUPER_ADMIN returns { '*': ['*'] }.
 */
export function abilitiesFor(role?: string | null): Record<string, string[]> {
  const norm = normalizeRole(role);
  const perms = ROLE_PERMISSIONS[norm];
  if (!perms || perms === ALL) return { '*': ['*'] };
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(perms)) {
    out[resource] = actions === ALL ? ['*'] : [...actions];
  }
  return out;
}
