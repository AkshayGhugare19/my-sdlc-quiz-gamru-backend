'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('levels', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      level: { type: Sequelize.INTEGER, allowNull: false },
      xp_required: { type: Sequelize.INTEGER, allowNull: false },
      title: { type: Sequelize.STRING },
      perks: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('levels', ['organization_id', 'level'], { unique: true, name: 'levels_org_level_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('levels');
  },
};
