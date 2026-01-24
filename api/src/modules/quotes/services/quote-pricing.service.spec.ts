import { Test, TestingModule } from '@nestjs/testing';
import { QuotePricingService } from './quote-pricing.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('QuotePricingService', () => {
  let service: QuotePricingService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    quote: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotePricingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QuotePricingService>(QuotePricingService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Clear mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateItemSubtotal', () => {
    it('should return 0 for empty items array', () => {
      const result = service.calculateItemSubtotal([]);
      expect(result.toString()).toBe('0');
    });

    it('should return 0 for null items', () => {
      const result = service.calculateItemSubtotal(null);
      expect(result.toString()).toBe('0');
    });

    it('should calculate correct subtotal for single item', () => {
      const items = [{ total_cost: new Decimal(100) }];
      const result = service.calculateItemSubtotal(items);
      expect(result.toString()).toBe('100');
    });

    it('should calculate correct subtotal for multiple items', () => {
      const items = [
        { total_cost: new Decimal(100) },
        { total_cost: new Decimal(200) },
        { total_cost: new Decimal(300) },
      ];
      const result = service.calculateItemSubtotal(items);
      expect(result.toString()).toBe('600');
    });

    it('should handle decimal precision correctly', () => {
      const items = [
        { total_cost: new Decimal('99.99') },
        { total_cost: new Decimal('0.01') },
      ];
      const result = service.calculateItemSubtotal(items);
      expect(result.toString()).toBe('100');
    });
  });

  describe('applyMarkups', () => {
    it('should apply no markup when percentages are 0', () => {
      const itemSubtotal = new Decimal(1000);
      const result = service.applyMarkups(
        itemSubtotal,
        new Decimal(0),
        new Decimal(0),
        new Decimal(0),
      );

      expect(result.profit.toString()).toBe('0');
      expect(result.overhead.toString()).toBe('0');
      expect(result.contingency.toString()).toBe('0');
      expect(result.subtotalBeforeDiscounts.toString()).toBe('1000');
    });

    it('should apply profit markup correctly (20%)', () => {
      const itemSubtotal = new Decimal(1000);
      const result = service.applyMarkups(
        itemSubtotal,
        new Decimal(20),
        new Decimal(0),
        new Decimal(0),
      );

      expect(result.profit.toString()).toBe('200');
      expect(result.overhead.toString()).toBe('0');
      expect(result.contingency.toString()).toBe('0');
      expect(result.subtotalBeforeDiscounts.toString()).toBe('1200');
    });

    it('should apply compounding markups correctly (20% profit, 10% overhead)', () => {
      const itemSubtotal = new Decimal(1000);
      const result = service.applyMarkups(
        itemSubtotal,
        new Decimal(20),
        new Decimal(10),
        new Decimal(0),
      );

      // Profit: 1000 × 20% = 200
      expect(result.profit.toString()).toBe('200');

      // Overhead: (1000 + 200) × 10% = 120
      expect(result.overhead.toString()).toBe('120');

      expect(result.contingency.toString()).toBe('0');
      expect(result.subtotalBeforeDiscounts.toString()).toBe('1320');
    });

    it('should apply all three compounding markups correctly (20%, 10%, 5%)', () => {
      const itemSubtotal = new Decimal(1000);
      const result = service.applyMarkups(
        itemSubtotal,
        new Decimal(20),
        new Decimal(10),
        new Decimal(5),
      );

      // Profit: 1000 × 20% = 200
      expect(result.profit.toString()).toBe('200');

      // Overhead: (1000 + 200) × 10% = 120
      expect(result.overhead.toString()).toBe('120');

      // Contingency: (1000 + 200 + 120) × 5% = 66
      expect(result.contingency.toString()).toBe('66');

      // Subtotal: 1000 + 200 + 120 + 66 = 1386
      expect(result.subtotalBeforeDiscounts.toString()).toBe('1386');
    });

    it('should handle high markup percentages (100%)', () => {
      const itemSubtotal = new Decimal(1000);
      const result = service.applyMarkups(
        itemSubtotal,
        new Decimal(100),
        new Decimal(0),
        new Decimal(0),
      );

      expect(result.profit.toString()).toBe('1000');
      expect(result.subtotalBeforeDiscounts.toString()).toBe('2000');
    });
  });

  describe('applyDiscountRules', () => {
    it('should return 0 discount when no rules provided', () => {
      const subtotal = new Decimal(1000);
      const result = service.applyDiscountRules(subtotal, []);

      expect(result.totalDiscountAmount.toString()).toBe('0');
      expect(result.subtotalAfterDiscounts.toString()).toBe('1000');
      expect(result.discountBreakdown).toEqual([]);
    });

    it('should apply single percentage discount correctly (10%)', () => {
      const subtotal = new Decimal(1000);
      const rules = [
        {
          id: 'rule-1',
          reason: '10% discount',
          rule_type: 'percentage' as const,
          value: new Decimal(10),
          order_index: 1,
        },
      ];

      const result = service.applyDiscountRules(subtotal, rules);

      expect(result.totalDiscountAmount.toString()).toBe('100');
      expect(result.subtotalAfterDiscounts.toString()).toBe('900');
      expect(result.discountBreakdown).toHaveLength(1);
      expect(result.discountBreakdown[0].discountAmount.toString()).toBe('100');
    });

    it('should apply single fixed discount correctly ($100)', () => {
      const subtotal = new Decimal(1000);
      const rules = [
        {
          id: 'rule-1',
          reason: '$100 discount',
          rule_type: 'fixed_amount' as const,
          value: new Decimal(100),
          order_index: 1,
        },
      ];

      const result = service.applyDiscountRules(subtotal, rules);

      expect(result.totalDiscountAmount.toString()).toBe('100');
      expect(result.subtotalAfterDiscounts.toString()).toBe('900');
    });

    it('should apply percentage discounts before fixed amount discounts', () => {
      const subtotal = new Decimal(1000);
      const rules = [
        {
          id: 'rule-1',
          reason: '$50 fixed',
          rule_type: 'fixed_amount' as const,
          value: new Decimal(50),
          order_index: 2,
        },
        {
          id: 'rule-2',
          reason: '10% off',
          rule_type: 'percentage' as const,
          value: new Decimal(10),
          order_index: 1,
        },
      ];

      const result = service.applyDiscountRules(subtotal, rules);

      // First: 10% of 1000 = 100, subtotal becomes 900
      // Then: $50 fixed, subtotal becomes 850
      expect(result.totalDiscountAmount.toString()).toBe('150');
      expect(result.subtotalAfterDiscounts.toString()).toBe('850');
      expect(result.discountBreakdown).toHaveLength(2);
      expect(result.discountBreakdown[0].ruleType).toBe('percentage');
      expect(result.discountBreakdown[1].ruleType).toBe('fixed_amount');
    });

    it('should cap discount at subtotal (cannot go negative)', () => {
      const subtotal = new Decimal(100);
      const rules = [
        {
          id: 'rule-1',
          reason: '200% discount (excessive)',
          rule_type: 'percentage' as const,
          value: new Decimal(200),
          order_index: 1,
        },
      ];

      const result = service.applyDiscountRules(subtotal, rules);

      // Discount should be capped at subtotal (100)
      expect(result.totalDiscountAmount.toString()).toBe('100');
      expect(result.subtotalAfterDiscounts.toString()).toBe('0');
    });

    it('should handle multiple percentage discounts compounding', () => {
      const subtotal = new Decimal(1000);
      const rules = [
        {
          id: 'rule-1',
          reason: '10% off',
          rule_type: 'percentage' as const,
          value: new Decimal(10),
          order_index: 1,
        },
        {
          id: 'rule-2',
          reason: '5% off',
          rule_type: 'percentage' as const,
          value: new Decimal(5),
          order_index: 2,
        },
      ];

      const result = service.applyDiscountRules(subtotal, rules);

      // First: 10% of 1000 = 100, subtotal becomes 900
      // Second: 5% of 900 = 45, subtotal becomes 855
      expect(result.totalDiscountAmount.toString()).toBe('145');
      expect(result.subtotalAfterDiscounts.toString()).toBe('855');
    });
  });

  describe('calculateTax', () => {
    it('should return 0 for null tax rate', () => {
      const subtotal = new Decimal(1000);
      const result = service.calculateTax(subtotal, null);

      expect(result.toString()).toBe('0');
    });

    it('should return 0 for 0% tax rate', () => {
      const subtotal = new Decimal(1000);
      const result = service.calculateTax(subtotal, new Decimal(0));

      expect(result.toString()).toBe('0');
    });

    it('should calculate tax correctly (8%)', () => {
      const subtotal = new Decimal(1000);
      const result = service.calculateTax(subtotal, new Decimal(8));

      expect(result.toString()).toBe('80');
    });

    it('should handle decimal tax rate correctly (8.25%)', () => {
      const subtotal = new Decimal(1000);
      const result = service.calculateTax(subtotal, new Decimal('8.25'));

      expect(result.toString()).toBe('82.5');
    });

    it('should handle high precision tax rate (8.125%)', () => {
      const subtotal = new Decimal(1000);
      const result = service.calculateTax(subtotal, new Decimal('8.125'));

      expect(result.toString()).toBe('81.25');
    });
  });

  describe('calculateTotal', () => {
    it('should calculate total correctly', () => {
      const subtotalAfterDiscounts = new Decimal(1000);
      const taxAmount = new Decimal(80);

      const result = service.calculateTotal(subtotalAfterDiscounts, taxAmount);

      expect(result.toString()).toBe('1080');
    });

    it('should handle 0 tax correctly', () => {
      const subtotalAfterDiscounts = new Decimal(1000);
      const taxAmount = new Decimal(0);

      const result = service.calculateTotal(subtotalAfterDiscounts, taxAmount);

      expect(result.toString()).toBe('1000');
    });
  });

  describe('getEffectivePercentages', () => {
    it('should use quote custom percentages when available', () => {
      const quote = {
        custom_profit_percent: new Decimal(25),
        custom_overhead_percent: new Decimal(15),
        custom_contingency_percent: new Decimal(10),
      };

      const tenant = {
        default_profit_margin: new Decimal(20),
        default_overhead_rate: new Decimal(10),
        default_contingency_rate: new Decimal(5),
        sales_tax_rate: new Decimal(8),
      };

      const result = service.getEffectivePercentages(quote, tenant);

      expect(result.profitPercent.toString()).toBe('25');
      expect(result.overheadPercent.toString()).toBe('15');
      expect(result.contingencyPercent.toString()).toBe('10');
      expect(result.taxRate.toString()).toBe('8');
    });

    it('should fall back to tenant defaults when quote custom is null', () => {
      const quote = {
        custom_profit_percent: null,
        custom_overhead_percent: null,
        custom_contingency_percent: null,
      };

      const tenant = {
        default_profit_margin: new Decimal(20),
        default_overhead_rate: new Decimal(10),
        default_contingency_rate: new Decimal(5),
        sales_tax_rate: new Decimal(8),
      };

      const result = service.getEffectivePercentages(quote, tenant);

      expect(result.profitPercent.toString()).toBe('20');
      expect(result.overheadPercent.toString()).toBe('10');
      expect(result.contingencyPercent.toString()).toBe('5');
      expect(result.taxRate.toString()).toBe('8');
    });

    it('should fall back to system defaults when both quote and tenant are null', () => {
      const quote = {
        custom_profit_percent: null,
        custom_overhead_percent: null,
        custom_contingency_percent: null,
      };

      const tenant = {
        default_profit_margin: null,
        default_overhead_rate: null,
        default_contingency_rate: null,
        sales_tax_rate: null,
      };

      const result = service.getEffectivePercentages(quote, tenant);

      // System defaults: profit 20%, overhead 10%, contingency 5%, tax 0%
      expect(result.profitPercent.toString()).toBe('20');
      expect(result.overheadPercent.toString()).toBe('10');
      expect(result.contingencyPercent.toString()).toBe('5');
      expect(result.taxRate.toString()).toBe('0');
    });
  });

  describe('End-to-End Calculation', () => {
    it('should calculate complete financial breakdown correctly', () => {
      // Scenario from plan:
      // Item subtotal: $1000
      // Markups: 20% profit, 10% overhead, 5% contingency
      // Discounts: 10% percentage, $50 fixed
      // Tax: 8%

      const itemSubtotal = new Decimal(1000);

      // Step 1: Apply markups
      const markups = service.applyMarkups(
        itemSubtotal,
        new Decimal(20),
        new Decimal(10),
        new Decimal(5),
      );

      expect(markups.profit.toString()).toBe('200');
      expect(markups.overhead.toString()).toBe('120');
      expect(markups.contingency.toString()).toBe('66');
      expect(markups.subtotalBeforeDiscounts.toString()).toBe('1386');

      // Step 2: Apply discounts
      const discountRules = [
        {
          id: 'rule-1',
          reason: '10% discount',
          rule_type: 'percentage' as const,
          value: new Decimal(10),
          order_index: 1,
        },
        {
          id: 'rule-2',
          reason: '$50 fixed discount',
          rule_type: 'fixed_amount' as const,
          value: new Decimal(50),
          order_index: 2,
        },
      ];

      const discounts = service.applyDiscountRules(
        markups.subtotalBeforeDiscounts,
        discountRules,
      );

      // 10% of 1386 = 138.6
      // After percentage: 1386 - 138.6 = 1247.4
      // After $50 fixed: 1247.4 - 50 = 1197.4
      expect(discounts.totalDiscountAmount.toString()).toBe('188.6');
      expect(discounts.subtotalAfterDiscounts.toString()).toBe('1197.4');

      // Step 3: Calculate tax
      const taxAmount = service.calculateTax(
        discounts.subtotalAfterDiscounts,
        new Decimal(8),
      );

      // 8% of 1197.4 = 95.792
      expect(taxAmount.toString()).toBe('95.792');

      // Step 4: Calculate total
      const total = service.calculateTotal(
        discounts.subtotalAfterDiscounts,
        taxAmount,
      );

      // 1197.4 + 95.792 = 1293.192
      expect(total.toString()).toBe('1293.192');
    });
  });
});
