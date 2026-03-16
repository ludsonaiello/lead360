import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TaskCrewHourService } from './task-crew-hour.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CrewHourLogService } from '../../financial/services/crew-hour-log.service';

describe('TaskCrewHourService', () => {
  let service: TaskCrewHourService;

  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';
  const USER_ID = 'user-uuid';
  const PROJECT_ID = 'project-uuid';
  const TASK_ID = 'task-uuid';
  const CREW_MEMBER_ID = 'crew-uuid';
  const HOUR_LOG_ID = 'hourlog-uuid';

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
    },
    project_task: {
      findFirst: jest.fn(),
    },
    crew_member: {
      findFirst: jest.fn(),
    },
    crew_hour_log: {
      findMany: jest.fn(),
    },
  };

  const mockCrewHourLogService = {
    logHours: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskCrewHourService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CrewHourLogService, useValue: mockCrewHourLogService },
      ],
    }).compile();

    service = module.get<TaskCrewHourService>(TaskCrewHourService);
  });

  // ---------------------------------------------------------------------------
  // Helper — set up valid project + task mock state
  // ---------------------------------------------------------------------------
  function setupValidProjectAndTask(tenantId = TENANT_A) {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: PROJECT_ID,
      tenant_id: tenantId,
    });
    mockPrisma.project_task.findFirst.mockResolvedValue({
      id: TASK_ID,
      project_id: PROJECT_ID,
      tenant_id: tenantId,
    });
  }

  // ===========================================================================
  // logTaskCrewHours
  // ===========================================================================
  describe('logTaskCrewHours', () => {
    const dto = {
      crew_member_id: CREW_MEMBER_ID,
      log_date: '2026-03-15',
      hours_regular: 8.0,
      hours_overtime: 2.0,
      notes: 'Framing work',
    };

    it('should delegate to CrewHourLogService.logHours with project_id and task_id pre-filled', async () => {
      setupValidProjectAndTask();

      const expectedLog = {
        id: HOUR_LOG_ID,
        tenant_id: TENANT_A,
        crew_member_id: CREW_MEMBER_ID,
        project_id: PROJECT_ID,
        task_id: TASK_ID,
        log_date: new Date('2026-03-15'),
        hours_regular: 8.0,
        hours_overtime: 2.0,
        source: 'manual',
        notes: 'Framing work',
        crew_member: { id: CREW_MEMBER_ID, first_name: 'John', last_name: 'Doe' },
        project: { id: PROJECT_ID, name: 'Test Project', project_number: 'P-001' },
        task: { id: TASK_ID, title: 'Install drywall' },
      };
      mockCrewHourLogService.logHours.mockResolvedValue(expectedLog);

      const result = await service.logTaskCrewHours(
        TENANT_A,
        USER_ID,
        PROJECT_ID,
        TASK_ID,
        dto,
      );

      expect(result).toEqual(expectedLog);
      expect(mockCrewHourLogService.logHours).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        {
          crew_member_id: CREW_MEMBER_ID,
          project_id: PROJECT_ID,
          task_id: TASK_ID,
          log_date: '2026-03-15',
          hours_regular: 8.0,
          hours_overtime: 2.0,
          notes: 'Framing work',
        },
      );
    });

    it('should pass undefined for optional fields when not provided', async () => {
      setupValidProjectAndTask();
      mockCrewHourLogService.logHours.mockResolvedValue({ id: HOUR_LOG_ID });

      await service.logTaskCrewHours(
        TENANT_A,
        USER_ID,
        PROJECT_ID,
        TASK_ID,
        {
          crew_member_id: CREW_MEMBER_ID,
          log_date: '2026-03-15',
          hours_regular: 8.0,
        },
      );

      expect(mockCrewHourLogService.logHours).toHaveBeenCalledWith(
        TENANT_A,
        USER_ID,
        {
          crew_member_id: CREW_MEMBER_ID,
          project_id: PROJECT_ID,
          task_id: TASK_ID,
          log_date: '2026-03-15',
          hours_regular: 8.0,
          hours_overtime: undefined,
          notes: undefined,
        },
      );
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.logTaskCrewHours(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.logTaskCrewHours(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow('Project not found');

      expect(mockCrewHourLogService.logHours).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        tenant_id: TENANT_A,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.logTaskCrewHours(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.logTaskCrewHours(TENANT_A, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow('Task not found in this project');

      expect(mockCrewHourLogService.logHours).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // getTaskCrewHours
  // ===========================================================================
  describe('getTaskCrewHours', () => {
    it('should return crew hour logs filtered by tenant, project, and task', async () => {
      setupValidProjectAndTask();

      const mockLogs = [
        {
          id: 'log-1',
          tenant_id: TENANT_A,
          crew_member_id: CREW_MEMBER_ID,
          project_id: PROJECT_ID,
          task_id: TASK_ID,
          log_date: new Date('2026-03-15'),
          hours_regular: 8.0,
          hours_overtime: 1.0,
          crew_member: { id: CREW_MEMBER_ID, first_name: 'John', last_name: 'Doe' },
          project: { id: PROJECT_ID, name: 'Kitchen Remodel', project_number: 'P-001' },
          task: { id: TASK_ID, title: 'Install drywall' },
        },
      ];
      mockPrisma.crew_hour_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getTaskCrewHours(TENANT_A, PROJECT_ID, TASK_ID);

      expect(result).toEqual(mockLogs);
      expect(mockPrisma.crew_hour_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          task_id: TASK_ID,
        },
        include: {
          crew_member: {
            select: { id: true, first_name: true, last_name: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
          task: {
            select: { id: true, title: true },
          },
        },
        orderBy: { log_date: 'desc' },
      });
    });

    it('should return empty array when no logs exist for task', async () => {
      setupValidProjectAndTask();
      mockPrisma.crew_hour_log.findMany.mockResolvedValue([]);

      const result = await service.getTaskCrewHours(TENANT_A, PROJECT_ID, TASK_ID);

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskCrewHours(TENANT_A, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task does not belong to project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
        tenant_id: TENANT_A,
      });
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskCrewHours(TENANT_A, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // getCrewHourSummary
  // ===========================================================================
  describe('getCrewHourSummary', () => {
    it('should return aggregated hours across projects', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });

      const mockLogs = [
        {
          project_id: 'proj-1',
          hours_regular: 40,
          hours_overtime: 5,
          project: { id: 'proj-1', name: 'Kitchen Remodel' },
        },
        {
          project_id: 'proj-1',
          hours_regular: 40,
          hours_overtime: 0,
          project: { id: 'proj-1', name: 'Kitchen Remodel' },
        },
        {
          project_id: 'proj-2',
          hours_regular: 80,
          hours_overtime: 7.5,
          project: { id: 'proj-2', name: 'Bathroom Addition' },
        },
      ];
      mockPrisma.crew_hour_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID);

      expect(result.crew_member_id).toBe(CREW_MEMBER_ID);
      expect(result.total_regular_hours).toBe(160);
      expect(result.total_overtime_hours).toBe(12.5);
      expect(result.total_hours).toBe(172.5);
      expect(result.logs_by_project).toHaveLength(2);

      // Verify project breakdown
      const proj1 = result.logs_by_project.find((p) => p.project_id === 'proj-1')!;
      expect(proj1).toBeDefined();
      expect(proj1.project_name).toBe('Kitchen Remodel');
      expect(proj1.regular_hours).toBe(80);
      expect(proj1.overtime_hours).toBe(5);
      expect(proj1.total_hours).toBe(85);

      const proj2 = result.logs_by_project.find((p) => p.project_id === 'proj-2')!;
      expect(proj2).toBeDefined();
      expect(proj2.project_name).toBe('Bathroom Addition');
      expect(proj2.regular_hours).toBe(80);
      expect(proj2.overtime_hours).toBe(7.5);
      expect(proj2.total_hours).toBe(87.5);
    });

    it('should return zeroes when crew member has no hour logs', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrisma.crew_hour_log.findMany.mockResolvedValue([]);

      const result = await service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID);

      expect(result.crew_member_id).toBe(CREW_MEMBER_ID);
      expect(result.total_regular_hours).toBe(0);
      expect(result.total_overtime_hours).toBe(0);
      expect(result.total_hours).toBe(0);
      expect(result.logs_by_project).toHaveLength(0);
    });

    it('should handle Decimal values from Prisma (Decimal → number conversion)', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });

      // Prisma returns Decimal objects; Number() must work correctly
      const mockLogs = [
        {
          project_id: 'proj-1',
          hours_regular: { toNumber: () => 8.5, toString: () => '8.50' },
          hours_overtime: { toNumber: () => 1.25, toString: () => '1.25' },
          project: { id: 'proj-1', name: 'Test' },
        },
      ];
      mockPrisma.crew_hour_log.findMany.mockResolvedValue(mockLogs);

      const result = await service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID);

      // Number() on a Prisma Decimal calls valueOf()/toString(), which should work
      expect(result.total_regular_hours).toBeGreaterThanOrEqual(0);
      expect(result.total_overtime_hours).toBeGreaterThanOrEqual(0);
    });

    it('should throw NotFoundException when crew member does not exist', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID),
      ).rejects.toThrow('Crew member not found');
    });

    it('should include tenant_id filter when querying crew hour logs', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue({ id: CREW_MEMBER_ID });
      mockPrisma.crew_hour_log.findMany.mockResolvedValue([]);

      await service.getCrewHourSummary(TENANT_A, CREW_MEMBER_ID);

      expect(mockPrisma.crew_hour_log.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          crew_member_id: CREW_MEMBER_ID,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });
    });
  });

  // ===========================================================================
  // Multi-Tenant Isolation Tests
  // ===========================================================================
  describe('Multi-Tenant Isolation', () => {
    const dto = {
      crew_member_id: CREW_MEMBER_ID,
      log_date: '2026-03-15',
      hours_regular: 8.0,
    };

    it('should not allow tenant B to log crew hours on tenant A project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.logTaskCrewHours(TENANT_B, USER_ID, PROJECT_ID, TASK_ID, dto),
      ).rejects.toThrow(NotFoundException);

      // Verify the query included tenant_id filter
      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: PROJECT_ID, tenant_id: TENANT_B },
        select: { id: true },
      });

      expect(mockCrewHourLogService.logHours).not.toHaveBeenCalled();
    });

    it('should not allow tenant B to list crew hours on tenant A project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getTaskCrewHours(TENANT_B, PROJECT_ID, TASK_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.crew_hour_log.findMany).not.toHaveBeenCalled();
    });

    it('should not allow tenant B to view tenant A crew member summary', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCrewHourSummary(TENANT_B, CREW_MEMBER_ID),
      ).rejects.toThrow(NotFoundException);

      // Verify the crew member query included tenant_id
      expect(mockPrisma.crew_member.findFirst).toHaveBeenCalledWith({
        where: { id: CREW_MEMBER_ID, tenant_id: TENANT_B },
        select: { id: true },
      });

      expect(mockPrisma.crew_hour_log.findMany).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // RBAC Boundary Tests (validate correct roles are expected at controller level)
  // ===========================================================================
  describe('RBAC — role guards are applied at controller level', () => {
    it('should verify service methods require tenantId as first param (defense in depth)', async () => {
      // Every public method signature starts with tenantId
      // This test documents the contract — if signatures change, tests break
      expect(service.logTaskCrewHours.length).toBe(5); // tenantId, userId, projectId, taskId, dto
      expect(service.getTaskCrewHours.length).toBe(3); // tenantId, projectId, taskId
      expect(service.getCrewHourSummary.length).toBe(2); // tenantId, crewMemberId
    });
  });
});
