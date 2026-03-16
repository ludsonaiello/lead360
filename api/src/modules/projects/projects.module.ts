import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaModule } from '../../core/database/prisma.module';
import { PrismaService } from '../../core/database/prisma.service';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { QuotesModule } from '../quotes/quotes.module';
import { LeadsModule } from '../leads/leads.module';
import { FinancialModule } from '../financial/financial.module';
import { CommunicationModule } from '../communication/communication.module';
import { CalendarIntegrationModule } from '../calendar-integration/calendar-integration.module';
import { JobsModule } from '../jobs/jobs.module';
import { PortalModule } from '../portal/portal.module';
import { ScheduledJobService } from '../jobs/services/scheduled-job.service';
import { CrewMemberController } from './controllers/crew-member.controller';
import { CrewMemberService } from './services/crew-member.service';
import { SubcontractorController } from './controllers/subcontractor.controller';
import { SubcontractorService } from './services/subcontractor.service';
import { ProjectTemplateController } from './controllers/project-template.controller';
import { ProjectTemplateService } from './services/project-template.service';
import { ProjectController } from './controllers/project.controller';
import { ProjectService } from './services/project.service';
import { ProjectNumberGeneratorService } from './services/project-number-generator.service';
import { ProjectActivityService } from './services/project-activity.service';
import { ProjectDocumentController } from './controllers/project-document.controller';
import { ProjectDocumentService } from './services/project-document.service';
import { ProjectPhotoController } from './controllers/project-photo.controller';
import { ProjectPhotoService } from './services/project-photo.service';
import { ProjectTaskController } from './controllers/project-task.controller';
import { ProjectTaskService } from './services/project-task.service';
import { TaskDependencyService } from './services/task-dependency.service';
import { TaskAssignmentService } from './services/task-assignment.service';
import { TaskDelayCheckProcessor } from './processors/task-delay-check.processor';
import { InsuranceExpiryCheckProcessor } from './processors/insurance-expiry-check.processor';
import { InsuranceExpiryCheckScheduler } from './schedulers/insurance-expiry-check.scheduler';
import { ProjectLogController } from './controllers/project-log.controller';
import { ProjectLogService } from './services/project-log.service';
import { TaskCommunicationService } from './services/task-communication.service';
import { TaskCalendarEventService } from './services/task-calendar-event.service';
import { PermitController } from './controllers/permit.controller';
import { PermitService } from './services/permit.service';
import { InspectionController } from './controllers/inspection.controller';
import { InspectionService } from './services/inspection.service';
import { ChecklistTemplateController } from './controllers/checklist-template.controller';
import { ChecklistTemplateService } from './services/checklist-template.service';
import { ProjectCompletionController } from './controllers/project-completion.controller';
import { ProjectCompletionService } from './services/project-completion.service';
import { TaskFinancialController } from './controllers/task-financial.controller';
import { TaskFinancialService } from './services/task-financial.service';
import { TaskCrewHourController, CrewHourSummaryController } from './controllers/task-crew-hour.controller';
import { TaskCrewHourService } from './services/task-crew-hour.service';
import { ProjectDashboardController } from './controllers/project-dashboard.controller';
import { ProjectDashboardService } from './services/project-dashboard.service';
import { GanttDataService } from './services/gantt-data.service';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    AuditModule,
    FilesModule,
    QuotesModule,
    LeadsModule,
    FinancialModule,
    CommunicationModule,
    CalendarIntegrationModule,
    JobsModule,
    PortalModule,
    BullModule.registerQueue({ name: 'project-management' }),
  ],
  controllers: [
    CrewMemberController,
    SubcontractorController,
    ProjectTemplateController,
    ProjectDashboardController,
    ProjectController,
    ProjectDocumentController,
    ProjectPhotoController,
    ProjectTaskController,
    ProjectLogController,
    PermitController,
    InspectionController,
    ChecklistTemplateController,
    ProjectCompletionController,
    TaskFinancialController,
    TaskCrewHourController,
    CrewHourSummaryController,
  ],
  providers: [
    CrewMemberService,
    SubcontractorService,
    ProjectTemplateService,
    ProjectService,
    ProjectNumberGeneratorService,
    ProjectActivityService,
    ProjectDocumentService,
    ProjectPhotoService,
    TaskDependencyService,
    TaskAssignmentService,
    ProjectTaskService,
    TaskDelayCheckProcessor,
    InsuranceExpiryCheckProcessor,
    InsuranceExpiryCheckScheduler,
    ProjectLogService,
    TaskCommunicationService,
    TaskCalendarEventService,
    PermitService,
    InspectionService,
    ChecklistTemplateService,
    ProjectCompletionService,
    TaskFinancialService,
    TaskCrewHourService,
    ProjectDashboardService,
    GanttDataService,
  ],
  exports: [
    CrewMemberService,
    SubcontractorService,
    ProjectTemplateService,
    ProjectService,
    ProjectNumberGeneratorService,
    ProjectActivityService,
    ProjectDocumentService,
    ProjectPhotoService,
    TaskDependencyService,
    TaskAssignmentService,
    ProjectTaskService,
    ProjectLogService,
    TaskCommunicationService,
    TaskCalendarEventService,
    PermitService,
    InspectionService,
    ChecklistTemplateService,
    ProjectCompletionService,
    ProjectDashboardService,
    GanttDataService,
  ],
})
export class ProjectsModule implements OnModuleInit {
  private readonly logger = new Logger(ProjectsModule.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduledJobService: ScheduledJobService,
    @InjectQueue('project-management')
    private readonly projectManagementQueue: Queue,
    // Force processor instantiation so the BullMQ worker starts
    private readonly taskDelayCheckProcessor: TaskDelayCheckProcessor,
    private readonly insuranceExpiryCheckScheduler: InsuranceExpiryCheckScheduler,
  ) {}

  async onModuleInit() {
    this.logger.log('ProjectsModule initializing...');

    // Verify processor was instantiated
    if (this.taskDelayCheckProcessor) {
      this.logger.log(
        'TaskDelayCheckProcessor instantiated and worker started',
      );
    }

    // Register scheduled job in DB (idempotent — skip if exists)
    await this.registerDelayCheckJob();

    // Add repeatable BullMQ job for actual scheduling
    await this.setupRepeatableDelayCheckJob();

    // Sprint 33: Register and schedule the subcontractor insurance expiry check
    await this.insuranceExpiryCheckScheduler.setup(
      this.projectManagementQueue,
    );

    this.logger.log('ProjectsModule initialization complete');
  }

  /**
   * Register the delay check job in the scheduled_job table.
   * This makes it visible in the Platform Admin UI at /admin/jobs/schedules.
   * Uses upsert pattern: if job_type already registered, skip.
   */
  private async registerDelayCheckJob() {
    try {
      const existing = await this.prisma.scheduled_job.findUnique({
        where: { job_type: 'project-task-delay-check' },
      });

      if (existing) {
        this.logger.log(
          'Scheduled job "project-task-delay-check" already registered — skipping',
        );
        return;
      }

      await this.scheduledJobService.registerScheduledJob({
        job_type: 'project-task-delay-check',
        name: 'Project Task Delay Check',
        description:
          'Daily scan for overdue project tasks. Creates notifications for assigned project managers.',
        schedule: '0 6 * * *',
        timezone: 'UTC',
        max_retries: 3,
        timeout_seconds: 300,
      });

      this.logger.log(
        'Scheduled job "project-task-delay-check" registered successfully',
      );
    } catch (error) {
      this.logger.error(
        `Failed to register delay check scheduled job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Add a BullMQ repeatable job to the project-management queue.
   * BullMQ deduplicates repeatable jobs by key, so this is safe to call
   * on every module init (idempotent).
   */
  private async setupRepeatableDelayCheckJob() {
    try {
      await this.projectManagementQueue.add(
        'project-task-delay-check',
        {},
        {
          repeat: { pattern: '0 6 * * *', tz: 'UTC' },
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      this.logger.log(
        'Repeatable delay check job added to project-management queue (0 6 * * * UTC)',
      );
    } catch (error) {
      this.logger.error(
        `Failed to set up repeatable delay check job: ${error.message}`,
        error.stack,
      );
    }
  }
}
