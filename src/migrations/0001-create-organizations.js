'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('organizations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      status: { type: Sequelize.STRING, defaultValue: 'TRIAL' },
      logo_url: { type: Sequelize.STRING },
      primary_color: { type: Sequelize.STRING, defaultValue: '#0B3D91' },
      accent_color: { type: Sequelize.STRING, defaultValue: '#22D3EE' },
      theme: { type: Sequelize.JSONB },
      plan: { type: Sequelize.STRING, defaultValue: 'standard' },
      seat_limit: { type: Sequelize.INTEGER },
      timezone: { type: Sequelize.STRING, defaultValue: 'UTC' },
      locale: { type: Sequelize.STRING, defaultValue: 'en' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('organizations');
  },
};
