# sdlc-quiz-gamru-backend

GamifiedLearning engine API — Node + Express + Sequelize (Postgres) + TypeScript.
Serves **two clients**: the admin console (`sdlc-quiz-gamru-frontend`, staff roles)
and the racing game (`sdlc-quiz-game-frontend`, EMPLOYEE / GUEST players).

## Run

```bash
npm install
npm run db:migrate      # or: npm run db:sync (dev, creates tables from models)
npm run db:seed         # demo tenants + full SDLC Quest content
npm run dev             # ts-node-dev on :4000
```

Useful one-offs:

```bash
npx ts-node --transpile-only src/scripts/backfillTournaments.ts
# gives every existing org the tournament question bank + default
# start/end dates and gameConfig on tournaments missing them
```

## Multi-tenancy & default content

Every organization is a tenant with its own users, missions, questions,
accessories, ranks and tournaments. `src/engines/defaultContent.engine.ts`
provisions the full "SDLC Quest" starter world for an org. It runs from three
places so **no org can ever be empty** (the old "Mission not found" bug):

1. the seeder (`npm run db:seed`),
2. player registration (`auth.service.register`),
3. the pillars endpoint (self-heal on first Hub load).

## Roles (who does what)

| Role | Client | Missions / Bundles | Questions | Tournaments |
|---|---|---|---|---|
| SUPER_ADMIN / ADMIN | Console | create, publish, attach questions & rewards | full CRUD | create, schedule, configure races & prizes |
| TRAINER | Console | author content & questions | full CRUD | view standings |
| MANAGER | Console | view team progress | — | view standings |
| EMPLOYEE | Game | play, earn XP/stars/coins | — | join + race for points |
| GUEST | Game | demo play, no rewards | — | cannot join |

## Mission flow (per player)

```
Admin: create Mission → attach Questions (mission_questions) → publish
Player: Hub (GET /play/pillars) → Learn (GET /play/missions/:id/content)
      → POST /play/sessions { missionId }            ← creates MissionAttempt + GameSession
      → POST /play/sessions/:id/answer (per lane)    ← server-authoritative grading
      → complete → XP + stars + coins + Progress(userId, MISSION)
```

- Progress is **per player** (`progress` table keyed by user); replays only
  credit stars/coins for *improvement* over the previous best.
- Accessory drops (`mission_accessory_rewards`) trigger on correct answers.

## Mission Bundle flow (per player)

```
Admin: create Bundle → attach Missions → publish
Player: complete every published mission in the bundle
      → recomputeBundleProgress marks MISSION_BUNDLE progress
      → first completion pays bundle XP/star rewards + badge + certificate
```

## Tournament flow

Tournaments are **separate from normal races**. A normal mission race never
touches tournament standings.

```
Admin (console → Tournaments): name, type, metric (XP|STARS|SCORE|SPEED),
  Starts At / Ends At, race config (questions per race, categories,
  difficulty, timer, lanes, XP per question), placement rewards JSON, status
Player (game dashboard): Join → 🏎️ Race
      → POST /play/sessions { tournamentId }          ← NO missionId
      → engine draws a fresh random question set from the org question bank,
        filtered by the tournament's gameConfig (categories/difficulty),
        with the configured timer/lanes — different questions every run
      → completing the race adds metric points to the player's entry,
        placements re-rank live (tie-breakers: score → stars → earliest join)
End of tournament (endsAt passed, checked lazily on dashboard loads):
      → final ranking frozen → rewardConfig prizes paid per placement
        (xp/coins/stars; winner also gets starReward) → status COMPLETED
```

Key columns: `tournaments.game_config` (race config JSONB),
`tournaments.reward_config` (prizes per placement),
`game_sessions.tournament_id` (marks a tournament race; `mission_id` is null
for tournament-only races).

## Question bank

Questions are org-scoped with `category`, `difficulty` (BEGINNER…EXPERT) and
inline answer options. Missions pin/attach specific questions; tournaments
draw randomly from the bank by category/difficulty. The default content ships
a categorized bank (Racing Knowledge / SDLC Fundamentals / Workplace Safety)
on top of the pillar questions.

## Economy

- **XP** → levels (XP bands inside ranks). Missions pay `xpReward`;
  tournament races pay `xpPerQuestion × questions`; prizes pay on settlement.
- **Stars** — 1 per correct answer up to the max; wallet-credited only for
  improvement (no farming).
- **Coins** — 10 per newly-gained star + 50 first-pass bonus; spent in the
  Reward Shop (accessories fulfil instantly, company perks go PENDING).
