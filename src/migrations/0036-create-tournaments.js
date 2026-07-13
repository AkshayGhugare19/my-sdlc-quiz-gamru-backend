'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tournaments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      type: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, defaultValue: 'DRAFT' },
      metric: { type: Sequelize.STRING, defaultValue: 'XP' },
      department_id: { type: Sequelize.UUID },
      mission_bundle_id: { type: Sequelize.UUID },
      starts_at: { type: Sequelize.DATE },
      ends_at: { type: Sequelize.DATE },
      reward_config: { type: Sequelize.JSONB },
      star_reward: { type: Sequelize.INTEGER, defaultValue: 0 },
      max_stars: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tournaments');
  },
};
