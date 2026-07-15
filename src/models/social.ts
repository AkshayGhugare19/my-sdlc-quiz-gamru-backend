// Competition & recognition: Leaderboard(+Entry), Tournament(+Entry),
// CertificateTemplate, IssuedCertificate.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class Leaderboard extends Model {
  declare id: string;
  declare organizationId: string;
  declare scope: string;
  declare period: string;
  declare metric: string;
}
Leaderboard.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    scope: { type: DataTypes.STRING, defaultValue: 'ORGANIZATION' }, // GLOBAL|ORGANIZATION|DEPARTMENT|TOURNAMENT
    period: { type: DataTypes.STRING, defaultValue: 'ALL_TIME' }, // ALL_TIME|SEASON|MONTHLY|WEEKLY|DAILY
    metric: { type: DataTypes.STRING, defaultValue: 'XP' }, // XP|STARS|SPEED|SCORE
    departmentId: DataTypes.UUID,
    tournamentId: DataTypes.UUID,
    periodKey: DataTypes.STRING, // e.g. "2026-W28"
  },
  { sequelize, modelName: 'Leaderboard', tableName: 'leaderboards' },
);

export class LeaderboardEntry extends Model {
  declare leaderboardId: string;
  declare userId: string;
  declare score: number;
  declare rank: number | null;
}
LeaderboardEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leaderboardId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    rank: DataTypes.INTEGER,
    meta: DataTypes.JSONB,
  },
  {
    sequelize,
    modelName: 'LeaderboardEntry',
    tableName: 'leaderboard_entries',
    indexes: [{ unique: true, fields: ['leaderboard_id', 'user_id'] }],
  },
);

export class Tournament extends Model {
  declare id: string;
  declare organizationId: string;
  declare type: string;
  declare status: string;
  declare metric: string;
  declare starReward: number;
  declare maxStars: number;
  declare rewardConfig: any;
  declare gameConfig: any;
}
Tournament.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    type: { type: DataTypes.STRING, allowNull: false }, // WEEKLY_CHALLENGE|MONTHLY_CHALLENGE|…
    status: { type: DataTypes.STRING, defaultValue: 'DRAFT' }, // DRAFT|SCHEDULED|ACTIVE|COMPLETED|CANCELLED
    metric: { type: DataTypes.STRING, defaultValue: 'XP' }, // XP|SCORE|SPEED|STARS
    departmentId: DataTypes.UUID,
    missionBundleId: DataTypes.UUID,
    learningPathId: DataTypes.UUID, // optional storyboard path (LearningPath.type = TOURNAMENT)
    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,
    rewardConfig: DataTypes.JSONB, // { "1": {xp, badgeId, coins}, ... }
    // How the tournament's OWN races play (admin-configured): questionCount,
    // categories[], difficulty, timerSec, correctBonusSec, laneCount,
    // xpPerQuestion, passingScorePct, maxStars. Missing keys fall back to
    // engine defaults, so a bare tournament is always playable.
    gameConfig: DataTypes.JSONB,
    starReward: { type: DataTypes.INTEGER, defaultValue: 0 },
    maxStars: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'Tournament', tableName: 'tournaments' },
);

export class TournamentEntry extends Model {
  declare tournamentId: string;
  declare userId: string;
  declare score: number;
  declare starsEarned: number;
  declare placement: number | null;
}
TournamentEntry.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tournamentId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    score: { type: DataTypes.INTEGER, defaultValue: 0 },
    starsEarned: { type: DataTypes.INTEGER, defaultValue: 0 },
    placement: DataTypes.INTEGER,
    joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    modelName: 'TournamentEntry',
    tableName: 'tournament_entries',
    indexes: [{ unique: true, fields: ['tournament_id', 'user_id'] }],
  },
);

export class CertificateTemplate extends Model {
  declare id: string;
  declare organizationId: string;
  declare layout: any;
}
CertificateTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    layout: { type: DataTypes.JSONB, allowNull: false },
    backgroundUrl: DataTypes.STRING,
  },
  { sequelize, modelName: 'CertificateTemplate', tableName: 'certificate_templates' },
);

export class IssuedCertificate extends Model {
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare templateId: string;
  declare serial: string;
}
IssuedCertificate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    templateId: { type: DataTypes.UUID, allowNull: false },
    serial: { type: DataTypes.STRING, allowNull: false, unique: true },
    sourceType: DataTypes.STRING, // MISSION_BUNDLE|LEARNING_PATH
    sourceId: DataTypes.UUID,
    pdfUrl: DataTypes.STRING,
    data: DataTypes.JSONB,
    issuedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, modelName: 'IssuedCertificate', tableName: 'issued_certificates' },
);
