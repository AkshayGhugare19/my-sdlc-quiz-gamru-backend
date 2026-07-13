// CommonJS config consumed by sequelize-cli (migrations/seeders runner).
// Reads the same DB_* env vars the app uses.
require('dotenv').config();

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'e-learingrace',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  dialectOptions:
    process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};

module.exports = {
  development: common,
  test: { ...common, database: `${common.database}_test` },
  production: common,
};
