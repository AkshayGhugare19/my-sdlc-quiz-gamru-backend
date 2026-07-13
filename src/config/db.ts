// Single Sequelize connection (row-level multi-tenancy — one shared database).
// Discrete DB_* credentials, matching gamru's config/db.ts style.
// Global model defaults: snake_case columns + timestamps.
import { Sequelize } from 'sequelize';
import { env } from './env';
import { logger } from '../utils/logger';

export const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host: env.db.host,
  port: env.db.port,
  dialect: 'postgres',
  logging: env.isProd ? false : (msg) => logger.debug(msg),
  dialectOptions: env.db.ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: { max: 15, min: 0, acquire: 30000, idle: 10000 },
});

export async function assertDbConnection() {
  await sequelize.authenticate();
  logger.info(`Database connection established (${env.db.name}@${env.db.host}:${env.db.port})`);
}
