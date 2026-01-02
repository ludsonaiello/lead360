import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './core/database';
import { FileStorageModule } from './core/file-storage';
import { AuthModule, JwtAuthGuard } from './modules/auth';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(), // Enable cron jobs for background tasks
    PrismaModule,
    FileStorageModule, // File upload and storage service
    AuthModule,
    TenantModule, // Tenant management with multi-tenant isolation
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
