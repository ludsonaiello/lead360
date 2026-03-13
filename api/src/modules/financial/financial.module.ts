import { Module } from '@nestjs/common';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { FinancialCategoryService } from './services/financial-category.service';
import { FinancialEntryService } from './services/financial-entry.service';
import { ReceiptService } from './services/receipt.service';
import { FinancialCategoryController } from './controllers/financial-category.controller';
import { FinancialEntryController } from './controllers/financial-entry.controller';
import { ProjectFinancialSummaryController } from './controllers/project-financial-summary.controller';
import { ReceiptController } from './controllers/receipt.controller';

@Module({
  imports: [PrismaModule, AuditModule, FilesModule],
  controllers: [
    FinancialCategoryController,
    FinancialEntryController,
    ProjectFinancialSummaryController,
    ReceiptController,
  ],
  providers: [FinancialCategoryService, FinancialEntryService, ReceiptService],
  exports: [FinancialCategoryService, FinancialEntryService, ReceiptService],
})
export class FinancialModule {}
