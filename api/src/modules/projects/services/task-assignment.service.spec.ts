import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TaskAssignmentService } from './task-assignment.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { AssigneeTypeEnum } from '../dto/assign-task.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const TENANT_B_ID = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const TASK_ID = 'task-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';
const SUBCONTRACTOR_ID = 'sub-uuid-001';
const ASSIGNEE_USER_ID = 'assignee-user-uuid-001';
const ASSIGNMENT_ID = 'assignment-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockTask = (overrides: any = {}) => ({
  id: TASK_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  title: 'Install new shingles',
  deleted_at: null,
  ...overrides,
});

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID,
  tenant_id: TENANT_ID,
  ...overrides,
});

const mockCrewMember = (overrides: any = {}) => ({
  id: CREW_MEMBER_ID,
  tenant_id: TENANT_ID,
  first_name: 'Mike',
  last_name: 'Johnson',
  ...overrides,
});

const mockSubcontractor = (overrides: any = {}) => ({
  id: SUBCONTRACTOR_ID,
  tenant_id: TENANT_ID,
  business_name: 'ABC Plumbing LLC',
  ...overrides,
});

const mockUser = (overrides: any = {}) => ({
  id: ASSIGNEE_USER_ID,
  tenant_id: TENANT_ID,
  first_name: 'Sarah',
  last_name: 'Williams',
  ...overrides,
});

const mockAssigneeRecord = (overrides: any = {}) => ({
  id: ASSIGNMENT_ID,
  tenant_id: TENANT_ID,
  task_id: TASK_ID,
  assignee_type: 'crew_member',
  crew_member_id: CREW_MEMBER_ID,
  subcontractor_id: null,
  user_id: null,
  assigned_at: new Date('2026-04-01T10:00:00.000Z'),
  assigned_by_user_id: USER_ID,
  crew_member: { id: CREW_MEMBER_ID, first_name: 'Mike', last_name: 'Johnson' },
  subcontractor: null,
  assignee_user: null,
  task: { title: 'Install new shingles' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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
  subcontractor: {
    findFirst: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  task_assignee: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuditLogger = {
  logTenantChange: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TaskAssignmentService', () => {
  let service: TaskAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskAssignmentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<TaskAssignmentService>(TaskAssignmentService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // assignToTask — crew member
  // =========================================================================

  describe('assignToTask — crew member', () => {
    const crewDto = {
      assignee_type: AssigneeTypeEnum.crew_member,
      crew_member_id: CREW_MEMBER_ID,
    };

    it('should assign a crew member to a task and return formatted response', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null); // no duplicate
      mockPrisma.task_assignee.create.mockResolvedValue(mockAssigneeRecord());

      const result = await service.assignToTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        crewDto,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(ASSIGNMENT_ID);
      expect(result.task_id).toBe(TASK_ID);
      expect(result.assignee_type).toBe('crew_member');
      expect(result.crew_member).toEqual({
        id: CREW_MEMBER_ID,
        first_name: 'Mike',
        last_name: 'Johnson',
      });
      expect(result.subcontractor).toBeNull();
      expect(result.user).toBeNull();
      expect(result.assigned_at).toBeDefined();
      expect(result.assigned_by_user_id).toBe(USER_ID);

      // Verify Prisma create was called with correct data
      expect(mockPrisma.task_assignee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            task_id: TASK_ID,
            assignee_type: 'crew_member',
            crew_member_id: CREW_MEMBER_ID,
            subcontractor_id: null,
            user_id: null,
            assigned_by_user_id: USER_ID,
          }),
        }),
      );

      // Verify audit log
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'task_assignee',
          entityId: ASSIGNMENT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, crewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, crewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when crew member not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, crewDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when crew member already assigned', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(mockAssigneeRecord());

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, crewDto),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // assignToTask — subcontractor
  // =========================================================================

  describe('assignToTask — subcontractor', () => {
    const subDto = {
      assignee_type: AssigneeTypeEnum.subcontractor,
      subcontractor_id: SUBCONTRACTOR_ID,
    };

    it('should assign a subcontractor to a task', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.subcontractor.findFirst.mockResolvedValue(mockSubcontractor());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null);
      mockPrisma.task_assignee.create.mockResolvedValue(
        mockAssigneeRecord({
          assignee_type: 'subcontractor',
          crew_member_id: null,
          subcontractor_id: SUBCONTRACTOR_ID,
          crew_member: null,
          subcontractor: {
            id: SUBCONTRACTOR_ID,
            business_name: 'ABC Plumbing LLC',
          },
        }),
      );

      const result = await service.assignToTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        subDto,
      );

      expect(result.assignee_type).toBe('subcontractor');
      expect(result.subcontractor).toEqual({
        id: SUBCONTRACTOR_ID,
        business_name: 'ABC Plumbing LLC',
      });
      expect(result.crew_member).toBeNull();
      expect(result.user).toBeNull();

      expect(mockPrisma.task_assignee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignee_type: 'subcontractor',
            crew_member_id: null,
            subcontractor_id: SUBCONTRACTOR_ID,
            user_id: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException when subcontractor not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, subDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // assignToTask — user
  // =========================================================================

  describe('assignToTask — user', () => {
    const userDto = {
      assignee_type: AssigneeTypeEnum.user,
      user_id: ASSIGNEE_USER_ID,
    };

    it('should assign a user to a task', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.user.findFirst.mockResolvedValue(mockUser());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null);
      mockPrisma.task_assignee.create.mockResolvedValue(
        mockAssigneeRecord({
          assignee_type: 'user',
          crew_member_id: null,
          user_id: ASSIGNEE_USER_ID,
          crew_member: null,
          assignee_user: {
            id: ASSIGNEE_USER_ID,
            first_name: 'Sarah',
            last_name: 'Williams',
          },
        }),
      );

      const result = await service.assignToTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        userDto,
      );

      expect(result.assignee_type).toBe('user');
      expect(result.user).toEqual({
        id: ASSIGNEE_USER_ID,
        first_name: 'Sarah',
        last_name: 'Williams',
      });
      expect(result.crew_member).toBeNull();
      expect(result.subcontractor).toBeNull();

      expect(mockPrisma.task_assignee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignee_type: 'user',
            crew_member_id: null,
            subcontractor_id: null,
            user_id: ASSIGNEE_USER_ID,
          }),
        }),
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, userDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // assignToTask — validation: type mismatch
  // =========================================================================

  describe('assignToTask — type mismatch validation', () => {
    it('should throw BadRequestException when crew_member_id missing for type crew_member', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.crew_member,
          // crew_member_id is missing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when subcontractor_id missing for type subcontractor', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.subcontractor,
          // subcontractor_id is missing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user_id missing for type user', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.user,
          // user_id is missing
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when extra IDs provided for crew_member type', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.crew_member,
          crew_member_id: CREW_MEMBER_ID,
          subcontractor_id: SUBCONTRACTOR_ID, // extra
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when extra IDs provided for subcontractor type', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.subcontractor,
          subcontractor_id: SUBCONTRACTOR_ID,
          user_id: ASSIGNEE_USER_ID, // extra
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when extra IDs provided for user type', async () => {
      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.user,
          user_id: ASSIGNEE_USER_ID,
          crew_member_id: CREW_MEMBER_ID, // extra
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // assignToTask — duplicate prevention
  // =========================================================================

  describe('assignToTask — duplicate prevention', () => {
    it('should prevent assigning the same crew member to the same task twice', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(
        mockAssigneeRecord(),
      );

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.crew_member,
          crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow(ConflictException);

      // Should NOT have called create
      expect(mockPrisma.task_assignee.create).not.toHaveBeenCalled();
    });

    it('should prevent assigning the same subcontractor to the same task twice', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractor(),
      );
      mockPrisma.task_assignee.findFirst.mockResolvedValue(
        mockAssigneeRecord({ assignee_type: 'subcontractor' }),
      );

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.subcontractor,
          subcontractor_id: SUBCONTRACTOR_ID,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.task_assignee.create).not.toHaveBeenCalled();
    });

    it('should prevent assigning the same user to the same task twice', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.user.findFirst.mockResolvedValue(mockUser());
      mockPrisma.task_assignee.findFirst.mockResolvedValue(
        mockAssigneeRecord({ assignee_type: 'user' }),
      );

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.user,
          user_id: ASSIGNEE_USER_ID,
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.task_assignee.create).not.toHaveBeenCalled();
    });

    it('should allow different assignee types to the same task', async () => {
      // Crew member already assigned, now assigning subcontractor — should succeed
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      mockPrisma.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractor(),
      );
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null); // different type, no duplicate
      mockPrisma.task_assignee.create.mockResolvedValue(
        mockAssigneeRecord({
          id: 'assignment-uuid-002',
          assignee_type: 'subcontractor',
          crew_member_id: null,
          subcontractor_id: SUBCONTRACTOR_ID,
          crew_member: null,
          subcontractor: {
            id: SUBCONTRACTOR_ID,
            business_name: 'ABC Plumbing LLC',
          },
        }),
      );

      const result = await service.assignToTask(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        USER_ID,
        {
          assignee_type: AssigneeTypeEnum.subcontractor,
          subcontractor_id: SUBCONTRACTOR_ID,
        },
      );

      expect(result).toBeDefined();
      expect(result.assignee_type).toBe('subcontractor');
      expect(mockPrisma.task_assignee.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // removeAssignment
  // =========================================================================

  describe('removeAssignment', () => {
    it('should delete the assignment and create audit log', async () => {
      mockPrisma.task_assignee.findFirst.mockResolvedValue(
        mockAssigneeRecord(),
      );
      mockPrisma.task_assignee.delete.mockResolvedValue(mockAssigneeRecord());

      await service.removeAssignment(
        TENANT_ID,
        PROJECT_ID,
        TASK_ID,
        ASSIGNMENT_ID,
        USER_ID,
      );

      expect(mockPrisma.task_assignee.delete).toHaveBeenCalledWith({
        where: { id: ASSIGNMENT_ID },
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'task_assignee',
          entityId: ASSIGNMENT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw NotFoundException when assignment not found', async () => {
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAssignment(
          TENANT_ID,
          PROJECT_ID,
          TASK_ID,
          'non-existent-id',
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not delete assignment from other tenant', async () => {
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAssignment(
          TENANT_B_ID,
          PROJECT_ID,
          TASK_ID,
          ASSIGNMENT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getTaskAssignees
  // =========================================================================

  describe('getTaskAssignees', () => {
    it('should return all assignees for a task', async () => {
      mockPrisma.task_assignee.findMany.mockResolvedValue([
        mockAssigneeRecord({ id: 'a1' }),
        mockAssigneeRecord({
          id: 'a2',
          assignee_type: 'subcontractor',
          crew_member_id: null,
          subcontractor_id: SUBCONTRACTOR_ID,
          crew_member: null,
          subcontractor: {
            id: SUBCONTRACTOR_ID,
            business_name: 'ABC Plumbing LLC',
          },
        }),
      ]);

      const result = await service.getTaskAssignees(TENANT_ID, TASK_ID);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a1');
      expect(result[0].assignee_type).toBe('crew_member');
      expect(result[1].id).toBe('a2');
      expect(result[1].assignee_type).toBe('subcontractor');
    });

    it('should return empty array when no assignees', async () => {
      mockPrisma.task_assignee.findMany.mockResolvedValue([]);

      const result = await service.getTaskAssignees(TENANT_ID, TASK_ID);

      expect(result).toEqual([]);
    });

    it('should filter by tenant_id', async () => {
      mockPrisma.task_assignee.findMany.mockResolvedValue([]);

      await service.getTaskAssignees(TENANT_B_ID, TASK_ID);

      expect(mockPrisma.task_assignee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
            task_id: TASK_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getCrewMemberTasks
  // =========================================================================

  describe('getCrewMemberTasks', () => {
    it('should return all tasks assigned to a crew member', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrisma.task_assignee.findMany.mockResolvedValue([
        {
          id: 'a1',
          assigned_at: new Date('2026-04-01'),
          task: {
            id: 'task-1',
            title: 'Install shingles',
            status: 'in_progress',
            project_id: PROJECT_ID,
            estimated_start_date: new Date('2026-04-01'),
            estimated_end_date: new Date('2026-04-05'),
            actual_start_date: new Date('2026-04-02'),
            actual_end_date: null,
            order_index: 0,
            deleted_at: null,
          },
        },
      ]);

      const result = await service.getCrewMemberTasks(
        TENANT_ID,
        CREW_MEMBER_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe('task-1');
      expect(result[0].task_title).toBe('Install shingles');
      expect(result[0].task_status).toBe('in_progress');
      expect(result[0].project_id).toBe(PROJECT_ID);
    });

    it('should throw NotFoundException when crew member not found', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCrewMemberTasks(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude soft-deleted tasks', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(mockCrewMember());
      mockPrisma.task_assignee.findMany.mockResolvedValue([
        {
          id: 'a1',
          assigned_at: new Date(),
          task: {
            id: 'task-1',
            title: 'Active task',
            status: 'in_progress',
            project_id: PROJECT_ID,
            estimated_start_date: null,
            estimated_end_date: null,
            actual_start_date: null,
            actual_end_date: null,
            order_index: 0,
            deleted_at: null,
          },
        },
        {
          id: 'a2',
          assigned_at: new Date(),
          task: {
            id: 'task-2',
            title: 'Deleted task',
            status: 'not_started',
            project_id: PROJECT_ID,
            estimated_start_date: null,
            estimated_end_date: null,
            actual_start_date: null,
            actual_end_date: null,
            order_index: 1,
            deleted_at: new Date('2026-03-10'), // soft-deleted
          },
        },
      ]);

      const result = await service.getCrewMemberTasks(
        TENANT_ID,
        CREW_MEMBER_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe('task-1');
    });

    it('should filter by tenant_id', async () => {
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.getCrewMemberTasks(TENANT_B_ID, CREW_MEMBER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.crew_member.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getSubcontractorTasks
  // =========================================================================

  describe('getSubcontractorTasks', () => {
    it('should return all tasks assigned to a subcontractor', async () => {
      mockPrisma.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractor(),
      );
      mockPrisma.task_assignee.findMany.mockResolvedValue([
        {
          id: 'a1',
          assigned_at: new Date('2026-04-01'),
          task: {
            id: 'task-1',
            title: 'Plumbing inspection',
            status: 'not_started',
            project_id: PROJECT_ID,
            estimated_start_date: new Date('2026-04-10'),
            estimated_end_date: new Date('2026-04-11'),
            actual_start_date: null,
            actual_end_date: null,
            order_index: 3,
            deleted_at: null,
          },
        },
      ]);

      const result = await service.getSubcontractorTasks(
        TENANT_ID,
        SUBCONTRACTOR_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe('task-1');
      expect(result[0].task_title).toBe('Plumbing inspection');
    });

    it('should throw NotFoundException when subcontractor not found', async () => {
      mockPrisma.subcontractor.findFirst.mockResolvedValue(null);

      await expect(
        service.getSubcontractorTasks(TENANT_ID, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should exclude soft-deleted tasks', async () => {
      mockPrisma.subcontractor.findFirst.mockResolvedValue(
        mockSubcontractor(),
      );
      mockPrisma.task_assignee.findMany.mockResolvedValue([
        {
          id: 'a1',
          assigned_at: new Date(),
          task: {
            id: 'task-1',
            title: 'Active',
            status: 'done',
            project_id: PROJECT_ID,
            estimated_start_date: null,
            estimated_end_date: null,
            actual_start_date: null,
            actual_end_date: null,
            order_index: 0,
            deleted_at: null,
          },
        },
        {
          id: 'a2',
          assigned_at: new Date(),
          task: {
            id: 'task-2',
            title: 'Deleted',
            status: 'not_started',
            project_id: PROJECT_ID,
            estimated_start_date: null,
            estimated_end_date: null,
            actual_start_date: null,
            actual_end_date: null,
            order_index: 1,
            deleted_at: new Date(),
          },
        },
      ]);

      const result = await service.getSubcontractorTasks(
        TENANT_ID,
        SUBCONTRACTOR_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].task_id).toBe('task-1');
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe('tenant isolation', () => {
    it('should not assign to task from other tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_B_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.crew_member,
          crew_member_id: CREW_MEMBER_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not remove assignment from other tenant', async () => {
      mockPrisma.task_assignee.findFirst.mockResolvedValue(null);

      await expect(
        service.removeAssignment(
          TENANT_B_ID,
          PROJECT_ID,
          TASK_ID,
          ASSIGNMENT_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter getTaskAssignees by tenant_id', async () => {
      mockPrisma.task_assignee.findMany.mockResolvedValue([]);

      await service.getTaskAssignees(TENANT_B_ID, TASK_ID);

      expect(mockPrisma.task_assignee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_B_ID,
          }),
        }),
      );
    });

    it('should validate assignee belongs to same tenant', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(mockTask());
      mockPrisma.project.findFirst.mockResolvedValue(mockProject());
      // Crew member not found for THIS tenant (belongs to different tenant)
      mockPrisma.crew_member.findFirst.mockResolvedValue(null);

      await expect(
        service.assignToTask(TENANT_ID, PROJECT_ID, TASK_ID, USER_ID, {
          assignee_type: AssigneeTypeEnum.crew_member,
          crew_member_id: 'crew-from-another-tenant',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
