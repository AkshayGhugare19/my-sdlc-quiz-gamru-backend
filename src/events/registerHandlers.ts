// Wire domain events to side effects (notifications, audit). Engines emit; these
// handlers react — keeping cross-cutting concerns decoupled (gamru pattern).
import { eventBus } from './eventBus';
import { EVENTS } from './events';
import { Notification } from '../models';
import { logger } from '../utils/logger';

async function notify(userId: string, organizationId: string, title: string, body?: string, data?: any) {
  try {
    await Notification.create({ userId, organizationId, title, body, data, status: 'SENT' });
  } catch (err) {
    logger.error({ err }, 'failed to create notification');
  }
}

export function registerEventHandlers() {
  eventBus.on(EVENTS.BADGE_AWARDED, (p: any) =>
    notify(p.userId, p.organizationId, 'New badge earned!', `You unlocked the "${p.code}" badge.`, p),
  );
  eventBus.on(EVENTS.LEVEL_UP, (p: any) =>
    notify(p.userId, p.organizationId, 'Level up!', `You reached level ${p.level}.`, p),
  );
  eventBus.on(EVENTS.RANK_UP, (p: any) =>
    notify(p.userId, p.organizationId, 'Rank up!', `You are now ${p.rank}.`, p),
  );
  eventBus.on(EVENTS.CERTIFICATE_ISSUED, (p: any) =>
    notify(p.userId, p.organizationId, 'Certificate issued', `Certificate ${p.serial} is ready.`, p),
  );
  eventBus.on(EVENTS.BUNDLE_COMPLETED, (p: any) =>
    notify(p.userId, p.organizationId, 'Pillar bundle complete!', 'You are one step closer to SDLC  Champion.', p),
  );

  logger.info('Event handlers registered');
}
