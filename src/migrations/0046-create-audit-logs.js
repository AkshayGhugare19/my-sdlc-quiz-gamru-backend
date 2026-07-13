'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID },
      actor_id: { type: Sequelize.UUID },
      actor_role: { type: Sequelize.STRING },
      action: { type: Sequelize.STRING, allowNull: false },
      entity_type: { type: Sequelize.STRING },
      entity_id: { type: Sequelize.UUID },
      ip: { type: Sequelize.STRING },
      user_agent: { type: Sequelize.STRING },
      metadata: { type: Sequelize.JSONB },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
