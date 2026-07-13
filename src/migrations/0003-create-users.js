'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: true },
      department_id: { type: Sequelize.UUID, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: false },
      password_hash: { type: Sequelize.STRING },
      first_name: { type: Sequelize.STRING },
      last_name: { type: Sequelize.STRING },
      display_name: { type: Sequelize.STRING },
      avatar_url: { type: Sequelize.STRING },
      role: { type: Sequelize.STRING, defaultValue: 'EMPLOYEE' },
      status: { type: Sequelize.STRING, defaultValue: 'ACTIVE' },
      job_title: { type: Sequelize.STRING },
      locale: { type: Sequelize.STRING },
      last_login_at: { type: Sequelize.DATE },
      total_xp: { type: Sequelize.INTEGER, defaultValue: 0 },
      coins: { type: Sequelize.INTEGER, defaultValue: 0 },
      stars: { type: Sequelize.INTEGER, defaultValue: 0 },
      current_level: { type: Sequelize.INTEGER, defaultValue: 1 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('users', ['organization_id', 'email'], { unique: true, name: 'users_org_email_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
