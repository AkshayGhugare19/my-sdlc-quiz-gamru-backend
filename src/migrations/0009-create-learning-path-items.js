'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('learning_path_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      learning_path_id: { type: Sequelize.UUID, allowNull: false },
      course_id: { type: Sequelize.UUID },
      mission_bundle_id: { type: Sequelize.UUID },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      unlock_rule: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('learning_path_items');
  },
};
