import http from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { assertDbConnection } from './config/db';
import './models'; // initialise models + associations
import { initSocket } from './realtime/socket';
import { registerEventHandlers } from './events/registerHandlers';
import { startKeepAliveCron, stopKeepAliveCron } from './cron/keepAlive.cron';

async function bootstrap() {
  await assertDbConnection();
  registerEventHandlers();

  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(env.port, () => {
    logger.info(`Gamru  API listening on ${env.publicUrl} (port ${env.port})`);
    startKeepAliveCron();
  });

  const shutdown = async () => {
    logger.info('Shutting down…');
    stopKeepAliveCron();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
