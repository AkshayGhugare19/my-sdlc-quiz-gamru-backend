import { Op } from 'sequelize';
import { User, RefreshToken, Organization, Avatar, PlayerAvatar } from '../../../models';
import { ensureDefaultGameContent } from '../../../engines/defaultContent.engine';
import { AppError } from '../../../utils/AppError';
import { normalizeRole } from '../../../auth/permissions';
import { hashPassword, verifyPassword } from '../../../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../../../utils/tokens';

function ttlToDate(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function persistRefresh(user: any, token: string, meta: { ip?: string; userAgent?: string }) {
  await RefreshToken.create({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: ttlToDate(30),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
}

// Roles that play the game; every other role belongs on the admin console.
const PLAYER_ROLES = new Set(['EMPLOYEE', 'GUEST']);

export async function login(
  email: string,
  password: string,
  meta: { ip?: string; userAgent?: string } = {},
  // Which client is signing in: the racing GAME accepts players only, the
  // admin CONSOLE accepts staff only. Checked BEFORE any tokens are issued.
  audience?: 'GAME' | 'CONSOLE',
) {
  const user: any = await User.findOne({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw AppError.unauthorized('Invalid email or password');
  }
  if (user.status === 'DISABLED') throw AppError.forbidden('Account disabled');

  const role = normalizeRole(user.role);
  if (audience === 'GAME' && !PLAYER_ROLES.has(role)) {
    throw AppError.forbidden(
      `The game is for players only — your ${role} account signs in on the GamifiedLearningadmin console instead.`,
    );
  }
  if (audience === 'CONSOLE' && PLAYER_ROLES.has(role)) {
    throw AppError.forbidden(
      'Player accounts sign in inside the learning game, not the admin console.',
    );
  }

  await user.update({ lastLoginAt: new Date() });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await persistRefresh(user, refreshToken, meta);

  return { user: sanitize(user), accessToken, refreshToken };
}

export async function register(input: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string | null;
  organizationSlug?: string | null;
  role?: string;
  departmentId?: string | null;
}) {
  const email = input.email.toLowerCase().trim();

  // Public game signups pick an organization by slug (or id). Resolve it so the
  // new learner is added to the right tenant.
  let organizationId = input.organizationId ?? null;
  if (!organizationId && input.organizationSlug) {
    const org: any = await Organization.findOne({ where: { slug: input.organizationSlug } });
    if (!org) throw AppError.badRequest('Unknown organization');
    organizationId = org.id;
  }

  const existing = await User.findOne({ where: { email, organizationId } });
  if (existing) throw AppError.conflict('A user with this email already exists');

  // Public self-signup can only ever create a learner (EMPLOYEE) or GUEST —
  // elevated roles are assigned by an admin via user management.
  const requestedRole = input.role ?? 'EMPLOYEE';
  const role = ['EMPLOYEE', 'GUEST'].includes(requestedRole) ? requestedRole : 'EMPLOYEE';

  const user: any = await User.create({
    email,
    passwordHash: await hashPassword(input.password),
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: [input.firstName, input.lastName].filter(Boolean).join(' ') || email,
    organizationId,
    departmentId: input.departmentId ?? null,
    role,
    status: 'ACTIVE',
  });

  // Initialise the new player's world so they can play immediately:
  // 1. make sure their organization has the default game content (missions,
  //    bundle, questions, avatars, accessories, ranks, tournament, shop) —
  //    without this, orgs created without content threw "Mission not found";
  // 2. assign the org's default avatar.
  if (user.organizationId) {
    try {
      await ensureDefaultGameContent(user.organizationId);
    } catch (err) {
      // Provisioning must never block a signup; the pillars endpoint self-heals.
      console.error('Default content provisioning failed during signup:', err);
    }
    const avatar: any = await Avatar.findOne({ where: { organizationId: user.organizationId, isDefault: true } });
    if (avatar) await PlayerAvatar.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, avatarId: avatar.id } });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await persistRefresh(user, refreshToken, {});
  return { user: sanitize(user), accessToken, refreshToken };
}

export async function refresh(token: string) {
  let payload: any;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }
  const stored: any = await RefreshToken.findOne({
    where: { tokenHash: hashToken(token), revokedAt: { [Op.is]: null } as any },
  });
  if (!stored || stored.expiresAt < new Date()) throw AppError.unauthorized('Refresh token expired');

  const user: any = await User.findByPk(payload.sub);
  if (!user) throw AppError.unauthorized('User no longer exists');

  // Rotate the refresh token.
  await stored.update({ revokedAt: new Date() });
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await persistRefresh(user, refreshToken, {});
  return { accessToken, refreshToken };
}

export async function logout(token: string) {
  if (!token) return;
  await RefreshToken.update({ revokedAt: new Date() }, { where: { tokenHash: hashToken(token) } });
}

export async function me(userId: string) {
  const user: any = await User.findByPk(userId, { include: [{ model: Organization }] });
  if (!user) throw AppError.notFound('User not found');
  return sanitize(user);
}

/** Public list of joinable organizations (for the game signup screen). */
export async function listPublicOrganizations() {
  const orgs = await Organization.findAll({
    where: { status: ['ACTIVE', 'TRIAL'] as any },
    attributes: ['id', 'name', 'slug', 'logoUrl', 'primaryColor', 'accentColor'],
    order: [['name', 'ASC']],
  });
  return orgs;
}

function sanitize(user: any) {
  const u = user.toJSON ? user.toJSON() : user;
  delete u.passwordHash;
  return u;
}
