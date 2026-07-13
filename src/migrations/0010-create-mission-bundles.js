'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_bundles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      cover_url: { type: Sequelize.STRING },
      unlock_rule: { type: Sequelize.JSONB },
      completion_rule: { type: Sequelize.JSONB },
      xp_reward: { type: Sequelize.INTEGER, defaultValue: 0 },
      star_reward: { type: Sequelize.INTEGER, defaultValue: 0 },
      max_stars: { type: Sequelize.INTEGER, defaultValue: 0 },
      badge_id: { type: Sequelize.UUID },
      certificate_template_id: { type: Sequelize.UUID },
      is_published: { type: Sequelize.BOOLEAN, defaultValue: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('mission_bundles', ['organization_id', 'slug'], { unique: true, name: 'mission_bundles_org_slug_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mission_bundles');
  },
};
