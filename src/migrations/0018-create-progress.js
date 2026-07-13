'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('progress', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      entity_type: { type: Sequelize.STRING, allowNull: false },
      entity_id: { type: Sequelize.UUID, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'AVAILABLE' },
      completion_pct: { type: Sequelize.INTEGER, defaultValue: 0 },
      stars_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      best_score_pct: { type: Sequelize.INTEGER, defaultValue: 0 },
      attempts: { type: Sequelize.INTEGER, defaultValue: 0 },
      first_started_at: { type: Sequelize.DATE },
      completed_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('progress', ['user_id', 'entity_type', 'entity_id'], { unique: true, name: 'progress_user_entity_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('progress');
  },
};
