'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leaderboards', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      scope: { type: Sequelize.STRING, defaultValue: 'ORGANIZATION' },
      period: { type: Sequelize.STRING, defaultValue: 'ALL_TIME' },
      metric: { type: Sequelize.STRING, defaultValue: 'XP' },
      department_id: { type: Sequelize.UUID },
      tournament_id: { type: Sequelize.UUID },
      period_key: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('leaderboards');
  },
};
