// Tenancy & identity models: Organization, Department, User, RefreshToken,
// AuthHandoffCode.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class Organization extends Model {
  declare id: string;
  declare name: string;
  declare slug: string;
  declare status: string;
}
Organization.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.STRING, defaultValue: 'TRIAL' }, // ACTIVE|SUSPENDED|TRIAL|ARCHIVED
    logoUrl: DataTypes.STRING,
    primaryColor: { type: DataTypes.STRING, defaultValue: '#0B3D91' },
    accentColor: { type: DataTypes.STRING, defaultValue: '#22D3EE' },
    theme: DataTypes.JSONB,
    plan: { type: DataTypes.STRING, defaultValue: 'standard' },
    seatLimit: DataTypes.INTEGER,
    timezone: { type: DataTypes.STRING, defaultValue: 'UTC' },
    locale: { type: DataTypes.STRING, defaultValue: 'en' },
  },
  { sequelize, modelName: 'Organization', tableName: 'organizations' },
);

export class Department extends Model {
  declare id: string;
  declare organizationId: string;
}
Department.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    code: DataTypes.STRING,
    parentId: DataTypes.UUID,
    managerId: DataTypes.UUID,
  },
  { sequelize, modelName: 'Department', tableName: 'departments' },
);

export class User extends Model {
  declare id: string;
  declare organizationId: string | null;
  declare email: string;
  declare role: string;
  declare passwordHash: string | null;
  declare totalXp: number;
  declare coins: number;
  declare stars: number;
  declare currentLevel: number;
}
User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: true },
    departmentId: { type: DataTypes.UUID, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false },
    passwordHash: DataTypes.STRING,
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    displayName: DataTypes.STRING,
    avatarUrl: DataTypes.STRING,
    role: { type: DataTypes.STRING, defaultValue: 'EMPLOYEE' },
    status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' }, // INVITED|ACTIVE|DISABLED
    jobTitle: DataTypes.STRING,
    locale: DataTypes.STRING,
    lastLoginAt: DataTypes.DATE,
    // Denormalised fast-read counters (ledgers are the source of truth)
    totalXp: { type: DataTypes.INTEGER, defaultValue: 0 },
    coins: { type: DataTypes.INTEGER, defaultValue: 0 },
    stars: { type: DataTypes.INTEGER, defaultValue: 0 },
    currentLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    indexes: [{ unique: true, fields: ['organization_id', 'email'] }],
  },
);

export class RefreshToken extends Model {}
RefreshToken.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: DataTypes.DATE,
    userAgent: DataTypes.STRING,
    ip: DataTypes.STRING,
  },
  { sequelize, modelName: 'RefreshToken', tableName: 'refresh_tokens' },
);

// One-time, short-lived code that carries a signed-in session across an origin
// boundary — the website mints one, puts it in the embedded Unity client's
// iframe URL, and the game exchanges it for its own tokens. Only the SHA-256
// hash is stored (same treatment as RefreshToken), so the DB never holds a
// usable code, and `consumedAt` makes redemption strictly single-use.
export class AuthHandoffCode extends Model {
  declare id: string;
  declare userId: string;
  declare organizationId: string | null;
  declare codeHash: string;
  declare expiresAt: Date;
  declare consumedAt: Date | null;
}
AuthHandoffCode.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    organizationId: { type: DataTypes.UUID, allowNull: true },
    codeHash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    consumedAt: DataTypes.DATE,
    // Who asked for the code…
    ip: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    // …and who redeemed it (audit trail for a stolen-code investigation).
    consumedIp: DataTypes.STRING,
    consumedUserAgent: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: 'AuthHandoffCode',
    tableName: 'auth_handoff_codes',
    indexes: [{ fields: ['user_id'] }, { fields: ['expires_at'] }],
  },
);
