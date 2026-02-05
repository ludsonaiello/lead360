import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

// Core imports
import { PrismaModule } from '../../core/database/prisma.module';
import { FileStorageModule } from '../../core/file-storage/file-storage.module';

// Other module imports
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { TenantModule } from '../tenant/tenant.module';

// Services
import { DashboardService } from './services/dashboard.service';
import { TenantManagementService } from './services/tenant-management.service';
import { ImpersonationService } from './services/impersonation.service';
import { FeatureFlagService } from './services/feature-flag.service';
import { MaintenanceModeService } from './services/maintenance-mode.service';
import { AlertService } from './services/alert.service';
import { SystemSettingService } from './services/system-setting.service';
import { ExportService } from './services/export.service';
import { IndustryService } from './services/industry.service';

// Controllers
import { DashboardController } from './controllers/dashboard.controller';
import { TenantManagementController } from './controllers/tenant-management.controller';
import { AdminValidationController } from './controllers/admin-validation.controller';
import { ImpersonationController } from './controllers/impersonation.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { SystemSettingsController } from './controllers/system-settings.controller';
import { AlertsController } from './controllers/alerts.controller';
import { ExportsController } from './controllers/exports.controller';
import { IndustryController } from './controllers/industry.controller';

// Guards
import { PlatformAdminGuard } from './guards/platform-admin.guard';

// Middleware
import { FeatureFlagMiddleware } from './middleware/feature-flag.middleware';
import { MaintenanceModeMiddleware } from './middleware/maintenance-mode.middleware';
import { ImpersonationMiddleware } from './middleware/impersonation.middleware';

// Background Jobs
import { DailyStatsEmailJob } from './jobs/daily-stats-email.job';
import { NotificationCleanupJob } from './jobs/notification-cleanup.job';
import { MaintenanceModeCheckJob } from './jobs/maintenance-mode-check.job';

// Processors
import { ExportProcessorProcessor } from './processors/export-processor.processor';

@Module({
  imports: [
    // Core modules
    PrismaModule,
    FileStorageModule,

    // Other modules
    AuditModule,
    AuthModule,
    TenantModule,
    JobsModule,

    // BullMQ queue for exports
    BullModule.registerQueue({
      name: 'export',
    }),

    // Schedule module for cron jobs
    //     ScheduleModule.forRoot(),  // REMOVED: Should only be in AppModule (causes duplicate cron triggers)
  ],
  controllers: [
    DashboardController,
    TenantManagementController,
    AdminValidationController,
    ImpersonationController,
    UserManagementController,
    SystemSettingsController,
    AlertsController,
    ExportsController,
    IndustryController,
  ],
  providers: [
    // Services
    DashboardService,
    TenantManagementService,
    ImpersonationService,
    FeatureFlagService,
    MaintenanceModeService,
    AlertService,
    SystemSettingService,
    ExportService,
    IndustryService,

    // Guards
    PlatformAdminGuard,

    // Background Jobs
    DailyStatsEmailJob,
    NotificationCleanupJob,
    MaintenanceModeCheckJob,

    // Processors
    ExportProcessorProcessor,
  ],
  exports: [
    // Export services that might be used by other modules
    FeatureFlagService,
    MaintenanceModeService,
    ImpersonationService,
  ],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply feature flag middleware globally
    consumer
      .apply(FeatureFlagMiddleware)
      .forRoutes('*');

    // Apply maintenance mode middleware globally (excluding admin routes)
    consumer
      .apply(MaintenanceModeMiddleware)
      .forRoutes('*');

    // Apply impersonation middleware globally
    consumer
      .apply(ImpersonationMiddleware)
      .forRoutes('*');
  }
}
