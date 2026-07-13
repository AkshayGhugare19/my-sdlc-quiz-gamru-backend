'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mission_accessory_rewards', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      mission_id: { type: Sequelize.UUID, allowNull: false },
      accessory_id: { type: Sequelize.UUID, allowNull: false },
      trigger: { type: Sequelize.STRING, defaultValue: 'CORRECT_ANSWER' },
      chance_pct: { type: Sequelize.INTEGER, defaultValue: 100 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('mission_accessory_rewards', ['mission_id', 'accessory_id'], { unique: true, name: 'mission_accessory_rewards_mission_accessory_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mission_accessory_rewards');
  },
};
