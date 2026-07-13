'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tournament_entries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      tournament_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      score: { type: Sequelize.INTEGER, defaultValue: 0 },
      stars_earned: { type: Sequelize.INTEGER, defaultValue: 0 },
      placement: { type: Sequelize.INTEGER },
      joined_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('tournament_entries', ['tournament_id', 'user_id'], { unique: true, name: 'tournament_entries_tournament_user_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('tournament_entries');
  },
};
