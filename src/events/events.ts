// Domain event names (gamru/sdlcgames event-bus pattern).
export const EVENTS = {
  ANSWER_RECORDED: 'answer.recorded',
  MISSION_STARTED: 'mission.started',
  MISSION_COMPLETED: 'mission.completed',
  BUNDLE_COMPLETED: 'bundle.completed',
  XP_AWARDED: 'xp.awarded',
  LEVEL_UP: 'level.up',
  RANK_UP: 'rank.up',
  BADGE_AWARDED: 'badge.awarded',
  ACCESSORY_UNLOCKED: 'accessory.unlocked',
  CERTIFICATE_ISSUED: 'certificate.issued',
  LEADERBOARD_UPDATED: 'leaderboard.updated',
  TOURNAMENT_SCORED: 'tournament.scored',
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
