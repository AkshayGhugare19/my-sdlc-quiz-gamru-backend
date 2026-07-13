// Gamification models: Level, Rank, Badge, UserBadge, Achievement,
// XpTransaction, RewardRule, RewardGrant.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

// A Level belongs to a Rank (gamru-style): each level spans an XP band
// [minXp, maxXp). Ranks group several levels.
export class Level extends Model {
  declare id: string;
  declare organizationId: string;
  declare rankId: string | null;
  declare level: number;
  declare minXp: number;
  declare maxXp: number | null;
}
Level.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    rankId: { type: DataTypes.UUID, allowNull: true }, // parent rank
    level: { type: DataTypes.INTEGER, allowNull: false },
    minXp: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // XP start
    maxXp: { type: DataTypes.INTEGER, allowNull: true }, // XP end (null = open-ended top level)
    xpRequired: { type: DataTypes.INTEGER, allowNull: true }, // legacy; kept nullable
    title: DataTypes.STRING,
    perks: DataTypes.JSONB,
  },
  {
    sequelize,
    modelName: 'Level',
    tableName: 'levels',
    indexes: [{ unique: true, fields: ['organization_id', 'level'] }],
  },
);

export class Rank extends Model {
  declare id: string;
  declare organizationId: string;
  declare name: string;
  declare tier: number;
  declare minXp: number;
}
Rank.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    tier: { type: DataTypes.INTEGER, allowNull: false },
    minXp: { type: DataTypes.INTEGER, allowNull: false },
    iconUrl: DataTypes.STRING,
    color: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: 'Rank',
    tableName: 'ranks',
    indexes: [{ unique: true, fields: ['organization_id', 'tier'] }],
  },
);

export class Badge extends Model {
  declare id: string;
  declare organizationId: string;
  declare code: string;
  declare criteria: any;
  declare isAutoGranted: boolean;
}
Badge.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false }, // FIRST_MISSION, PERFECT_SCORE…
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    iconUrl: DataTypes.STRING,
    criteria: DataTypes.JSONB,
    isAutoGranted: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    modelName: 'Badge',
    tableName: 'badges',
    indexes: [{ unique: true, fields: ['organization_id', 'code'] }],
  },
);

export class UserBadge extends Model {
  declare userId: string;
  declare badgeId: string;
}
UserBadge.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    badgeId: { type: DataTypes.UUID, allowNull: false },
    awardedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    context: DataTypes.JSONB,
  },
  {
    sequelize,
    modelName: 'UserBadge',
    tableName: 'user_badges',
    indexes: [{ unique: true, fields: ['user_id', 'badge_id'] }],
  },
);

export class Achievement extends Model {}
Achievement.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    iconUrl: DataTypes.STRING,
    criteria: DataTypes.JSONB,
    xpReward: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Achievement',
    tableName: 'achievements',
    indexes: [{ unique: true, fields: ['organization_id', 'code'] }],
  },
);

export class XpTransaction extends Model {
  declare userId: string;
  declare amount: number;
  declare balanceAfter: number;
  declare source: string;
}
XpTransaction.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false }, // signed
    balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
    source: { type: DataTypes.STRING, allowNull: false }, // MISSION_COMPLETE, CORRECT_ANSWER…
    refType: DataTypes.STRING,
    refId: DataTypes.UUID,
    note: DataTypes.STRING,
  },
  { sequelize, modelName: 'XpTransaction', tableName: 'xp_transactions' },
);

export class RewardRule extends Model {
  declare organizationId: string;
  declare type: string;
  declare refType: string;
  declare amount: number;
  declare targetId: string | null;
  declare condition: any;
}
RewardRule.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false }, // XP|COINS|STARS|BADGE|ACCESSORY|CERTIFICATE…
    amount: { type: DataTypes.INTEGER, defaultValue: 0 },
    refType: { type: DataTypes.STRING, allowNull: false }, // MISSION|MISSION_BUNDLE|TOURNAMENT
    missionId: DataTypes.UUID,
    missionBundleId: DataTypes.UUID,
    targetId: DataTypes.UUID,
    condition: DataTypes.JSONB,
  },
  { sequelize, modelName: 'RewardRule', tableName: 'reward_rules' },
);

export class RewardGrant extends Model {
  declare userId: string;
  declare type: string;
  declare amount: number;
}
RewardGrant.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.INTEGER, defaultValue: 0 },
    targetId: DataTypes.UUID,
    sourceType: DataTypes.STRING,
    sourceId: DataTypes.UUID,
    meta: DataTypes.JSONB,
  },
  { sequelize, modelName: 'RewardGrant', tableName: 'reward_grants' },
);
