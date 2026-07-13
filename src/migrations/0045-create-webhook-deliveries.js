'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('webhook_deliveries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      webhook_id: { type: Sequelize.UUID, allowNull: false },
      event: { type: Sequelize.STRING, allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false },
      status_code: { type: Sequelize.INTEGER },
      success: { type: Sequelize.BOOLEAN, defaultValue: false },
      attempts: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('webhook_deliveries');
  },
};
