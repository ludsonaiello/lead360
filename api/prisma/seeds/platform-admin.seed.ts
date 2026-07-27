import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Platform Admin User Seed
 *
 * Creates a Platform Admin user that has access to the entire platform
 * (not tied to any specific tenant)
 *
 * Platform Admins can:
 * - Manage all tenants
 * - Create/update/delete roles and permissions
 * - Access admin-only endpoints
 * - View system-wide analytics
 *
 * Idempotent: Can be run multiple times safely
 */

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(
      `${key} is not set. Define PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in api/.env ` +
        `before seeding — the platform admin credentials must never be committed to source control.`,
    );
  }

  return value;
}

const PLATFORM_ADMIN_USER = {
  email: requireEnv('PLATFORM_ADMIN_EMAIL'),
  password: requireEnv('PLATFORM_ADMIN_PASSWORD'), // Will be hashed
  first_name: process.env.PLATFORM_ADMIN_FIRST_NAME ?? 'Platform',
  last_name: process.env.PLATFORM_ADMIN_LAST_NAME ?? 'Admin',
  is_platform_admin: true,
  is_active: true,
  email_verified: true,
};

async function seedPlatformAdmin() {
  console.log('🌱 Seeding Platform Admin user...\n');

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: PLATFORM_ADMIN_USER.email },
    });

    if (existingUser) {
      console.log(`  ℹ️  Platform Admin user already exists: ${PLATFORM_ADMIN_USER.email}`);

      // Update to ensure they have platform admin privileges
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          is_platform_admin: true,
          is_active: true,
          email_verified: true,
        },
      });

      console.log(`  ✓ Updated existing user to ensure Platform Admin privileges`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(PLATFORM_ADMIN_USER.password, 10);

    // Create platform admin user (no tenant_id = platform-wide access)
    const user = await prisma.user.create({
      data: {
        id: randomBytes(16).toString('hex'),
        updated_at: new Date(),
        email: PLATFORM_ADMIN_USER.email,
        password_hash: passwordHash,
        first_name: PLATFORM_ADMIN_USER.first_name,
        last_name: PLATFORM_ADMIN_USER.last_name,
        is_platform_admin: true,
        is_active: true,
        email_verified: true,
      },
    });

    // Create audit log
    await prisma.audit_log.create({
      data: {
        id: randomBytes(16).toString('hex'),
        tenant_id: null,
        actor_user_id: user.id,
        actor_type: 'system',
        entity_type: 'user',
        entity_id: user.id,
        action_type: 'platform_admin_created',
        description: `Platform Admin user created: ${user.email}`,
        before_json: null,
        after_json: JSON.stringify({
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_platform_admin: true,
        }),
      },
    });

    console.log(`  ✓ Created Platform Admin user: ${PLATFORM_ADMIN_USER.email}`);
    console.log(`  ✓ User ID: ${user.id}`);
    console.log(`\n✨ Platform Admin user seeded successfully!\n`);
    console.log(`🔐 Sign in with ${PLATFORM_ADMIN_USER.email}`);
    console.log(`   Password: the value of PLATFORM_ADMIN_PASSWORD in api/.env\n`);
  } catch (error) {
    console.error('❌ Error seeding Platform Admin user:', error);
    throw error;
  }
}

// Execute seed
seedPlatformAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
