import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../core/database/prisma.module';
import { AuditModule } from '../audit/audit.module';

// Controllers
import { TenantController } from './tenant.controller';
import { AdminController } from './admin.controller';

// Services
import { TenantService } from './services/tenant.service';
import { TenantAddressService } from './services/tenant-address.service';
import { TenantLicenseService } from './services/tenant-license.service';
import { TenantInsuranceService } from './services/tenant-insurance.service';
import { TenantPaymentTermsService } from './services/tenant-payment-terms.service';
import { TenantBusinessHoursService } from './services/tenant-business-hours.service';
import { TenantServiceAreaService } from './services/tenant-service-area.service';
import { SubscriptionService } from './services/subscription.service';
import { LicenseTypeService } from './services/license-type.service';
import { ServiceService } from './services/service.service';

// Middleware
import { TenantResolutionMiddleware } from './middleware/tenant-resolution.middleware';

// Guards
import { FeatureFlagGuard } from './guards/feature-flag.guard';

// Background Jobs
import { LicenseExpiryCheckJob } from './jobs/license-expiry-check.job';
import { InsuranceExpiryCheckJob } from './jobs/insurance-expiry-check.job';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    JwtModule.register({}), // Register JwtModule for middleware to use
    ConfigModule, // ConfigModule is global, but explicitly import for clarity
  ],
  controllers: [TenantController, AdminController],
  providers: [
    // Services
    TenantService,
    TenantAddressService,
    TenantLicenseService,
    TenantInsuranceService,
    TenantPaymentTermsService,
    TenantBusinessHoursService,
    TenantServiceAreaService,
    SubscriptionService,
    LicenseTypeService,
    ServiceService,

    // Middleware
    TenantResolutionMiddleware,

    // Guards
    FeatureFlagGuard,

    // Background Jobs
    LicenseExpiryCheckJob,
    InsuranceExpiryCheckJob,
  ],
  exports: [
    TenantService,
    TenantAddressService,
    TenantLicenseService,
    TenantInsuranceService,
    TenantPaymentTermsService,
    TenantBusinessHoursService,
    TenantServiceAreaService,
    SubscriptionService,
    LicenseTypeService,
    ServiceService,
    TenantResolutionMiddleware,
    FeatureFlagGuard,
  ],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply TenantResolutionMiddleware globally to all routes
    consumer.apply(TenantResolutionMiddleware).forRoutes('*'); // Apply to all routes
  }
}
