'use strict';

// Tournament races are separate from normal races: a session started FOR a
// tournament carries tournament_id, and only those sessions feed tournament
// scoring. Normal mission races no longer count toward tournament progress.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('game_sessions', 'tournament_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addIndex('game_sessions', ['tournament_id'], { name: 'game_sessions_tournament_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('game_sessions', 'game_sessions_tournament_id_idx');
    await queryInterface.removeColumn('game_sessions', 'tournament_id');
  },
};
