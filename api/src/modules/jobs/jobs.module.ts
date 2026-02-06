import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../core/database/prisma.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';

// Services
import { SmtpService } from './services/smtp.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailService } from './services/email.service';
import { JobQueueService } from './services/job-queue.service';
import { ScheduledJobService } from './services/scheduled-job.service';
import { VariableRegistryService } from './services/variable-registry.service';
import { TemplateValidatorService } from './services/template-validator.service';

// Handlers
import { ExpiryCheckHandler } from './handlers/expiry-check.handler';
import { DataCleanupHandler } from './handlers/data-cleanup.handler';
import { JobRetentionHandler } from './handlers/job-retention.handler';
import { PartitionMaintenanceHandler } from './handlers/partition-maintenance.handler';

// Processors
import { SendEmailProcessor } from './processors/send-email.processor';
import { ScheduledJobsProcessor } from './processors/scheduled-jobs.processor';

// Schedulers
import { ScheduledJobExecutor } from './schedulers/scheduled-job-executor.scheduler';

// Controllers
import { JobsAdminController } from './controllers/jobs-admin.controller';
import { ScheduledJobsController } from './controllers/scheduled-jobs.controller';
// import { EmailSettingsController } from './controllers/email-settings.controller'; // DEPRECATED: Use platform-email-config controller
import { EmailTemplatesController } from './controllers/email-templates.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'email' },
      { name: 'scheduled' },
      { name: 'export' }, // Export queue for report generation
      { name: 'scheduled-reports' }, // Scheduled reports queue (separate from export)
    ),
    //     ScheduleModule.forRoot(),  // REMOVED: Should only be in AppModule (causes duplicate cron triggers)
    PrismaModule,
    EncryptionModule,
    AuditModule,
  ],
  providers: [
    // Services
    SmtpService,
    EmailTemplateService,
    EmailService,
    JobQueueService,
    ScheduledJobService,
    VariableRegistryService,
    TemplateValidatorService,

    // Handlers
    ExpiryCheckHandler,
    DataCleanupHandler,
    JobRetentionHandler,
    PartitionMaintenanceHandler,

    // Processors
    SendEmailProcessor,
    ScheduledJobsProcessor,

    // Schedulers
    ScheduledJobExecutor,
  ],
  controllers: [
    // Register specific routes BEFORE parameterized routes
    // EmailSettingsController, // DEPRECATED: Use platform-email-config controller
    EmailTemplatesController,
    ScheduledJobsController,
    JobsAdminController, // Has :id parameter, must be last
  ],
  exports: [
    EmailService,
    EmailTemplateService,
    SmtpService,
    JobQueueService,
    ScheduledJobService,
    VariableRegistryService,
  ],
})
export class JobsModule implements OnModuleInit {
  private readonly logger = new Logger(JobsModule.name);

  // CRITICAL FIX: Inject processors to force instantiation
  // NestJS lazy-loads providers - they're only instantiated when injected
  // By injecting here, we force constructors to run, which starts BullMQ workers
  constructor(
    private moduleRef: ModuleRef,
    private sendEmailProcessor: SendEmailProcessor,
    private scheduledJobsProcessor: ScheduledJobsProcessor,
  ) {}

  async onModuleInit() {
    this.logger.log('JobsModule initializing...');

    // Verify processors were instantiated (should all be true now)
    const processors = [
      { name: 'SendEmailProcessor', instance: this.sendEmailProcessor },
      { name: 'ScheduledJobsProcessor', instance: this.scheduledJobsProcessor },
    ];

    for (const processor of processors) {
      if (processor.instance) {
        this.logger.log(`✓ ${processor.name} instantiated and worker started`);
      } else {
        this.logger.error(`✗ ${processor.name} - FAILED TO INSTANTIATE`);
      }
    }

    this.logger.log(
      'JobsModule initialization complete - All workers should be listening',
    );
  }
}
