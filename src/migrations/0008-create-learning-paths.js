'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('learning_paths', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      cover_url: { type: Sequelize.STRING },
      is_published: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('learning_paths', ['organization_id', 'slug'], { unique: true, name: 'learning_paths_org_slug_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('learning_paths');
  },
};
