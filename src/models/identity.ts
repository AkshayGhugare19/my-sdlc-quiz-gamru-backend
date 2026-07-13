// Tenancy & identity models: Organization, Department, User, RefreshToken.
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
