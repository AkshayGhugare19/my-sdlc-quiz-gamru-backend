'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('answer_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      game_session_id: { type: Sequelize.UUID, allowNull: false },
      attempt_id: { type: Sequelize.UUID },
      question_id: { type: Sequelize.UUID, allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false },
      chosen_lane: { type: Sequelize.INTEGER },
      is_correct: { type: Sequelize.BOOLEAN, allowNull: false },
      time_taken_ms: { type: Sequelize.INTEGER },
      bonus_sec_awarded: { type: Sequelize.INTEGER, defaultValue: 0 },
      star_awarded: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('answer_events');
  },
};
