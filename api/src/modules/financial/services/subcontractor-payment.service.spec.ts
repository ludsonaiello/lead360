import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubcontractorPaymentService } from './subcontractor-payment.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const SUB_ID = 'sub-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const PAYMENT_ID = 'payment-uuid-001';

const mockSubcontractor = (overrides: any = {}) => ({
  id: SUB_ID,
  tenant_id: TENANT_ID,
  business_name: 'Acme Electric',
  ...overrides,
});

const mockPaymentRecord = (overrides: any = {}) => ({
  id: PAYMENT_ID,
  tenant_id: TENANT_ID,
  subcontractor_id: SUB_ID,
  project_id: null,
  amount: 5000.0,
  payment_date: new Date('2026-03-15'),
  payment_method: 'bank_transfer',
  reference_number: 'WIRE-001',
  notes: 'Payment for electrical work',
  created_by_user_id: USER_ID,
  created_at: new Date(),
  subcontractor: { id: SUB_ID, business_name: 'Acme Electric', trade_specialty: 'Electrical' },
  project: null,
  ...overrides,
});

const mockPrismaService = {
  subcontractor_payment_record: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  subcontractor: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('SubcontractorPaymentService', () => {
  let service: SubcontractorPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubcontractorPaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<SubcontractorPaymentService>(SubcontractorPaymentService);
    jest.clearAllMocks();
  });

  describe('createPayment()', () => {
    const dto = {
      subcontractor_id: SUB_ID,
      amount: 5000.0,
      payment_date: '2026-03-15',
      payment_method: 'bank_transfer',
      reference_number: 'WIRE-001',
      notes: 'Payment for electrical work',
    };

    it('should create a payment record and call audit log', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(mockSubcontractor());
      mockPrismaService.subcontractor_payment_record.create.mockResolvedValue(mockPaymentRecord());

      const result = await service.createPayment(TENANT_ID, USER_ID, SUB_ID, dto as any);

      expect(mockPrismaService.subcontractor.findFirst).toHaveBeenCalledWith({
        where: { id: SUB_ID, tenant_id: TENANT_ID },
      });

      expect(mockPrismaService.subcontractor_payment_record.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            subcontractor_id: SUB_ID,
            amount: 5000.0,
            created_by_user_id: USER_ID,
          }),
        }),
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'subcontractor_payment_record',
          tenantId: TENANT_ID,
        }),
      );

      expect(result.id).toBe(PAYMENT_ID);
    });

    it('should throw NotFoundException when subcontractor does not belong to tenant', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(TENANT_ID, USER_ID, SUB_ID, dto as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.subcontractor_payment_record.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payment_date is in the future', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(mockSubcontractor());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        service.createPayment(TENANT_ID, USER_ID, SUB_ID, {
          ...dto,
          payment_date: futureDateStr,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.subcontractor_payment_record.create).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentHistory()', () => {
    it('should return paginated results filtered by tenant and subcontractor', async () => {
      mockPrismaService.subcontractor_payment_record.findMany.mockResolvedValue([mockPaymentRecord()]);
      mockPrismaService.subcontractor_payment_record.count.mockResolvedValue(1);

      const result = await service.getPaymentHistory(TENANT_ID, SUB_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.subcontractor_payment_record.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            subcontractor_id: SUB_ID,
          }),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getTotalPaid()', () => {
    it('should return aggregated total and count', async () => {
      mockPrismaService.subcontractor_payment_record.aggregate.mockResolvedValue({
        _sum: { amount: 15000 },
        _count: 5,
      });

      const result = await service.getTotalPaid(TENANT_ID, SUB_ID);

      expect(result.total_paid).toBe(15000);
      expect(result.payment_count).toBe(5);
    });

    it('should return 0 when no payments exist', async () => {
      mockPrismaService.subcontractor_payment_record.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      });

      const result = await service.getTotalPaid(TENANT_ID, SUB_ID);

      expect(result.total_paid).toBe(0);
      expect(result.payment_count).toBe(0);
    });
  });

  describe('Tenant isolation', () => {
    it('should always include tenant_id in subcontractor validation', async () => {
      mockPrismaService.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment('other-tenant', USER_ID, SUB_ID, {
          subcontractor_id: SUB_ID,
          amount: 100,
          payment_date: '2026-03-01',
          payment_method: 'cash',
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.subcontractor.findFirst).toHaveBeenCalledWith({
        where: { id: SUB_ID, tenant_id: 'other-tenant' },
      });
    });
  });
});
