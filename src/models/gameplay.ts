// Gameplay models: MissionAttempt, GameSession, AnswerEvent, Progress.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class MissionAttempt extends Model {
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare missionId: string;
  declare status: string;
  declare correctCount: number;
  declare starsEarned: number;
  declare xpEarned: number;
  declare scorePct: number;
  declare rating: string;
  declare attemptNo: number;
  declare timeRemainingSec: number;
  declare questionsTotal: number;
}
MissionAttempt.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    missionId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'IN_PROGRESS' }, // IN_PROGRESS|PASSED|FAILED|ABANDONED
    questionsTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
    correctCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    starsEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
    xpEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
    timeRemainingSec: { type: DataTypes.INTEGER, defaultValue: 0 },
    scorePct: { type: DataTypes.INTEGER, defaultValue: 0 },
    rating: { type: DataTypes.STRING, defaultValue: 'NONE' }, // NONE|BRONZE|SILVER|GOLD|GOLD_CHAMPION
    attemptNo: { type: DataTypes.INTEGER, defaultValue: 1 },
    startedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    completedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'MissionAttempt', tableName: 'mission_attempts' },
);

export class GameSession extends Model {
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare missionId: string;
  declare missionBundleId: string | null;
  declare attemptId: string | null;
  declare status: string;
  declare serverSeed: string;
  declare questionOrder: string[];
  declare currentIndex: number;
  declare timeRemainingSec: number;
  declare starsEarned: number;
  declare correctCount: number;
  declare accessoriesUnlocked: string[];
  declare avatarId: string | null;
  declare tournamentId: string | null;
  declare expiresAt: Date;
}
GameSession.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    // Null for tournament-only races (they draw questions from the org bank
    // per the tournament's gameConfig instead of a mission's pool).
    missionId: { type: DataTypes.UUID, allowNull: true },
    // Set when the race was started FROM a mission bundle (pillar) — only these
    // sessions feed bundle progress; standalone mission races never do.
    missionBundleId: { type: DataTypes.UUID, allowNull: true },
    attemptId: { type: DataTypes.UUID, unique: true },
    avatarId: DataTypes.UUID,
    // Set when the race was started FOR a tournament — only these sessions
    // feed tournament scoring (normal races never do).
    tournamentId: DataTypes.UUID,
    status: { type: DataTypes.STRING, defaultValue: 'CREATED' }, // CREATED|ACTIVE|COMPLETED|EXPIRED|ABANDONED
    // Authoritative runtime state (server-side; the client is "dumb")
    serverSeed: { type: DataTypes.STRING, allowNull: false },
    questionOrder: { type: DataTypes.JSONB, defaultValue: [] },
    currentIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    timeRemainingSec: { type: DataTypes.INTEGER, allowNull: false },
    starsEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
    correctCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    accessoriesUnlocked: { type: DataTypes.JSONB, defaultValue: [] },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    startedAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'GameSession', tableName: 'game_sessions' },
);

export class AnswerEvent extends Model {
  declare id: string;
  declare gameSessionId: string;
  declare questionId: string;
  declare isCorrect: boolean;
  declare chosenLane: number | null;
}
AnswerEvent.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    gameSessionId: { type: DataTypes.UUID, allowNull: false },
    attemptId: DataTypes.UUID,
    questionId: { type: DataTypes.UUID, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false }, // raw client submission
    chosenLane: DataTypes.INTEGER,
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false },
    timeTakenMs: DataTypes.INTEGER,
    bonusSecAwarded: { type: DataTypes.INTEGER, defaultValue: 0 },
    starAwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: 'AnswerEvent', tableName: 'answer_events' },
);

export class Progress extends Model {
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare entityType: string;
  declare entityId: string;
  declare status: string;
  declare completionPct: number;
  declare starsEarned: number;
  declare bestScorePct: number;
  declare attempts: number;
}
Progress.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    entityType: { type: DataTypes.STRING, allowNull: false }, // MISSION|MISSION_BUNDLE|COURSE|LEARNING_PATH
    entityId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'AVAILABLE' }, // LOCKED|AVAILABLE|IN_PROGRESS|COMPLETED
    completionPct: { type: DataTypes.INTEGER, defaultValue: 0 },
    starsEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
    bestScorePct: { type: DataTypes.INTEGER, defaultValue: 0 },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    firstStartedAt: DataTypes.DATE,
    completedAt: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Progress',
    tableName: 'progress',
    indexes: [{ unique: true, fields: ['user_id', 'entity_type', 'entity_id'] }],
  },
);
