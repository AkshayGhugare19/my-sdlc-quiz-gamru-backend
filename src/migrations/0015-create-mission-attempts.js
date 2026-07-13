'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_attempts', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      mission_id: { type: Sequelize.UUID, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'IN_PROGRESS' },
      questions_total: { type: Sequelize.INTEGER, defaultValue: 0 },
      correct_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      stars_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      xp_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      time_remaining_sec: { type: Sequelize.INTEGER, defaultValue: 0 },
      score_pct: { type: Sequelize.INTEGER, defaultValue: 0 },
      rating: { type: Sequelize.STRING, defaultValue: 'NONE' },
      attempt_no: { type: Sequelize.INTEGER, defaultValue: 1 },
      started_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      completed_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mission_attempts');
  },
};
