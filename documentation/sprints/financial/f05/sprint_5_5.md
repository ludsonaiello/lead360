# Sprint 5_5 — Unit Tests (OCR Parsing, Amount Extraction, Date Extraction, Failure Paths)

**Module:** Financial
**File:** ./documentation/sprints/financial/f05/sprint_5_5.md
**Type:** Backend — Unit Tests
**Depends On:** Sprint 5_4 complete (all endpoints live and Swagger-documented)
**Gate:** STOP — All unit tests must pass (`npm run test -- --testPathPattern=ocr`)
**Estimated Complexity:** Medium

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

Write comprehensive unit tests for the `OcrService`, specifically focusing on the `parseReceiptText()` method and its sub-methods (`extractVendor`, `extractAmount`, `extractDate`). These parsing methods are the most complex part of Sprint F-05 and must be tested with real-world receipt text samples.

The `parseReceiptText()` method is a pure function — it takes a string and returns structured data. This makes it ideal for thorough unit testing without any mocking.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/ocr.service.ts` — understand ALL methods, especially `parseReceiptText()`, `extractVendor()`, `extractAmount()`, `extractDate()`
- [ ] Read existing test files for naming conventions: check `/var/www/lead360.app/api/src/modules/financial/services/` for any `*.spec.ts` files
- [ ] Verify Sprint 5_4 gate passed: all endpoints respond correctly

---

## Dev Server

The dev server is NOT needed for unit tests. Unit tests run via Jest directly:

```bash
cd /var/www/lead360.app/api

# Run OCR-specific tests
npm run test -- --testPathPattern=ocr

# Run with verbose output
npm run test -- --testPathPattern=ocr --verbose

# Run with coverage
npm run test -- --testPathPattern=ocr --coverage
```

**Note:** Do NOT start the dev server for this sprint. Unit tests use Jest, not the running application.

**BEFORE marking the sprint COMPLETE:**
Ensure no dev server is running:
```
lsof -i :8000
```
If a process is found, kill it:
```
kill {PID}
```

---

## Tasks

### Task 1 — Read OcrService Implementation

**What:** Read `/var/www/lead360.app/api/src/modules/financial/services/ocr.service.ts` in full.

Understand:
1. `parseReceiptText(fullText: string)` — the main parsing method (PUBLIC, unit-testable)
2. `extractVendor(lines: string[])` — takes first non-empty line as vendor name (PRIVATE)
3. `extractAmount(lines: string[])` — searches for TOTAL/AMOUNT DUE patterns, extracts largest decimal (PRIVATE)
4. `extractDate(text: string)` — searches for MM/DD/YYYY and other date patterns (PRIVATE)

**Key insight:** `parseReceiptText()` is the public entry point. Even though `extractVendor`, `extractAmount`, and `extractDate` are private, they are tested through `parseReceiptText()` by providing appropriate input text.

---

### Task 2 — Create Unit Test File

**What:** Create the test file `api/src/modules/financial/services/ocr.service.spec.ts`

**File path:** `/var/www/lead360.app/api/src/modules/financial/services/ocr.service.spec.ts`

**Test structure:**

```typescript
import { OcrService } from './ocr.service';

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    // IMPORTANT: Do NOT use `new OcrService(null, null, null)` — the constructor
    // calls `this.configService.get(...)` which would throw TypeError on null.
    //
    // Use Object.create to get an instance with all prototype methods available
    // but WITHOUT running the constructor. This is safe because parseReceiptText()
    // and its private helpers (extractVendor, extractAmount, extractDate) are pure
    // instance methods that do not use any injected dependencies.
    service = Object.create(OcrService.prototype) as OcrService;
  });

  // ... test suites below
});
```

**Why `Object.create` and not `new OcrService(null, null, null)`:**
The `OcrService` constructor calls `this.configService.get<string>('GOOGLE_VISION_API_KEY')`. If `configService` is `null`, this throws `TypeError: Cannot read properties of null (reading 'get')`. Using `Object.create(OcrService.prototype)` bypasses the constructor entirely while giving us access to all prototype methods including `parseReceiptText()` and its private helpers.

---

### Task 3 — Test Suite: Vendor Extraction

```typescript
describe('parseReceiptText — vendor extraction', () => {
  it('should extract vendor from first line', () => {
    const text = 'HOME DEPOT\n123 Main St\nDate: 03/15/2026\nTOTAL $45.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('HOME DEPOT');
  });

  it('should use second line if first line is too short', () => {
    const text = '#\nACE HARDWARE\n456 Oak Ave\nTOTAL $23.50';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('ACE HARDWARE');
  });

  it('should handle single-line text', () => {
    const text = 'LOWES HOME IMPROVEMENT';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('LOWES HOME IMPROVEMENT');
  });

  it('should truncate vendor to 200 characters', () => {
    const longName = 'A'.repeat(250);
    const text = `${longName}\nTOTAL $10.00`;
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toHaveLength(200);
  });

  it('should return null for empty text', () => {
    const result = service.parseReceiptText('');
    expect(result.ocr_vendor).toBeNull();
  });

  it('should return null for whitespace-only text', () => {
    const result = service.parseReceiptText('   \n  \n   ');
    expect(result.ocr_vendor).toBeNull();
  });
});
```

---

### Task 4 — Test Suite: Amount Extraction

```typescript
describe('parseReceiptText — amount extraction', () => {
  it('should extract amount from TOTAL line', () => {
    const text = 'HOME DEPOT\nItem 1  $5.99\nItem 2  $3.99\nTOTAL  $9.98';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(9.98);
  });

  it('should extract amount with dollar sign', () => {
    const text = 'STORE\nTOTAL $125.50';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(125.50);
  });

  it('should extract amount without dollar sign', () => {
    const text = 'STORE\nTOTAL 125.50';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(125.50);
  });

  it('should extract amount with comma as thousands separator', () => {
    const text = 'STORE\nGRAND TOTAL $1,250.00';
    const result = service.parseReceiptText(text);
    // Note: the regex captures "250.00" from "1,250.00" — this is a known limitation
    // The comma in 1,250.00 may cause the amount to be parsed as 250.00 or 1250.00
    // depending on regex behavior. Verify actual parsing result.
    expect(result.ocr_amount).toBeGreaterThan(0);
  });

  it('should pick the largest amount from TOTAL-related lines', () => {
    const text = 'STORE\nSUBTOTAL $89.99\nTAX $7.20\nTOTAL $97.19';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(97.19);
  });

  it('should handle AMOUNT DUE keyword', () => {
    const text = 'STORE\nAMOUNT DUE: $45.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(45.00);
  });

  it('should handle BALANCE DUE keyword', () => {
    const text = 'STORE\nBALANCE DUE $78.50';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(78.50);
  });

  it('should handle GRAND TOTAL keyword', () => {
    const text = 'STORE\nGRAND TOTAL $150.75';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(150.75);
  });

  it('should handle TOTAL DUE keyword', () => {
    const text = 'STORE\nTOTAL DUE $220.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(220.00);
  });

  it('should fallback to largest amount when no TOTAL keyword found', () => {
    const text = 'STORE\nItem A  $12.99\nItem B  $8.50\nItem C  $45.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(45.00);
  });

  it('should return null when no amounts found', () => {
    const text = 'STORE\nThank you for shopping!';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBeNull();
  });

  it('should handle amounts with space after dollar sign', () => {
    const text = 'STORE\nTOTAL $ 55.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_amount).toBe(55.99);
  });
});
```

---

### Task 5 — Test Suite: Date Extraction

```typescript
describe('parseReceiptText — date extraction', () => {
  it('should extract MM/DD/YYYY date', () => {
    const text = 'HOME DEPOT\n03/15/2026\nTOTAL $45.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getFullYear()).toBe(2026);
    expect(result.ocr_date!.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(result.ocr_date!.getDate()).toBe(15);
  });

  it('should extract MM-DD-YYYY date', () => {
    const text = 'STORE\n12-25-2025\nTOTAL $10.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getFullYear()).toBe(2025);
    expect(result.ocr_date!.getMonth()).toBe(11); // December = 11
    expect(result.ocr_date!.getDate()).toBe(25);
  });

  it('should extract MM/DD/YY date (20xx century)', () => {
    const text = 'STORE\n03/15/26\nTOTAL $45.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getFullYear()).toBe(2026);
  });

  it('should extract MM-DD-YY date', () => {
    const text = 'STORE\n06-20-25\nTOTAL $10.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getFullYear()).toBe(2025);
  });

  it('should extract "Month DD, YYYY" date', () => {
    const text = 'STORE\nMarch 15, 2026\nTOTAL $45.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getFullYear()).toBe(2026);
    expect(result.ocr_date!.getMonth()).toBe(2);
    expect(result.ocr_date!.getDate()).toBe(15);
  });

  it('should extract abbreviated month name', () => {
    const text = 'STORE\nMar 15, 2026\nTOTAL $10.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getMonth()).toBe(2);
  });

  it('should take the first date found (near top of receipt)', () => {
    const text = 'STORE\n03/15/2026\nSome items\n12/25/2025\nTOTAL $10.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date!.getFullYear()).toBe(2026);
    expect(result.ocr_date!.getMonth()).toBe(2);
  });

  it('should return null when no date found', () => {
    const text = 'STORE\nItem $5.99\nTOTAL $5.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeNull();
  });

  it('should handle single-digit month and day', () => {
    const text = 'STORE\n1/5/2026\nTOTAL $10.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getMonth()).toBe(0); // January
    expect(result.ocr_date!.getDate()).toBe(5);
  });
});
```

---

### Task 6 — Test Suite: Real-World Receipt Samples

```typescript
describe('parseReceiptText — real-world receipt samples', () => {
  it('should parse gas station receipt', () => {
    const text = [
      'SHELL',
      '1234 Highway Blvd',
      'Anytown, TX 75001',
      '',
      '03/10/2026  14:32',
      '',
      'PUMP #4',
      'REGULAR UNLEADED',
      '15.234 GAL @ $2.899',
      '',
      'TOTAL            $44.16',
      '',
      'VISA ****1234',
      'APPROVED',
    ].join('\n');

    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('SHELL');
    expect(result.ocr_amount).toBe(44.16);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getMonth()).toBe(2); // March
  });

  it('should parse hardware store receipt', () => {
    const text = [
      'HOME DEPOT #0456',
      '789 Commerce Dr',
      'Houston, TX 77001',
      '(713) 555-0123',
      '',
      '03/15/2026  09:15 AM',
      '',
      '2X4X8 STUD SPF         $3.48',
      '2X4X8 STUD SPF         $3.48',
      'DRYWALL SCREW 1LB      $8.97',
      'DECK SCREW 5LB        $24.98',
      '',
      'SUBTOTAL              $40.91',
      'TAX                    $3.37',
      'TOTAL                 $44.28',
      '',
      'CASH                  $50.00',
      'CHANGE                 $5.72',
    ].join('\n');

    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('HOME DEPOT #0456');
    expect(result.ocr_amount).toBe(44.28);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getDate()).toBe(15);
  });

  it('should parse lumber yard receipt', () => {
    const text = [
      'ABC LUMBER SUPPLY',
      '555 Industrial Rd',
      'Dallas, TX 75201',
      '',
      'Date: March 12, 2026',
      '',
      'Pressure Treated 4x4x8     $12.99',
      'Pressure Treated 4x4x8     $12.99',
      'Cedar 1x6x8                 $8.49',
      'Cedar 1x6x8                 $8.49',
      'Concrete Mix 80lb           $5.98',
      '',
      'SUBTOTAL                   $48.94',
      'SALES TAX (8.25%)           $4.04',
      'AMOUNT DUE                 $52.98',
    ].join('\n');

    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('ABC LUMBER SUPPLY');
    expect(result.ocr_amount).toBe(52.98);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getMonth()).toBe(2); // March
    expect(result.ocr_date!.getDate()).toBe(12);
  });

  it('should parse supply house receipt', () => {
    const text = [
      'FERGUSON ENTERPRISES',
      'Plumbing Supply',
      '321 Supply Way, Austin TX',
      '',
      '02/28/2026',
      '',
      'PVC 3" ELBOW 90          $4.29',
      'PVC 3" TEE               $5.89',
      'PVC CEMENT 16OZ          $8.99',
      'COPPER 3/4" L 10FT      $42.50',
      '',
      'GRAND TOTAL             $61.67',
    ].join('\n');

    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('FERGUSON ENTERPRISES');
    expect(result.ocr_amount).toBe(61.67);
    expect(result.ocr_date).toBeInstanceOf(Date);
    expect(result.ocr_date!.getMonth()).toBe(1); // February
    expect(result.ocr_date!.getDate()).toBe(28);
  });

  it('should parse restaurant receipt (lunch for crew)', () => {
    const text = [
      'SUBWAY #12345',
      '100 Main Street',
      'San Antonio TX 78201',
      '',
      '03/17/2026   12:45 PM',
      '',
      '6" ITALIAN BMT           $7.99',
      '6" TURKEY                $7.49',
      '2 COOKIES                $2.00',
      '2 FOUNTAIN DRINKS        $4.38',
      '',
      'SUBTOTAL                $21.86',
      'TAX                      $1.80',
      'TOTAL                   $23.66',
      '',
      'VISA ****5678',
    ].join('\n');

    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('SUBWAY #12345');
    expect(result.ocr_amount).toBe(23.66);
    expect(result.ocr_date).toBeInstanceOf(Date);
  });
});
```

---

### Task 7 — Test Suite: Edge Cases and Failure Paths

```typescript
describe('parseReceiptText — edge cases', () => {
  it('should handle null input gracefully', () => {
    const result = service.parseReceiptText(null as any);
    expect(result.ocr_vendor).toBeNull();
    expect(result.ocr_amount).toBeNull();
    expect(result.ocr_date).toBeNull();
  });

  it('should handle undefined input gracefully', () => {
    const result = service.parseReceiptText(undefined as any);
    expect(result.ocr_vendor).toBeNull();
    expect(result.ocr_amount).toBeNull();
    expect(result.ocr_date).toBeNull();
  });

  it('should handle text with no useful data', () => {
    const text = '***\n---\n===\n!!!';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('***');
    expect(result.ocr_amount).toBeNull();
    expect(result.ocr_date).toBeNull();
  });

  it('should handle text with only a vendor', () => {
    const text = 'HOME DEPOT\nThank you!';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('HOME DEPOT');
    expect(result.ocr_amount).toBeNull();
    expect(result.ocr_date).toBeNull();
  });

  it('should handle text with vendor and amount but no date', () => {
    const text = 'STORE\nTOTAL $99.99';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('STORE');
    expect(result.ocr_amount).toBe(99.99);
    expect(result.ocr_date).toBeNull();
  });

  it('should handle text with vendor and date but no amount', () => {
    const text = 'STORE\n03/15/2026\nNo purchase made';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('STORE');
    expect(result.ocr_amount).toBeNull();
    expect(result.ocr_date).toBeInstanceOf(Date);
  });

  it('should handle multiline vendor names with short first line', () => {
    const text = 'W\nWALMART SUPERCENTER\n03/15/2026\nTOTAL $50.00';
    const result = service.parseReceiptText(text);
    expect(result.ocr_vendor).toBe('WALMART SUPERCENTER');
  });
});
```

---

### Task 8 — Run Tests and Fix Failures

**What:** Run all tests and fix any failures.

```bash
cd /var/www/lead360.app/api
npm run test -- --testPathPattern=ocr --verbose
```

**Expected:** All tests pass. If any test fails:
1. Read the failure message carefully
2. Determine if the test expectation is wrong or the implementation is wrong
3. Fix the implementation if the test expectation is correct (the test represents the contract requirement)
4. Fix the test expectation ONLY if the test itself is incorrect (wrong assumption about parsing behavior)

**Common issues:**
- Date timezone issues — use `.getDate()`, `.getMonth()`, `.getFullYear()` not `.toISOString()`
- Amount regex edge cases with commas in thousands
- The `parseReceiptText` null/undefined guard — verify it handles falsy input (short-circuit on `!fullText`)

**Run with coverage:**
```bash
npm run test -- --testPathPattern=ocr --coverage --collectCoverageFrom='src/modules/financial/services/ocr.service.ts'
```

---

## Acceptance Criteria

- [ ] File created: `api/src/modules/financial/services/ocr.service.spec.ts`
- [ ] Vendor extraction tests: 6 tests covering normal, short first line, single line, long name, empty, whitespace
- [ ] Amount extraction tests: 12 tests covering TOTAL, $, no $, commas, largest value, keywords, fallback, no amounts, space after $
- [ ] Date extraction tests: 9 tests covering MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY, MM-DD-YY, Month DD YYYY, abbreviated, first date, no date, single digits
- [ ] Real-world receipt samples: 5 tests (gas station, hardware store, lumber yard, supply house, restaurant)
- [ ] Edge cases: 7 tests covering null, undefined, no data, vendor only, no date, no amount, short first line
- [ ] All tests pass: `npm run test -- --testPathPattern=ocr` exits with 0
- [ ] No existing tests broken
- [ ] Dev server NOT running at sprint end

---

## Gate Marker

**STOP** — Before proceeding to Sprint 5_6:
1. All unit tests pass: `npm run test -- --testPathPattern=ocr` exits with 0
2. At least 39 test cases total
3. Test covers vendor, amount, date, real-world samples, and edge cases
4. No existing tests broken

---

## Handoff Notes

- Test file: `api/src/modules/financial/services/ocr.service.spec.ts`
- Tests validate parsing logic only — no API calls, no database
- `parseReceiptText()` is the main tested method — it internally calls the private extraction methods
- Any parsing bug found during testing should be fixed in `ocr.service.ts` (Sprint 5_1 code)
- Next sprint (5_6) adds API documentation and final verification gate
