import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTenantIds() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, company_name: true, subdomain: true },
    take: 5,
  });

  console.log('Tenant IDs from database:');
  tenants.forEach(t => {
    console.log(`  ID: ${t.id} (length: ${t.id.length}) - ${t.company_name || t.subdomain}`);
  });

  await prisma.$disconnect();
}

checkTenantIds().catch(console.error);
