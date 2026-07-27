import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import * as parser from 'cron-parser';

const prisma = new PrismaClient();

function calculateNextRun(cronExpression: string, timezone: string): Date {
  const interval = parser.parseExpression(cronExpression, { tz: timezone });
  return interval.next().toDate();
}

async function seedScheduledJobs() {
  const jobs = [
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'expiry-check',
      name: 'License and Insurance Expiry Check',
      description:
        'Check for expiring licenses and insurance, send warning emails',
      schedule: '0 6 * * *', // 6:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 1,
      timeout_seconds: 600,
      next_run_at: calculateNextRun('0 6 * * *', 'America/New_York'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'data-cleanup',
      name: 'Expired Token Cleanup',
      description: 'Delete expired password reset and activation tokens',
      schedule: '0 2 * * *', // 2:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 2,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('0 2 * * *', 'America/New_York'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'job-retention',
      name: 'Job Retention Cleanup',
      description:
        'Delete jobs older than 30 days (keep last 100 per scheduled job)',
      schedule: '0 4 * * *', // 4:00 AM daily
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 2,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('0 4 * * *', 'America/New_York'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'partition-maintenance',
      name: 'Audit Log Partition Maintenance',
      description: 'Create monthly partitions and enforce 7-year retention',
      schedule: '0 0 1 * *', // Midnight on 1st of every month
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 1,
      timeout_seconds: 600,
      next_run_at: calculateNextRun('0 0 1 * *', 'America/New_York'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'subcontractor-insurance-check',
      name: 'Subcontractor Insurance Expiry Check',
      description:
        'Daily scan for subcontractor insurance expiry. Notifies tenant owners and admins of expired or expiring insurance.',
      schedule: '0 7 * * *', // 7:00 AM daily
      timezone: 'UTC',
      is_enabled: true,
      max_retries: 3,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('0 7 * * *', 'UTC'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'project-task-delay-check',
      name: 'Project Task Delay Check',
      description:
        'Daily scan for overdue project tasks. Creates notifications for assigned project managers.',
      schedule: '0 6 * * *', // 6:00 AM daily
      timezone: 'UTC',
      is_enabled: true,
      max_retries: 3,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('0 6 * * *', 'UTC'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'receipt-cleanup',
      name: 'Orphan Receipt Cleanup',
      description:
        'Deletes receipts not linked to any financial entry after 7 days. Removes both the receipt record and associated file from disk.',
      schedule: '0 */2 * * *', // Every 2 hours
      timezone: 'America/New_York',
      is_enabled: true,
      max_retries: 3,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('0 */2 * * *', 'America/New_York'),
    },
    {
      id: randomBytes(16).toString('hex'),
      job_type: 'ai-voice-pricing-activation',
      name: 'AI Voice Pricing Activation',
      description:
        'Automatically activates AI voice pricing when the effective_date arrives. Deactivates old pricing and sets new pricing as current.',
      schedule: '15 0 * * *', // 12:15 AM daily
      timezone: 'UTC',
      is_enabled: true,
      max_retries: 3,
      timeout_seconds: 300,
      next_run_at: calculateNextRun('15 0 * * *', 'UTC'),
    },
  ];

  for (const job of jobs) {
    await prisma.scheduled_job.upsert({
      where: { job_type: job.job_type },
      update: job,
      create: job,
    });
  }

  console.log('✅ Scheduled jobs seeded successfully');
  console.log(`   - ${jobs.length} scheduled jobs created/updated`);
}

seedScheduledJobs()
  .catch((e) => {
    console.error('❌ Failed to seed scheduled jobs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
