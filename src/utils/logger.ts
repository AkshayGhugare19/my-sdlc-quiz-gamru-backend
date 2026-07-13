import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.logLevel,
  transport: env.isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss',
          ignore: 'pid,hostname,req,res,responseTime',
        },
      },
});
