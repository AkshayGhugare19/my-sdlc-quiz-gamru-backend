'use strict';

// Levels become part of Ranks: add rank_id (parent rank) and the XP band
// [min_xp, max_xp). Legacy xp_required is relaxed to nullable.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('levels', 'rank_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('levels', 'min_xp', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn('levels', 'max_xp', { type: Sequelize.INTEGER, allowNull: true });
    // Relax the legacy cumulative column so it is optional going forward.
    await queryInterface.changeColumn('levels', 'xp_required', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addIndex('levels', ['rank_id'], { name: 'levels_rank_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('levels', 'levels_rank_id_idx');
    await queryInterface.removeColumn('levels', 'rank_id');
    await queryInterface.removeColumn('levels', 'min_xp');
    await queryInterface.removeColumn('levels', 'max_xp');
  },
};
