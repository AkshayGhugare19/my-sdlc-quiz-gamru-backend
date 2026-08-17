'use strict';

// One-time handoff codes for the embedded Unity racing client. The website (which
// holds the access token in sessionStorage) mints a code, passes it in the iframe
// URL, and the game exchanges it once — inside a short TTL — for its own tokens,
// so no access token ever travels in a URL.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auth_handoff_codes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.UUID, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: true },
      code_hash: { type: Sequelize.STRING, allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      consumed_at: { type: Sequelize.DATE },
      ip: { type: Sequelize.STRING },
      user_agent: { type: Sequelize.STRING },
      consumed_ip: { type: Sequelize.STRING },
      consumed_user_agent: { type: Sequelize.STRING },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });

    await queryInterface.addIndex('auth_handoff_codes', ['user_id']);
    // Drives the opportunistic sweep of expired rows on every mint.
    await queryInterface.addIndex('auth_handoff_codes', ['expires_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auth_handoff_codes');
  },
};
