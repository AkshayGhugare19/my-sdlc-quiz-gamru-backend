'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leaderboard_entries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      leaderboard_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      score: { type: Sequelize.INTEGER, defaultValue: 0 },
      rank: { type: Sequelize.INTEGER },
      meta: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('leaderboard_entries', ['leaderboard_id', 'user_id'], { unique: true, name: 'leaderboard_entries_leaderboard_user_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('leaderboard_entries');
  },
};
