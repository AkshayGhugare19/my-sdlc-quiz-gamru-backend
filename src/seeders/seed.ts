/* eslint-disable no-console */
// Seed demo data. Idempotent-ish via findOrCreate on natural keys.
// Creates two tenants (no shared data) with all roles, then provisions the
// full default game content for each via the defaultContent engine — the same
// engine that auto-provisions a brand-new organization on player signup, so
// the seeder and production signups can never drift apart.
import { sequelize } from '../config/db';
import '../models';
import { Organization, Department, User } from '../models';
import { ensureDefaultGameContent, ensureTournamentQuestionBank, ensureRoadmapCourse } from '../engines/defaultContent.engine';
import { hashPassword } from '../utils/password';

async function seedTenant(opts: { name: string; slug: string }) {
  const [org] = await Organization.findOrCreate({
    where: { slug: opts.slug },
    defaults: { name: opts.name, slug: opts.slug, status: 'ACTIVE' },
  });
  const organizationId = (org as any).id;
  console.log(`\n▶ Tenant ${opts.name} (${organizationId})`);

  const [dept] = await Department.findOrCreate({
    where: { organizationId, code: 'OPS' },
    defaults: { organizationId, name: 'Operations', code: 'OPS' },
  });

  // Roles: org admin, trainer, manager, employees
  const pwd = await hashPassword('Password123!');
  const people = [
    { email: `admin@${opts.slug}.com`, role: 'ADMIN', firstName: 'Olivia', lastName: 'Admin' },
    { email: `trainer@${opts.slug}.com`, role: 'TRAINER', firstName: 'Tariq', lastName: 'Trainer' },
    { email: `manager@${opts.slug}.com`, role: 'MANAGER', firstName: 'Mia', lastName: 'Manager' },
    { email: `rambo@${opts.slug}.com`, role: 'EMPLOYEE', firstName: 'Rambo', lastName: 'Rambo' },
    { email: `Johan@${opts.slug}.com`, role: 'EMPLOYEE', firstName: 'Johan', lastName: 'Johansson' },
  ];
  for (const p of people) {
    await User.findOrCreate({
      where: { organizationId, email: p.email },
      defaults: { organizationId, departmentId: (dept as any).id, passwordHash: pwd, status: 'ACTIVE', displayName: `${p.firstName} ${p.lastName}`, ...p },
    });
  }

  // The manager runs the Operations department — this drives the reporting
  // chain shown in Team Structure (employee → dept manager → org admin).
  const mgr: any = await User.findOne({ where: { organizationId, email: `manager@${opts.slug}.com` } });
  if (mgr && !(dept as any).managerId) await (dept as any).update({ managerId: mgr.id });

  // Full default game content: avatars, accessories, shop, ranks/levels,
  // badges, leaderboards, certificate template, tournament, SDLC Quest bundle.
  const created = await ensureDefaultGameContent(organizationId);
  // Runs standalone too, so orgs seeded before tournament pools existed still
  // get the categorized tournament question bank on re-seed.
  await ensureTournamentQuestionBank(organizationId);
  // Likewise standalone: orgs seeded before course roadmaps existed still get
  // the demo "SDLC Quest Roadmap" course on re-seed.
  await ensureRoadmapCourse(organizationId);
  console.log(created ? '  ✓ SDLC Quest content provisioned' : '  ✓ SDLC Quest content already present');
}

async function run() {
  await sequelize.authenticate();
  // Ensure tables exist (safe if migrations already ran).
  await sequelize.sync();

  // Platform super admin (no tenant)
  const pwd = await hashPassword('Password123!');
  await User.findOrCreate({
    where: { email: 'superadmin@platform.com', organizationId: null as any },
    defaults: { email: 'superadmin@platform.com', passwordHash: pwd, role: 'SUPER_ADMIN', status: 'ACTIVE', displayName: 'Platform Super Admin' },
  });

  // ONE demo tenant by default. Every tenant gets the same full content set, so
  // seeding several makes a super admin (who sees across orgs) read everything
  // "twice" — that's per-tenant copies, not duplicate rows. Set
  // SEED_SECOND_TENANT=true only when you explicitly want a second demo org to
  // test multi-tenancy.
  await seedTenant({ name: 'Acme Corporation', slug: 'acme' });
  if (process.env.SEED_SECOND_TENANT === 'true') {
    await seedTenant({ name: 'Globex Industries', slug: 'globex' });
  }

  console.log('\n✅ Seed complete.');
  console.log('   Super Admin: superadmin@platform.com / Password123!');
  console.log('   Acme admin:  admin@acme.com / Password123!');
  if (process.env.SEED_SECOND_TENANT === 'true') {
    console.log('   Globex admin: admin@globex.com / Password123!');
  }
  await sequelize.close();
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
