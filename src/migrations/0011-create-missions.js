'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('missions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      mission_bundle_id: { type: Sequelize.UUID },
      course_id: { type: Sequelize.UUID },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      difficulty: { type: Sequelize.STRING, defaultValue: 'MEDIUM' },
      estimated_min: { type: Sequelize.INTEGER, defaultValue: 5 },
      timer_sec: { type: Sequelize.INTEGER, defaultValue: 300 },
      correct_bonus_sec: { type: Sequelize.INTEGER, defaultValue: 10 },
      question_count: { type: Sequelize.INTEGER, defaultValue: 5 },
      randomize_questions: { type: Sequelize.BOOLEAN, defaultValue: true },
      passing_score_pct: { type: Sequelize.INTEGER, defaultValue: 60 },
      max_stars: { type: Sequelize.INTEGER, defaultValue: 5 },
      lane_count: { type: Sequelize.INTEGER, defaultValue: 3 },
      xp_reward: { type: Sequelize.INTEGER, defaultValue: 100 },
      retry_limit: { type: Sequelize.INTEGER },
      retry_cooldown_sec: { type: Sequelize.INTEGER },
      unlock_rule: { type: Sequelize.JSONB },
      badge_id: { type: Sequelize.UUID },
      is_published: { type: Sequelize.BOOLEAN, defaultValue: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('missions', ['organization_id', 'slug'], { unique: true, name: 'missions_org_slug_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('missions');
  },
};
