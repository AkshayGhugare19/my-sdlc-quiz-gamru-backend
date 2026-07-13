import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { apiLimiter } from './middlewares/rateLimit.middleware';
import { notFoundHandler, errorHandler } from './middlewares/error.middleware';
import apiRoutes from './route';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, env.corsOrigins.length === 0);
      },
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: !env.isProd,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res, responseTime) =>
        `${req.method} ${req.url} → ${res.statusCode} (${responseTime}ms)`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.url} → ${res.statusCode} FAILED: ${err.message}`,
    }),
  );

  // Serve locally-stored uploads in dev (STORAGE_DRIVER=local).
  app.use('/uploads', express.static(path.resolve(process.cwd(), env.storage.localDir)));

  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'GamifiedLearning', time: new Date().toISOString() }));

  app.use('/api', apiLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
