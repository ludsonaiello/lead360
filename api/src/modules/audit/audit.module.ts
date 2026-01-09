import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database/prisma.module';
import { RBACModule } from '../rbac/rbac.module';

// Controllers
import { AuditController } from './audit.controller';

// Services
import { AuditLoggerService } from './services/audit-logger.service';
import { AuditReaderService } from './services/audit-reader.service';
import { AuditExportService } from './services/audit-export.service';

// Jobs
import { AuditLogWriteJob } from './jobs/audit-log-write.job';
import { PartitionCreatorJob } from './jobs/partition-creator.job';
import { RetentionEnforcerJob } from './jobs/retention-enforcer.job';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => RBACModule), // Use forwardRef to break circular dependency
    BullModule.registerQueue({
      name: 'audit-log-write',
    }),
  ],
  controllers: [AuditController],
  providers: [
    // Services
    AuditLoggerService,
    AuditReaderService,
    AuditExportService,
    // Background Jobs
    AuditLogWriteJob,
    PartitionCreatorJob,
    RetentionEnforcerJob,
  ],
  exports: [
    AuditLoggerService, // Export for use in other modules (Auth, Tenant, RBAC)
  ],
})
export class AuditModule {}
