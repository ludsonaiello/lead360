import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed System Settings for Configurable Cron Schedules
 *
 * Sprint 8 Enhancement: Make cron schedules configurable
 *
 * This seed creates system settings for:
 * - Twilio usage sync schedule
 * - Twilio health check schedule
 * - Cron timezone configuration
 * - Enable/disable flags for each job
 */
export async function seedCronSettings(prisma: PrismaClient) {
  console.log('Seeding cron schedule system settings...');

  const cronSettings = [
    {
      id: uuidv4(),
      setting_key: 'twilio_usage_sync_cron',
      setting_value: '0 2 * * *',
      data_type: 'string',
      description:
        'Cron expression for Twilio usage sync job. Default: 0 2 * * * (daily at 2:00 AM). Format: minute hour day month dayOfWeek',
    },
    {
      id: uuidv4(),
      setting_key: 'twilio_health_check_cron',
      setting_value: '*/15 * * * *',
      data_type: 'string',
      description:
        'Cron expression for Twilio health check job. Default: */15 * * * * (every 15 minutes). Format: minute hour day month dayOfWeek',
    },
    {
      id: uuidv4(),
      setting_key: 'cron_timezone',
      setting_value: 'America/New_York',
      data_type: 'string',
      description:
        'Timezone for all scheduled jobs. Default: America/New_York. Use IANA timezone names (e.g., America/Los_Angeles, Europe/London, UTC)',
    },
    {
      id: uuidv4(),
      setting_key: 'twilio_usage_sync_enabled',
      setting_value: 'true',
      data_type: 'boolean',
      description:
        'Enable/disable automatic Twilio usage sync job. Default: true. Set to false to disable nightly syncing.',
    },
    {
      id: uuidv4(),
      setting_key: 'twilio_health_check_enabled',
      setting_value: 'true',
      data_type: 'boolean',
      description:
        'Enable/disable automatic Twilio health check job. Default: true. Set to false to disable health monitoring.',
    },
  ];

  for (const setting of cronSettings) {
    await prisma.system_setting.upsert({
      where: { setting_key: setting.setting_key },
      update: {}, // Don't overwrite existing values
      create: setting,
    });
    console.log(`✓ Created/verified setting: ${setting.setting_key}`);
  }

  console.log('Cron schedule settings seeded successfully!');
}

// Allow running directly
if (require.main === module) {
  const prisma = new PrismaClient();
  seedCronSettings(prisma)
    .then(() => {
      console.log('Seed completed');
      prisma.$disconnect();
    })
    .catch((error) => {
      console.error('Seed failed:', error);
      prisma.$disconnect();
      process.exit(1);
    });
}
