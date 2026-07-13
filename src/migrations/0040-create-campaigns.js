'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campaigns', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      status: { type: Sequelize.STRING, defaultValue: 'DRAFT' },
      channel: { type: Sequelize.STRING, defaultValue: 'IN_APP' },
      audience: { type: Sequelize.JSONB },
      content: { type: Sequelize.JSONB },
      schedule_at: { type: Sequelize.DATE },
      starts_at: { type: Sequelize.DATE },
      ends_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('campaigns');
  },
};
