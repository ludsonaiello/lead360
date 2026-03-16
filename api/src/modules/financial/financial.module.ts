import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';

// Gate 1 (Sprint 06)
import { FinancialCategoryService } from './services/financial-category.service';
import { FinancialEntryService } from './services/financial-entry.service';
import { FinancialCategoryController } from './controllers/financial-category.controller';
import { FinancialEntryController } from './controllers/financial-entry.controller';
import { ProjectFinancialSummaryController } from './controllers/project-financial-summary.controller';

// Gate 2 (Sprint 11)
import { ReceiptService } from './services/receipt.service';
import { ReceiptController } from './controllers/receipt.controller';

// Gate 3 (Sprint 27) — Crew Payments, Hour Logs, Subcontractor Payments, Invoices
import { CrewPaymentService } from './services/crew-payment.service';
import { CrewHourLogService } from './services/crew-hour-log.service';
import { SubcontractorPaymentService } from './services/subcontractor-payment.service';
import { SubcontractorInvoiceService } from './services/subcontractor-invoice.service';
import { CrewPaymentController, CrewPaymentHistoryController } from './controllers/crew-payment.controller';
import { CrewHourLogController } from './controllers/crew-hour-log.controller';
import { SubcontractorPaymentController, SubcontractorPaymentHistoryController, SubcontractorPaymentSummaryController } from './controllers/subcontractor-payment.controller';
import { SubcontractorInvoiceController, TaskInvoicesController, SubcontractorInvoiceListController } from './controllers/subcontractor-invoice.controller';

@Module({
  imports: [PrismaModule, AuditModule, FilesModule],
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
  ],
  providers: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    // Gate 2
    ReceiptService,
    // Gate 3
    CrewPaymentService,
    CrewHourLogService,
    SubcontractorPaymentService,
    SubcontractorInvoiceService,
  ],
  exports: [
    // Gate 1
    FinancialCategoryService,
    FinancialEntryService,
    // Gate 2
    ReceiptService,
    // Gate 3
    CrewPaymentService,
    CrewHourLogService,
    SubcontractorPaymentService,
    SubcontractorInvoiceService,
  ],
})
export class FinancialModule {}
