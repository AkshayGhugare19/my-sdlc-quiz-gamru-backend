// Keep-alive cron: self-pings GET /health every 5 minutes so free-tier hosts
// (e.g. Render) don't spin the instance down after inactivity.
// Base URL comes from GAMRU_PUBLIC_URL (env.publicUrl).
import { env } from '../config/env';
import { logger } from '../utils/logger';

const PING_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const HEALTH_URL = `${env.publicUrl.replace(/\/+$/, '')}/health`;

let timer: NodeJS.Timeout | null = null;

async function ping(): Promise<void> {
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), 30_000);
  try {
    console.log(`[keep-alive] pinging ${HEALTH_URL}`);
    const res = await fetch(HEALTH_URL, { method: 'GET', signal: controller.signal });
    logger.info(`[keep-alive] pinged ${HEALTH_URL} → ${res.status}`);
  } catch (err) {
    logger.warn({ err }, `[keep-alive] ping failed for ${HEALTH_URL}`);
  } finally {
    clearTimeout(abort);
  }
}

export function startKeepAliveCron(): void {
  if (timer) return; // already running

  timer = setInterval(() => void ping(), PING_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref(); // don't keep the process alive by itself
  logger.info(`[keep-alive] started — pinging ${HEALTH_URL} every ${PING_INTERVAL_MS / 60000} min`);
}

export function stopKeepAliveCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
