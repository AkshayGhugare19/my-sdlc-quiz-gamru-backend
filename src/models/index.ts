// Central model registry + associations (gamru config/associations pattern).
// Import this once at boot so every model is initialised and related.
import { Organization, Department, User, RefreshToken } from './identity';
import {
  Media,
  Course,
  ContentBlock,
  LearningPath,
  LearningPathItem,
  CourseMission,
  CourseBundle,
  CourseTournament,
} from './content';
import { MissionBundle, Mission, Question, QuestionOption, MissionQuestion } from './missions';
import { MissionAttempt, GameSession, AnswerEvent, Progress } from './gameplay';
import {
  Level,
  Rank,
  Badge,
  UserBadge,
  Achievement,
  XpTransaction,
  RewardRule,
  RewardGrant,
} from './gamification';
import {
  Avatar,
  PlayerAvatar,
  Accessory,
  GarageItem,
  MissionAccessoryReward,
  ShopItem,
  ShopOrder,
} from './economy';
import {
  Leaderboard,
  LeaderboardEntry,
  Tournament,
  TournamentEntry,
  CertificateTemplate,
  IssuedCertificate,
} from './social';
import {
  Campaign,
  Notification,
  OrgSetting,
  EmailTemplate,
  Webhook,
  WebhookDelivery,
  AuditLog,
} from './system';

// ── Organization is the tenant root ──────────────────────────────────────
Organization.hasMany(Department, { foreignKey: 'organizationId' });
Department.belongsTo(Organization, { foreignKey: 'organizationId' });
Department.hasMany(Department, { as: 'children', foreignKey: 'parentId' });
Department.belongsTo(Department, { as: 'parent', foreignKey: 'parentId' });

Organization.hasMany(User, { foreignKey: 'organizationId' });
User.belongsTo(Organization, { foreignKey: 'organizationId' });
Department.hasMany(User, { foreignKey: 'departmentId' });
User.belongsTo(Department, { foreignKey: 'departmentId' });

User.hasMany(RefreshToken, { foreignKey: 'userId' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

// ── Content ───────────────────────────────────────────────────────────────
Course.hasMany(ContentBlock, { foreignKey: 'courseId', as: 'contentBlocks' });
ContentBlock.belongsTo(Course, { foreignKey: 'courseId' });
ContentBlock.belongsTo(Media, { foreignKey: 'mediaId' });

LearningPath.hasMany(LearningPathItem, { foreignKey: 'learningPathId', as: 'items' });
LearningPathItem.belongsTo(LearningPath, { foreignKey: 'learningPathId' });
LearningPathItem.belongsTo(Course, { foreignKey: 'courseId' });
LearningPathItem.belongsTo(MissionBundle, { foreignKey: 'missionBundleId' });

// ── Course roadmap — a course REFERENCES reusable missions/bundles/tournaments
// via join tables (LMS style). Content is never owned or duplicated: the same
// mission/bundle/tournament can appear in any number of courses, and each keeps
// its own independent progress records.
Course.belongsToMany(Mission, { through: CourseMission, foreignKey: 'courseId', otherKey: 'missionId', as: 'roadmapMissions' });
Mission.belongsToMany(Course, { through: CourseMission, foreignKey: 'missionId', otherKey: 'courseId', as: 'courses' });
Course.belongsToMany(MissionBundle, { through: CourseBundle, foreignKey: 'courseId', otherKey: 'missionBundleId', as: 'roadmapBundles' });
MissionBundle.belongsToMany(Course, { through: CourseBundle, foreignKey: 'missionBundleId', otherKey: 'courseId', as: 'courses' });
Course.belongsToMany(Tournament, { through: CourseTournament, foreignKey: 'courseId', otherKey: 'tournamentId', as: 'roadmapTournaments' });
Tournament.belongsToMany(Course, { through: CourseTournament, foreignKey: 'tournamentId', otherKey: 'courseId', as: 'courses' });
Course.belongsTo(CertificateTemplate, { foreignKey: 'certificateTemplateId' });

// ── Missions & questions ────────────────────────────────────────────────
MissionBundle.hasMany(Mission, { foreignKey: 'missionBundleId', as: 'missions' });
Mission.belongsTo(MissionBundle, { foreignKey: 'missionBundleId' });
Mission.belongsTo(Course, { foreignKey: 'courseId' });
MissionBundle.belongsTo(Badge, { foreignKey: 'badgeId' });
MissionBundle.belongsTo(CertificateTemplate, { foreignKey: 'certificateTemplateId' });

Question.hasMany(QuestionOption, { foreignKey: 'questionId', as: 'options' });
QuestionOption.belongsTo(Question, { foreignKey: 'questionId' });

Mission.belongsToMany(Question, { through: MissionQuestion, foreignKey: 'missionId', otherKey: 'questionId', as: 'questions' });
Question.belongsToMany(Mission, { through: MissionQuestion, foreignKey: 'questionId', otherKey: 'missionId', as: 'missions' });
MissionQuestion.belongsTo(Mission, { foreignKey: 'missionId' });
MissionQuestion.belongsTo(Question, { foreignKey: 'questionId' });

// ── Gameplay ───────────────────────────────────────────────────────────────
User.hasMany(MissionAttempt, { foreignKey: 'userId' });
MissionAttempt.belongsTo(User, { foreignKey: 'userId' });
Mission.hasMany(MissionAttempt, { foreignKey: 'missionId' });
MissionAttempt.belongsTo(Mission, { foreignKey: 'missionId' });

User.hasMany(GameSession, { foreignKey: 'userId' });
GameSession.belongsTo(User, { foreignKey: 'userId' });
Mission.hasMany(GameSession, { foreignKey: 'missionId' });
GameSession.belongsTo(Mission, { foreignKey: 'missionId' });
GameSession.belongsTo(MissionAttempt, { foreignKey: 'attemptId' });

GameSession.hasMany(AnswerEvent, { foreignKey: 'gameSessionId', as: 'answers' });
AnswerEvent.belongsTo(GameSession, { foreignKey: 'gameSessionId' });
AnswerEvent.belongsTo(Question, { foreignKey: 'questionId' });
MissionAttempt.hasMany(AnswerEvent, { foreignKey: 'attemptId' });

User.hasMany(Progress, { foreignKey: 'userId' });
Progress.belongsTo(User, { foreignKey: 'userId' });

// ── Gamification ledgers ──────────────────────────────────────────────────
User.hasMany(XpTransaction, { foreignKey: 'userId' });
XpTransaction.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(RewardGrant, { foreignKey: 'userId' });
RewardGrant.belongsTo(User, { foreignKey: 'userId' });

Badge.hasMany(UserBadge, { foreignKey: 'badgeId' });
UserBadge.belongsTo(Badge, { foreignKey: 'badgeId' });
User.hasMany(UserBadge, { foreignKey: 'userId', as: 'earnedBadges' });
UserBadge.belongsTo(User, { foreignKey: 'userId' });

Mission.hasMany(RewardRule, { foreignKey: 'missionId' });
MissionBundle.hasMany(RewardRule, { foreignKey: 'missionBundleId' });

// Levels are nested under Ranks (a rank contains levels with XP bands).
Rank.hasMany(Level, { foreignKey: 'rankId', as: 'levels' });
Level.belongsTo(Rank, { foreignKey: 'rankId' });

// ── Avatars / accessories / garage / shop ─────────────────────────────────
User.hasOne(PlayerAvatar, { foreignKey: 'userId' });
PlayerAvatar.belongsTo(User, { foreignKey: 'userId' });
PlayerAvatar.belongsTo(Avatar, { foreignKey: 'avatarId' });
Avatar.hasMany(PlayerAvatar, { foreignKey: 'avatarId' });

User.hasMany(GarageItem, { foreignKey: 'userId', as: 'garage' });
GarageItem.belongsTo(User, { foreignKey: 'userId' });
Accessory.hasMany(GarageItem, { foreignKey: 'accessoryId' });
GarageItem.belongsTo(Accessory, { foreignKey: 'accessoryId' });

Mission.hasMany(MissionAccessoryReward, { foreignKey: 'missionId', as: 'accessoryRewards' });
MissionAccessoryReward.belongsTo(Mission, { foreignKey: 'missionId' });
MissionAccessoryReward.belongsTo(Accessory, { foreignKey: 'accessoryId' });

ShopItem.hasMany(ShopOrder, { foreignKey: 'shopItemId' });
ShopOrder.belongsTo(ShopItem, { foreignKey: 'shopItemId' });
User.hasMany(ShopOrder, { foreignKey: 'userId' });
ShopOrder.belongsTo(User, { foreignKey: 'userId' });

// ── Leaderboards / tournaments / certificates ─────────────────────────────
Leaderboard.hasMany(LeaderboardEntry, { foreignKey: 'leaderboardId', as: 'entries' });
LeaderboardEntry.belongsTo(Leaderboard, { foreignKey: 'leaderboardId' });
LeaderboardEntry.belongsTo(User, { foreignKey: 'userId' });

Tournament.hasMany(TournamentEntry, { foreignKey: 'tournamentId', as: 'entries' });
TournamentEntry.belongsTo(Tournament, { foreignKey: 'tournamentId' });
TournamentEntry.belongsTo(User, { foreignKey: 'userId' });

CertificateTemplate.hasMany(IssuedCertificate, { foreignKey: 'templateId' });
IssuedCertificate.belongsTo(CertificateTemplate, { foreignKey: 'templateId' });
User.hasMany(IssuedCertificate, { foreignKey: 'userId' });
IssuedCertificate.belongsTo(User, { foreignKey: 'userId' });

// ── System ────────────────────────────────────────────────────────────────
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId' });
Webhook.hasMany(WebhookDelivery, { foreignKey: 'webhookId' });
WebhookDelivery.belongsTo(Webhook, { foreignKey: 'webhookId' });

export const models = {
  Organization,
  Department,
  User,
  RefreshToken,
  Media,
  Course,
  ContentBlock,
  LearningPath,
  LearningPathItem,
  CourseMission,
  CourseBundle,
  CourseTournament,
  MissionBundle,
  Mission,
  Question,
  QuestionOption,
  MissionQuestion,
  MissionAttempt,
  GameSession,
  AnswerEvent,
  Progress,
  Level,
  Rank,
  Badge,
  UserBadge,
  Achievement,
  XpTransaction,
  RewardRule,
  RewardGrant,
  Avatar,
  PlayerAvatar,
  Accessory,
  GarageItem,
  MissionAccessoryReward,
  ShopItem,
  ShopOrder,
  Leaderboard,
  LeaderboardEntry,
  Tournament,
  TournamentEntry,
  CertificateTemplate,
  IssuedCertificate,
  Campaign,
  Notification,
  OrgSetting,
  EmailTemplate,
  Webhook,
  WebhookDelivery,
  AuditLog,
};

export * from './identity';
export * from './content';
export * from './missions';
export * from './gameplay';
export * from './gamification';
export * from './economy';
export * from './social';
export * from './system';
