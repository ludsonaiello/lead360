import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExportService } from './export.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

// ============================================================================
// Constants
// ============================================================================
const TENANT_ID = 'tenant-test-001';
const OTHER_TENANT_ID = 'tenant-other-999';
const USER_ID = 'user-test-001';
const CATEGORY_ID_1 = 'cat-001';
const PROJECT_ID_1 = 'proj-001';

// ============================================================================
// Mock factories
// ============================================================================
const mockEntry = (overrides: any = {}) => ({
  id: 'entry-001',
  entry_date: new Date('2026-03-15'),
  amount: 150.5,
  notes: 'Office supplies',
  vendor_name: 'Staples',
  tax_amount: 12.04,
  payment_method: 'credit_card',
  category_id: CATEGORY_ID_1,
  project_id: PROJECT_ID_1,
  category: { name: 'Materials' },
  supplier: { name: 'Staples Inc' },
  project: { name: 'Kitchen Remodel' },
  ...overrides,
});

const mockInvoice = (overrides: any = {}) => ({
  id: 'inv-001',
  invoice_number: 'INV-001',
  amount: 5000.0,
  tax_amount: 400.0,
  description: 'Phase 1 completion',
  due_date: new Date('2026-04-15'),
  status: 'sent',
  created_at: new Date('2026-03-10'),
  project: {
    name: 'Kitchen Remodel',
    project_number: 'PRJ-001',
  },
  ...overrides,
});

// ============================================================================
// Mock setup
// ============================================================================
const mockPrisma = {
  financial_entry: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  financial_category_account_mapping: {
    findMany: jest.fn(),
  },
  financial_export_log: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  project_invoice: {
    findMany: jest.fn(),
  },
  supplier: {
    findFirst: jest.fn(),
  },
};

const mockAuditLogger = {
  log: jest.fn(),
  logTenantChange: jest.fn(),
};

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);

    // Reset mocks
    jest.clearAllMocks();
  });

  // ==========================================================================
  // formatDateQB — Task 2
  // ==========================================================================
  describe('formatDateQB', () => {
    it('should format 2026-01-15 as 01/15/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-01-15'))).toBe('01/15/2026');
    });

    it('should format 2026-12-31 as 12/31/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-12-31'))).toBe('12/31/2026');
    });

    it('should format 2026-03-05 as 03/05/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-03-05'))).toBe('03/05/2026');
    });

    it('should format 2026-02-28 as 02/28/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-02-28'))).toBe('02/28/2026');
    });

    it('should zero-pad single-digit month/day: 2026-09-09 as 09/09/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-09-09'))).toBe('09/09/2026');
    });

    it('should format 2026-07-04 as 07/04/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-07-04'))).toBe('07/04/2026');
    });

    it('should format 2026-11-25 as 11/25/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-11-25'))).toBe('11/25/2026');
    });

    it('should format 2025-01-01 as 01/01/2025', () => {
      expect((service as any).formatDateQB(new Date('2025-01-01'))).toBe('01/01/2025');
    });

    it('should format 2026-06-30 as 06/30/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-06-30'))).toBe('06/30/2026');
    });

    it('should format 2026-10-31 as 10/31/2026', () => {
      expect((service as any).formatDateQB(new Date('2026-10-31'))).toBe('10/31/2026');
    });
  });

  // ==========================================================================
  // formatDateXero — Task 2
  // ==========================================================================
  describe('formatDateXero', () => {
    it('should format 2026-01-15 as 15/01/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-01-15'))).toBe('15/01/2026');
    });

    it('should format 2026-12-31 as 31/12/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-12-31'))).toBe('31/12/2026');
    });

    it('should format 2026-03-05 as 05/03/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-03-05'))).toBe('05/03/2026');
    });

    it('should format 2026-02-28 as 28/02/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-02-28'))).toBe('28/02/2026');
    });

    it('should zero-pad single-digit month/day: 2026-09-09 as 09/09/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-09-09'))).toBe('09/09/2026');
    });

    it('should format 2026-07-04 as 04/07/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-07-04'))).toBe('04/07/2026');
    });

    it('should format 2026-11-25 as 25/11/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-11-25'))).toBe('25/11/2026');
    });

    it('should format 2025-01-01 as 01/01/2025', () => {
      expect((service as any).formatDateXero(new Date('2025-01-01'))).toBe('01/01/2025');
    });

    it('should format 2026-06-30 as 30/06/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-06-30'))).toBe('30/06/2026');
    });

    it('should format 2026-10-31 as 31/10/2026', () => {
      expect((service as any).formatDateXero(new Date('2026-10-31'))).toBe('31/10/2026');
    });
  });

  // ==========================================================================
  // escapeCsvField — Task 6
  // ==========================================================================
  describe('escapeCsvField', () => {
    it('should return empty string for null', () => {
      expect((service as any).escapeCsvField(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect((service as any).escapeCsvField(undefined)).toBe('');
    });

    it('should return plain string when no special characters', () => {
      expect((service as any).escapeCsvField('Hello World')).toBe('Hello World');
    });

    it('should wrap in quotes when comma present', () => {
      expect((service as any).escapeCsvField('Smith, Jones & Co.')).toBe(
        '"Smith, Jones & Co."',
      );
    });

    it('should double internal quotes', () => {
      expect((service as any).escapeCsvField('He said "hello"')).toBe(
        '"He said ""hello"""',
      );
    });

    it('should handle newlines', () => {
      expect((service as any).escapeCsvField('Line 1\nLine 2')).toBe(
        '"Line 1\nLine 2"',
      );
    });

    it('should handle carriage returns', () => {
      expect((service as any).escapeCsvField('Line 1\rLine 2')).toBe(
        '"Line 1\rLine 2"',
      );
    });

    it('should convert number to string', () => {
      expect((service as any).escapeCsvField(42.5)).toBe('42.5');
    });

    it('should handle commas and quotes together', () => {
      expect((service as any).escapeCsvField('"Total, $100"')).toBe(
        '"""Total, $100"""',
      );
    });
  });

  // ==========================================================================
  // validateDateRange (tested indirectly via exports) — Task 5
  // ==========================================================================
  describe('exportQBExpenses — date validation', () => {
    it('should throw 400 if date_from is after date_to', async () => {
      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, {
          date_from: '2026-06-01',
          date_to: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, {
          date_from: '2026-06-01',
          date_to: '2026-01-01',
        }),
      ).rejects.toThrow('date_from must be before or equal to date_to');
    });

    it('should throw 400 if date range exceeds 366 days', async () => {
      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, {
          date_from: '2025-01-01',
          date_to: '2026-06-01',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, {
          date_from: '2025-01-01',
          date_to: '2026-06-01',
        }),
      ).rejects.toThrow('Date range cannot exceed 366 days');
    });

    it('should throw 400 for invalid date formats', async () => {
      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, {
          date_from: 'not-a-date',
          date_to: '2026-01-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================================================
  // exportQBExpenses — Task 7
  // ==========================================================================
  describe('exportQBExpenses', () => {
    const validQuery = {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    };

    beforeEach(() => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);
    });

    it('should throw 400 when no records match', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);

      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('No records match the selected filters');
    });

    it('should throw 400 when records exceed 50000', async () => {
      const bigArray = new Array(50001).fill(mockEntry());
      mockPrisma.financial_entry.findMany.mockResolvedValue(bigArray);

      await expect(
        service.exportQBExpenses(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('Export too large');
    });

    it('should generate valid CSV with correct header', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount',
      );
      expect(lines.length).toBe(2); // header + 1 data row
    });

    it('should format dates as MM/DD/YYYY in CSV', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ entry_date: new Date('2026-03-15') }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow.startsWith('03/15/2026,')).toBe(true);
    });

    it('should output positive amounts', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ amount: 150.5 }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('150.50');
    });

    it('should use account mapping when available', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([
        {
          category_id: CATEGORY_ID_1,
          account_name: 'Job Materials',
          account_code: '5100',
        },
      ]);
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Job Materials');
    });

    it('should fall back to category name when no mapping exists', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Materials');
    });

    it('should translate payment methods via PAYMENT_METHOD_QB_MAP', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ payment_method: 'credit_card' }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Credit Card');
    });

    it('should include tenant_id in entry query', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should include tenant_id in account mapping query', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(
        mockPrisma.financial_category_account_mapping.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should default to confirmed entries only', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ submission_status: 'confirmed' }),
        }),
      );
    });

    it('should not filter by submission_status when include_pending is true', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, {
        ...validQuery,
        include_pending: true,
      });

      const callArgs = mockPrisma.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where.submission_status).toBeUndefined();
    });

    it('should exclude recurring instances by default', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_recurring_instance: false }),
        }),
      );
    });

    it('should not exclude recurring instances when include_recurring is true', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, {
        ...validQuery,
        include_recurring: true,
      });

      const callArgs = mockPrisma.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where.is_recurring_instance).toBeUndefined();
    });

    it('should log export to financial_export_log', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_export_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            export_type: 'quickbooks_expenses',
            exported_by_user_id: USER_ID,
            record_count: 1,
          }),
        }),
      );
    });

    it('should write audit log with accessed action', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportQBExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          actor_user_id: USER_ID,
          action_type: 'accessed',
          entity_type: 'financial_export',
          entity_id: 'quickbooks_expenses',
        }),
      );
    });

    it('should return correct fileName format', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.fileName).toBe(
        'quickbooks-expenses-2026-01-01-to-2026-03-31.csv',
      );
    });

    it('should return correct recordCount', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry(),
        mockEntry({ id: 'entry-002' }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.recordCount).toBe(2);
    });

    it('should use supplier name over vendor_name when available', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({
          supplier: { name: 'Supplier Co' },
          vendor_name: 'Legacy Vendor',
        }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Supplier Co');
      expect(dataRow).not.toContain('Legacy Vendor');
    });

    it('should handle entry with null optional fields', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({
          notes: null,
          vendor_name: null,
          tax_amount: null,
          payment_method: null,
          supplier: null,
          project: null,
        }),
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.csv.split('\n').length).toBe(2);
    });

    it('should map all 10 QB columns correctly in a single row', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        {
          id: 'entry-full',
          entry_date: new Date('2026-03-15'),
          amount: 250.75,
          notes: 'Lumber for deck',
          vendor_name: null,
          tax_amount: 20.06,
          payment_method: 'credit_card',
          category_id: 'cat-1',
          project_id: 'proj-1',
          category: { name: 'Materials - General' },
          supplier: { name: 'Home Depot' },
          project: { name: 'Smith Residence' },
        },
      ]);

      const result = await service.exportQBExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount',
      );

      const row = lines[1].split(',');
      expect(row[0]).toBe('03/15/2026');          // Date: MM/DD/YYYY
      expect(row[1]).toBe('Lumber for deck');      // Description: from notes
      expect(row[2]).toBe('250.75');               // Amount: positive
      expect(row[3]).toBe('Materials - General');   // Account: fallback to category name
      expect(row[4]).toBe('Home Depot');            // Name: supplier name
      expect(row[5]).toBe('Smith Residence');       // Class: project name
      expect(row[6]).toBe('Lumber for deck');       // Memo: from notes
      expect(row[7]).toBe('Credit Card');           // Payment Method: translated
      expect(row[8]).toBe('');                      // Check No: always empty
      expect(row[9]).toBe('20.06');                 // Tax Amount
    });
  });

  // ==========================================================================
  // exportQBInvoices — Task 8
  // ==========================================================================
  describe('exportQBInvoices', () => {
    const validQuery = {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    };

    beforeEach(() => {
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);
    });

    it('should throw 400 when no records match', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([]);

      await expect(
        service.exportQBInvoices(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('No records match the selected filters');
    });

    it('should throw 400 when records exceed 50000', async () => {
      const bigArray = new Array(50001).fill(mockInvoice());
      mockPrisma.project_invoice.findMany.mockResolvedValue(bigArray);

      await expect(
        service.exportQBInvoices(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('Export too large');
    });

    it('should generate valid CSV with correct header', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'Invoice No,Customer,Invoice Date,Due Date,Item,Description,Quantity,Rate,Amount,Tax Amount,Status',
      );
    });

    it('should always exclude voided invoices in the query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportQBInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'voided' },
          }),
        }),
      );
    });

    it('should map status correctly: sent → Open', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'sent' }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,Open$/);
    });

    it('should map status correctly: draft → Draft', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'draft' }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,Draft$/);
    });

    it('should map status correctly: partial → Partial', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'partial' }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,Partial$/);
    });

    it('should map status correctly: paid → Paid', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'paid' }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,Paid$/);
    });

    it('should format customer as "Name (PRJ-001)"', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Kitchen Remodel (PRJ-001)');
    });

    it('should use project name only when project_number is null', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({
          project: { name: 'Bathroom Reno', project_number: null },
        }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Bathroom Reno');
      expect(dataRow).not.toContain('(');
    });

    it('should use "Unknown Project" when project is null', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ project: null }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Unknown Project');
    });

    it('should include tenant_id in query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportQBInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should log export to financial_export_log', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportQBInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_export_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            export_type: 'quickbooks_invoices',
            exported_by_user_id: USER_ID,
            record_count: 1,
          }),
        }),
      );
    });

    it('should write audit log with accessed action', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportQBInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          actor_user_id: USER_ID,
          action_type: 'accessed',
          entity_type: 'financial_export',
          entity_id: 'quickbooks_invoices',
        }),
      );
    });

    it('should format invoice dates as MM/DD/YYYY', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ created_at: new Date('2026-03-10') }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      // Invoice date should be 03/10/2026
      expect(dataRow).toContain('03/10/2026');
    });

    it('should return correct fileName format', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.fileName).toBe(
        'quickbooks-invoices-2026-01-01-to-2026-03-31.csv',
      );
    });

    it('should set Quantity to 1 for all rows', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      // After "Services," there should be the description, then "1,"
      const fields = dataRow.split(',');
      // Quantity is at index 6
      expect(fields[6]).toBe('1');
    });

    it('should handle empty due_date gracefully', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ due_date: null }),
      ]);

      const result = await service.exportQBInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.csv.split('\n').length).toBe(2);
    });
  });

  // ==========================================================================
  // exportXeroExpenses — Sprint 10_5
  // ==========================================================================
  describe('exportXeroExpenses', () => {
    const validQuery = {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    };

    beforeEach(() => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);
    });

    it('should throw 400 when no records match', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);

      await expect(
        service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('No records match the selected filters');
    });

    it('should throw 400 when records exceed 50000', async () => {
      const bigArray = new Array(50001).fill(mockEntry());
      mockPrisma.financial_entry.findMany.mockResolvedValue(bigArray);

      await expect(
        service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('Export too large');
    });

    it('should generate valid CSV with correct Xero header', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1',
      );
      expect(lines.length).toBe(2); // header + 1 data row
    });

    it('should format dates as DD/MM/YYYY', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ entry_date: new Date('2026-03-15') }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow.startsWith('15/03/2026,')).toBe(true);
    });

    it('should output NEGATIVE amounts for Xero expenses', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ amount: 150.5 }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('-150.50');
    });

    it('should use account_code when available from mapping', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([
        {
          category_id: CATEGORY_ID_1,
          account_name: 'Job Materials',
          account_code: '5100',
        },
      ]);
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('5100');
    });

    it('should fall back to account_name when account_code is null', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([
        {
          category_id: CATEGORY_ID_1,
          account_name: 'Job Materials',
          account_code: null,
        },
      ]);
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Job Materials');
    });

    it('should fall back to category name when no mapping exists', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Materials');
    });

    it('should derive tax rate as percentage when tax_amount exists', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ amount: 100, tax_amount: 8 }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('8.0%');
    });

    it('should use "Tax Exempt" when no tax_amount', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ tax_amount: null }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Tax Exempt');
    });

    it('should use "Tax Exempt" when tax_amount is zero', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ tax_amount: 0 }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Tax Exempt');
    });

    it('should use first 8 chars of UUID as reference', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ id: 'abcd1234-5678-9012-3456-789012345678' }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('abcd1234');
    });

    it('should use project name as tracking name', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({ project: { name: 'Kitchen Remodel' } }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Kitchen Remodel');
    });

    it('should include tenant_id in entry query', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should include tenant_id in account mapping query', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(
        mockPrisma.financial_category_account_mapping.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should load account mappings for xero platform', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(
        mockPrisma.financial_category_account_mapping.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ platform: 'xero' }),
        }),
      );
    });

    it('should default to confirmed entries only', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ submission_status: 'confirmed' }),
        }),
      );
    });

    it('should not filter by submission_status when include_pending is true', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, {
        ...validQuery,
        include_pending: true,
      });

      const callArgs = mockPrisma.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where.submission_status).toBeUndefined();
    });

    it('should exclude recurring instances by default', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_recurring_instance: false }),
        }),
      );
    });

    it('should log export to financial_export_log with xero_expenses type', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_export_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            export_type: 'xero_expenses',
            exported_by_user_id: USER_ID,
            record_count: 1,
          }),
        }),
      );
    });

    it('should write audit log with accessed action', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      await service.exportXeroExpenses(TENANT_ID, USER_ID, validQuery);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          actor_user_id: USER_ID,
          action_type: 'accessed',
          entity_type: 'financial_export',
          entity_id: 'xero_expenses',
        }),
      );
    });

    it('should return correct fileName format', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.fileName).toBe(
        'xero-expenses-2026-01-01-to-2026-03-31.csv',
      );
    });

    it('should return correct recordCount', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry(),
        mockEntry({ id: 'entry-002' }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.recordCount).toBe(2);
    });

    it('should use supplier name over vendor_name when available', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({
          supplier: { name: 'Supplier Co' },
          vendor_name: 'Legacy Vendor',
        }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Supplier Co');
      expect(dataRow).not.toContain('Legacy Vendor');
    });

    it('should handle entry with null optional fields', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        mockEntry({
          notes: null,
          vendor_name: null,
          tax_amount: null,
          supplier: null,
          project: null,
        }),
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.csv.split('\n').length).toBe(2);
    });

    it('should produce correct column count per row', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const headerCols = result.csv.split('\n')[0].split(',').length;
      const dataCols = result.csv.split('\n')[1].split(',').length;
      expect(headerCols).toBe(8);
      expect(dataCols).toBe(8);
    });

    it('should map all 8 Xero columns correctly in a single row', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([
        { category_id: 'cat-xero', account_name: 'Materials', account_code: '5000' },
      ]);
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        {
          id: 'entry-abc12345-rest-of-uuid',
          entry_date: new Date('2026-03-15'),
          amount: 250.75,
          notes: 'Lumber for deck',
          vendor_name: null,
          tax_amount: 25.08,
          category_id: 'cat-xero',
          project_id: 'proj-1',
          category: { name: 'Materials - General' },
          supplier: { name: 'Home Depot' },
          project: { name: 'Smith Residence' },
        },
      ]);

      const result = await service.exportXeroExpenses(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1',
      );

      const row = lines[1].split(',');
      expect(row[0]).toBe('15/03/2026');           // Date: DD/MM/YYYY
      expect(row[1]).toBe('-250.75');              // Amount: NEGATIVE
      expect(row[2]).toBe('Home Depot');            // Payee: supplier name
      expect(row[3]).toBe('Lumber for deck');       // Description: from notes
      expect(row[4]).toBe('entry-ab');              // Reference: first 8 chars of UUID
      expect(row[5]).toBe('5000');                  // Account Code: from mapping
      expect(row[6]).toBe('10.0%');                 // Tax Rate: 25.08/250.75*100
      expect(row[7]).toBe('Smith Residence');       // Tracking Name 1: project name
    });
  });

  // ==========================================================================
  // exportXeroInvoices — Sprint 10_5
  // ==========================================================================
  describe('exportXeroInvoices', () => {
    const validQuery = {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    };

    beforeEach(() => {
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);
    });

    it('should throw 400 when no records match', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([]);

      await expect(
        service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('No records match the selected filters');
    });

    it('should throw 400 when records exceed 50000', async () => {
      const bigArray = new Array(50001).fill(mockInvoice());
      mockPrisma.project_invoice.findMany.mockResolvedValue(bigArray);

      await expect(
        service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery),
      ).rejects.toThrow('Export too large');
    });

    it('should generate valid CSV with correct Xero header', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const lines = result.csv.split('\n');
      expect(lines[0]).toBe(
        'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode,TaxAmount,InvoiceStatus',
      );
      expect(lines.length).toBe(2);
    });

    it('should format dates as DD/MM/YYYY', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ created_at: new Date('2026-03-10') }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('10/03/2026');
    });

    it('should output POSITIVE amounts for Xero invoices', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ amount: 5000.0 }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('5000.00');
      expect(dataRow).not.toContain('-5000.00');
    });

    it('should always exclude voided invoices in the query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'voided' },
          }),
        }),
      );
    });

    it('should map status: draft → DRAFT', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'draft' }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,DRAFT$/);
    });

    it('should map status: sent → SUBMITTED', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'sent' }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,SUBMITTED$/);
    });

    it('should map status: partial → AUTHORISED', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'partial' }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,AUTHORISED$/);
    });

    it('should map status: paid → PAID', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ status: 'paid' }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toMatch(/,PAID$/);
    });

    it('should use "Tax Exclusive" when tax_amount > 0', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ tax_amount: 400.0 }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Tax Exclusive');
    });

    it('should use "No Tax" when tax_amount is null', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ tax_amount: null }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('No Tax');
    });

    it('should use "No Tax" when tax_amount is zero', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ tax_amount: 0 }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('No Tax');
    });

    it('should use project name only as ContactName (no project_number)', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Kitchen Remodel');
      expect(dataRow).not.toContain('PRJ-001');
    });

    it('should use "Unknown Project" when project is null', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ project: null }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('Unknown Project');
    });

    it('should leave AccountCode empty for all rows', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      const fields = dataRow.split(',');
      // AccountCode is index 8 (0-based) in the Xero header
      expect(fields[8]).toBe('');
    });

    it('should set Quantity to 1 for all rows', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      const fields = dataRow.split(',');
      // Quantity is index 5
      expect(fields[5]).toBe('1');
    });

    it('should include tenant_id in query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should log export to financial_export_log with xero_invoices type', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockPrisma.financial_export_log.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            export_type: 'xero_invoices',
            exported_by_user_id: USER_ID,
            record_count: 1,
          }),
        }),
      );
    });

    it('should write audit log with accessed action', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      await service.exportXeroInvoices(TENANT_ID, USER_ID, validQuery);

      expect(mockAuditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          actor_user_id: USER_ID,
          action_type: 'accessed',
          entity_type: 'financial_export',
          entity_id: 'xero_invoices',
        }),
      );
    });

    it('should return correct fileName format', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      expect(result.fileName).toBe(
        'xero-invoices-2026-01-01-to-2026-03-31.csv',
      );
    });

    it('should handle empty due_date gracefully', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ due_date: null }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      const fields = dataRow.split(',');
      // DueDate is index 3
      expect(fields[3]).toBe('');
    });

    it('should produce correct column count per row', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const headerCols = result.csv.split('\n')[0].split(',').length;
      const dataCols = result.csv.split('\n')[1].split(',').length;
      expect(headerCols).toBe(11);
      expect(dataCols).toBe(11);
    });

    it('should format due_date as DD/MM/YYYY when present', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([
        mockInvoice({ due_date: new Date('2026-04-15') }),
      ]);

      const result = await service.exportXeroInvoices(
        TENANT_ID,
        USER_ID,
        validQuery,
      );

      const dataRow = result.csv.split('\n')[1];
      expect(dataRow).toContain('15/04/2026');
    });
  });

  // ==========================================================================
  // Cross-tenant isolation (including Xero methods)
  // ==========================================================================
  describe('tenant isolation', () => {
    it('should pass correct tenant_id to expense entry query', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);

      await service.exportQBExpenses(OTHER_TENANT_ID, USER_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
      expect(
        mockPrisma.financial_category_account_mapping.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
    });

    it('should pass correct tenant_id to invoice query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);

      await service.exportQBInvoices(OTHER_TENANT_ID, USER_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
    });

    it('should pass correct tenant_id to Xero expense query', async () => {
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue(
        [],
      );
      mockPrisma.financial_entry.findMany.mockResolvedValue([mockEntry()]);
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);

      await service.exportXeroExpenses(OTHER_TENANT_ID, USER_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
      expect(
        mockPrisma.financial_category_account_mapping.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
    });

    it('should pass correct tenant_id to Xero invoice query', async () => {
      mockPrisma.project_invoice.findMany.mockResolvedValue([mockInvoice()]);
      mockPrisma.financial_export_log.create.mockResolvedValue({});
      mockAuditLogger.log.mockResolvedValue(undefined);

      await service.exportXeroInvoices(OTHER_TENANT_ID, USER_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      expect(mockPrisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
    });
  });

  // ==========================================================================
  // getQualityReport — Sprint 10_6 Task 2
  // ==========================================================================
  describe('getQualityReport', () => {
    const baseEntry = (overrides: any = {}) => ({
      id: 'entry-qr-001',
      entry_date: new Date('2026-03-15'),
      amount: 150.50,
      vendor_name: 'Staples',
      supplier_id: 'sup-001',
      payment_method: 'credit_card',
      project_id: 'proj-001',
      category_id: 'cat-001',
      category: { name: 'Materials', type: 'expense', classification: 'cost_of_goods_sold' },
      supplier: { name: 'Staples Inc' },
      ...overrides,
    });

    beforeEach(() => {
      // Default: no duplicates
      mockPrisma.financial_entry.groupBy.mockResolvedValue([]);
    });

    it('should include tenant_id in the entry query', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);
      mockPrisma.financial_entry.groupBy.mockResolvedValue([]);

      await service.getQualityReport(TENANT_ID, {});

      expect(mockPrisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should apply date_from and date_to filters when provided', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);
      mockPrisma.financial_entry.groupBy.mockResolvedValue([]);

      await service.getQualityReport(TENANT_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      const callArgs = mockPrisma.financial_entry.findMany.mock.calls[0][0];
      expect(callArgs.where.entry_date.gte).toEqual(new Date('2026-01-01'));
      expect(callArgs.where.entry_date.lte).toEqual(new Date('2026-03-31'));
    });

    it('should return ready readiness when no issues found', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([baseEntry()]);
      mockPrisma.financial_entry.groupBy.mockResolvedValue([]);

      const result = await service.getQualityReport(TENANT_ID, {});

      expect(result.total_entries_checked).toBe(1);
      expect(result.errors).toBe(0);
      expect(result.warnings).toBe(0);
      expect(result.export_readiness.quickbooks).toBe('ready');
      expect(result.export_readiness.xero).toBe('ready');
    });

    // CHECK 1: Missing account mapping
    it('should detect missing account mappings when platform is provided', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([baseEntry()]);
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([]); // No mappings

      const result = await service.getQualityReport(TENANT_ID, { platform: 'quickbooks' });

      const mappingIssues = result.issues.filter((i) => i.check_type === 'missing_account_mapping');
      expect(mappingIssues.length).toBe(1);
      expect(mappingIssues[0].severity).toBe('warning');
      expect(mappingIssues[0].message).toContain('QB');
    });

    it('should skip account mapping check when no platform specified', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([baseEntry()]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const mappingIssues = result.issues.filter((i) => i.check_type === 'missing_account_mapping');
      expect(mappingIssues.length).toBe(0);
    });

    it('should deduplicate missing mapping issues by category_id', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ id: 'e1', category_id: 'cat-001' }),
        baseEntry({ id: 'e2', category_id: 'cat-001' }),
        baseEntry({ id: 'e3', category_id: 'cat-002', category: { name: 'Labor', type: 'expense', classification: 'operating_expense' } }),
      ]);
      mockPrisma.financial_category_account_mapping.findMany.mockResolvedValue([]);

      const result = await service.getQualityReport(TENANT_ID, { platform: 'xero' });

      const mappingIssues = result.issues.filter((i) => i.check_type === 'missing_account_mapping');
      expect(mappingIssues.length).toBe(2); // cat-001 and cat-002, not 3
    });

    // CHECK 2: Missing vendor/supplier
    it('should detect entries with no vendor and no supplier', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ vendor_name: null, supplier_id: null, supplier: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const vendorIssues = result.issues.filter((i) => i.check_type === 'missing_vendor');
      expect(vendorIssues.length).toBe(1);
      expect(vendorIssues[0].severity).toBe('warning');
      expect(vendorIssues[0].entry_id).toBe('entry-qr-001');
    });

    it('should NOT flag vendor issue when supplier_id is present', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ vendor_name: null, supplier_id: 'sup-001' }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const vendorIssues = result.issues.filter((i) => i.check_type === 'missing_vendor');
      expect(vendorIssues.length).toBe(0);
    });

    // CHECK 3: Missing project class (COGS without project)
    it('should detect COGS entries without a project', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ project_id: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const classIssues = result.issues.filter((i) => i.check_type === 'missing_project_class');
      expect(classIssues.length).toBe(1);
      expect(classIssues[0].severity).toBe('info');
    });

    it('should NOT flag project class for non-COGS entries', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({
          project_id: null,
          category: { name: 'Utilities', type: 'expense', classification: 'operating_expense' },
        }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const classIssues = result.issues.filter((i) => i.check_type === 'missing_project_class');
      expect(classIssues.length).toBe(0);
    });

    // CHECK 4: Zero amount
    it('should flag zero-amount entries as errors', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ amount: 0 }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const zeroIssues = result.issues.filter((i) => i.check_type === 'zero_amount');
      expect(zeroIssues.length).toBe(1);
      expect(zeroIssues[0].severity).toBe('error');
      expect(zeroIssues[0].amount).toBe(0);
    });

    // CHECK 5: Future date
    it('should detect future-dated entries', async () => {
      const futureDate = new Date();
      futureDate.setUTCDate(futureDate.getUTCDate() + 30);

      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ entry_date: futureDate }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const futureIssues = result.issues.filter((i) => i.check_type === 'future_date');
      expect(futureIssues.length).toBe(1);
      expect(futureIssues[0].severity).toBe('warning');
    });

    it('should NOT flag past-dated entries as future', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ entry_date: new Date('2026-01-01') }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const futureIssues = result.issues.filter((i) => i.check_type === 'future_date');
      expect(futureIssues.length).toBe(0);
    });

    // CHECK 6: Missing payment method
    it('should detect entries with no payment method', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ payment_method: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      const pmIssues = result.issues.filter((i) => i.check_type === 'missing_payment_method');
      expect(pmIssues.length).toBe(1);
      expect(pmIssues[0].severity).toBe('info');
    });

    // CHECK 7: Duplicate entry risk
    it('should detect duplicate entries via groupBy', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);
      mockPrisma.financial_entry.groupBy.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          amount: 150.50,
          supplier_id: 'sup-001',
          _count: { id: 3 },
        },
      ]);
      mockPrisma.supplier.findFirst.mockResolvedValue({ name: 'Staples Inc' });

      const result = await service.getQualityReport(TENANT_ID, {});

      const dupIssues = result.issues.filter((i) => i.check_type === 'duplicate_entry_risk');
      expect(dupIssues.length).toBe(1);
      expect(dupIssues[0].severity).toBe('warning');
      expect(dupIssues[0].message).toContain('3 entries');
      expect(dupIssues[0].message).toContain('$150.50');
      expect(dupIssues[0].message).toContain('Staples Inc');
    });

    it('should enforce tenant_id on supplier lookup in duplicate check', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([]);
      mockPrisma.financial_entry.groupBy.mockResolvedValue([
        {
          entry_date: new Date('2026-03-15'),
          amount: 50.00,
          supplier_id: 'sup-001',
          _count: { id: 2 },
        },
      ]);
      mockPrisma.supplier.findFirst.mockResolvedValue({ name: 'Test' });

      await service.getQualityReport(TENANT_ID, {});

      expect(mockPrisma.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    // Sorting: error → warning → info
    it('should sort issues: error first, warning second, info last', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ amount: 0, payment_method: null, project_id: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      // Should have: zero_amount (error), missing_payment_method (info), missing_project_class (info)
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      const severities = result.issues.map((i) => i.severity);
      const errorIdx = severities.indexOf('error');
      const infoIdx = severities.indexOf('info');
      if (errorIdx !== -1 && infoIdx !== -1) {
        expect(errorIdx).toBeLessThan(infoIdx);
      }
    });

    // Export readiness
    it('should return errors_present when error-severity issues exist', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ amount: 0 }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      expect(result.export_readiness.quickbooks).toBe('errors_present');
      expect(result.export_readiness.xero).toBe('errors_present');
    });

    it('should return warnings_present when only warning-severity issues exist', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ vendor_name: null, supplier_id: null, supplier: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      expect(result.export_readiness.quickbooks).toBe('warnings_present');
      expect(result.export_readiness.xero).toBe('warnings_present');
    });

    it('should return correct summary counts', async () => {
      mockPrisma.financial_entry.findMany.mockResolvedValue([
        baseEntry({ amount: 0, payment_method: null }),
      ]);

      const result = await service.getQualityReport(TENANT_ID, {});

      expect(result.errors).toBeGreaterThanOrEqual(1);  // zero_amount
      expect(result.infos).toBeGreaterThanOrEqual(1);   // missing_payment_method
      expect(result.total_issues).toBe(result.errors + result.warnings + result.infos);
    });
  });

  // ==========================================================================
  // getExportHistory — Sprint 10_6 Task 3
  // ==========================================================================
  describe('getExportHistory', () => {
    const mockExportLog = (overrides: any = {}) => ({
      id: 'log-001',
      export_type: 'quickbooks_expenses',
      date_from: new Date('2026-01-01'),
      date_to: new Date('2026-03-31'),
      record_count: 142,
      file_name: 'quickbooks-expenses-2026-01-01-to-2026-03-31.csv',
      filters_applied: '{"date_from":"2026-01-01","date_to":"2026-03-31"}',
      exported_by_user_id: USER_ID,
      created_at: new Date('2026-03-17T10:00:00Z'),
      exported_by: {
        id: USER_ID,
        first_name: 'John',
        last_name: 'Smith',
      },
      ...overrides,
    });

    it('should include tenant_id in the query', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      await service.getExportHistory(TENANT_ID, {});

      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(mockPrisma.financial_export_log.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should return paginated results with correct meta', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([mockExportLog()]);
      mockPrisma.financial_export_log.count.mockResolvedValue(25);

      const result = await service.getExportHistory(TENANT_ID, { page: 2, limit: 10 });

      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        total_pages: 3,
      });
      // Verify skip/take were correct
      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should use default page=1 and limit=20', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      const result = await service.getExportHistory(TENANT_ID, {});

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by export_type when provided', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      await service.getExportHistory(TENANT_ID, { export_type: 'xero_expenses' });

      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ export_type: 'xero_expenses' }),
        }),
      );
    });

    it('should parse filters_applied JSON string to object', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([mockExportLog()]);
      mockPrisma.financial_export_log.count.mockResolvedValue(1);

      const result = await service.getExportHistory(TENANT_ID, {});

      expect(result.data[0].filters_applied).toEqual({
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });
    });

    it('should handle null filters_applied gracefully', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([
        mockExportLog({ filters_applied: null }),
      ]);
      mockPrisma.financial_export_log.count.mockResolvedValue(1);

      const result = await service.getExportHistory(TENANT_ID, {});

      expect(result.data[0].filters_applied).toBeNull();
    });

    it('should order results by created_at descending', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      await service.getExportHistory(TENANT_ID, {});

      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should include exported_by user relation with correct fields', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([mockExportLog()]);
      mockPrisma.financial_export_log.count.mockResolvedValue(1);

      const result = await service.getExportHistory(TENANT_ID, {});

      expect(result.data[0].exported_by).toEqual({
        id: USER_ID,
        first_name: 'John',
        last_name: 'Smith',
      });
    });

    it('should return empty data with zero total_pages when no history exists', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      const result = await service.getExportHistory(TENANT_ID, {});

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.total_pages).toBe(0);
    });

    it('should enforce tenant isolation — uses tenant_id from parameter not from data', async () => {
      mockPrisma.financial_export_log.findMany.mockResolvedValue([]);
      mockPrisma.financial_export_log.count.mockResolvedValue(0);

      await service.getExportHistory(OTHER_TENANT_ID, {});

      expect(mockPrisma.financial_export_log.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: OTHER_TENANT_ID }),
        }),
      );
    });
  });
});
