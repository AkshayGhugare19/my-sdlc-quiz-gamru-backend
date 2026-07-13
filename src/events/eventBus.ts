// In-process event bus (gamru/sdlcgames pattern) that decouples engines.
// The XP engine, badge engine, leaderboard engine, notification engine and
// socket layer all subscribe here rather than calling each other directly.
import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger';

class EventBus extends EventEmitter {
  emitSafe(event: string, payload: unknown) {
    try {
      this.emit(event, payload);
    } catch (err) {
      logger.error({ err, event }, 'event handler failed');
    }
  }
}

export const eventBus = new EventBus();
eventBus.setMaxListeners(50);
