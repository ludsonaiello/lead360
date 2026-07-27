import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Seed platform-level operational defaults.
 *
 * Covers the global singletons and toggles the application expects to exist at
 * boot but which no other seed owns:
 *   - feature_flag       (5 platform capability toggles)
 *   - maintenance_mode   (single row, disabled)
 *   - system_setting     (security / retention limits)
 *
 * Cron-related system settings are owned by system-settings-cron.seed.ts and
 * are deliberately not duplicated here.
 *
 * Every write is an upsert keyed on a natural unique column, so re-running this
 * seed never duplicates rows and never overwrites values an operator changed
 * from the admin panel.
 */

const featureFlags = [
  {
    flag_key: 'file_storage',
    name: 'File Storage',
    description: 'Allow tenants to upload files',
    is_enabled: true,
  },
  {
    flag_key: 'email_queue',
    name: 'Email Queue',
    description: 'Allow system to send emails',
    is_enabled: true,
  },
  {
    flag_key: 'background_jobs',
    name: 'Background Jobs',
    description: 'Allow job scheduling',
    is_enabled: true,
  },
  {
    flag_key: 'user_registration',
    name: 'User Registration',
    description: 'Allow new tenant signups',
    is_enabled: true,
  },
  {
    flag_key: 'api_access',
    name: 'API Access',
    description: 'Allow API requests',
    is_enabled: true,
  },
];

const platformSettings = [
  {
    setting_key: 'max_failed_login_attempts',
    setting_value: '5',
    data_type: 'integer',
    description: 'Max failed login attempts before lockout',
  },
  {
    setting_key: 'account_lockout_duration_minutes',
    setting_value: '15',
    data_type: 'integer',
    description: 'Account lockout duration',
  },
  {
    setting_key: 'session_timeout_minutes',
    setting_value: '30',
    data_type: 'integer',
    description: 'Session timeout in minutes',
  },
  {
    setting_key: 'password_reset_token_expiry_hours',
    setting_value: '24',
    data_type: 'integer',
    description: 'Password reset token expiry',
  },
  {
    setting_key: 'max_file_upload_size_mb',
    setting_value: '10',
    data_type: 'integer',
    description: 'Max file upload size in MB',
  },
  {
    setting_key: 'max_storage_per_tenant_gb',
    setting_value: '500',
    data_type: 'integer',
    description: 'Max storage per tenant in GB',
  },
  {
    setting_key: 'audit_log_retention_days',
    setting_value: '90',
    data_type: 'integer',
    description: 'Audit log retention in days',
  },
  {
    setting_key: 'job_retention_days',
    setting_value: '30',
    data_type: 'integer',
    description: 'Job record retention in days',
  },
];

async function seedFeatureFlags() {
  for (const flag of featureFlags) {
    await prisma.feature_flag.upsert({
      where: { flag_key: flag.flag_key },
      update: {},
      create: flag,
    });
  }
  console.log(`  ✓ feature_flag: ${featureFlags.length} flags`);
}

async function seedMaintenanceMode() {
  // Singleton table with no natural unique key — key off row presence instead.
  const existing = await prisma.maintenance_mode.findFirst();

  if (existing) {
    console.log('  ✓ maintenance_mode: already present, left untouched');
    return;
  }

  await prisma.maintenance_mode.create({
    data: {
      id: uuidv4(),
      is_enabled: false,
      mode: 'immediate',
      message: "Lead360 is undergoing maintenance. We'll be back shortly.",
    },
  });
  console.log('  ✓ maintenance_mode: created (disabled)');
}

async function seedPlatformSettings() {
  for (const setting of platformSettings) {
    await prisma.system_setting.upsert({
      where: { setting_key: setting.setting_key },
      update: {},
      create: { id: uuidv4(), ...setting },
    });
  }
  console.log(
    `  ✓ system_setting: ${platformSettings.length} platform settings`,
  );
}

async function seedPlatformDefaults() {
  console.log('Seeding platform defaults...');

  await seedFeatureFlags();
  await seedMaintenanceMode();
  await seedPlatformSettings();

  console.log('✅ Platform defaults seeded successfully');
}

seedPlatformDefaults()
  .catch((error) => {
    console.error('❌ Platform defaults seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
