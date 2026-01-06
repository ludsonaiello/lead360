import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

const PLATFORM_ADMIN_USER = {
  email: 'ludsonaiello@gmail.com',
  password: '978@F32c', // Will be hashed
  first_name: 'Ludson',
  last_name: 'Aiello',
  is_platform_admin: true,
  is_active: true,
  email_verified: true,
};

async function seedPlatformAdmin() {
  console.log('🌱 Seeding Platform Admin user...\n');

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: PLATFORM_ADMIN_USER.email, tenant_id: null },
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
        email: PLATFORM_ADMIN_USER.email,
        password_hash: passwordHash,
        first_name: PLATFORM_ADMIN_USER.first_name,
        last_name: PLATFORM_ADMIN_USER.last_name,
        is_platform_admin: true,
        is_active: true,
        email_verified: true,
        tenant_id: null, // No tenant = Platform Admin
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        tenant_id: null,
        actor_user_id: user.id,
        entity_type: 'user',
        entity_id: user.id,
        action: 'platform_admin_created',
        before_json: Prisma.JsonNull,
        after_json: {
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          is_platform_admin: true,
        },
      },
    });

    console.log(`  ✓ Created Platform Admin user: ${PLATFORM_ADMIN_USER.email}`);
    console.log(`  ✓ User ID: ${user.id}`);
    console.log(`\n✨ Platform Admin user seeded successfully!\n`);
    console.log(`🔐 Login credentials:`);
    console.log(`   Email: ${PLATFORM_ADMIN_USER.email}`);
    console.log(`   Password: ${PLATFORM_ADMIN_USER.password}\n`);
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
