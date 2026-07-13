// Pluggable job queue. Default 'inline' runs jobs immediately in-process (no
// Redis needed — great for local dev without Docker). Set QUEUE_DRIVER=bullmq
// to offload to BullMQ workers backed by Redis for horizontal scale.
import { env } from '../config/env';
import { logger } from '../utils/logger';

export type JobHandler = (data: any) => Promise<void> | void;

interface Queue {
  register(name: string, handler: JobHandler): void;
  add(name: string, data: any): Promise<void>;
}

class InlineQueue implements Queue {
  private handlers = new Map<string, JobHandler>();
  register(name: string, handler: JobHandler) {
    this.handlers.set(name, handler);
  }
  async add(name: string, data: any) {
    const handler = this.handlers.get(name);
    if (!handler) return;
    try {
      await handler(data);
    } catch (err) {
      logger.error({ err, job: name }, 'inline job failed');
    }
  }
}

// BullMQ implementation is created lazily so the dependency/Redis is only
// touched when explicitly enabled.
class BullQueue implements Queue {
  private queues = new Map<string, any>();
  private connection: any;
  private BullMQ: any;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    this.BullMQ = require('bullmq');
    const IORedis = require('ioredis');
    this.connection = new IORedis(env.queue.redisUrl, { maxRetriesPerRequest: null });
  }
  register(name: string, handler: JobHandler) {
    new this.BullMQ.Worker(name, async (job: any) => handler(job.data), { connection: this.connection });
  }
  private queueFor(name: string) {
    if (!this.queues.has(name)) {
      this.queues.set(name, new this.BullMQ.Queue(name, { connection: this.connection }));
    }
    return this.queues.get(name);
  }
  async add(name: string, data: any) {
    await this.queueFor(name).add(name, data);
  }
}

export const queue: Queue = env.queue.driver === 'bullmq' ? new BullQueue() : new InlineQueue();

logger.info(`Queue driver: ${env.queue.driver}`);
