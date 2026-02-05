import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../core/database/prisma.module';
import { CacheModule } from '../../core/cache/cache.module';
import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { FilesModule } from '../files/files.module';
import { CommunicationModule } from '../communication/communication.module';

// Services (Dev 2)
import { VendorService } from './services/vendor.service';
import { UnitMeasurementService } from './services/unit-measurement.service';
import { BundleService } from './services/bundle.service';
import { QuoteSettingsService } from './services/quote-settings.service';
import { QuoteTemplateService } from './services/quote-template.service';

// Services (Dev 3)
import { QuoteNumberGeneratorService } from './services/quote-number-generator.service';
import { QuoteJobsiteAddressService } from './services/quote-jobsite-address.service';
import { QuoteVersionService } from './services/quote-version.service';
import { QuoteService } from './services/quote.service';
import { QuoteItemService } from './services/quote-item.service';
import { QuoteGroupService } from './services/quote-group.service';
import { ItemLibraryService } from './services/item-library.service';
import { QuotePricingService } from './services/quote-pricing.service';

// Services (Dev 4)
import { DiscountRuleService } from './services/discount-rule.service';
import { DrawScheduleService } from './services/draw-schedule.service';
import { ApprovalWorkflowService } from './services/approval-workflow.service';
import { QuoteVersionComparisonService } from './services/quote-version-comparison.service';
import { ProfitabilityAnalyzerService } from './services/profitability-analyzer.service';

// Services (Dev 5)
import { QuotePublicAccessService } from './services/quote-public-access.service';
import { QuoteViewTrackingService } from './services/quote-view-tracking.service';
import { QuotePdfGeneratorService } from './services/quote-pdf-generator.service';
import { QrCodeGeneratorService } from './services/qr-code-generator.service';
import { QuoteEmailService } from './services/quote-email.service';
import { QuoteDashboardService } from './services/quote-dashboard.service';
import { QuoteSearchService } from './services/quote-search.service';
import { ChangeOrderService } from './services/change-order.service';
import { QuoteAttachmentService } from './services/quote-attachment.service';
import { QuoteTagService } from './services/quote-tag.service';
import { WarrantyTierService } from './services/warranty-tier.service';
import { QuoteNotesService } from './services/quote-notes.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminTenantService } from './services/admin-tenant.service';
import { AdminOperationsService } from './services/admin-operations.service';
import { AdminReportingService } from './services/admin-reporting.service';
import { AdminTemplateTestingService } from './services/admin-template-testing.service';
import { ScheduledReportSchedulerService } from './services/scheduled-report-scheduler.service';

// Template Builder Services (Dev 6)
import { TemplateValidatorService } from './services/template-builder/template-validator.service';
import { TemplateComponentService } from './services/template-builder/template-component.service';
import { CodeTemplateBuilderService } from './services/template-builder/code-template-builder.service';
import { VisualTemplateBuilderService } from './services/template-builder/visual-template-builder.service';
import { TemplateRendererService } from './services/template-builder/template-renderer.service';
import { TemplateMigrationService } from './services/template-builder/template-migration.service';

// Processors
import { ReportGenerationProcessor } from './processors/report-generation.processor';
import { ScheduledReportProcessor } from './processors/scheduled-report.processor';

// Controllers (Dev 2)
import { VendorController } from './controllers/vendor.controller';
import {
  UnitMeasurementController,
  UnitMeasurementAdminController,
} from './controllers/unit-measurement.controller';
import { BundleController } from './controllers/bundle.controller';
import { QuoteSettingsController } from './controllers/quote-settings.controller';
import {
  QuoteTemplateController,
  QuoteTemplateAdminController,
} from './controllers/quote-template.controller';

// Controllers (Dev 3)
import { QuoteController } from './controllers/quote.controller';
import { QuoteItemController } from './controllers/quote-item.controller';
import { QuoteGroupController } from './controllers/quote-group.controller';
import { ItemLibraryController } from './controllers/item-library.controller';

// Controllers (Dev 4)
import { QuoteDiscountController } from './controllers/quote-discount.controller';
import { DrawScheduleController } from './controllers/draw-schedule.controller';
import { QuoteApprovalController } from './controllers/quote-approval.controller';
import { QuoteVersionController } from './controllers/quote-version.controller';
import { QuoteProfitabilityController } from './controllers/quote-profitability.controller';

// Controllers (Dev 5)
import { QuotePublicController } from './controllers/quote-public.controller';
import { QuotePdfController } from './controllers/quote-pdf.controller';
import { QuoteAnalyticsController } from './controllers/quote-analytics.controller';
import { QuoteDashboardController } from './controllers/quote-dashboard.controller';
import { QuoteAdminController } from './controllers/quote-admin.controller';
import { QuoteSearchController } from './controllers/quote-search.controller';
import { ChangeOrderController } from './controllers/change-order.controller';
import { QuoteAttachmentController } from './controllers/quote-attachment.controller';
import { QuoteEmailController } from './controllers/quote-email.controller';
import { QuoteTagController } from './controllers/quote-tag.controller';
import { WarrantyTierController } from './controllers/warranty-tier.controller';
import { QuoteNotesController } from './controllers/quote-notes.controller';

@Module({
  imports: [
    PrismaModule,
    CacheModule, // Redis caching for analytics (Admin)
    AuditModule,
    LeadsModule, // Provides GoogleMapsService
    FilesModule, // Provides FilesService
    CommunicationModule, // Provides SendEmailService (Dev 5)
    ThrottlerModule, // Rate limiting for public endpoints (Dev 5)
    //     ScheduleModule.forRoot(), // Cron jobs for scheduled reports (Dev 4)  // REMOVED: Should only be in AppModule (causes duplicate cron triggers)
    BullModule.registerQueue(
      { name: 'export' }, // BullMQ queue for report generation (Dev 4)
      { name: 'scheduled-reports' }, // BullMQ queue for scheduled report triggers
    ),
  ],
  controllers: [
    // Dev 2 controllers
    VendorController,
    UnitMeasurementController,
    UnitMeasurementAdminController,
    BundleController,
    QuoteSettingsController,
    QuoteTemplateController,
    QuoteTemplateAdminController,
    // Dev 3 controllers (42 endpoints total)
    QuoteController, // 12 endpoints
    QuoteItemController, // 10 endpoints
    QuoteGroupController, // 6 endpoints
    ItemLibraryController, // 8 endpoints
    // Dev 4 controllers (26 endpoints total)
    QuoteDiscountController, // 7 endpoints
    DrawScheduleController, // 4 endpoints
    QuoteApprovalController, // 8 endpoints
    QuoteVersionController, // 6 endpoints
    QuoteProfitabilityController, // 2 endpoints
    // Dev 5 controllers (44 endpoints total)
    QuotePublicController, // 3 endpoints (public access)
    QuotePdfController, // 2 endpoints (PDF generation)
    QuoteAnalyticsController, // 5 endpoints (view tracking & public access)
    QuoteDashboardController, // 8 endpoints (tenant dashboard)
    QuoteAdminController, // 6 endpoints (admin dashboard)
    QuoteSearchController, // 4 endpoints (advanced search)
    ChangeOrderController, // 6 endpoints (change orders)
    QuoteAttachmentController, // 6 endpoints (attachments)
    QuoteEmailController, // 1 endpoint (email delivery)
    QuoteTagController, // 8 endpoints (tags)
    WarrantyTierController, // 5 endpoints (warranty tiers)
    QuoteNotesController, // 4 endpoints (notes)
  ],
  providers: [
    // Dev 2 services
    VendorService,
    UnitMeasurementService,
    BundleService,
    QuoteSettingsService,
    QuoteTemplateService,
    // Dev 3 services
    QuoteNumberGeneratorService,
    QuoteJobsiteAddressService,
    QuoteVersionService,
    QuoteService,
    QuoteItemService,
    QuoteGroupService,
    ItemLibraryService,
    QuotePricingService,
    // Dev 4 services
    DiscountRuleService,
    DrawScheduleService,
    ApprovalWorkflowService,
    QuoteVersionComparisonService,
    ProfitabilityAnalyzerService,
    // Dev 5 services
    QuotePublicAccessService,
    QuoteViewTrackingService,
    QuotePdfGeneratorService,
    QrCodeGeneratorService,
    QuoteEmailService,
    QuoteDashboardService,
    QuoteSearchService,
    ChangeOrderService,
    QuoteAttachmentService,
    QuoteTagService,
    WarrantyTierService,
    QuoteNotesService,
    // Admin services
    AdminAnalyticsService,
    AdminTenantService,
    AdminOperationsService,
    AdminReportingService,
    AdminTemplateTestingService,
    ScheduledReportSchedulerService,
    // Template Builder services (Dev 6)
    TemplateValidatorService,
    TemplateComponentService,
    CodeTemplateBuilderService,
    VisualTemplateBuilderService,
    TemplateRendererService,
    TemplateMigrationService,
    // Processors
    ReportGenerationProcessor,
    ScheduledReportProcessor,
  ],
  exports: [
    // Dev 2 services
    VendorService,
    UnitMeasurementService,
    BundleService,
    QuoteSettingsService,
    QuoteTemplateService,
    // Dev 3 services
    QuoteNumberGeneratorService,
    QuoteJobsiteAddressService,
    QuoteVersionService,
    QuoteService,
    QuoteItemService,
    QuoteGroupService,
    ItemLibraryService,
    QuotePricingService,
    // Dev 4 services
    DiscountRuleService,
    DrawScheduleService,
    ApprovalWorkflowService,
    QuoteVersionComparisonService,
    ProfitabilityAnalyzerService,
    // Dev 5 services (key services for external module use)
    QuotePublicAccessService,
    QuotePdfGeneratorService,
    QuoteEmailService,
  ],
})
export class QuotesModule {}
