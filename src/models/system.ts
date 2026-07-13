// Engagement & platform system: Campaign, Notification, OrgSetting,
// EmailTemplate, Webhook(+Delivery), AuditLog.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class Campaign extends Model {
  declare id: string;
  declare organizationId: string;
  declare status: string;
  declare channel: string;
}
Campaign.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    status: { type: DataTypes.STRING, defaultValue: 'DRAFT' }, // DRAFT|SCHEDULED|ACTIVE|PAUSED|COMPLETED
    channel: { type: DataTypes.STRING, defaultValue: 'IN_APP' }, // IN_APP|EMAIL|PUSH|WEBHOOK
    audience: DataTypes.JSONB, // { roles, departments, segments }
    content: DataTypes.JSONB, // { title, body, cta, imageUrl }
    scheduleAt: DataTypes.DATE,
    startsAt: DataTypes.DATE,
    endsAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Campaign', tableName: 'campaigns' },
);

export class Notification extends Model {
  declare id: string;
  declare organizationId: string;
  declare userId: string;
  declare status: string;
  declare channel: string;
}
Notification.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    channel: { type: DataTypes.STRING, defaultValue: 'IN_APP' },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING' }, // PENDING|SENT|READ|FAILED
    title: { type: DataTypes.STRING, allowNull: false },
    body: DataTypes.TEXT,
    data: DataTypes.JSONB,
    campaignId: DataTypes.UUID,
    readAt: DataTypes.DATE,
  },
  { sequelize, modelName: 'Notification', tableName: 'notifications' },
);

export class OrgSetting extends Model {
  declare organizationId: string;
  declare key: string;
  declare value: any;
}
OrgSetting.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    modelName: 'OrgSetting',
    tableName: 'org_settings',
    indexes: [{ unique: true, fields: ['organization_id', 'key'] }],
  },
);

export class EmailTemplate extends Model {
  declare organizationId: string;
  declare code: string;
}
EmailTemplate.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false }, // WELCOME|CERTIFICATE_ISSUED|TOURNAMENT_START
    subject: { type: DataTypes.STRING, allowNull: false },
    html: { type: DataTypes.TEXT, allowNull: false },
    variables: DataTypes.JSONB,
  },
  {
    sequelize,
    modelName: 'EmailTemplate',
    tableName: 'email_templates',
    indexes: [{ unique: true, fields: ['organization_id', 'code'] }],
  },
);

export class Webhook extends Model {
  declare id: string;
  declare organizationId: string;
  declare events: string[];
}
Webhook.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },
    secret: { type: DataTypes.STRING, allowNull: false },
    events: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'Webhook', tableName: 'webhooks' },
);

export class WebhookDelivery extends Model {}
WebhookDelivery.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    webhookId: { type: DataTypes.UUID, allowNull: false },
    event: { type: DataTypes.STRING, allowNull: false },
    payload: { type: DataTypes.JSONB, allowNull: false },
    statusCode: DataTypes.INTEGER,
    success: { type: DataTypes.BOOLEAN, defaultValue: false },
    attempts: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'WebhookDelivery', tableName: 'webhook_deliveries' },
);

export class AuditLog extends Model {
  declare organizationId: string | null;
  declare action: string;
}
AuditLog.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: DataTypes.UUID,
    actorId: DataTypes.UUID,
    actorRole: DataTypes.STRING,
    action: { type: DataTypes.STRING, allowNull: false }, // mission.create, user.login…
    entityType: DataTypes.STRING,
    entityId: DataTypes.UUID,
    ip: DataTypes.STRING,
    userAgent: DataTypes.STRING,
    metadata: DataTypes.JSONB,
  },
  { sequelize, modelName: 'AuditLog', tableName: 'audit_logs' },
);
