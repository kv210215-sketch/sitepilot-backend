/**
 * Development seed script.
 * Creates a demo admin user + project + page if they don't already exist.
 *
 * Usage:
 *   SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='change-me' npm run db:seed
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AppDataSource } from '../data-source';

dotenv.config();

function getSeedAdminCredentials() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@sitepilot.local';
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!password) {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required to seed an admin user');
  }

  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters long');
  }

  return { email, password };
}

async function seed(ds: DataSource) {
  const userRepo = ds.getRepository('users');
  const projectRepo = ds.getRepository('projects');
  const pageRepo = ds.getRepository('pages');
  const subscriptionRepo = ds.getRepository('subscriptions');

  // ── Seed user ─────────────────────────────────────────────────────────────
  const { email, password } = getSeedAdminCredentials();
  let user = await userRepo.findOne({ where: { email } });

  if (!user) {
    const hashed = await bcrypt.hash(password, 10);
    user = await userRepo.save(
      userRepo.create({ email, password: hashed, name: 'Admin', role: 'admin' }),
    );
    console.log(`✓ Created seed admin user: ${email}`);
  } else {
    console.log(`→ Seed admin user already exists: ${email}`);
  }

  // ── Seed subscription ──────────────────────────────────────────────────────
  const existingSub = await subscriptionRepo.findOne({ where: { userId: user.id } });
  if (!existingSub) {
    await subscriptionRepo.save(
      subscriptionRepo.create({ userId: user.id, plan: 'free' }),
    );
    console.log('✓ Created free subscription');
  }

  // ── Seed project ──────────────────────────────────────────────────────────
  let project = await projectRepo.findOne({ where: { userId: user.id } });

  if (!project) {
    project = await projectRepo.save(
      projectRepo.create({
        name: 'Demo Site',
        description: 'Seeded demo project',
        slug: 'demo-site',
        userId: user.id,
      }),
    );
    console.log(`✓ Created project: "Demo Site" (${project.id})`);
  } else {
    console.log(`→ Project already exists: ${project.name}`);
  }

  // ── Seed page ─────────────────────────────────────────────────────────────
  const existingPage = await pageRepo.findOne({ where: { projectId: project.id } });

  if (!existingPage) {
    await pageRepo.save(
      pageRepo.create({
        title: 'Home',
        slug: 'home',
        content: { blocks: [{ type: 'heading', text: 'Welcome to SitePilot' }] },
        projectId: project.id,
        order: 0,
      }),
    );
    console.log('✓ Created page: "Home"');
  }

  console.log('\n✓ Seed complete.');
  console.log(`  Login: ${email}`);
}

AppDataSource.initialize()
  .then((ds) => seed(ds).finally(() => ds.destroy()))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
