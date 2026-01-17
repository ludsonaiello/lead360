import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './core/database';
import { FileStorageModule } from './core/file-storage';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { TenantModule } from './modules/tenant/tenant.module';
import { FilesModule } from './modules/files/files.module';
import { RBACModule } from './modules/rbac/rbac.module';
import { AuditModule } from './modules/audit/audit.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AdminModule } from './modules/admin/admin.module';
import { LeadsModule } from './modules/leads/leads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(), // Enable cron jobs for background tasks
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('REDIS_HOST') || '127.0.0.1',
          port: configService.get('REDIS_PORT') || 6379,
          password: configService.get('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    FileStorageModule, // File upload and storage service
    AuthModule,
    AdminModule, // Platform Admin Dashboard & Management (MUST be before TenantModule to avoid route conflicts)
    TenantModule, // Tenant management with multi-tenant isolation
    FilesModule, // General file management with orphan tracking
    RBACModule, // Role-Based Access Control (RBAC) management
    AuditModule, // Audit logging with async queue and export functionality
    JobsModule, // Background jobs and email services
    LeadsModule, // Leads/Customer management with CRM functionality
  ],
  controllers: [HealthController],
  providers: [
    // Apply JwtAuthGuard globally - use @Public() decorator to skip auth
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
