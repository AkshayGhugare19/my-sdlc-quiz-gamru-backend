'use strict';

// Course = learning roadmap (LMS style). A course now REFERENCES reusable
// missions, mission bundles and tournaments through join tables instead of
// owning anything — the same content can appear in many courses. Also adds the
// roadmap metadata fields the course form collects (difficulty, estimated
// duration, completion certificate template).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('courses', 'difficulty', { type: Sequelize.STRING, defaultValue: 'MEDIUM' });
    await queryInterface.addColumn('courses', 'estimated_min', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('courses', 'certificate_template_id', { type: Sequelize.UUID, allowNull: true });

    await queryInterface.createTable('course_missions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      course_id: { type: Sequelize.UUID, allowNull: false },
      mission_id: { type: Sequelize.UUID, allowNull: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('course_missions', ['course_id', 'mission_id'], { unique: true, name: 'course_missions_course_mission_unique' });

    await queryInterface.createTable('course_bundles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      course_id: { type: Sequelize.UUID, allowNull: false },
      mission_bundle_id: { type: Sequelize.UUID, allowNull: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('course_bundles', ['course_id', 'mission_bundle_id'], { unique: true, name: 'course_bundles_course_bundle_unique' });

    await queryInterface.createTable('course_tournaments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      course_id: { type: Sequelize.UUID, allowNull: false },
      tournament_id: { type: Sequelize.UUID, allowNull: false },
      order_index: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
    await queryInterface.addIndex('course_tournaments', ['course_id', 'tournament_id'], { unique: true, name: 'course_tournaments_course_tournament_unique' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('course_tournaments');
    await queryInterface.dropTable('course_bundles');
    await queryInterface.dropTable('course_missions');
    await queryInterface.removeColumn('courses', 'certificate_template_id');
    await queryInterface.removeColumn('courses', 'estimated_min');
    await queryInterface.removeColumn('courses', 'difficulty');
  },
};
