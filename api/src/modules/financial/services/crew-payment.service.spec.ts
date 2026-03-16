import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CrewPaymentService } from './crew-payment.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const PAYMENT_ID = 'payment-uuid-001';

const mockCrewMember = (overrides: any = {}) => ({
  id: CREW_MEMBER_ID,
  tenant_id: TENANT_ID,
  first_name: 'John',
  last_name: 'Doe',
  ...overrides,
});

const mockPaymentRecord = (overrides: any = {}) => ({
  id: PAYMENT_ID,
  tenant_id: TENANT_ID,
  crew_member_id: CREW_MEMBER_ID,
  project_id: null,
  amount: 1500.0,
  payment_date: new Date('2026-03-15'),
  payment_method: 'check',
  reference_number: 'CHK-4521',
  period_start_date: null,
  period_end_date: null,
  hours_paid: null,
  notes: 'Bi-weekly payment',
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-15T10:00:00.000Z'),
  crew_member: { id: CREW_MEMBER_ID, first_name: 'John', last_name: 'Doe' },
  project: null,
  ...overrides,
});

const mockPrismaService = {
  crew_payment_record: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  },
  crew_member: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('CrewPaymentService', () => {
  let service: CrewPaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrewPaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<CrewPaymentService>(CrewPaymentService);
    jest.clearAllMocks();
  });

  describe('createPayment()', () => {
    const dto = {
      crew_member_id: CREW_MEMBER_ID,
      amount: 1500.0,
      payment_date: '2026-03-15',
      payment_method: 'check',
      reference_number: 'CHK-4521',
      notes: 'Bi-weekly payment',
    };

    it('should create a payment record and call audit log', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrismaService.crew_payment_record.create.mockResolvedValue(mockPaymentRecord());

      const result = await service.createPayment(TENANT_ID, USER_ID, CREW_MEMBER_ID, dto as any);

      expect(mockPrismaService.crew_member.findFirst).toHaveBeenCalledWith({
        where: { id: CREW_MEMBER_ID, tenant_id: TENANT_ID },
      });

      expect(mockPrismaService.crew_payment_record.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            crew_member_id: CREW_MEMBER_ID,
            amount: 1500.0,
            created_by_user_id: USER_ID,
          }),
        }),
      );

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'crew_payment_record',
          tenantId: TENANT_ID,
        }),
      );

      expect(result.id).toBe(PAYMENT_ID);
    });

    it('should throw NotFoundException when crew member does not belong to tenant', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment(TENANT_ID, USER_ID, CREW_MEMBER_ID, dto as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.crew_payment_record.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when payment_date is in the future', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(mockCrewMember());

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      await expect(
        service.createPayment(TENANT_ID, USER_ID, CREW_MEMBER_ID, {
          ...dto,
          payment_date: futureDateStr,
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.crew_payment_record.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when period_start_date is after period_end_date', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(mockCrewMember());

      await expect(
        service.createPayment(TENANT_ID, USER_ID, CREW_MEMBER_ID, {
          ...dto,
          period_start_date: '2026-03-20',
          period_end_date: '2026-03-10',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPaymentHistory()', () => {
    it('should return paginated results with tenant_id and crew_member_id filter', async () => {
      const payments = [mockPaymentRecord()];
      mockPrismaService.crew_payment_record.findMany.mockResolvedValue(payments);
      mockPrismaService.crew_payment_record.count.mockResolvedValue(1);

      const result = await service.getPaymentHistory(TENANT_ID, CREW_MEMBER_ID, {
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.crew_payment_record.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            crew_member_id: CREW_MEMBER_ID,
          }),
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply project_id filter when provided', async () => {
      mockPrismaService.crew_payment_record.findMany.mockResolvedValue([]);
      mockPrismaService.crew_payment_record.count.mockResolvedValue(0);

      await service.getPaymentHistory(TENANT_ID, CREW_MEMBER_ID, {
        project_id: PROJECT_ID,
      });

      expect(mockPrismaService.crew_payment_record.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            project_id: PROJECT_ID,
          }),
        }),
      );
    });
  });

  describe('listPayments()', () => {
    it('should return paginated results with tenant_id filter', async () => {
      mockPrismaService.crew_payment_record.findMany.mockResolvedValue([]);
      mockPrismaService.crew_payment_record.count.mockResolvedValue(0);

      const result = await service.listPayments(TENANT_ID, { page: 1, limit: 20 });

      expect(mockPrismaService.crew_payment_record.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );

      expect(result.meta.page).toBe(1);
    });

    it('should cap limit at 100', async () => {
      mockPrismaService.crew_payment_record.findMany.mockResolvedValue([]);
      mockPrismaService.crew_payment_record.count.mockResolvedValue(0);

      await service.listPayments(TENANT_ID, { limit: 500 });

      expect(mockPrismaService.crew_payment_record.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('getTotalPaid()', () => {
    it('should return aggregated total and count', async () => {
      mockPrismaService.crew_payment_record.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
        _count: 3,
      });

      const result = await service.getTotalPaid(TENANT_ID, CREW_MEMBER_ID);

      expect(mockPrismaService.crew_payment_record.aggregate).toHaveBeenCalledWith({
        where: { tenant_id: TENANT_ID, crew_member_id: CREW_MEMBER_ID },
        _sum: { amount: true },
        _count: true,
      });

      expect(result.total_paid).toBe(5000);
      expect(result.payment_count).toBe(3);
    });

    it('should return 0 when no payments exist', async () => {
      mockPrismaService.crew_payment_record.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: 0,
      });

      const result = await service.getTotalPaid(TENANT_ID, CREW_MEMBER_ID);

      expect(result.total_paid).toBe(0);
      expect(result.payment_count).toBe(0);
    });
  });

  describe('Tenant isolation', () => {
    it('should always include tenant_id in crew member validation', async () => {
      mockPrismaService.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.createPayment('other-tenant', USER_ID, CREW_MEMBER_ID, {
          crew_member_id: CREW_MEMBER_ID,
          amount: 100,
          payment_date: '2026-03-01',
          payment_method: 'cash',
        } as any),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.crew_member.findFirst).toHaveBeenCalledWith({
        where: { id: CREW_MEMBER_ID, tenant_id: 'other-tenant' },
      });
    });
  });
});
