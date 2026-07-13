/* eslint-disable no-console */
// Backfill for organizations provisioned before tournaments had their own
// gameplay: gives every org the tournament question bank, and stamps default
// start/end dates + gameConfig onto tournaments that are missing them.
// Run once with: npx ts-node --transpile-only src/scripts/backfillTournaments.ts
import { sequelize } from '../config/db';
import '../models';
import { Organization, Tournament } from '../models';
import { ensureTournamentQuestionBank, DEFAULT_TOURNAMENT_GAME_CONFIG } from '../engines/defaultContent.engine';

async function run() {
  await sequelize.authenticate();
  const orgs: any[] = await Organization.findAll({ attributes: ['id', 'name'] });

  for (const org of orgs) {
    await ensureTournamentQuestionBank(org.id);
    const tournaments: any[] = await Tournament.findAll({ where: { organizationId: org.id } });
    for (const t of tournaments) {
      const patch: any = {};
      if (!t.gameConfig) patch.gameConfig = DEFAULT_TOURNAMENT_GAME_CONFIG;
      if (!t.startsAt) patch.startsAt = new Date();
      if (!t.endsAt) patch.endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (Object.keys(patch).length) await t.update(patch);
    }
    console.log(`✓ ${org.name}: question bank ensured, ${tournaments.length} tournament(s) checked`);
  }

  await sequelize.close();
  console.log('✅ Backfill complete.');
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
