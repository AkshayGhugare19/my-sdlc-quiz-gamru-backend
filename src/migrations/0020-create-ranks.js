'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ranks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      tier: { type: Sequelize.INTEGER, allowNull: false },
      min_xp: { type: Sequelize.INTEGER, allowNull: false },
      icon_url: { type: Sequelize.STRING },
      color: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('ranks', ['organization_id', 'tier'], { unique: true, name: 'ranks_org_tier_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ranks');
  },
};
