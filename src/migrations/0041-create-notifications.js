'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      channel: { type: Sequelize.STRING, defaultValue: 'IN_APP' },
      status: { type: Sequelize.STRING, defaultValue: 'PENDING' },
      title: { type: Sequelize.STRING, allowNull: false },
      body: { type: Sequelize.TEXT },
      data: { type: Sequelize.JSONB },
      campaign_id: { type: Sequelize.UUID },
      read_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
