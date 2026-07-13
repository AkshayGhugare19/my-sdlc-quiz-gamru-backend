'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_settings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      key: { type: Sequelize.STRING, allowNull: false },
      value: { type: Sequelize.JSONB, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('org_settings', ['organization_id', 'key'], { unique: true, name: 'org_settings_org_key_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('org_settings');
  },
};
