# Sprint 10: SMS Analytics Export & Reporting

**Priority:** 🟢 MEDIUM
**Estimated Effort:** 2-3 days
**Developer:** AI Developer #10
**Dependencies:** Sprint 6 (Analytics Dashboard)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS

**REVIEW FIRST:**
1. Study Sprint 6 analytics service
2. Review CSV/Excel generation libraries
3. Check existing export patterns in codebase
4. Understand streaming large exports
5. Review file storage for temporary exports
6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

**DO NOT:**
- Generate exports synchronously (use queue for large exports)
- Store exports permanently (temp files, auto-delete)
- Expose sensitive data in exports

---

## Objective

Enable tenants to export SMS analytics data to CSV/Excel for external reporting and compliance documentation.

## Requirements

### 1. Install Dependencies

```bash
npm install csv-writer exceljs
```

---

### 2. Export Service

**File:** `api/src/modules/communication/services/sms-export.service.ts` (NEW)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { createObjectCsvWriter } from 'csv-writer';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SmsExportService {
  private readonly logger = new Logger(SmsExportService.name);
  private readonly EXPORT_DIR = '/var/www/lead360.app/api/exports';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export SMS history to CSV
   */
  async exportToCsv(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const filename = `sms_export_${tenantId}_${Date.now()}.csv`;
    const filepath = path.join(this.EXPORT_DIR, filename);

    // Ensure export directory exists
    if (!fs.existsSync(this.EXPORT_DIR)) {
      fs.mkdirSync(this.EXPORT_DIR, { recursive: true });
    }

    // Fetch SMS data
    const smsData = await this.prisma.communication_event.findMany({
      where: {
        tenant_id: tenantId,
        channel: 'sms',
        created_at: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        direction: true,
        to_phone: true,
        from_phone: true,
        text_body: true,
        status: true,
        sent_at: true,
        delivered_at: true,
        error_message: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: 'Event ID' },
        { id: 'direction', title: 'Direction' },
        { id: 'to_phone', title: 'To Phone' },
        { id: 'from_phone', title: 'From Phone' },
        { id: 'text_body', title: 'Message' },
        { id: 'status', title: 'Status' },
        { id: 'sent_at', title: 'Sent At' },
        { id: 'delivered_at', title: 'Delivered At' },
        { id: 'error_message', title: 'Error' },
        { id: 'created_at', title: 'Created At' },
      ],
    });

    await csvWriter.writeRecords(smsData);

    this.logger.log(`Exported ${smsData.length} SMS records to ${filename}`);

    return filename;
  }

  /**
   * Export SMS analytics to Excel
   */
  async exportToExcel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string> {
    const filename = `sms_analytics_${tenantId}_${Date.now()}.xlsx`;
    const filepath = path.join(this.EXPORT_DIR, filename);

    const workbook = new ExcelJS.Workbook();

    // Sheet 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    const summary = await this.getSummaryData(tenantId, startDate, endDate);

    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
    ];

    summarySheet.addRows([
      { metric: 'Total Sent', value: summary.total_sent },
      { metric: 'Total Delivered', value: summary.total_delivered },
      { metric: 'Total Failed', value: summary.total_failed },
      { metric: 'Delivery Rate (%)', value: summary.delivery_rate },
      { metric: 'Total Cost ($)', value: summary.total_cost },
      { metric: 'Unique Recipients', value: summary.unique_recipients },
      { metric: 'Opt-Out Count', value: summary.opt_out_count },
    ]);

    // Sheet 2: Daily Trends
    const trendsSheet = workbook.addWorksheet('Daily Trends');
    const trends = await this.getTrendsData(tenantId, startDate, endDate);

    trendsSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Sent', key: 'sent_count', width: 15 },
      { header: 'Delivered', key: 'delivered_count', width: 15 },
      { header: 'Failed', key: 'failed_count', width: 15 },
    ];

    trendsSheet.addRows(trends);

    // Sheet 3: Failure Breakdown
    const failuresSheet = workbook.addWorksheet('Failures');
    const failures = await this.getFailuresData(tenantId, startDate, endDate);

    failuresSheet.columns = [
      { header: 'Error Code', key: 'error_code', width: 20 },
      { header: 'Count', key: 'count', width: 15 },
    ];

    failuresSheet.addRows(failures);

    // Save workbook
    await workbook.xlsx.writeFile(filepath);

    this.logger.log(`Exported analytics to ${filename}`);

    return filename;
  }

  /**
   * Clean up old export files (older than 24 hours)
   */
  async cleanupOldExports() {
    const files = fs.readdirSync(this.EXPORT_DIR);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const file of files) {
      const filepath = path.join(this.EXPORT_DIR, file);
      const stats = fs.statSync(filepath);

      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filepath);
        this.logger.log(`Deleted old export: ${file}`);
      }
    }
  }

  private async getSummaryData(tenantId: string, startDate: Date, endDate: Date) {
    // Reuse logic from SmsAnalyticsService (Sprint 6)
    // REVIEW: Import and use existing analytics service
  }

  private async getTrendsData(tenantId: string, startDate: Date, endDate: Date) {
    // Reuse logic from SmsAnalyticsService
  }

  private async getFailuresData(tenantId: string, startDate: Date, endDate: Date) {
    // Reuse logic from SmsAnalyticsService
  }
}
```

---

### 3. Export Controller

**File:** `api/src/modules/communication/controllers/sms-export.controller.ts` (NEW)

```typescript
import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/jwt-auth.guard';
import { RolesGuard } from '../../../core/auth/roles.guard';
import { Roles } from '../../../core/auth/roles.decorator';
import { SmsExportService } from '../services/sms-export.service';
import { Response } from 'express';
import * as path from 'path';

@Controller('communication/sms/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Owner', 'Admin', 'Manager')
export class SmsExportController {
  constructor(private readonly exportService: SmsExportService) {}

  @Get('csv')
  async exportCsv(
    @Req() req: any,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenant_id;
    const start = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(endDate || Date.now());

    const filename = await this.exportService.exportToCsv(tenantId, start, end);
    const filepath = path.join('/var/www/lead360.app/api/exports', filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  }

  @Get('excel')
  async exportExcel(
    @Req() req: any,
    @Query('start_date') startDate: string,
    @Query('end_date') endDate: string,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenant_id;
    const start = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = new Date(endDate || Date.now());

    const filename = await this.exportService.exportToExcel(tenantId, start, end);
    const filepath = path.join('/var/www/lead360.app/api/exports', filename);

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  }
}
```

---

### 4. Cleanup Cron Job

**File:** `api/src/modules/communication/cron/export-cleanup.cron.ts` (NEW)

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SmsExportService } from '../services/sms-export.service';

@Injectable()
export class ExportCleanupCron {
  constructor(private readonly exportService: SmsExportService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldExports() {
    await this.exportService.cleanupOldExports();
  }
}
```

---

## Testing

**Test 1: CSV Export**
```bash
GET /communication/sms/export/csv?start_date=2026-01-01&end_date=2026-02-13
```
- Verify: CSV file downloaded
- Verify: Contains SMS data

**Test 2: Excel Export**
```bash
GET /communication/sms/export/excel?start_date=2026-01-01&end_date=2026-02-13
```
- Verify: Excel file downloaded
- Verify: 3 sheets (Summary, Trends, Failures)

**Test 3: Multi-Tenant Isolation**
- Export as Tenant A
- Verify: Only Tenant A's data in export

**Test 4: Cleanup Cron**
- Create export file
- Manually set mtime to 25 hours ago
- Run cron
- Verify: File deleted

---

## Acceptance Criteria

- [ ] SmsExportService implemented
- [ ] CSV export works
- [ ] Excel export works (3 sheets)
- [ ] Export controller created
- [ ] File download works
- [ ] Cleanup cron job scheduled
- [ ] Multi-tenant isolation verified
- [ ] RBAC enforced
- [ ] All tests pass
- [ ] API documentation updated

---

**END OF SPRINT 10**
**END OF ALL SMS IMPROVEMENT SPRINTS**
