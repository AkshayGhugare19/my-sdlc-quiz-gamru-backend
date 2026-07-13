'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('questions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      type: { type: Sequelize.STRING, defaultValue: 'SINGLE_CHOICE' },
      prompt: { type: Sequelize.TEXT, allowNull: false },
      explanation: { type: Sequelize.TEXT },
      media_id: { type: Sequelize.UUID },
      difficulty: { type: Sequelize.STRING, defaultValue: 'MEDIUM' },
      category: { type: Sequelize.STRING },
      tags: { type: Sequelize.ARRAY(Sequelize.STRING) },
      points: { type: Sequelize.INTEGER, defaultValue: 10 },
      time_limit_sec: { type: Sequelize.INTEGER },
      config: { type: Sequelize.JSONB },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_by_id: { type: Sequelize.UUID },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('questions');
  },
};
