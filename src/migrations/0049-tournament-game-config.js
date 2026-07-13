'use strict';

// Real tournament gameplay: tournaments carry their own race configuration
// (question pool filters, count, timer, lanes, XP) in game_config, and
// tournament-only races have no mission — game_sessions.mission_id becomes
// nullable for those sessions.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tournaments', 'game_config', { type: Sequelize.JSONB, allowNull: true });
    await queryInterface.changeColumn('game_sessions', 'mission_id', { type: Sequelize.UUID, allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tournaments', 'game_config');
    await queryInterface.changeColumn('game_sessions', 'mission_id', { type: Sequelize.UUID, allowNull: false });
  },
};
