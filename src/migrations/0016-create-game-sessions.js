'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('game_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      mission_id: { type: Sequelize.UUID, allowNull: false },
      attempt_id: { type: Sequelize.UUID, unique: true },
      avatar_id: { type: Sequelize.UUID },
      status: { type: Sequelize.STRING, defaultValue: 'CREATED' },
      server_seed: { type: Sequelize.STRING, allowNull: false },
      question_order: { type: Sequelize.JSONB, defaultValue: [] },
      current_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      time_remaining_sec: { type: Sequelize.INTEGER, allowNull: false },
      stars_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      correct_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      accessories_unlocked: { type: Sequelize.JSONB, defaultValue: [] },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      started_at: { type: Sequelize.DATE },
      completed_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('game_sessions');
  },
};
