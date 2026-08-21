import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../../middlewares/validate.middleware';
import { authenticate } from '../../middlewares/auth.middleware';
import { authLimiter, handoffLimiter } from '../../middlewares/rateLimit.middleware';
import { asyncHandler } from '../../utils/responseHandler';
import * as auth from './controller/auth.controller';

const router = Router();

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// Public game signup: learner picks their organization by slug (or id).
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().allow('').optional(),
  lastName: Joi.string().allow('').optional(),
  organizationId: Joi.string().optional(),
  organizationSlug: Joi.string().optional(),
  departmentId: Joi.string().optional(),
  // Self-signup is restricted to learner roles server-side regardless.
  role: Joi.string().valid('EMPLOYEE', 'GUEST').optional(),
}).or('organizationId', 'organizationSlug');

const handoffExchangeSchema = Joi.object({
  code: Joi.string().trim().required(),
});

// ── Admin console auth (Gamrufrontend) — staff roles only ──────────────
// EMPLOYEE/GUEST accounts are rejected here with a pointer to the game.
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(auth.login));

// ── Game auth (racing client) — players only ───────────────────────────────
// EMPLOYEE/GUEST sign in and self-register here; staff roles are rejected
// with a pointer to the admin console. Signup always creates a learner role.
router.post('/game/login', authLimiter, validate(loginSchema), asyncHandler(auth.loginGame));
router.post('/game/register', authLimiter, validate(registerSchema), asyncHandler(auth.register));
router.get('/game/organizations', asyncHandler(auth.organizations)); // public, for the signup org picker
router.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Gamru', time: new Date().toISOString() }));

// ── Unity iframe handoff (sessionStorage token → embedded game) ────────────
// The website calls /handoff with its access token and gets a one-time code to
// put in the iframe URL; the Unity build inside that iframe calls /handoff/
// exchange with the code and receives its own tokens. Exchange is public by
// design (the game has no token yet) — the code is the credential, so it is
// single-use, expires in ~2 minutes, and is rate limited like a login.
router.post('/handoff', authenticate, asyncHandler(auth.handoff));
router.post(
  '/handoff/exchange',
  handoffLimiter,
  validate(handoffExchangeSchema),
  asyncHandler(auth.handoffExchange),
);

// ── Shared (token-based, used by both clients) ─────────────────────────────
router.post('/refresh', asyncHandler(auth.refresh));
router.post('/logout', asyncHandler(auth.logout));
router.get('/me', authenticate, asyncHandler(auth.me));
router.get('/permissions', authenticate, asyncHandler(auth.permissions));
// Kept for backward compatibility with earlier clients.
router.post('/register', authLimiter, validate(registerSchema), asyncHandler(auth.register));
router.get('/organizations', asyncHandler(auth.organizations));

export default router;
