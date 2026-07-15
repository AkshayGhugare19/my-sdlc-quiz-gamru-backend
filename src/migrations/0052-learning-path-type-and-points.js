'use strict';

// Learning paths become typed storyboards. A path now carries:
//   - `type`   (COURSE | MISSION | MISSION_BUNDLE | TOURNAMENT) — which entity's
//              "Select Learning Path" dropdown it appears in.
//   - `points` (JSONB) — ordered storyboard panels the admin builds with the
//              "+ Add point" button: [{ title, description, imageUrl, instructions }].
// And each of the four target entities gets an optional `learning_path_id` link.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('learning_paths', 'type', { type: Sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('learning_paths', 'points', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });

    await queryInterface.addColumn('courses', 'learning_path_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('missions', 'learning_path_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('mission_bundles', 'learning_path_id', { type: Sequelize.UUID, allowNull: true });
    await queryInterface.addColumn('tournaments', 'learning_path_id', { type: Sequelize.UUID, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tournaments', 'learning_path_id');
    await queryInterface.removeColumn('mission_bundles', 'learning_path_id');
    await queryInterface.removeColumn('missions', 'learning_path_id');
    await queryInterface.removeColumn('courses', 'learning_path_id');
    await queryInterface.removeColumn('learning_paths', 'points');
    await queryInterface.removeColumn('learning_paths', 'type');
  },
};
