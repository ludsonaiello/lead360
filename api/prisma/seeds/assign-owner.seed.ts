import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

/**
 * Assign Owner Role to User
 *
 * Assigns the Owner role to a specific user for a specific tenant.
 * This gives the user full access to all features within their tenant.
 *
 * Idempotent: Can be run multiple times safely
 */

const ASSIGNMENT = {
  user_id: '32cd6d0d-1823-4033-8aa8-9513dda9cf59',
  tenant_id: '14a34ab2-6f6f-4e41-9bea-c444a304557e',
  role_name: 'Owner',
};

async function assignOwnerRole() {
  console.log('🌱 Assigning Owner role to user...\n');

  try {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: ASSIGNMENT.user_id },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        tenant_id: true,
        is_active: true,
        email_verified: true,
      },
    });

    if (!user) {
      throw new Error(`User with ID ${ASSIGNMENT.user_id} not found`);
    }

    console.log(`  ✓ User found: ${user.email} (${user.first_name} ${user.last_name})`);

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: ASSIGNMENT.tenant_id },
      select: {
        id: true,
        company_name: true,
        subdomain: true,
        is_active: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant with ID ${ASSIGNMENT.tenant_id} not found`);
    }

    console.log(`  ✓ Tenant found: ${tenant.company_name} (${tenant.subdomain})`);

    // Verify user belongs to this tenant
    if (user.tenant_id !== tenant.id) {
      console.log(`  ⚠️  WARNING: User's tenant_id (${user.tenant_id}) doesn't match target tenant (${tenant.id})`);
      console.log(`  → Updating user's tenant_id to ${tenant.id}`);

      await prisma.user.update({
        where: { id: user.id },
        data: { tenant_id: tenant.id },
      });

      console.log(`  ✓ Updated user's tenant_id`);
    }

    // Find Owner role
    const ownerRole = await prisma.role.findFirst({
      where: { name: ASSIGNMENT.role_name },
      select: { id: true, name: true, is_active: true },
    });

    if (!ownerRole) {
      throw new Error(
        `Role "${ASSIGNMENT.role_name}" not found. Please run RBAC seed first: npm run seed:rbac`,
      );
    }

    console.log(`  ✓ Role found: ${ownerRole.name}`);

    if (!ownerRole.is_active) {
      console.log(`  ⚠️  WARNING: Role "${ownerRole.name}" is not active`);
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.user_role.findFirst({
      where: {
        user_id: user.id,
        role_id: ownerRole.id,
        tenant_id: tenant.id,
      },
    });

    if (existingAssignment) {
      console.log(`  ℹ️  Role assignment already exists`);
      console.log(`  ✓ User "${user.email}" already has "${ownerRole.name}" role for tenant "${tenant.company_name}"`);
      return;
    }

    // Ensure user is active and email is verified
    if (!user.is_active || !user.email_verified) {
      console.log(`  ⚠️  User is not active or email not verified. Activating...`);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          is_active: true,
          email_verified: true,
          email_verified_at: new Date(),
        },
      });

      console.log(`  ✓ User activated and email verified`);
    }

    // Create the role assignment
    const userRole = await prisma.user_role.create({
      data: {
        id: randomBytes(16).toString('hex'),
        user_id: user.id,
        role_id: ownerRole.id,
        tenant_id: tenant.id,
        assigned_by_user_id: user.id, // Self-assigned
      },
    });

    // Create audit log
    await prisma.audit_log.create({
      data: {
        id: randomBytes(16).toString('hex'),
        tenant_id: tenant.id,
        actor_user_id: user.id,
        actor_type: 'system',
        entity_type: 'user_role',
        entity_id: userRole.id,
        action_type: 'owner_role_assigned',
        description: `Owner role assigned to ${user.email} for tenant ${tenant.company_name}`,
        before_json: null,
        after_json: JSON.stringify({
          user_id: user.id,
          user_email: user.email,
          role_id: ownerRole.id,
          role_name: ownerRole.name,
          tenant_id: tenant.id,
          tenant_name: tenant.company_name,
        }),
      },
    });

    console.log(`\n✨ Owner role assigned successfully!\n`);
    console.log(`📋 Assignment Details:`);
    console.log(`   User: ${user.first_name} ${user.last_name} (${user.email})`);
    console.log(`   Role: ${ownerRole.name}`);
    console.log(`   Tenant: ${tenant.company_name} (${tenant.subdomain})`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Tenant ID: ${tenant.id}`);
    console.log(`   Assignment ID: ${userRole.id}\n`);
  } catch (error) {
    console.error('❌ Error assigning Owner role:', error);
    throw error;
  }
}

// Execute seed
assignOwnerRole()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
