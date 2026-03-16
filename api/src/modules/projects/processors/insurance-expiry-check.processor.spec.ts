import { Test, TestingModule } from '@nestjs/testing';
import { InsuranceExpiryCheckProcessor } from './insurance-expiry-check.processor';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

describe('InsuranceExpiryCheckProcessor', () => {
  let processor: InsuranceExpiryCheckProcessor;

  const mockPrisma = {
    tenant: { findMany: jest.fn() },
    subcontractor: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    notification: { findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InsuranceExpiryCheckProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    processor = module.get<InsuranceExpiryCheckProcessor>(
      InsuranceExpiryCheckProcessor,
    );
  });

  // -------------------------------------------------------------------------
  // computeComplianceStatus — pure function tests
  // -------------------------------------------------------------------------

  describe('computeComplianceStatus', () => {
    const today = new Date('2026-03-16T00:00:00.000Z');
    const threshold = new Date('2026-04-15T00:00:00.000Z'); // today + 30 days

    it('should return "unknown" when insurance_expiry_date is null', () => {
      expect(processor.computeComplianceStatus(null, today, threshold)).toBe(
        'unknown',
      );
    });

    it('should return "expired" when expiry date is before today', () => {
      const expiredDate = new Date('2026-03-15'); // yesterday
      expect(
        processor.computeComplianceStatus(expiredDate, today, threshold),
      ).toBe('expired');
    });

    it('should return "expired" when expiry date is far in the past', () => {
      const longExpired = new Date('2025-01-01');
      expect(
        processor.computeComplianceStatus(longExpired, today, threshold),
      ).toBe('expired');
    });

    it('should return "expiring_soon" when expiry date is today', () => {
      const expiryToday = new Date('2026-03-16');
      expect(
        processor.computeComplianceStatus(expiryToday, today, threshold),
      ).toBe('expiring_soon');
    });

    it('should return "expiring_soon" when expiry date is within 30 days', () => {
      const expiring = new Date('2026-04-10'); // 25 days from now
      expect(
        processor.computeComplianceStatus(expiring, today, threshold),
      ).toBe('expiring_soon');
    });

    it('should return "expiring_soon" on the 30th day exactly', () => {
      const exactThreshold = new Date('2026-04-15');
      expect(
        processor.computeComplianceStatus(exactThreshold, today, threshold),
      ).toBe('expiring_soon');
    });

    it('should return "valid" when expiry date is beyond 30 days', () => {
      const valid = new Date('2026-04-16'); // 31 days from now
      expect(
        processor.computeComplianceStatus(valid, today, threshold),
      ).toBe('valid');
    });

    it('should return "valid" when expiry date is far in the future', () => {
      const farFuture = new Date('2027-12-31');
      expect(
        processor.computeComplianceStatus(farFuture, today, threshold),
      ).toBe('valid');
    });
  });

  // -------------------------------------------------------------------------
  // Core execution — multi-tenant processing
  // -------------------------------------------------------------------------

  describe('execute', () => {
    it('should process all active tenants', async () => {
      const tenantA = { id: 'tenant-a', company_name: 'Company A' };
      const tenantB = { id: 'tenant-b', company_name: 'Company B' };
      mockPrisma.tenant.findMany.mockResolvedValue([tenantA, tenantB]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      const result = await processor.execute();

      expect(result.tenants_processed).toBe(2);
      expect(result.tenants_total).toBe(2);
      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
        where: { is_active: true, deleted_at: null },
        select: { id: true, company_name: true },
      });
    });

    it('should return zero counts when no tenants exist', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);

      const result = await processor.execute();

      expect(result.tenants_processed).toBe(0);
      expect(result.tenants_total).toBe(0);
      expect(result.subcontractors_checked).toBe(0);
    });

    it('should skip tenants with no subcontractors assigned to active projects', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      const result = await processor.execute();

      expect(result.subcontractors_checked).toBe(0);
      expect(result.notifications_sent).toBe(0);
      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Compliance status updates
  // -------------------------------------------------------------------------

  describe('compliance status updates', () => {
    const setupTenantWithSub = (sub: any) => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([sub]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
    };

    it('should update compliance_status from unknown to expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      setupTenantWithSub({
        id: 'sub-1',
        business_name: 'Ace Plumbing',
        insurance_expiry_date: pastDate,
        compliance_status: 'unknown',
      });

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', tenant_id: 'tenant-a' },
        data: { compliance_status: 'expired' },
      });
    });

    it('should update compliance_status from valid to expiring_soon', async () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 15);

      setupTenantWithSub({
        id: 'sub-1',
        business_name: 'Ace Plumbing',
        insurance_expiry_date: soonDate,
        compliance_status: 'valid',
      });

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', tenant_id: 'tenant-a' },
        data: { compliance_status: 'expiring_soon' },
      });
    });

    it('should NOT update when compliance_status is already correct', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      setupTenantWithSub({
        id: 'sub-1',
        business_name: 'Ace Plumbing',
        insurance_expiry_date: pastDate,
        compliance_status: 'expired', // already correct
      });

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).not.toHaveBeenCalled();
    });

    it('should not update or notify for "valid" subcontractors', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 90);

      setupTenantWithSub({
        id: 'sub-1',
        business_name: 'Ace Plumbing',
        insurance_expiry_date: futureDate,
        compliance_status: 'valid',
      });

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).not.toHaveBeenCalled();
      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should not update or notify for "unknown" (no expiry date) subcontractors', async () => {
      setupTenantWithSub({
        id: 'sub-1',
        business_name: 'Ace Plumbing',
        insurance_expiry_date: null,
        compliance_status: 'unknown',
      });

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).not.toHaveBeenCalled();
      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Notification creation
  // -------------------------------------------------------------------------

  describe('notifications', () => {
    it('should create notification for each Owner/Admin user when insurance is expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Ace Plumbing',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null); // No dedup hit
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'owner-1' },
        { id: 'admin-1' },
      ]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      const result = await processor.execute();

      expect(result.notifications_sent).toBe(2);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledTimes(2);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-a',
          user_id: 'owner-1',
          type: 'subcontractor_compliance',
          title: 'Insurance Expiry Alert',
          message: "Insurance for 'Ace Plumbing' has expired.",
          action_url: '/subcontractors/sub-1',
          related_entity_type: 'subcontractor',
          related_entity_id: 'sub-1',
        }),
      );
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'admin-1',
        }),
      );
    });

    it('should use "expires on" message format for expiring_soon', async () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 10);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Quick Electric',
          insurance_expiry_date: soonDate,
          compliance_status: 'valid',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      await processor.execute();

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Insurance for 'Quick Electric' expires on"),
        }),
      );
    });

    it('should skip notification if no Owner/Admin users exist', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Ace Plumbing',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]); // No owners/admins

      const result = await processor.execute();

      expect(result.notifications_sent).toBe(0);
      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Deduplication — one notification per subcontractor per day
  // -------------------------------------------------------------------------

  describe('deduplication', () => {
    it('should skip notification when one already exists today for this subcontractor', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Ace Plumbing',
          insurance_expiry_date: pastDate,
          compliance_status: 'expired',
        },
      ]);
      // Dedup hit: notification already exists today
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'existing-notif',
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);

      const result = await processor.execute();

      expect(result.notifications_sent).toBe(0);
      expect(mockNotificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('should check dedup using tenant_id + type + related_entity_id + today', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Ace',
          insurance_expiry_date: pastDate,
          compliance_status: 'expired',
        },
      ]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      await processor.execute();

      // Verify dedup query includes correct filters
      expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-a',
            type: 'subcontractor_compliance',
            related_entity_id: 'sub-1',
            created_at: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
          select: { id: true },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Multi-tenant fault isolation
  // -------------------------------------------------------------------------

  describe('multi-tenant fault isolation', () => {
    it('should continue processing if one tenant fails', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'Good Tenant' },
        { id: 'tenant-b', company_name: 'Bad Tenant' },
        { id: 'tenant-c', company_name: 'Another Good' },
      ]);

      // tenant-a and tenant-c succeed, tenant-b throws
      mockPrisma.subcontractor.findMany
        .mockResolvedValueOnce([]) // tenant-a
        .mockRejectedValueOnce(new Error('DB connection lost')) // tenant-b
        .mockResolvedValueOnce([]); // tenant-c

      const result = await processor.execute();

      expect(result.tenants_processed).toBe(2); // a and c
      expect(result.tenants_total).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('tenant-b');
    });

    it('should continue if notification creation fails for one user', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Ace',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'owner-1' },
        { id: 'admin-1' },
      ]);

      // First notification fails, second succeeds
      mockNotificationsService.createNotification
        .mockRejectedValueOnce(new Error('Notification error'))
        .mockResolvedValueOnce({ id: 'n2' });

      const result = await processor.execute();

      expect(result.notifications_sent).toBe(1);
      expect(result.compliance_updated).toBe(1);
    });

    it('should continue processing other subcontractors if one fails', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 10);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Bad Sub',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
        {
          id: 'sub-2',
          business_name: 'Good Sub',
          insurance_expiry_date: soonDate,
          compliance_status: 'valid',
        },
      ]);

      // First sub's updateMany throws, second succeeds
      mockPrisma.subcontractor.updateMany
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      const result = await processor.execute();

      // sub-2 should still be processed
      expect(result.subcontractors_checked).toBe(2);
      expect(result.compliance_updated).toBe(1);
      expect(result.notifications_sent).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation in queries
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('should always include tenant_id in subcontractor queries', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      await processor.execute();

      expect(mockPrisma.subcontractor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-x',
          }),
        }),
      );
    });

    it('should include tenant_id in subcontractor updateMany for compliance update', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Test',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await processor.execute();

      expect(mockPrisma.subcontractor.updateMany).toHaveBeenCalledWith({
        where: { id: 'sub-1', tenant_id: 'tenant-x' },
        data: { compliance_status: 'expired' },
      });
    });

    it('should include tenant_id in notification dedup query', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Test',
          insurance_expiry_date: pastDate,
          compliance_status: 'expired',
        },
      ]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      await processor.execute();

      expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-x',
          }),
        }),
      );
    });

    it('should include tenant_id filter when querying Owner/Admin users', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Test',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);

      await processor.execute();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
            deleted_at: null,
            memberships: {
              some: { tenant_id: 'tenant-x', status: 'ACTIVE' },
            },
            user_role_user_role_user_idTouser: {
              some: {
                tenant_id: 'tenant-x',
                role: { name: { in: ['Owner', 'Admin'] } },
              },
            },
          }),
        }),
      );
    });

    it('should filter subcontractors by active project assignment', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([]);

      await processor.execute();

      expect(mockPrisma.subcontractor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-x',
            is_active: true,
            task_assignees: {
              some: {
                tenant_id: 'tenant-x',
                task: {
                  deleted_at: null,
                  project: {
                    tenant_id: 'tenant-x',
                    status: 'in_progress',
                  },
                },
              },
            },
          }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Owner/Admin user query caching (performance)
  // -------------------------------------------------------------------------

  describe('owner/admin user query optimization', () => {
    it('should query Owner/Admin users only once per tenant even with multiple subs', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.subcontractor.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          business_name: 'Sub A',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
        {
          id: 'sub-2',
          business_name: 'Sub B',
          insurance_expiry_date: pastDate,
          compliance_status: 'unknown',
        },
      ]);
      mockPrisma.subcontractor.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'owner-1' }]);
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      await processor.execute();

      // Users queried once for the tenant, not once per subcontractor
      expect(mockPrisma.user.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
