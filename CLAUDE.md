# CLAUDE.md — GamifiedLearning backend

Gamification-engine API for the "SDLC Quest" corporate-learning platform.
Node + Express 4 + Sequelize 6 (Postgres, UUID PKs, snake_case) + TypeScript + Socket.io.
**This is the single source of truth.** It serves two frontends (siblings in the parent folder):
the admin console `my-sdlc-quiz-gamru-frontend` (staff) and the racing game
`my-sdlc-quiz-game-frontend` (EMPLOYEE/GUEST players). Gameplay is **server-authoritative** —
clients render questions and post the chosen lane; the server grades and owns all scoring/economy.

## Run

```bash
npm install
npm run db:migrate      # OR npm run db:sync (dev: create tables from models)
npm run db:seed         # demo tenants + full "SDLC Quest" content
npm run dev             # ts-node-dev on :4000 (API mounted under /api)
```

Other scripts: `build` (tsc → dist/), `start`, `typecheck`, `lint`,
`db:migrate:undo`. One-off: `npx ts-node --transpile-only src/scripts/backfillTournaments.ts`.
Needs Postgres (default DB `e-learingrace`, user `postgres`/`root`). Env in `.env.example`;
Redis NOT required (`QUEUE_DRIVER=inline`). Demo creds (all `Password123!`):
`superadmin@platform.com`, `admin@acme.com`, `rambo@acme.com`, etc.

## Architecture

- Bootstrap: `src/server.ts` → `src/app.ts` (helmet → cors → compression → json → pino-http →
  `/health` → `app.use('/api', apiLimiter, apiRoutes)` → error handler).
- **Multi-tenancy** is row-level, single DB: every tenant table has `organization_id`.
  `bindTenant` middleware puts the org in **AsyncLocalStorage** (`src/tenancy/context.ts`);
  `BaseRepository` (`src/core/models/base.repository.ts`) auto-scopes every query and stamps
  `organization_id` on create. Super admins act cross-tenant via `x-organization-id` header.
- **Generic CRUD** is the dominant admin pattern: `src/core/crud.factory.ts` builds a
  list/get/create/update/delete router per resource (pagination, ILIKE search, lifecycle hooks
  `beforeWrite`/`afterWrite`/`beforeDelete`). Registered in `src/route/index.ts`.
- **Engines** (`src/engines/`) hold business logic; **modules** (`src/modules/`) hold
  routes+controllers+services per feature. The game lives in `src/modules/game/`.
- Response envelope `{success, message, data|errors, timestamp}` via `src/utils/responseHandler.ts`.
  Errors via typed `AppError` (`src/utils/AppError.ts`) + `src/middlewares/error.middleware.ts`
  (maps Sequelize/PG codes → clean messages). Validation = Joi (`validate.middleware.ts`, → 422).
- Real-time: `src/realtime/socket.ts`, rooms `user:<id>`/`org:<orgId>`/`session:<id>`. Engines
  emit events (`src/events/`) → Notifications, and call `emitToUser/Org/Session` directly.

## Data models (`src/models/`, associations in `index.ts`)

`identity.ts` (Organization, Department, User[+denormalized wallet totalXp/coins/stars/currentLevel],
RefreshToken) · `content.ts` (Course=LMS roadmap via join tables, ContentBlock, Media, LearningPath) ·
`missions.ts` (MissionBundle="pillar", Mission[timerSec/questionCount/passingScorePct/maxStars/
laneCount/xpReward], Question, QuestionOption, MissionQuestion) · `gameplay.ts` (MissionAttempt,
GameSession[serverSeed/questionOrder/tournamentId], AnswerEvent, **Progress**) · `gamification.ts`
(Rank+Level, Badge, XpTransaction ledger, RewardRule, RewardGrant) · `economy.ts` (Avatar, Accessory,
GarageItem, MissionAccessoryReward, ShopItem, ShopOrder) · `social.ts` (Leaderboard, **Tournament**
[gameConfig + rewardConfig JSONB], TournamentEntry, Certificate) · `system.ts` (Notification, OrgSetting,
AuditLog, …).

**Critical:** `Progress.entityType` distinguishes `MISSION` (standalone play) from `BUNDLE_MISSION`
(played from a pillar) — these are **fully isolated** progress tracks.

## Gameplay engine — `src/modules/game/service/gameSession.service.ts` (the heart)

Three race modes from `POST /play/sessions` body: **mission** (`missionId`, +`missionBundleId` for
bundle flow), **tournament** (`tournamentId`, no missionId — draws from org bank by `gameConfig`),
**quick** (neither — casual, no progress). Answering = steering into a lane matching
`chosenLane → lanes[i].isCorrect`. Correct → `+correctBonusSec`, `+1 star` (up to maxStars),
rolls accessory drop.

**Economy (anti-farming — do not break):** only *improvement over previous best* credits the wallet —
`starsGained = max(0, session.starsEarned − prevProgress.starsEarned)`;
`coinsEarned = starsGained*10 + (firstPass ? 50 : 0)`. **GUEST = demo mode, zero real rewards.**

**Tournaments** (`tournament.service.ts`): live rank by `[score DESC, stars DESC, joined_at ASC]`;
`settleTournament` pays `rewardConfig[placement]`, status→COMPLETED is the idempotency guard.
**Settlement is lazy** — `settleDueTournaments` runs from `getDashboard`, there is NO cron (BullMQ is
scaffolding only).

**Default content** (`src/engines/defaultContent.engine.ts`, largest file): provisions the "SDLC Quest"
starter world per org (3 pillars, avatars, accessories, ranks, badges, tournament question bank),
idempotently, from **three places so no org is ever empty**: the seeder, player registration, and
`GET /play/pillars` (self-heal).

## Auth & RBAC — `src/auth/permissions.ts`

Roles: `SUPER_ADMIN`(=`'*'`) / `ADMIN` / `MANAGER` / `TRAINER` / `EMPLOYEE` / `GUEST`.
Matrix `ROLE_PERMISSIONS[role][resource]=actions[]`, checked via `can(role, resource, action)`;
guards `authorize()` / `authorizeCrud()`. Three JWTs (`src/utils/tokens.ts`): access (15m),
refresh (30d, rotated+hashed), game-session (2h). **Login is audience-gated**: `/auth/login` =
staff only, `/auth/game/login` = players only.

## Conventions

- Idempotency everywhere: `findOrCreate` on natural keys, improvement-based crediting,
  status-flip settlement guards, one cert per `(user, sourceType, sourceId)`.
- Prefer adding a resource via the CRUD factory + a `RESOURCE_CONFIGS` entry on the admin frontend
  over a bespoke route, unless it needs custom logic.
- Pluggable adapters: `src/storage/index.ts` (local|s3), `src/queue/index.ts` (inline|bullmq).
