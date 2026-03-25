import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { LeadsModule } from '../leads/leads.module';

// Gate 1 (Sprint 06)
import { FinancialCategoryService } from './services/financial-category.service';
import { FinancialEntryService } from './services/financial-entry.service';
import { FinancialCategoryController } from './controllers/financial-category.controller';
import { FinancialEntryController } from './controllers/financial-entry.controller';
import { ProjectFinancialSummaryController } from './controllers/project-financial-summary.controller';
import { ProjectFinancialSummaryService } from './services/project-financial-summary.service';

// Gate 2 (Sprint 11)
import { ReceiptService } from './services/receipt.service';
import { ReceiptController } from './controllers/receipt.controller';

// F-05 — Receipt OCR
import { OcrService } from './services/ocr.service';

// Gate 3 (Sprint 27) — Crew Payments, Hour Logs, Subcontractor Payments, Invoices
import { CrewPaymentService } from './services/crew-payment.service';
import { CrewHourLogService } from './services/crew-hour-log.service';
import { SubcontractorPaymentService } from './services/subcontractor-payment.service';
import { SubcontractorInvoiceService } from './services/subcontractor-invoice.service';
import {
  CrewPaymentController,
  CrewPaymentHistoryController,
} from './controllers/crew-payment.controller';
import { CrewHourLogController } from './controllers/crew-hour-log.controller';
import {
  SubcontractorPaymentController,
  SubcontractorPaymentHistoryController,
  SubcontractorPaymentSummaryController,
} from './controllers/subcontractor-payment.controller';
import {
  SubcontractorInvoiceController,
  TaskInvoicesController,
  SubcontractorInvoiceListController,
} from './controllers/subcontractor-invoice.controller';

// Gate 4 (Sprint F-02) — Supplier Registry
import { SupplierCategoryService } from './services/supplier-category.service';
import { SupplierService } from './services/supplier.service';
import { SupplierProductService } from './services/supplier-product.service';
import { SupplierCategoryController } from './controllers/supplier-category.controller';
import { SupplierController } from './controllers/supplier.controller';
import { SupplierProductController } from './controllers/supplier-product.controller';

// Sprint F-03: Payment Method Registry
import { PaymentMethodRegistryService } from './services/payment-method-registry.service';
import { PaymentMethodRegistryController } from './controllers/payment-method-registry.controller';

// Sprint F-06: Recurring Expense Rules
import { RecurringExpenseService } from './services/recurring-expense.service';
import { RecurringExpenseController } from './controllers/recurring-expense.controller';

// Sprint F-08: Draw Milestones & Project Invoices
import { InvoiceNumberGeneratorService } from './services/invoice-number-generator.service';
import { DrawMilestoneService } from './services/draw-milestone.service';
import { ProjectInvoiceService } from './services/project-invoice.service';
import { DrawMilestoneController } from './controllers/draw-milestone.controller';
import { ProjectInvoiceController } from './controllers/project-invoice.controller';

// Sprint F-09: Financial Dashboard
import { DashboardService } from './services/dashboard.service';
import { DashboardController } from './controllers/dashboard.controller';

// Sprint F-10: Account Mapping & Export
import { AccountMappingService } from './services/account-mapping.service';
import { ExportService } from './services/export.service';
import { AccountMappingController } from './controllers/account-mapping.controller';
import { ExportController } from './controllers/export.controller';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    FilesModule,
    LeadsModule,
    BullModule.registerQueue({ name: 'ocr-processing' }), // F-05: OCR queue for ReceiptService
    BullModule.registerQueue({ name: 'recurring-expense-generation' }), // F-06: Recurring expense queue for RecurringExpenseService
  ],
  controllers: [
    // Gate 1
    FinancialCategoryController,
    FinancialEntryController,
    ProjectFinancialSummaryController,
    // Gate 2
    ReceiptController,
    // Gate 3
    CrewPaymentController,
    CrewPaymentHistoryController,
    CrewHourLogController,
    SubcontractorPaymentController,
    SubcontractorPaymentHistoryController,
    SubcontractorPaymentSummaryController,
    SubcontractorInvoiceController,
    TaskInvoicesController,
    SubcontractorInvoiceListController,
    // Gate 4 — Supplier Registry
    SupplierCategoryController,
    SupplierController,
    SupplierProductController,
    // Sprint F-03 — Payment Method Registry
    PaymentMethodRegistryController,
    // Sprint F-06 — Recurring Expense Rules
    RecurringExpenseController,
    // Sprint F-08 — Draw Milestones & Project Invoices
    DrawMilestoneController,
    ProjectInvoiceController,
    // Sprint F-09 — Financial Dashboard
    DashboardController,
    // Sprint F-10 — Account Mapping & Export
    AccountMappingController,
    ExportController,
  ],
  providers: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    ProjectFinancialSummaryService,
    // Gate 2
    ReceiptService,
    OcrService,
    // Gate 3
    CrewPaymentService,
    CrewHourLogService,
    SubcontractorPaymentService,
    SubcontractorInvoiceService,
    // Gate 4 — Supplier Registry
    SupplierCategoryService,
    SupplierService,
    SupplierProductService,
    // Sprint F-03 — Payment Method Registry
    PaymentMethodRegistryService,
    // Sprint F-06 — Recurring Expense Rules
    RecurringExpenseService,
    // Sprint F-08 — Invoice Number Generator, Draw Milestones & Project Invoices
    InvoiceNumberGeneratorService,
    DrawMilestoneService,
    ProjectInvoiceService,
    // Sprint F-09 — Financial Dashboard
    DashboardService,
    // Sprint F-10 — Account Mapping & Export
    AccountMappingService,
    ExportService,
  ],
  exports: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    ProjectFinancialSummaryService,
    // Gate 2
    ReceiptService,
    OcrService,
    // Gate 3
    CrewPaymentService,
    CrewHourLogService,
    SubcontractorPaymentService,
    SubcontractorInvoiceService,
    // Gate 4 — Supplier Registry
    SupplierService,
    // Sprint F-03 — Payment Method Registry (exported for F-04 findDefault)
    PaymentMethodRegistryService,
    // Sprint F-06 — Recurring Expense Rules (exported for Jobs module processor)
    RecurringExpenseService,
    // Sprint F-08 — Invoice Number Generator, Draw Milestones & Project Invoices
    InvoiceNumberGeneratorService,
    DrawMilestoneService,
    ProjectInvoiceService,
    // Sprint F-09 — Financial Dashboard
    DashboardService,
    // Sprint F-10 — Account Mapping & Export
    AccountMappingService,
    ExportService,
  ],
})
export class FinancialModule {}
