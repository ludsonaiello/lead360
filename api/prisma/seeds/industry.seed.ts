import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed the platform-wide industry reference list.
 *
 * These rows are global (no tenant_id) and drive the industry selector during
 * tenant onboarding. Upserted by `name`, which is unique, so re-running is safe
 * and will not duplicate or clobber an operator's is_active changes.
 */
const industries = [
  {
    name: 'Asphalt Contractor',
    description: 'Commercial and Residential Asphalt Contractors',
    is_active: true,
  },
  {
    name: 'Concrete & Masonry',
    description: 'Concrete, brick, and stone work',
    is_active: true,
  },
  {
    name: 'Construction Cleaning',
    description: 'Construction cleaning business',
    is_active: false,
  },
  {
    name: 'Electrical',
    description: 'Electrical installation and repair services',
    is_active: true,
  },
  {
    name: 'Flooring',
    description: 'Flooring installation and refinishing',
    is_active: true,
  },
  {
    name: 'General Contracting',
    description: 'General construction and contracting services',
    is_active: true,
  },
  {
    name: 'HVAC',
    description: 'Heating, ventilation, and air conditioning services',
    is_active: true,
  },
  {
    name: 'Landscaping',
    description: 'Landscaping and lawn care services',
    is_active: true,
  },
  {
    name: 'Other',
    description: 'Other service business types',
    is_active: true,
  },
  {
    name: 'Painting',
    description: 'Interior and exterior painting services',
    is_active: true,
  },
  {
    name: 'Pest Control',
    description: 'Pest control and extermination services',
    is_active: true,
  },
  {
    name: 'Plumbing',
    description: 'Plumbing installation and repair services',
    is_active: true,
  },
  {
    name: 'Roofing',
    description: 'Residential and commercial roofing services',
    is_active: true,
  },
];

async function seedIndustries() {
  console.log('Seeding industry reference list...');

  for (const industry of industries) {
    await prisma.industry.upsert({
      where: { name: industry.name },
      update: {},
      create: industry,
    });
  }

  console.log(
    `✅ Industries seeded successfully (${industries.length} entries)`,
  );
}

seedIndustries()
  .catch((error) => {
    console.error('❌ Industry seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
