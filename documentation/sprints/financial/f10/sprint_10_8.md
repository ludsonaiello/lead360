# Sprint 10_8 — Unit Tests

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_8.md
**Type:** Backend — Tests
**Depends On:** Sprint 10_7 (all controllers and services must be registered and functional)
**Gate:** NONE
**Estimated Complexity:** High

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Write comprehensive unit and integration tests for the export module. These tests verify every critical behavior specified in the F-10 contract: date formatting, amount sign conventions, account name resolution, CSV row building, quality report checks, and tenant isolation.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts` — the complete service file
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts`
- [ ] Read an existing test file for patterns: `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-category.service.spec.ts`
- [ ] Confirm the test runner: `cd /var/www/lead360.app/api && npx jest --version` — note the Jest version

---

## Dev Server

> ⚠️ This project does NOT use PM2. Do not reference or run PM2 commands.
> ⚠️ Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

**For this sprint, you do NOT need the dev server running.** Tests are run via Jest directly:

```bash
cd /var/www/lead360.app/api

# Run specific test file:
npx jest src/modules/financial/services/export.service.spec.ts --verbose

# Run all financial tests:
npx jest src/modules/financial/ --verbose

# Run with coverage:
npx jest src/modules/financial/services/export.service.spec.ts --coverage
```

**However**, if you need to verify that the server compiles first:
```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding
```

**BEFORE marking the sprint COMPLETE:**
Make sure no dev server or test runner is still running:
```bash
lsof -i :8000
# If found: kill {PID}
```

---

## Tasks

### Task 1 — Create `export.service.spec.ts`

**What:** Create the test file:
`/var/www/lead360.app/api/src/modules/financial/services/export.service.spec.ts`

**Read the existing test files first** to understand the mocking patterns used in this project. The financial module's existing spec files (e.g., `financial-entry.service.spec.ts`) show how `PrismaService` and `AuditLoggerService` are mocked.

**Test file structure:**
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('ExportService', () => {
  let service: ExportService;
  let prisma: any;
  let auditLogger: any;

  beforeEach(async () => {
    prisma = {
      financial_entry: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      financial_export_log: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      financial_category_account_mapping: {
        findMany: jest.fn(),
      },
      project_invoice: {
        findMany: jest.fn(),
      },
      supplier: {
        findFirst: jest.fn(),
      },
    };

    auditLogger = {
      logTenantChange: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLoggerService, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  // Test groups defined in Tasks 2-10 below
});
```

**Acceptance:** Test file created. Module bootstraps without errors.

---

### Task 2 — Test `formatDateQB()`

**What:** Since `formatDateQB` is private, test it indirectly through the public export methods, or access it via `(service as any).formatDateQB()` for unit testing.

```typescript
describe('formatDateQB', () => {
  it('should format date as MM/DD/YYYY', () => {
    const format = (service as any).formatDateQB.bind(service);

    expect(format(new Date('2026-01-15'))).toBe('01/15/2026');
    expect(format(new Date('2026-12-31'))).toBe('12/31/2026');
    expect(format(new Date('2026-03-05'))).toBe('03/05/2026');
    expect(format(new Date('2026-02-28'))).toBe('02/28/2026');
    expect(format(new Date('2026-09-09'))).toBe('09/09/2026');
    expect(format(new Date('2026-07-04'))).toBe('07/04/2026');
    expect(format(new Date('2026-11-25'))).toBe('11/25/2026');
    expect(format(new Date('2025-01-01'))).toBe('01/01/2025');
    expect(format(new Date('2026-06-30'))).toBe('06/30/2026');
    expect(format(new Date('2026-10-31'))).toBe('10/31/2026');
  });
});
```

**Acceptance:** 10 date inputs, all correct MM/DD/YYYY output. Zero-padded months and days.

---

### Task 3 — Test `formatDateXero()`

```typescript
describe('formatDateXero', () => {
  it('should format date as DD/MM/YYYY', () => {
    const format = (service as any).formatDateXero.bind(service);

    expect(format(new Date('2026-01-15'))).toBe('15/01/2026');
    expect(format(new Date('2026-12-31'))).toBe('31/12/2026');
    expect(format(new Date('2026-03-05'))).toBe('05/03/2026');
    expect(format(new Date('2026-02-28'))).toBe('28/02/2026');
    expect(format(new Date('2026-09-09'))).toBe('09/09/2026');
    expect(format(new Date('2026-07-04'))).toBe('04/07/2026');
    expect(format(new Date('2026-11-25'))).toBe('25/11/2026');
    expect(format(new Date('2025-01-01'))).toBe('01/01/2025');
    expect(format(new Date('2026-06-30'))).toBe('30/06/2026');
    expect(format(new Date('2026-10-31'))).toBe('31/10/2026');
  });
});
```

**Acceptance:** 10 date inputs, all correct DD/MM/YYYY output. Note how March 5 = `05/03/2026` (NOT `03/05/2026` — that's QB format).

---

### Task 4 — Test Xero amount negation

```typescript
describe('Xero amount negation', () => {
  it('should return negative amounts for Xero expenses', async () => {
    // Mock entries with positive amounts
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'test-1',
        entry_date: new Date('2026-01-15'),
        amount: 100.50,
        notes: 'Test expense',
        vendor_name: 'Vendor A',
        tax_amount: null,
        category_id: 'cat-1',
        project_id: null,
        category: { name: 'Materials' },
        supplier: null,
        project: null,
      },
    ]);
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
    prisma.financial_export_log.create.mockResolvedValue({});

    const result = await service.exportXeroExpenses('tenant-1', 'user-1', {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    } as any);

    // Parse CSV — second line (first data row)
    const lines = result.csv.split('\n');
    const dataRow = lines[1].split(',');
    const amount = parseFloat(dataRow[1]); // Amount is second column in Xero

    expect(amount).toBeLessThan(0);
    expect(amount).toBe(-100.50);
  });
});
```

**Acceptance:** Xero expense amounts are negative in the CSV output.

---

### Task 5 — Test account name resolution (custom mapping vs fallback)

```typescript
describe('Account name resolution', () => {
  it('should use custom mapping when available', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([
      { category_id: 'cat-1', account_name: 'Custom QB Name', account_code: '5100' },
    ]);
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'test-1',
        entry_date: new Date('2026-01-15'),
        amount: 50.00,
        notes: null,
        vendor_name: 'Vendor',
        tax_amount: null,
        payment_method: 'cash',
        category_id: 'cat-1',
        project_id: null,
        category: { name: 'Materials - General' },
        supplier: null,
        project: null,
      },
    ]);
    prisma.financial_export_log.create.mockResolvedValue({});

    const result = await service.exportQBExpenses('tenant-1', 'user-1', {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    } as any);

    // Parse CSV — Account column (4th column, index 3)
    const lines = result.csv.split('\n');
    const dataRow = lines[1].split(',');
    expect(dataRow[3]).toBe('Custom QB Name');
  });

  it('should fall back to category name when no mapping exists', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]); // No mappings
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'test-2',
        entry_date: new Date('2026-02-01'),
        amount: 75.00,
        notes: null,
        vendor_name: 'Vendor',
        tax_amount: null,
        payment_method: 'check',
        category_id: 'cat-2',
        project_id: null,
        category: { name: 'Fuel & Transportation' },
        supplier: null,
        project: null,
      },
    ]);
    prisma.financial_export_log.create.mockResolvedValue({});

    const result = await service.exportQBExpenses('tenant-1', 'user-1', {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    } as any);

    const lines = result.csv.split('\n');
    const dataRow = lines[1].split(',');
    expect(dataRow[3]).toBe('Fuel & Transportation');
  });
});
```

**Acceptance:** Custom mapping overrides category name. Fallback to category name when no mapping.

---

### Task 6 — Test `buildQBExpenseRow` via `exportQBExpenses()`

```typescript
describe('QB expense CSV row', () => {
  it('should map all fields correctly to QB CSV columns', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'entry-1',
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
    prisma.financial_export_log.create.mockResolvedValue({});

    const result = await service.exportQBExpenses('tenant-1', 'user-1', {
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    } as any);

    const lines = result.csv.split('\n');

    // Header row
    expect(lines[0]).toBe('Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount');

    // Data row
    const row = lines[1].split(',');
    expect(row[0]).toBe('03/15/2026');          // Date: MM/DD/YYYY
    expect(row[1]).toBe('Lumber for deck');      // Description
    expect(row[2]).toBe('250.75');               // Amount: positive
    expect(row[3]).toBe('Materials - General');   // Account: category name (no mapping)
    expect(row[4]).toBe('Home Depot');            // Name: supplier name
    expect(row[5]).toBe('Smith Residence');       // Class: project name
    expect(row[6]).toBe('Lumber for deck');       // Memo
    expect(row[7]).toBe('Credit Card');           // Payment Method: translated
    expect(row[8]).toBe('');                      // Check No: empty
    expect(row[9]).toBe('20.06');                 // Tax Amount
  });
});
```

**Acceptance:** All 10 QB columns mapped correctly. Amount positive. Date MM/DD/YYYY. Payment method translated.

---

### Task 7 — Test `buildXeroExpenseRow` via `exportXeroExpenses()`

```typescript
describe('Xero expense CSV row', () => {
  it('should map all fields correctly to Xero CSV columns', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([
      { category_id: 'cat-1', account_name: 'Materials', account_code: '5000' },
    ]);
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'entry-abc12345-rest-of-uuid',
        entry_date: new Date('2026-03-15'),
        amount: 250.75,
        notes: 'Lumber for deck',
        vendor_name: null,
        tax_amount: 25.08,
        category_id: 'cat-1',
        project_id: 'proj-1',
        category: { name: 'Materials - General' },
        supplier: { name: 'Home Depot' },
        project: { name: 'Smith Residence' },
      },
    ]);
    prisma.financial_export_log.create.mockResolvedValue({});

    const result = await service.exportXeroExpenses('tenant-1', 'user-1', {
      date_from: '2026-03-01',
      date_to: '2026-03-31',
    } as any);

    const lines = result.csv.split('\n');

    // Header row
    expect(lines[0]).toBe('Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1');

    // Data row
    const row = lines[1].split(',');
    expect(row[0]).toBe('15/03/2026');           // Date: DD/MM/YYYY
    expect(row[1]).toBe('-250.75');              // Amount: NEGATIVE
    expect(row[2]).toBe('Home Depot');            // Payee
    expect(row[3]).toBe('Lumber for deck');       // Description
    // row[4] = Reference (first 8 chars of UUID)
    expect(row[5]).toBe('5000');                  // Account Code: from mapping
    // row[6] = Tax Rate (derived percentage)
    expect(row[7]).toBe('Smith Residence');       // Tracking Name 1
  });
});
```

**Acceptance:** Xero header correct. Amount negative. Date DD/MM/YYYY. Account code from mapping.

---

### Task 8 — Test quality report: duplicate detection

```typescript
describe('Quality Report — duplicate detection', () => {
  it('should detect duplicate entries by date + amount + supplier', async () => {
    prisma.financial_entry.findMany.mockResolvedValue([]);
    prisma.financial_entry.groupBy.mockResolvedValue([
      {
        entry_date: new Date('2026-03-15'),
        amount: 150.00,
        supplier_id: 'supplier-1',
        _count: { id: 2 },
      },
    ]);
    prisma.supplier.findFirst.mockResolvedValue({ name: 'Home Depot' });

    const result = await service.getQualityReport('tenant-1', {});

    const dupIssues = result.issues.filter((i) => i.check_type === 'duplicate_entry_risk');
    expect(dupIssues.length).toBe(1);
    expect(dupIssues[0].severity).toBe('warning');
    expect(dupIssues[0].message).toContain('Possible duplicate');
    expect(dupIssues[0].message).toContain('Home Depot');
    expect(dupIssues[0].message).toContain('$150.00');
  });
});
```

---

### Task 9 — Test quality report: missing vendor detection

```typescript
describe('Quality Report — missing vendor', () => {
  it('should flag entries with no vendor and no supplier', async () => {
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'entry-1',
        entry_date: new Date('2026-03-15'),
        amount: 50.00,
        vendor_name: null,
        supplier_id: null,
        payment_method: 'cash',
        project_id: 'proj-1',
        category_id: 'cat-1',
        category: { name: 'Misc', type: 'other', classification: null },
        supplier: null,
      },
    ]);
    prisma.financial_entry.groupBy.mockResolvedValue([]);

    const result = await service.getQualityReport('tenant-1', {});

    const vendorIssues = result.issues.filter((i) => i.check_type === 'missing_vendor');
    expect(vendorIssues.length).toBe(1);
    expect(vendorIssues[0].severity).toBe('warning');
    expect(vendorIssues[0].message).toContain('no vendor or supplier');
  });

  it('should NOT flag entries with a supplier', async () => {
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'entry-2',
        entry_date: new Date('2026-03-15'),
        amount: 50.00,
        vendor_name: null,
        supplier_id: 'supplier-1',
        payment_method: 'cash',
        project_id: 'proj-1',
        category_id: 'cat-1',
        category: { name: 'Misc', type: 'other', classification: null },
        supplier: { name: 'Some Supplier' },
      },
    ]);
    prisma.financial_entry.groupBy.mockResolvedValue([]);

    const result = await service.getQualityReport('tenant-1', {});

    const vendorIssues = result.issues.filter((i) => i.check_type === 'missing_vendor');
    expect(vendorIssues.length).toBe(0);
  });
});
```

---

### Task 10 — Test tenant isolation and export logging

```typescript
describe('Tenant isolation', () => {
  it('should always include tenant_id in expense export query', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'e1', entry_date: new Date('2026-01-01'), amount: 100,
        notes: null, vendor_name: 'V', tax_amount: null, payment_method: null,
        category_id: 'c1', project_id: null,
        category: { name: 'Cat' }, supplier: null, project: null,
      },
    ]);
    prisma.financial_export_log.create.mockResolvedValue({});

    await service.exportQBExpenses('tenant-abc', 'user-1', {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    } as any);

    // Verify the Prisma query included tenant_id
    const findManyCall = prisma.financial_entry.findMany.mock.calls[0][0];
    expect(findManyCall.where.tenant_id).toBe('tenant-abc');
  });
});

describe('Export logging', () => {
  it('should log export after successful QB expense export', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
    prisma.financial_entry.findMany.mockResolvedValue([
      {
        id: 'e1', entry_date: new Date('2026-01-01'), amount: 100,
        notes: null, vendor_name: 'V', tax_amount: null, payment_method: null,
        category_id: 'c1', project_id: null,
        category: { name: 'Cat' }, supplier: null, project: null,
      },
    ]);
    prisma.financial_export_log.create.mockResolvedValue({});

    await service.exportQBExpenses('tenant-1', 'user-1', {
      date_from: '2026-01-01',
      date_to: '2026-03-31',
    } as any);

    expect(prisma.financial_export_log.create).toHaveBeenCalledTimes(1);
    const logCall = prisma.financial_export_log.create.mock.calls[0][0];
    expect(logCall.data.tenant_id).toBe('tenant-1');
    expect(logCall.data.export_type).toBe('quickbooks_expenses');
    expect(logCall.data.record_count).toBe(1);
    expect(logCall.data.exported_by_user_id).toBe('user-1');
  });
});
```

---

### Task 11 — Test date range validation

```typescript
describe('Date range validation', () => {
  it('should reject date range exceeding 366 days', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);

    await expect(
      service.exportQBExpenses('t1', 'u1', {
        date_from: '2025-01-01',
        date_to: '2026-03-01',
      } as any),
    ).rejects.toThrow('Date range cannot exceed 366 days');
  });

  it('should reject when date_from is after date_to', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);

    await expect(
      service.exportQBExpenses('t1', 'u1', {
        date_from: '2026-06-01',
        date_to: '2026-01-01',
      } as any),
    ).rejects.toThrow('date_from must be before or equal to date_to');
  });

  it('should reject when zero records match', async () => {
    prisma.financial_category_account_mapping.findMany.mockResolvedValue([]);
    prisma.financial_entry.findMany.mockResolvedValue([]);

    await expect(
      service.exportQBExpenses('t1', 'u1', {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      } as any),
    ).rejects.toThrow('No records match the selected filters');
  });
});
```

---

### Task 12 — Run All Tests

**What:** Run the complete test suite and verify all tests pass.

```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/services/export.service.spec.ts --verbose
```

**Expected output:** All tests pass. No failures.

**Also run existing financial tests to confirm no regressions:**
```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/ --verbose
```

**Acceptance:** All new tests pass. All existing financial tests still pass.

---

## Patterns to Apply

### Test Mocking Pattern (from existing codebase)
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [
    ServiceUnderTest,
    { provide: PrismaService, useValue: mockPrisma },
    { provide: AuditLoggerService, useValue: mockAuditLogger },
  ],
}).compile();
```

### Testing Private Methods
Access via `(service as any).privateMethod()` for direct unit testing.

---

## Business Rules Tested

- BR-07: QB uses MM/DD/YYYY, Xero uses DD/MM/YYYY
- BR-08: Xero expense amounts are negative, QB expense amounts are positive
- BR-06: Category name fallback when no account mapping
- BR-09: Export logged after success
- BR-10: Tenant isolation enforced in all queries
- BR-11: Duplicate detection works via groupBy
- BR-12: Missing vendor detection works
- BR-04: Date range validation (366 day limit)
- BR-05: Zero records returns 400

---

## Acceptance Criteria

- [ ] `export.service.spec.ts` created at correct path
- [ ] Test: `formatDateQB()` — 10+ dates, all correct MM/DD/YYYY
- [ ] Test: `formatDateXero()` — 10+ dates, all correct DD/MM/YYYY
- [ ] Test: Xero amount negation for expenses
- [ ] Test: Account name resolution — custom mapping vs. fallback
- [ ] Test: QB expense row — all fields mapped correctly
- [ ] Test: Xero expense row — all fields mapped correctly
- [ ] Test: Quality report duplicate detection
- [ ] Test: Quality report missing vendor detection
- [ ] Test: Tenant isolation — tenant_id always in queries
- [ ] Test: Export log created after successful export
- [ ] Test: Date range validation (>366 days, inverted, zero records)
- [ ] All new tests pass
- [ ] All existing financial tests still pass (no regressions)
- [ ] Dev server shut down before sprint is marked complete (if started)

---

## Gate Marker

NONE — Sprint 10_9 can proceed after this sprint completes.

---

## Handoff Notes

- Test file: `/var/www/lead360.app/api/src/modules/financial/services/export.service.spec.ts`
- All critical behaviors from the F-10 contract are tested
- Sprint 10_9 produces API documentation — it reads the actual codebase, not assumptions
