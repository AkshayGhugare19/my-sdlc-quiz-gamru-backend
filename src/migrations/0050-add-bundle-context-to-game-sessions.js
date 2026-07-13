'use strict';

// Mission vs Mission-Bundle progress isolation: a session started FROM a bundle
// (pillar) carries mission_bundle_id, and only those sessions feed bundle
// progress (Progress rows of entity_type BUNDLE_MISSION). Standalone mission
// races keep writing MISSION rows and never touch the bundle.
//
// To keep players' existing bundle progress intact after the split, every
// existing MISSION progress row for a bundled mission is copied once into a
// BUNDLE_MISSION row — from then on the two flows diverge independently.
const crypto = require('node:crypto');

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('game_sessions', 'mission_bundle_id', { type: Sequelize.UUID, allowNull: true });

    const [rows] = await queryInterface.sequelize.query(`
      SELECT p.organization_id, p.user_id, p.entity_id, p.status, p.completion_pct,
             p.stars_earned, p.best_score_pct, p.attempts, p.first_started_at, p.completed_at
      FROM progress p
      JOIN missions m ON m.id = p.entity_id
      WHERE p.entity_type = 'MISSION'
        AND m.mission_bundle_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM progress q
          WHERE q.user_id = p.user_id AND q.entity_type = 'BUNDLE_MISSION' AND q.entity_id = p.entity_id
        )
    `);

    if (rows.length) {
      const now = new Date();
      await queryInterface.bulkInsert(
        'progress',
        rows.map((r) => ({
          id: crypto.randomUUID(),
          organization_id: r.organization_id,
          user_id: r.user_id,
          entity_type: 'BUNDLE_MISSION',
          entity_id: r.entity_id,
          status: r.status,
          completion_pct: r.completion_pct,
          stars_earned: r.stars_earned,
          best_score_pct: r.best_score_pct,
          attempts: r.attempts,
          first_started_at: r.first_started_at,
          completed_at: r.completed_at,
          created_at: now,
          updated_at: now,
        })),
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('progress', { entity_type: 'BUNDLE_MISSION' });
    await queryInterface.removeColumn('game_sessions', 'mission_bundle_id');
  },
};
