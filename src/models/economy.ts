// Avatar / accessory / garage / shop models.
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class Avatar extends Model {
  declare id: string;
  declare organizationId: string;
  declare key: string;
  declare isDefault: boolean;
}
Avatar.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false }, // maya|omar|james|ava|alex|aya
    name: { type: DataTypes.STRING, allowNull: false },
    portraitUrl: DataTypes.STRING,
    spriteUrl: DataTypes.STRING,
    config: DataTypes.JSONB, // { hair, face, skin, outfit, helmet, animations }
    isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Avatar',
    tableName: 'avatars',
    indexes: [{ unique: true, fields: ['organization_id', 'key'] }],
  },
);

export class PlayerAvatar extends Model {
  declare userId: string;
  declare avatarId: string;
  declare equipped: any;
}
PlayerAvatar.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    avatarId: { type: DataTypes.UUID, allowNull: false },
    equipped: { type: DataTypes.JSONB, defaultValue: {} }, // accessory per slot
    customization: { type: DataTypes.JSONB, defaultValue: {} },
  },
  { sequelize, modelName: 'PlayerAvatar', tableName: 'player_avatars' },
);

export class Accessory extends Model {
  declare id: string;
  declare organizationId: string;
  declare key: string;
  declare slot: string;
  declare unlockType: string;
}
Accessory.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    key: { type: DataTypes.STRING, allowNull: false }, // turbo_booster, neon_wings…
    name: { type: DataTypes.STRING, allowNull: false },
    slot: { type: DataTypes.STRING, allowNull: false }, // EXHAUST|WINGS|BOOST|BLADE|HELMET|TRAIL|BODY|SPECIAL
    rarity: { type: DataTypes.STRING, defaultValue: 'common' },
    iconUrl: DataTypes.STRING,
    spriteUrl: DataTypes.STRING,
    unlockType: { type: DataTypes.STRING, defaultValue: 'REWARD' }, // REWARD|SHOP|DEFAULT
    shopPriceCoins: DataTypes.INTEGER,
    config: DataTypes.JSONB,
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Accessory',
    tableName: 'accessories',
    indexes: [{ unique: true, fields: ['organization_id', 'key'] }],
  },
);

export class GarageItem extends Model {
  declare userId: string;
  declare accessoryId: string;
  declare isEquipped: boolean;
}
GarageItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    accessoryId: { type: DataTypes.UUID, allowNull: false },
    unlockedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    source: DataTypes.STRING, // MISSION|SHOP|SEED
    isEquipped: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'GarageItem',
    tableName: 'garage_items',
    indexes: [{ unique: true, fields: ['user_id', 'accessory_id'] }],
  },
);

export class MissionAccessoryReward extends Model {
  declare missionId: string;
  declare accessoryId: string;
  declare trigger: string;
  declare chancePct: number;
}
MissionAccessoryReward.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    missionId: { type: DataTypes.UUID, allowNull: false },
    accessoryId: { type: DataTypes.UUID, allowNull: false },
    trigger: { type: DataTypes.STRING, defaultValue: 'CORRECT_ANSWER' }, // CORRECT_ANSWER|PERFECT|COMPLETE
    chancePct: { type: DataTypes.INTEGER, defaultValue: 100 },
  },
  {
    sequelize,
    modelName: 'MissionAccessoryReward',
    tableName: 'mission_accessory_rewards',
    indexes: [{ unique: true, fields: ['mission_id', 'accessory_id'] }],
  },
);

export class ShopItem extends Model {
  declare id: string;
  declare organizationId: string;
  declare kind: string;
  declare priceCoins: number;
  declare priceStars: number;
}
ShopItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING, allowNull: false }, // ACCESSORY|COUPON|TITLE|COMPANY_REWARD|BADGE|CUSTOM
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    imageUrl: DataTypes.STRING,
    priceCoins: { type: DataTypes.INTEGER, defaultValue: 0 },
    priceStars: { type: DataTypes.INTEGER, defaultValue: 0 },
    stock: DataTypes.INTEGER,
    targetId: DataTypes.UUID,
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { sequelize, modelName: 'ShopItem', tableName: 'shop_items' },
);

export class ShopOrder extends Model {
  declare userId: string;
  declare shopItemId: string;
  declare status: string;
}
ShopOrder.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    shopItemId: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'PENDING' }, // PENDING|FULFILLED|CANCELLED|REFUNDED
    paidCoins: { type: DataTypes.INTEGER, defaultValue: 0 },
    paidStars: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'ShopOrder', tableName: 'shop_orders' },
);
