// Fail-fast environment loader (gamru config/env pattern).
import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (val === undefined || val === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

function optional(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

const nodeEnv = optional('NODE_ENV', 'development');

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  logLevel: optional('LOG_LEVEL', 'info'),

  port: Number(optional('GAMRU_PORT', '4000')),
  publicUrl: optional('GAMRU_PUBLIC_URL', 'http://localhost:4000'),

  db: {
    host: optional('DB_HOST', 'localhost'),
    port: Number(optional('DB_PORT', '5432')),
    user: optional('DB_USER', 'postgres'),
    password: optional('DB_PASSWORD', 'root'),
    name: optional('DB_NAME', 'e-learingrace'),
    ssl: optional('DB_SSL', 'false') === 'true',
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: optional('JWT_ACCESS_TTL', '1d'),
    refreshTtl: optional('JWT_REFRESH_TTL', '30d'),
    gameSessionSecret: required('GAME_SESSION_SECRET', 'dev-game-session-secret'),
  },

  queue: {
    driver: optional('QUEUE_DRIVER', 'inline') as 'inline' | 'bullmq',
    redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  storage: {
    driver: optional('STORAGE_DRIVER', 'local') as 'local' | 's3',
    localDir: optional('LOCAL_UPLOAD_DIR', 'uploads'),
    s3: {
      endpoint: optional('S3_ENDPOINT', ''),
      region: optional('S3_REGION', 'us-east-1'),
      bucket: optional('S3_BUCKET', 'learning-media'),
      accessKey: optional('S3_ACCESS_KEY', ''),
      secretKey: optional('S3_SECRET_KEY', ''),
      forcePathStyle: optional('S3_FORCE_PATH_STYLE', 'false') === 'true',
      publicUrl: optional('S3_PUBLIC_URL', ''),
    },
  },

  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5273')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
