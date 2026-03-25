import { OcrService } from './ocr.service';

// ---------------------------------------------------------------------------
// OcrService — parseReceiptText() Unit Tests
//
// The parseReceiptText() method is a pure function: string → structured data.
// It internally delegates to three private helpers:
//   - extractVendor(lines)  → first non-trivial line (≥2 chars)
//   - extractAmount(lines)  → largest amount from TOTAL-keyword lines, else largest overall
//   - extractDate(text)     → first date match (MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY, Month DD YYYY)
//
// We instantiate OcrService via Object.create() to bypass the constructor,
// which calls this.configService.get('GOOGLE_VISION_API_KEY') and would
// throw TypeError on null. The parsing methods are pure instance methods
// that do not use any injected dependencies.
// ---------------------------------------------------------------------------

describe('OcrService', () => {
  let service: OcrService;

  beforeEach(() => {
    service = Object.create(OcrService.prototype) as OcrService;
  });

  // =========================================================================
  // Vendor Extraction (6 tests)
  // =========================================================================

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

  // =========================================================================
  // Amount Extraction (12 tests)
  // =========================================================================

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
      expect(result.ocr_amount).toBe(1250.00);
    });

    it('should extract amount with multiple comma groups', () => {
      const text = 'STORE\nTOTAL $12,345.67';
      const result = service.parseReceiptText(text);
      expect(result.ocr_amount).toBe(12345.67);
    });

    it('should extract large amount with two comma groups', () => {
      const text = 'STORE\nGRAND TOTAL $1,234,567.89';
      const result = service.parseReceiptText(text);
      expect(result.ocr_amount).toBe(1234567.89);
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

    it('should handle comma-formatted amount in fallback path (no TOTAL keyword)', () => {
      const text = 'STORE\nCustom Cabinets  $2,499.00\nLabor  $1,750.00';
      const result = service.parseReceiptText(text);
      expect(result.ocr_amount).toBe(2499.00);
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

  // =========================================================================
  // Date Extraction (9 tests)
  // =========================================================================

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

  // =========================================================================
  // Real-World Receipt Samples (5 tests)
  // =========================================================================

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

  // =========================================================================
  // Edge Cases and Failure Paths (7 tests)
  // =========================================================================

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
});
