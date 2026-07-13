'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('question_options', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      question_id: { type: Sequelize.UUID, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: false },
      media_id: { type: Sequelize.UUID },
      is_correct: { type: Sequelize.BOOLEAN, defaultValue: false },
      feedback: { type: Sequelize.TEXT },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      match_key: { type: Sequelize.STRING },
      correct_position: { type: Sequelize.INTEGER },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('question_options');
  },
};
