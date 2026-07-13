'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('garage_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      accessory_id: { type: Sequelize.UUID, allowNull: false },
      unlocked_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      source: { type: Sequelize.STRING },
      is_equipped: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('garage_items', ['user_id', 'accessory_id'], { unique: true, name: 'garage_items_user_accessory_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('garage_items');
  },
};
