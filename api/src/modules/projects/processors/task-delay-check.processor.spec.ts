import { Test, TestingModule } from '@nestjs/testing';
import { TaskDelayCheckProcessor } from './task-delay-check.processor';
import { InsuranceExpiryCheckProcessor } from './insurance-expiry-check.processor';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { Job } from 'bullmq';

describe('TaskDelayCheckProcessor', () => {
  let processor: TaskDelayCheckProcessor;

  const mockPrisma = {
    tenant: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
    project_task: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockNotificationsService = {
    createNotification: jest.fn(),
  };

  const mockInsuranceExpiryCheck = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskDelayCheckProcessor,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
        {
          provide: InsuranceExpiryCheckProcessor,
          useValue: mockInsuranceExpiryCheck,
        },
      ],
    }).compile();

    processor = module.get<TaskDelayCheckProcessor>(TaskDelayCheckProcessor);
  });

  // -------------------------------------------------------------------------
  // Core processing
  // -------------------------------------------------------------------------

  describe('process', () => {
    it('should process all active tenants (excluding soft-deleted)', async () => {
      const tenantA = { id: 'tenant-a', company_name: 'Company A' };
      const tenantB = { id: 'tenant-b', company_name: 'Company B' };
      mockPrisma.tenant.findMany.mockResolvedValue([tenantA, tenantB]);
      // Stale flag cleanup call + no projects
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findMany.mockResolvedValue([]);

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.success).toBe(true);
      expect(result.tenants_processed).toBe(2);
      expect(result.tenants_total).toBe(2);
      expect(mockPrisma.tenant.findMany).toHaveBeenCalledWith({
        where: { is_active: true, deleted_at: null },
        select: { id: true, company_name: true },
      });
    });

    it('should update is_delayed for overdue tasks', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Test Project', assigned_pm_user_id: 'pm-1' },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Overdue Task' },
        { id: 'task-2', title: 'Another Overdue' },
      ]);
      // First call: stale cleanup; Second call: batch update
      mockPrisma.project_task.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 2 });
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'notif-1',
      });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.tasks_updated).toBe(2);
      // Second updateMany call should be the delay flagging
      expect(mockPrisma.project_task.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['task-1', 'task-2'] },
          tenant_id: 'tenant-a',
        },
        data: { is_delayed: true },
      });
    });

    it('should create notifications for newly delayed tasks', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Remodel', assigned_pm_user_id: 'pm-user-1' },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Install Cabinets' },
      ]);
      mockPrisma.project_task.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.notifications_sent).toBe(1);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith({
        tenant_id: 'tenant-a',
        user_id: 'pm-user-1',
        type: 'task_delayed',
        title: 'Task Delayed',
        message:
          "Task 'Install Cabinets' in project 'Remodel' is past its estimated end date.",
        action_url: '/projects/proj-1/tasks/task-1',
        related_entity_type: 'project_task',
        related_entity_id: 'task-1',
      });
    });

    it('should broadcast notification when project has no assigned PM', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'Unassigned', assigned_pm_user_id: null },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Fix Leak' },
      ]);
      mockPrisma.project_task.updateMany
        .mockResolvedValueOnce({ count: 0 })
        .mockResolvedValueOnce({ count: 1 });
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: null, // Broadcast to all tenant users
        }),
      );
    });

    it('should skip projects with no overdue tasks', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'On Track', assigned_pm_user_id: 'pm-1' },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([]);
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.tasks_updated).toBe(0);
      expect(result.notifications_sent).toBe(0);
      expect(
        mockNotificationsService.createNotification,
      ).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Stale flag cleanup
  // -------------------------------------------------------------------------

  describe('stale flag cleanup', () => {
    it('should clear is_delayed for tasks that are no longer overdue', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.project.findMany.mockResolvedValue([]);

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      // First updateMany call should be the stale flag cleanup
      expect(mockPrisma.project_task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-a',
            is_delayed: true,
            deleted_at: null,
          }),
          data: { is_delayed: false },
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

      // Stale cleanup succeeds for all, project query fails for tenant-b
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findMany
        .mockResolvedValueOnce([]) // tenant-a
        .mockRejectedValueOnce(new Error('DB connection lost')) // tenant-b
        .mockResolvedValueOnce([]); // tenant-c

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.tenants_processed).toBe(2); // a and c
      expect(result.tenants_total).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('tenant-b');
    });

    it('should continue if notification creation fails for one task', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-a', company_name: 'A' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'proj-1', name: 'P1', assigned_pm_user_id: 'pm-1' },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Task A' },
        { id: 'task-2', title: 'Task B' },
      ]);
      mockPrisma.project_task.updateMany
        .mockResolvedValueOnce({ count: 0 }) // stale cleanup
        .mockResolvedValueOnce({ count: 2 }); // batch flag

      // First notification fails, second succeeds
      mockNotificationsService.createNotification
        .mockRejectedValueOnce(new Error('Notification error'))
        .mockResolvedValueOnce({ id: 'n2' });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      const result = await processor.process(job);

      expect(result.tasks_updated).toBe(2);
      expect(result.notifications_sent).toBe(1); // Only second succeeded
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation in queries
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('should always include tenant_id in project queries', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findMany.mockResolvedValue([]);

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'tenant-x' }),
        }),
      );
    });

    it('should always include tenant_id in task queries', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'p1', name: 'P1', assigned_pm_user_id: null },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([]);

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      expect(mockPrisma.project_task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'tenant-x' }),
        }),
      );
    });

    it('should include tenant_id in updateMany for delay flagging', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.project.findMany.mockResolvedValue([
        { id: 'p1', name: 'P1', assigned_pm_user_id: null },
      ]);
      mockPrisma.project_task.findMany.mockResolvedValue([
        { id: 't1', title: 'Delayed' },
      ]);
      mockPrisma.project_task.updateMany
        .mockResolvedValueOnce({ count: 0 }) // stale cleanup
        .mockResolvedValueOnce({ count: 1 }); // delay flag
      mockNotificationsService.createNotification.mockResolvedValue({
        id: 'n1',
      });

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      // Second call is the delay flagging
      expect(mockPrisma.project_task.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['t1'] },
          tenant_id: 'tenant-x',
        },
        data: { is_delayed: true },
      });
    });

    it('should include tenant_id in stale flag cleanup', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 'tenant-x', company_name: 'X' },
      ]);
      mockPrisma.project_task.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.project.findMany.mockResolvedValue([]);

      const job = { id: 'job-1', data: {} } as unknown as Job;
      await processor.process(job);

      // First call is the stale flag cleanup
      expect(mockPrisma.project_task.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: 'tenant-x' }),
          data: { is_delayed: false },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Job-name routing (Sprint 33)
  // -------------------------------------------------------------------------

  describe('job-name routing', () => {
    it('should route "subcontractor-insurance-check" to InsuranceExpiryCheckProcessor', async () => {
      mockInsuranceExpiryCheck.execute.mockResolvedValue({
        tenants_processed: 1,
        tenants_total: 1,
        subcontractors_checked: 3,
        compliance_updated: 1,
        notifications_sent: 2,
      });

      const job = {
        id: 'job-1',
        name: 'subcontractor-insurance-check',
        data: {},
      } as unknown as Job;

      const result = await processor.process(job);

      expect(mockInsuranceExpiryCheck.execute).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.subcontractors_checked).toBe(3);
      // Delay check logic should NOT run
      expect(mockPrisma.tenant.findMany).not.toHaveBeenCalled();
    });

    it('should route default/unknown job names to delay check logic', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([]);

      const job = {
        id: 'job-1',
        name: 'project-task-delay-check',
        data: {},
      } as unknown as Job;

      await processor.process(job);

      expect(mockPrisma.tenant.findMany).toHaveBeenCalled();
      expect(mockInsuranceExpiryCheck.execute).not.toHaveBeenCalled();
    });

    it('should propagate errors from insurance check', async () => {
      mockInsuranceExpiryCheck.execute.mockRejectedValue(
        new Error('Insurance check failed'),
      );

      const job = {
        id: 'job-1',
        name: 'subcontractor-insurance-check',
        data: {},
      } as unknown as Job;

      await expect(processor.process(job)).rejects.toThrow(
        'Insurance check failed',
      );
    });
  });
});
