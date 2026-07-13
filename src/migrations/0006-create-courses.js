'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('courses', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false },
      summary: { type: Sequelize.TEXT },
      description: { type: Sequelize.TEXT },
      cover_url: { type: Sequelize.STRING },
      icon: { type: Sequelize.STRING },
      color: { type: Sequelize.STRING },
      category: { type: Sequelize.STRING },
      is_published: { type: Sequelize.BOOLEAN, defaultValue: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('courses', ['organization_id', 'slug'], { unique: true, name: 'courses_org_slug_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('courses');
  },
};
