// Mission authoring models: MissionBundle, Mission, Question, QuestionOption,
// MissionQuestion (pool join).
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/db';

export class MissionBundle extends Model {
  declare id: string;
  declare organizationId: string;
  declare maxStars: number;
  declare starReward: number;
}
MissionBundle.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    learningPathId: DataTypes.UUID, // optional storyboard path (LearningPath.type = MISSION_BUNDLE)
    description: DataTypes.TEXT,
    coverUrl: DataTypes.STRING,
    unlockRule: DataTypes.JSONB,
    completionRule: DataTypes.JSONB,
    xpReward: { type: DataTypes.INTEGER, defaultValue: 0 },
    starReward: { type: DataTypes.INTEGER, defaultValue: 0 }, // stars for finishing the bundle
    maxStars: { type: DataTypes.INTEGER, defaultValue: 0 }, // aggregate max across missions
    badgeId: DataTypes.UUID,
    certificateTemplateId: DataTypes.UUID,
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'MissionBundle',
    tableName: 'mission_bundles',
    indexes: [{ unique: true, fields: ['organization_id', 'slug'] }],
  },
);

export class Mission extends Model {
  declare id: string;
  declare organizationId: string;
  declare timerSec: number;
  declare correctBonusSec: number;
  declare questionCount: number;
  declare randomizeQuestions: boolean;
  declare passingScorePct: number;
  declare maxStars: number;
  declare laneCount: number;
  declare xpReward: number;
  declare retryLimit: number | null;
}
Mission.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    missionBundleId: DataTypes.UUID,
    courseId: DataTypes.UUID, // learning content shown before the race
    learningPathId: DataTypes.UUID, // optional storyboard path (LearningPath.type = MISSION)
    title: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    difficulty: { type: DataTypes.STRING, defaultValue: 'MEDIUM' },
    estimatedMin: { type: DataTypes.INTEGER, defaultValue: 5 },
    // Gameplay config
    timerSec: { type: DataTypes.INTEGER, defaultValue: 300 }, // 05:00
    correctBonusSec: { type: DataTypes.INTEGER, defaultValue: 10 }, // +10s / correct
    questionCount: { type: DataTypes.INTEGER, defaultValue: 5 },
    randomizeQuestions: { type: DataTypes.BOOLEAN, defaultValue: true },
    passingScorePct: { type: DataTypes.INTEGER, defaultValue: 60 },
    maxStars: { type: DataTypes.INTEGER, defaultValue: 5 },
    laneCount: { type: DataTypes.INTEGER, defaultValue: 3 },
    // Rewards & rules
    xpReward: { type: DataTypes.INTEGER, defaultValue: 100 },
    retryLimit: DataTypes.INTEGER,
    retryCooldownSec: DataTypes.INTEGER,
    unlockRule: DataTypes.JSONB,
    badgeId: DataTypes.UUID,
    isPublished: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'Mission',
    tableName: 'missions',
    indexes: [{ unique: true, fields: ['organization_id', 'slug'] }],
  },
);

export class Question extends Model {
  declare id: string;
  declare organizationId: string;
  declare type: string;
  declare points: number;
}
Question.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    organizationId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'SINGLE_CHOICE' },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    explanation: DataTypes.TEXT, // feedback ("The correct answer is …")
    mediaId: DataTypes.UUID,
    difficulty: { type: DataTypes.STRING, defaultValue: 'MEDIUM' },
    category: DataTypes.STRING,
    tags: DataTypes.ARRAY(DataTypes.STRING),
    points: { type: DataTypes.INTEGER, defaultValue: 10 },
    timeLimitSec: DataTypes.INTEGER,
    config: DataTypes.JSONB, // type-specific payload
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdById: DataTypes.UUID,
  },
  { sequelize, modelName: 'Question', tableName: 'questions' },
);

export class QuestionOption extends Model {
  declare id: string;
  declare questionId: string;
  declare isCorrect: boolean;
  declare label: string;
  declare orderIndex: number;
}
QuestionOption.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    questionId: { type: DataTypes.UUID, allowNull: false },
    label: { type: DataTypes.STRING, allowNull: false },
    mediaId: DataTypes.UUID,
    isCorrect: { type: DataTypes.BOOLEAN, defaultValue: false },
    feedback: DataTypes.TEXT,
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    matchKey: DataTypes.STRING,
    correctPosition: DataTypes.INTEGER,
  },
  { sequelize, modelName: 'QuestionOption', tableName: 'question_options' },
);

export class MissionQuestion extends Model {
  declare missionId: string;
  declare questionId: string;
  declare isPinned: boolean;
  declare orderIndex: number;
}
MissionQuestion.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    missionId: { type: DataTypes.UUID, allowNull: false },
    questionId: { type: DataTypes.UUID, allowNull: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
    weight: { type: DataTypes.INTEGER, defaultValue: 1 },
    isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    modelName: 'MissionQuestion',
    tableName: 'mission_questions',
    indexes: [{ unique: true, fields: ['mission_id', 'question_id'] }],
  },
);
