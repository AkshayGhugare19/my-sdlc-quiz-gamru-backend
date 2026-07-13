'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accessories', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      organization_id: { type: Sequelize.UUID, allowNull: false },
      key: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      slot: { type: Sequelize.STRING, allowNull: false },
      rarity: { type: Sequelize.STRING, defaultValue: 'common' },
      icon_url: { type: Sequelize.STRING },
      sprite_url: { type: Sequelize.STRING },
      unlock_type: { type: Sequelize.STRING, defaultValue: 'REWARD' },
      shop_price_coins: { type: Sequelize.INTEGER },
      config: { type: Sequelize.JSONB },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('accessories', ['organization_id', 'key'], { unique: true, name: 'accessories_org_key_unique' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('accessories');
  },
};
