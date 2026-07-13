'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_badges', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      badge_id: { type: Sequelize.UUID, allowNull: false },
      awarded_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      context: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('user_badges', ['user_id', 'badge_id'], { unique: true, name: 'user_badges_user_badge_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('user_badges');
  },
};
