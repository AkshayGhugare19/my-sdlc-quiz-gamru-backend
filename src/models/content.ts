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
  declare certificateTemplateId: string | null;
}
Course.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    summary: DataTypes.TEXT,
    description: DataTypes.TEXT,
    coverUrl: DataTypes.STRING, // thumbnail
    icon: DataTypes.STRING,
    color: DataTypes.STRING,
    category: DataTypes.STRING, // "Emergency Management" etc.
    // Roadmap metadata — a course is the learning roadmap that REFERENCES
    // reusable missions / bundles / tournaments (see CourseMission & friends).
    difficulty: { type: DataTypes.STRING, defaultValue: 'MEDIUM' },
    estimatedMin: DataTypes.INTEGER,
    certificateTemplateId: DataTypes.UUID, // issued when the whole roadmap is completed
    learningPathId: DataTypes.UUID, // optional storyboard path shown before the roadmap (LearningPath.type = COURSE)
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

// ── Course roadmap joins — a course only REFERENCES reusable content. ──────
// The same mission/bundle/tournament can appear in many courses; deleting a
// course removes only the references, never the content itself.
export class CourseMission extends Model {
  declare id: string;
  declare courseId: string;
  declare missionId: string;
  declare orderIndex: number;
}
CourseMission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    courseId: { type: DataTypes.UUID, allowNull: false },
    missionId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'CourseMission',
    tableName: 'course_missions',
    indexes: [{ unique: true, fields: ['course_id', 'mission_id'] }],
  },
);

export class CourseBundle extends Model {
  declare id: string;
  declare courseId: string;
  declare missionBundleId: string;
  declare orderIndex: number;
}
CourseBundle.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    courseId: { type: DataTypes.UUID, allowNull: false },
    missionBundleId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'CourseBundle',
    tableName: 'course_bundles',
    indexes: [{ unique: true, fields: ['course_id', 'mission_bundle_id'] }],
  },
);

export class CourseTournament extends Model {
  declare id: string;
  declare courseId: string;
  declare tournamentId: string;
  declare orderIndex: number;
}
CourseTournament.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    courseId: { type: DataTypes.UUID, allowNull: false },
    tournamentId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'CourseTournament',
    tableName: 'course_tournaments',
    indexes: [{ unique: true, fields: ['course_id', 'tournament_id'] }],
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
    // Which kind of entity this path attaches to: COURSE | MISSION |
    // MISSION_BUNDLE | TOURNAMENT. Decides which creation modal's
    // "Select Learning Path" dropdown lists this path.
    type: { type: DataTypes.STRING, allowNull: true },
    description: DataTypes.TEXT,
    coverUrl: DataTypes.STRING,
    // Ordered storyboard panels shown before play — an array of
    // { title, description, imageUrl, instructions } (the 6-panel chapter
    // layout the admin builds with the "+ Add point" button).
    points: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
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
