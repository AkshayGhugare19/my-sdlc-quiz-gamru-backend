// Default game-content provisioning — the single source of the "SDLC Quest"
// starter content every tenant needs before a player can race: avatars,
// accessories, reward shop, ranks/levels, badges, leaderboards, a certificate
// template, a weekly tournament and the three-pillar mission bundle with
// storyboard learning content and lane questions.
//
// Called from three places so no organization can ever be left empty:
//   1. the seeder (both demo tenants),
//   2. auth registration (a new employee's org is provisioned on signup),
//   3. the pillars endpoint (self-heals orgs created before this existed).
// Everything is findOrCreate on natural keys, so re-running is safe.
import {
  Avatar,
  Accessory,
  Level,
  Rank,
  Badge,
  Leaderboard,
  CertificateTemplate,
  Tournament,
  Course,
  CourseMission,
  CourseBundle,
  CourseTournament,
  ContentBlock,
  MissionBundle,
  Mission,
  Question,
  QuestionOption,
  MissionQuestion,
  MissionAccessoryReward,
  ShopItem,
} from '../models';

const AVATARS = [
  { key: 'alex', name: 'Alex', isDefault: true },
  { key: 'maya', name: 'Maya' },
  { key: 'omar', name: 'Omar' },
  { key: 'aya', name: 'Aya' },
  { key: 'james', name: 'James' },
  { key: 'ava', name: 'Ava' },
];

const ACCESSORIES = [
  { key: 'turbo_booster', name: 'Turbo Booster', slot: 'BOOST', unlockType: 'REWARD', rarity: 'rare' },
  { key: 'neon_wings', name: 'Neon Wings', slot: 'WINGS', unlockType: 'SHOP', shopPriceCoins: 500 },
  { key: 'cyber_boost', name: 'Cyber Boost', slot: 'BOOST', unlockType: 'SHOP', shopPriceCoins: 600 },
  { key: 'dragon_exhaust', name: 'Dragon Exhaust', slot: 'EXHAUST', unlockType: 'SHOP', shopPriceCoins: 700 },
  { key: 'nitro_blade', name: 'Nitro Blade', slot: 'BLADE', unlockType: 'SHOP', shopPriceCoins: 800 },
  { key: 'champion_helmet', name: 'Champion Helmet', slot: 'HELMET', unlockType: 'REWARD', rarity: 'epic' },
  { key: 'victory_trail', name: 'Victory Trail', slot: 'TRAIL', unlockType: 'REWARD', rarity: 'epic' },
];

// Each pillar: learning storyboard + 5 lane questions.
const PILLARS = [
  {
    slug: 'emergency-management',
    title: 'Emergency Management',
    category: 'Emergency Management',
    color: '#0EA5E9',
    summary: 'Prepare, respond and recover effectively.',
    storyboard: [
      { title: 'Medical Emergency', body: 'A colleague suddenly collapses at the office. What should you do first? Look for the First Aider flag.' },
      { title: 'Find the First Aider', body: 'Look around the office to find the First Aider flag. Good spot! The First Aider flag is here.' },
      { title: 'First Aider Responds', body: 'The First Aider arrives and starts CPR. Help perform CPR — press SPACE 3 times to give chest compressions.', config: { interaction: 'CPR', presses: 3 } },
      { title: 'Notice the Fire', body: 'The First Aider notices a small fire in the trash can. Involve the Fire Warden.' },
      { title: 'Fire Warden Responds', body: 'The Fire Warden takes control and checks the situation. Leave it to the Fire Warden.' },
      { title: 'Evacuate Safely', body: "Follow the Fire Warden's instructions to reach the assembly point. Safety is everyone's responsibility." },
    ],
    questions: [
      { prompt: 'Where can BCM, ERM and Emergency Management policies be found?', options: ['Canvas → Our Policies', 'Ask a colleague', 'Social Media'], correct: 0 },
      { prompt: 'What is the FIRST thing to do when a colleague collapses?', options: ['Look for the First Aider flag', 'Post about it online', 'Continue working'], correct: 0 },
      { prompt: 'How many chest compressions cycle do you assist with (SPACE presses)?', options: ['3', '1', '10'], correct: 0 },
      { prompt: 'Who takes control of a small office fire?', options: ['The Fire Warden', 'Any bystander', 'Nobody'], correct: 0 },
      { prompt: 'Where do you go during an evacuation?', options: ['The assembly point', 'The car park exit only', 'Stay at your desk'], correct: 0 },
    ],
  },
  {
    slug: 'business-continuity-management',
    title: 'Business Continuity Management',
    category: 'Business Continuity Management',
    color: '#2563EB',
    summary: 'Keep critical business running no matter what.',
    storyboard: [
      { title: 'Identify Critical Functions', body: 'Know which business functions must keep running during disruption.' },
      { title: 'Recovery Time Objectives', body: 'Understand how quickly each function must be restored.' },
      { title: 'Invoke the Plan', body: 'When disruption hits, invoke the Business Continuity Plan.' },
    ],
    questions: [
      { prompt: 'What does BCM primarily protect?', options: ['Critical business functions', 'Office decorations', 'Parking spaces'], correct: 0 },
      { prompt: 'What does RTO stand for?', options: ['Recovery Time Objective', 'Regular Time Off', 'Rapid Task Order'], correct: 0 },
      { prompt: 'When should the continuity plan be invoked?', options: ['On significant disruption', 'Every Friday', 'Never'], correct: 0 },
      { prompt: 'Who owns business continuity?', options: ['Everyone, led by BC coordinators', 'Only IT', 'Only HR'], correct: 0 },
      { prompt: 'Where are continuity plans stored?', options: ['Canvas → Our Policies', 'A personal laptop', 'Nowhere'], correct: 0 },
    ],
  },
  {
    slug: 'enterprise-risk-management',
    title: 'Enterprise Risk Management',
    category: 'Enterprise Risk Management',
    color: '#7C3AED',
    summary: 'Anticipate risks and build SDLC.',
    storyboard: [
      { title: 'Identify Risks', body: 'Spot risks before they become incidents.' },
      { title: 'Assess & Prioritise', body: 'Rate risks by likelihood and impact.' },
      { title: 'Mitigate', body: 'Put controls in place and monitor them.' },
    ],
    questions: [
      { prompt: 'What is the goal of ERM?', options: ['Anticipate risks and build SDLC', 'Eliminate all work', 'Increase paperwork'], correct: 0 },
      { prompt: 'How are risks prioritised?', options: ['Likelihood × Impact', 'Alphabetically', 'By color'], correct: 0 },
      { prompt: 'What comes after identifying a risk?', options: ['Assess and mitigate it', 'Ignore it', 'Escalate to social media'], correct: 0 },
      { prompt: 'Who is responsible for managing risk?', options: ['Everyone in the organization', 'Only the CEO', 'Only interns'], correct: 0 },
      { prompt: 'What builds long-term SDLC?', options: ['Continuous monitoring & controls', 'One-off training', 'Luck'], correct: 0 },
    ],
  },
];

// Tournament question bank — categorized, difficulty-tiered questions that
// power tournament-only races (drawn randomly per the tournament's gameConfig).
// Option 0 is always the correct answer; options are shuffled per race lane.
const TOURNAMENT_QUESTIONS = [
  { category: 'Racing Knowledge', difficulty: 'EASY', prompt: 'What does the checkered flag mean in a race?', options: ['The race is finished', 'Slow down immediately', 'A pit stop is required'] },
  { category: 'Racing Knowledge', difficulty: 'EASY', prompt: 'How do you answer a question in the quiz race?', options: ['Steer into the lane with the correct answer', 'Honk the horn', 'Stop the kart'] },
  { category: 'Racing Knowledge', difficulty: 'EASY', prompt: 'What earns you stars during a race?', options: ['Correct answers', 'Driving fast', 'Skipping questions'] },
  { category: 'SDLC Fundamentals', difficulty: 'MEDIUM', prompt: 'What does SDLC stand for?', options: ['Software Development Life Cycle', 'Simple Data Loading Cycle', 'System Design Level Check'] },
  { category: 'SDLC Fundamentals', difficulty: 'MEDIUM', prompt: 'Which phase comes FIRST in the SDLC?', options: ['Requirements gathering', 'Deployment', 'Testing'] },
  { category: 'SDLC Fundamentals', difficulty: 'MEDIUM', prompt: 'What happens in the testing phase?', options: ['Defects are found and fixed', 'Code is first written', 'Servers are purchased'] },
  { category: 'SDLC Fundamentals', difficulty: 'MEDIUM', prompt: 'Which SDLC phase releases the product to users?', options: ['Deployment', 'Planning', 'Design'] },
  { category: 'Workplace Safety', difficulty: 'MEDIUM', prompt: 'Who should you alert first in a medical emergency at work?', options: ['The First Aider', 'Social media', 'Nobody'] },
  { category: 'Workplace Safety', difficulty: 'MEDIUM', prompt: 'Where do teams meet during an evacuation?', options: ['The assembly point', 'The cafeteria', 'The parking garage'] },
  { category: 'SDLC Fundamentals', difficulty: 'HARD', prompt: 'What is the purpose of a retrospective?', options: ['Learn and improve from the last cycle', 'Assign blame for failures', 'Extend project deadlines'] },
  { category: 'SDLC Fundamentals', difficulty: 'HARD', prompt: 'Which practice catches defects earliest?', options: ['Code review and early testing', 'Fixing bugs in production', 'Skipping QA to ship faster'] },
  { category: 'Workplace Safety', difficulty: 'HARD', prompt: 'What makes a business continuity plan strong?', options: ['Tested, documented recovery steps', 'A single printed copy', 'Optimism'] },
];

/** Default per-race gameplay config stamped on new tournaments (admin-editable). */
export const DEFAULT_TOURNAMENT_GAME_CONFIG = {
  questionCount: 5,
  categories: [] as string[], // empty = whole question bank
  difficulty: null as string | null, // null = all difficulties
  timerSec: 180,
  correctBonusSec: 10,
  laneCount: 3,
  xpPerQuestion: 20,
  passingScorePct: 60,
  maxStars: 5,
};

const RANK_DEFS = [
  {
    name: 'Bronze', tier: 1, minXp: 0, color: '#CD7F32',
    levels: [
      { level: 1, minXp: 0, maxXp: 250, title: 'Rookie I' },
      { level: 2, minXp: 250, maxXp: 500, title: 'Rookie II' },
      { level: 3, minXp: 500, maxXp: 750, title: 'Rookie III' },
    ],
  },
  {
    name: 'Silver', tier: 2, minXp: 750, color: '#C0C0C0',
    levels: [
      { level: 4, minXp: 750, maxXp: 1100, title: 'Driver I' },
      { level: 5, minXp: 1100, maxXp: 1450, title: 'Driver II' },
      { level: 6, minXp: 1450, maxXp: 1750, title: 'Driver III' },
    ],
  },
  {
    name: 'Gold', tier: 3, minXp: 1750, color: '#FFD700',
    levels: [
      { level: 7, minXp: 1750, maxXp: 2300, title: 'Ace I' },
      { level: 8, minXp: 2300, maxXp: 2900, title: 'Ace II' },
      { level: 9, minXp: 2900, maxXp: 3500, title: 'Ace III' },
    ],
  },
  {
    name: 'Champion', tier: 4, minXp: 3500, color: '#22D3EE',
    levels: [{ level: 10, minXp: 3500, maxXp: null, title: 'Champion' }],
  },
];

const BADGES = [
  { code: 'FIRST_MISSION', name: 'First Mission', criteria: { type: 'FIRST_MISSION' } },
  { code: 'PERFECT_SCORE', name: 'Perfect Score', criteria: { type: 'PERFECT_SCORE' } },
  { code: 'FAST_LEARNER', name: 'Fast Learner', criteria: { type: 'FAST_LEARNER', minTimeRemaining: 60 } },
  { code: 'GOLD_CHAMPION', name: 'Gold Champion', criteria: { type: 'GOLD_CHAMPION' } },
  { code: 'SAFETY_CHAMPION', name: 'Safety Champion', criteria: { type: 'CUSTOM' } },
  { code: 'EMERGENCY_EXPERT', name: 'Emergency Expert', criteria: { type: 'CUSTOM' } },
  { code: 'BUSINESS_CONTINUITY_MASTER', name: 'Business Continuity Master', criteria: { type: 'CUSTOM' } },
  { code: 'RISK_MANAGEMENT_EXPERT', name: 'Risk Management Expert', criteria: { type: 'CUSTOM' } },
];

/** True when the org already has playable content (a published bundle). */
export async function hasGameContent(organizationId: string) {
  const count = await MissionBundle.count({ where: { organizationId, isPublished: true } });
  return count > 0;
}

/**
 * Make sure the org has the tournament question bank (idempotent by prompt).
 * Kept separate from ensureDefaultGameContent so it can also backfill orgs
 * that were provisioned before tournaments had their own question pools.
 */
export async function ensureTournamentQuestionBank(organizationId: string) {
  for (const qDef of TOURNAMENT_QUESTIONS) {
    const [question, created] = await Question.findOrCreate({
      where: { organizationId, prompt: qDef.prompt },
      defaults: {
        organizationId,
        type: 'SINGLE_CHOICE',
        prompt: qDef.prompt,
        category: qDef.category,
        difficulty: qDef.difficulty,
        points: 10,
        explanation: `Correct: ${qDef.options[0]}`,
      },
    });
    if (created) {
      for (let o = 0; o < qDef.options.length; o++) {
        await QuestionOption.create({ questionId: (question as any).id, label: qDef.options[o], isCorrect: o === 0, orderIndex: o });
      }
    }
  }
}

/**
 * Make sure the org has the demo "SDLC Quest Roadmap" COURSE — the LMS-style
 * learning roadmap that REFERENCES the seeded pillar bundle, its missions and
 * the weekly tournament (courses select existing content; they never own it).
 * Idempotent by natural keys, and kept standalone so re-seeding an org that was
 * provisioned before course roadmaps existed still backfills it.
 */
export async function ensureRoadmapCourse(organizationId: string) {
  const bundle: any = await MissionBundle.findOne({ where: { organizationId, slug: 'SDLC-quest' } });
  const missions: any[] = await Mission.findAll({
    where: { organizationId, slug: PILLARS.map((p) => p.slug) },
    order: [['order_index', 'ASC']],
  });
  const tournament: any = await Tournament.findOne({ where: { organizationId, name: 'Weekly Learning Challenge' } });
  const certTpl: any = await CertificateTemplate.findOne({ where: { organizationId, name: 'SDLC  Champion' } });
  if (!bundle && missions.length === 0 && !tournament) return; // org has no seeded content to reference

  const [courseRow] = await Course.findOrCreate({
    where: { organizationId, slug: 'sdlc-quest-roadmap' },
    defaults: {
      organizationId,
      title: 'SDLC Quest Roadmap',
      slug: 'sdlc-quest-roadmap',
      summary: 'The complete SDLC Quest journey: race every pillar mission, finish the quest bundle and compete in the weekly tournament.',
      category: 'SDLC',
      difficulty: 'MEDIUM',
      estimatedMin: 45,
      certificateTemplateId: certTpl ? certTpl.id : null,
      isPublished: true,
      orderIndex: 0,
    },
  });
  const courseId = (courseRow as any).id;

  for (let i = 0; i < missions.length; i++) {
    await CourseMission.findOrCreate({
      where: { courseId, missionId: missions[i].id },
      defaults: { courseId, missionId: missions[i].id, orderIndex: i },
    });
  }
  if (bundle) {
    await CourseBundle.findOrCreate({
      where: { courseId, missionBundleId: bundle.id },
      defaults: { courseId, missionBundleId: bundle.id, orderIndex: 0 },
    });
  }
  if (tournament) {
    await CourseTournament.findOrCreate({
      where: { courseId, tournamentId: tournament.id },
      defaults: { courseId, tournamentId: tournament.id, orderIndex: 0 },
    });
  }
}

/**
 * Provision the full default game content for an organization. Idempotent —
 * safe to call on every signup / hub load; returns false immediately when the
 * org already has a published bundle.
 */
export async function ensureDefaultGameContent(organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  if (await hasGameContent(organizationId)) return false;

  // Avatars & accessories
  for (let i = 0; i < AVATARS.length; i++) {
    await Avatar.findOrCreate({ where: { organizationId, key: AVATARS[i].key }, defaults: { organizationId, orderIndex: i, ...AVATARS[i] } });
  }
  const accessoryMap: Record<string, string> = {};
  for (let i = 0; i < ACCESSORIES.length; i++) {
    const [a] = await Accessory.findOrCreate({ where: { organizationId, key: ACCESSORIES[i].key }, defaults: { organizationId, orderIndex: i, ...ACCESSORIES[i] } });
    accessoryMap[ACCESSORIES[i].key] = (a as any).id;
  }

  // Reward shop — spend earned coins/stars on kart gear and real-world perks.
  const shopDefs: any[] = [
    { kind: 'ACCESSORY', name: 'Neon Wings', description: 'Glowing wings for your kart', priceCoins: 150, priceStars: 0, targetId: accessoryMap['neon_wings'] },
    { kind: 'ACCESSORY', name: 'Victory Trail', description: 'Leave a sparkling trail behind you', priceCoins: 250, priceStars: 3, targetId: accessoryMap['victory_trail'] },
    { kind: 'COUPON', name: 'Coffee Voucher', description: 'A free coffee at the office café', priceCoins: 100, priceStars: 0 },
    { kind: 'COMPANY_REWARD', name: 'Half-Day Off', description: 'Redeem a half day of leave (admin approval)', priceCoins: 500, priceStars: 10, stock: 5 },
    { kind: 'TITLE', name: 'Legend Title', description: 'Show the "Legend" title on leaderboards', priceCoins: 300, priceStars: 5 },
  ];
  for (const s of shopDefs) {
    if (s.kind === 'ACCESSORY' && !s.targetId) continue;
    await ShopItem.findOrCreate({ where: { organizationId, name: s.name }, defaults: { organizationId, isActive: true, ...s } });
  }

  // Ranks, each containing its levels with XP bands [minXp, maxXp).
  for (const r of RANK_DEFS) {
    const [rankRow] = await Rank.findOrCreate({
      where: { organizationId, tier: r.tier },
      defaults: { organizationId, name: r.name, tier: r.tier, minXp: r.minXp, color: r.color },
    });
    for (const lv of r.levels) {
      const [lvlRow, createdLvl] = await Level.findOrCreate({
        where: { organizationId, level: lv.level },
        defaults: { organizationId, rankId: (rankRow as any).id, level: lv.level, minXp: lv.minXp, maxXp: lv.maxXp, title: lv.title },
      });
      if (!createdLvl) {
        await lvlRow.update({ rankId: (rankRow as any).id, minXp: lv.minXp, maxXp: lv.maxXp, title: lv.title });
      }
    }
  }

  // Badges (auto-grant criteria)
  const badgeMap: Record<string, string> = {};
  for (const b of BADGES) {
    const [row] = await Badge.findOrCreate({ where: { organizationId, code: b.code }, defaults: { organizationId, isAutoGranted: true, ...b } });
    badgeMap[b.code] = (row as any).id;
  }

  // Leaderboards (XP + STARS, org-wide, all-time)
  await Leaderboard.findOrCreate({ where: { organizationId, name: 'Org XP Leaders' }, defaults: { organizationId, name: 'Org XP Leaders', scope: 'ORGANIZATION', period: 'ALL_TIME', metric: 'XP' } });
  await Leaderboard.findOrCreate({ where: { organizationId, name: 'Org Star Leaders' }, defaults: { organizationId, name: 'Org Star Leaders', scope: 'ORGANIZATION', period: 'ALL_TIME', metric: 'STARS' } });

  // Certificate template
  const [certTpl] = await CertificateTemplate.findOrCreate({
    where: { organizationId, name: 'SDLC  Champion' },
    defaults: {
      organizationId,
      name: 'SDLC  Champion',
      layout: { title: 'SDLC  Champion', fields: ['recipient', 'issuedAt', 'stars'], accent: '#22D3EE' },
    },
  });

  // Starred weekly tournament — a real, time-boxed competition with its own
  // race configuration (question pool draw, timer, lanes) and placement prizes.
  await Tournament.findOrCreate({
    where: { organizationId, name: 'Weekly Learning Challenge' },
    defaults: {
      organizationId,
      name: 'Weekly Learning Challenge',
      description: 'Race the tournament track and earn the most XP this week!',
      type: 'WEEKLY_CHALLENGE',
      status: 'ACTIVE',
      metric: 'XP',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      starReward: 10,
      maxStars: 30,
      rewardConfig: { '1': { xp: 500, coins: 200 }, '2': { xp: 300 }, '3': { xp: 150 } },
      gameConfig: DEFAULT_TOURNAMENT_GAME_CONFIG,
    },
  });

  // Tournament question bank (categorized + difficulty-tiered).
  await ensureTournamentQuestionBank(organizationId);

  // ── SDLC Quest bundle: three pillars, storyboards, lane questions ──
  const [bundle] = await MissionBundle.findOrCreate({
    where: { organizationId, slug: 'SDLC-quest' },
    defaults: {
      organizationId,
      title: 'SDLC  Quest',
      slug: 'SDLC-quest',
      description: 'Complete all three pillars to become a SDLC  Champion.',
      xpReward: 500,
      starReward: 15,
      maxStars: 15, // 3 pillars × 5 stars
      badgeId: badgeMap['GOLD_CHAMPION'],
      certificateTemplateId: (certTpl as any).id,
      isPublished: true,
      orderIndex: 0,
    },
  });
  const bundleId = (bundle as any).id;

  for (let i = 0; i < PILLARS.length; i++) {
    const pillar = PILLARS[i];

    const [course] = await Course.findOrCreate({
      where: { organizationId, slug: pillar.slug },
      defaults: {
        organizationId,
        title: pillar.title,
        slug: pillar.slug,
        summary: pillar.summary,
        category: pillar.category,
        color: pillar.color,
        isPublished: true,
        orderIndex: i,
      },
    });
    const courseId = (course as any).id;
    for (let s = 0; s < pillar.storyboard.length; s++) {
      const step = pillar.storyboard[s] as any;
      await ContentBlock.findOrCreate({
        where: { courseId, title: step.title },
        defaults: { courseId, type: 'SLIDE', title: step.title, body: step.body, config: step.config ?? null, orderIndex: s },
      });
    }

    const [mission] = await Mission.findOrCreate({
      where: { organizationId, slug: pillar.slug },
      defaults: {
        organizationId,
        missionBundleId: bundleId,
        courseId,
        title: pillar.title,
        slug: pillar.slug,
        description: pillar.summary,
        difficulty: 'MEDIUM',
        timerSec: 300,
        correctBonusSec: 10,
        questionCount: 5,
        passingScorePct: 60,
        maxStars: 5,
        laneCount: 3,
        xpReward: 150,
        isPublished: true,
        orderIndex: i,
      },
    });
    const missionId = (mission as any).id;

    for (let q = 0; q < pillar.questions.length; q++) {
      const qDef = pillar.questions[q];
      const [question] = await Question.findOrCreate({
        where: { organizationId, prompt: qDef.prompt },
        defaults: { organizationId, type: 'SINGLE_CHOICE', prompt: qDef.prompt, category: pillar.category, points: 10, explanation: `Correct: ${qDef.options[qDef.correct]}` },
      });
      const questionId = (question as any).id;
      const existingOptions = await QuestionOption.count({ where: { questionId } });
      if (existingOptions === 0) {
        for (let o = 0; o < qDef.options.length; o++) {
          await QuestionOption.create({ questionId, label: qDef.options[o], isCorrect: o === qDef.correct, orderIndex: o });
        }
      }
      await MissionQuestion.findOrCreate({
        where: { missionId, questionId },
        defaults: { missionId, questionId, orderIndex: q, isPinned: q === 0 },
      });
    }

    // First pillar unlocks the Turbo Booster on correct answers.
    if (i === 0) {
      await MissionAccessoryReward.findOrCreate({
        where: { missionId, accessoryId: accessoryMap['turbo_booster'] },
        defaults: { missionId, accessoryId: accessoryMap['turbo_booster'], trigger: 'CORRECT_ANSWER', chancePct: 100 },
      });
    }
  }

  // The LMS-style demo roadmap course that references the content created above.
  await ensureRoadmapCourse(organizationId);

  return true;
}
