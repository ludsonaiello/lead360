import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Financial Categories Seed
 *
 * Seeds 9 default financial categories for ALL existing tenants.
 * Idempotent: safe to run multiple times — skips tenants that already have defaults.
 */

const DEFAULT_CATEGORIES: { name: string; type: string }[] = [
  { name: 'Labor - General', type: 'labor' },
  { name: 'Labor - Crew Overtime', type: 'labor' },
  { name: 'Materials - General', type: 'material' },
  { name: 'Materials - Tools', type: 'equipment' },
  { name: 'Materials - Safety Equipment', type: 'equipment' },
  { name: 'Subcontractor - General', type: 'subcontractor' },
  { name: 'Equipment Rental', type: 'equipment' },
  { name: 'Fuel & Transportation', type: 'other' },
  { name: 'Miscellaneous', type: 'other' },
];

async function seedFinancialCategories() {
  console.log('🔄 Seeding default financial categories for all tenants...');

  // Get all active tenants
  const tenants = await prisma.tenant.findMany({
    where: { is_active: true },
    select: { id: true, company_name: true },
  });

  console.log(`Found ${tenants.length} active tenant(s).`);

  let totalCreated = 0;

  for (const tenant of tenants) {
    // Check which defaults already exist for this tenant
    const existingDefaults = await prisma.financial_category.findMany({
      where: {
        tenant_id: tenant.id,
        is_system_default: true,
      },
      select: { name: true },
    });

    const existingNames = new Set(existingDefaults.map((c) => c.name));

    const toCreate = DEFAULT_CATEGORIES.filter(
      (cat) => !existingNames.has(cat.name),
    );

    if (toCreate.length === 0) {
      console.log(
        `  ✅ Tenant "${tenant.company_name}" (${tenant.id}) — already has all ${DEFAULT_CATEGORIES.length} defaults.`,
      );
      continue;
    }

    await prisma.financial_category.createMany({
      data: toCreate.map((cat) => ({
        tenant_id: tenant.id,
        name: cat.name,
        type: cat.type as any,
        is_system_default: true,
        is_active: true,
        created_by_user_id: null,
      })),
    });

    totalCreated += toCreate.length;
    console.log(
      `  ✅ Tenant "${tenant.company_name}" (${tenant.id}) — seeded ${toCreate.length} categories.`,
    );
  }

  console.log(
    `\n✅ Financial categories seed complete. Created ${totalCreated} categories across ${tenants.length} tenant(s).`,
  );
}

seedFinancialCategories()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
