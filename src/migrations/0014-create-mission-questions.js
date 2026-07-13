'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_questions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      mission_id: { type: Sequelize.UUID, allowNull: false },
      question_id: { type: Sequelize.UUID, allowNull: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      weight: { type: Sequelize.INTEGER, defaultValue: 1 },
      is_pinned: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('mission_questions', ['mission_id', 'question_id'], { unique: true, name: 'mission_questions_mission_question_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mission_questions');
  },
};
