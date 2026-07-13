// Dev convenience: create all tables from the Sequelize models in one shot
// (alternative to running the sequelize-cli migrations). Use `npm run db:sync`.
// Production should use `npm run db:migrate` (the numbered migration files).
import { sequelize } from '../config/db';
import '../models';
import { logger } from '../utils/logger';

async function run() {
  const alter = process.argv.includes('--alter');
  await sequelize.sync({ alter });
  logger.info(`Schema synced (${alter ? 'alter' : 'create-if-missing'} mode)`);
  await sequelize.close();
}

run().catch((err) => {
  logger.error({ err }, 'sync failed');
  process.exit(1);
});
