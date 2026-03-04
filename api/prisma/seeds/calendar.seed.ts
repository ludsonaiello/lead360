import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calendar Module Seed
 *
 * Creates default "Quote Visit" appointment type for all existing tenants
 * with 7 schedule rows (Monday-Sunday)
 *
 * Default Schedule:
 * - Monday-Friday: 9 AM - 5 PM (available)
 * - Saturday-Sunday: Closed (not available)
 *
 * Idempotent: Can be run multiple times safely
 */

async function seedCalendarModule() {
  console.log('🗓️  Seeding Calendar Module...\n');

  try {
    // Get all existing tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, company_name: true },
    });

    console.log(`Found ${tenants.length} existing tenant(s)\n`);

    if (tenants.length === 0) {
      console.log('  ℹ️  No tenants found. Skipping calendar seeding.');
      return;
    }

    for (const tenant of tenants) {
      console.log(`  ➜ Processing tenant: ${tenant.company_name}`);

      // Check if tenant already has appointment types
      const existingTypes = await prisma.appointment_type.count({
        where: { tenant_id: tenant.id },
      });

      if (existingTypes > 0) {
        console.log(
          `    ✓ Tenant already has ${existingTypes} appointment type(s), skipping\n`,
        );
        continue;
      }

      // Create default "Quote Visit" appointment type
      const appointmentType = await prisma.appointment_type.create({
        data: {
          tenant_id: tenant.id,
          name: 'Quote Visit',
          description:
            'Schedule a quote visit with the customer to assess the job',
          slot_duration_minutes: 60, // 1-hour slots
          max_lookahead_weeks: 8, // 8 weeks forward
          reminder_24h_enabled: true,
          reminder_1h_enabled: true,
          is_active: true,
          is_default: true,
          created_by_user_id: null, // System-created
        },
      });

      console.log(`    ✓ Created appointment type: ${appointmentType.name}`);

      // Create 7 schedule rows (Sun-Sat, day_of_week 0-6)
      const scheduleRows = [
        // Sunday (0) - Not available
        {
          day_of_week: 0,
          is_available: false,
          window1_start: null,
          window1_end: null,
        },

        // Monday (1) - 9 AM to 5 PM
        {
          day_of_week: 1,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },

        // Tuesday (2) - 9 AM to 5 PM
        {
          day_of_week: 2,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },

        // Wednesday (3) - 9 AM to 5 PM
        {
          day_of_week: 3,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },

        // Thursday (4) - 9 AM to 5 PM
        {
          day_of_week: 4,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },

        // Friday (5) - 9 AM to 5 PM
        {
          day_of_week: 5,
          is_available: true,
          window1_start: '09:00',
          window1_end: '17:00',
        },

        // Saturday (6) - Not available
        {
          day_of_week: 6,
          is_available: false,
          window1_start: null,
          window1_end: null,
        },
      ];

      for (const schedule of scheduleRows) {
        await prisma.appointment_type_schedule.create({
          data: {
            appointment_type_id: appointmentType.id,
            ...schedule,
          },
        });
      }

      console.log(
        `    ✓ Created 7 schedule rows (Mon-Fri: 9 AM - 5 PM)\n`,
      );
    }

    console.log('✅ Calendar Module seeding complete\n');
  } catch (error) {
    console.error('❌ Error seeding Calendar Module:', error);
    throw error;
  }
}

// Execute seed
seedCalendarModule()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
