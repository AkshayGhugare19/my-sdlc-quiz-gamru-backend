// Learning content models: Media, Course, ContentBlock, LearningPath(+Item).
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class Media extends Model {
  declare id: string;
  declare organizationId: string;
}
Media.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false }, // VIDEO|PDF|IMAGE|SLIDE|DOCUMENT|AUDIO|SCORM|INTERACTIVE
    title: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    storageKey: { type: DataTypes.STRING, allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },
    mimeType: DataTypes.STRING,
    sizeBytes: DataTypes.INTEGER,
    durationSec: DataTypes.INTEGER,
    width: DataTypes.INTEGER,
    height: DataTypes.INTEGER,
    meta: DataTypes.JSONB,
    createdById: DataTypes.UUID,
  },
  { sequelize, modelName: 'Media', tableName: 'media' },
);

export class Course extends Model {
  declare id: string;
  declare organizationId: string;
}
Course.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    summary: DataTypes.TEXT,
    description: DataTypes.TEXT,
    coverUrl: DataTypes.STRING,
    icon: DataTypes.STRING,
    color: DataTypes.STRING,
    category: DataTypes.STRING, // "Emergency Management" etc.
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Course',
    tableName: 'courses',
    indexes: [{ unique: true, fields: ['organization_id', 'slug'] }],
  },
);

export class ContentBlock extends Model {}
ContentBlock.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    courseId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, allowNull: false }, // VIDEO|PDF|IMAGE|SLIDE|DOCUMENT|INTERACTIVE|QUIZ|SCORM|RICH_TEXT
    title: { type: DataTypes.STRING, allowNull: false },
    body: DataTypes.TEXT,
    mediaId: DataTypes.UUID,
    // Storyboard steps (e.g. 6-panel ERM chapter, SPACE×3 CPR beat)
    config: DataTypes.JSONB,
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'ContentBlock', tableName: 'content_blocks' },
);

export class LearningPath extends Model {
  declare id: string;
  declare organizationId: string;
}
LearningPath.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    coverUrl: DataTypes.STRING,
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'LearningPath',
    tableName: 'learning_paths',
    indexes: [{ unique: true, fields: ['organization_id', 'slug'] }],
  },
);

export class LearningPathItem extends Model {}
LearningPathItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    learningPathId: { type: DataTypes.UUID, allowNull: false },
    courseId: DataTypes.UUID,
    missionBundleId: DataTypes.UUID,
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    unlockRule: DataTypes.JSONB,
  },
  { sequelize, modelName: 'LearningPathItem', tableName: 'learning_path_items' },
);
