'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('issued_certificates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      template_id: { type: Sequelize.UUID, allowNull: false },
      serial: { type: Sequelize.STRING, allowNull: false, unique: true },
      source_type: { type: Sequelize.STRING },
      source_id: { type: Sequelize.UUID },
      pdf_url: { type: Sequelize.STRING },
      data: { type: Sequelize.JSONB },
      issued_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('issued_certificates');
  },
};
