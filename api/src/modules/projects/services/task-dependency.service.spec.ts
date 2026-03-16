import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { TaskDependencyService } from './task-dependency.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { TaskDependencyTypeEnum } from '../dto/create-task-dependency.dto';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const TENANT_B_ID = 'tenant-uuid-002';
const USER_ID = 'user-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const TASK_A_ID = 'task-uuid-aaa';
const TASK_B_ID = 'task-uuid-bbb';
const TASK_C_ID = 'task-uuid-ccc';
const TASK_D_ID = 'task-uuid-ddd';
const DEP_ID = 'dep-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockTask = (overrides: any = {}) => ({
  id: TASK_A_ID,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID,
  title: 'Install shingles',
  status: 'not_started',
  deleted_at: null,
  ...overrides,
});

const mockDependencyRecord = (overrides: any = {}) => ({
  id: DEP_ID,
  tenant_id: TENANT_ID,
  task_id: TASK_A_ID,
  depends_on_task_id: TASK_B_ID,
  dependency_type: 'finish_to_start',
  created_by_user_id: USER_ID,
  created_at: new Date('2026-03-13T10:00:00.000Z'),
  depends_on_task: { id: TASK_B_ID, title: 'Remove old shingles' },
  task: { title: 'Install shingles' },
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  project_task: {
    findFirst: jest.fn(),
  },
  task_dependency: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockAuditLogger = {
  logTenantChange: jest.fn(),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('TaskDependencyService', () => {
  let service: TaskDependencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskDependencyService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
      ],
    }).compile();

    service = module.get<TaskDependencyService>(TaskDependencyService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // addDependency
  // =========================================================================

  describe('addDependency', () => {
    const dto = {
      depends_on_task_id: TASK_B_ID,
      dependency_type: TaskDependencyTypeEnum.finish_to_start,
    };

    it('should create a dependency and return formatted response', async () => {
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(mockTask({ id: TASK_A_ID, title: 'Install shingles' }))
        .mockResolvedValueOnce(mockTask({ id: TASK_B_ID, title: 'Remove old shingles' }));
      mockPrisma.task_dependency.findUnique.mockResolvedValue(null);
      mockPrisma.task_dependency.findMany.mockResolvedValue([]); // no existing deps
      mockPrisma.task_dependency.create.mockResolvedValue(mockDependencyRecord());

      const result = await service.addDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        USER_ID,
        dto,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe(DEP_ID);
      expect(result.task_id).toBe(TASK_A_ID);
      expect(result.depends_on_task_id).toBe(TASK_B_ID);
      expect(result.depends_on_task_title).toBe('Remove old shingles');
      expect(result.dependency_type).toBe('finish_to_start');
      expect(result.created_at).toBeDefined();

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'task_dependency',
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw BadRequestException for self-reference', async () => {
      await expect(
        service.addDependency(TENANT_ID, PROJECT_ID, TASK_A_ID, USER_ID, {
          depends_on_task_id: TASK_A_ID,
          dependency_type: TaskDependencyTypeEnum.finish_to_start,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when task not found', async () => {
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(null) // task not found
        .mockResolvedValueOnce(mockTask({ id: TASK_B_ID }));

      await expect(
        service.addDependency(TENANT_ID, PROJECT_ID, TASK_A_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when depends_on task not found', async () => {
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(mockTask({ id: TASK_A_ID }))
        .mockResolvedValueOnce(null); // depends_on task not found

      await expect(
        service.addDependency(TENANT_ID, PROJECT_ID, TASK_A_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for duplicate dependency', async () => {
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(mockTask({ id: TASK_A_ID }))
        .mockResolvedValueOnce(mockTask({ id: TASK_B_ID }));
      mockPrisma.task_dependency.findUnique.mockResolvedValue(
        mockDependencyRecord(),
      );

      await expect(
        service.addDependency(TENANT_ID, PROJECT_ID, TASK_A_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when circular dependency detected', async () => {
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(mockTask({ id: TASK_A_ID }))
        .mockResolvedValueOnce(mockTask({ id: TASK_B_ID }));
      mockPrisma.task_dependency.findUnique.mockResolvedValue(null);

      // Existing dependency: B → A (B depends on A)
      // Trying to add: A → B (A depends on B)
      // This creates cycle: A → B → A
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_B_ID, depends_on_task_id: TASK_A_ID },
      ]);

      await expect(
        service.addDependency(TENANT_ID, PROJECT_ID, TASK_A_ID, USER_ID, dto),
      ).rejects.toThrow(ConflictException);
    });

    it('should enforce tenant isolation — task from different tenant', async () => {
      // findFirst with wrong tenant returns null
      mockPrisma.project_task.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        service.addDependency(TENANT_B_ID, PROJECT_ID, TASK_A_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // removeDependency
  // =========================================================================

  describe('removeDependency', () => {
    it('should delete the dependency and create audit log', async () => {
      mockPrisma.task_dependency.findFirst.mockResolvedValue(
        mockDependencyRecord(),
      );
      mockPrisma.task_dependency.delete.mockResolvedValue(
        mockDependencyRecord(),
      );

      await service.removeDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        DEP_ID,
        USER_ID,
      );

      expect(mockPrisma.task_dependency.delete).toHaveBeenCalledWith({
        where: { id: DEP_ID },
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'task_dependency',
          entityId: DEP_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw NotFoundException when dependency not found', async () => {
      mockPrisma.task_dependency.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDependency(
          TENANT_ID,
          PROJECT_ID,
          TASK_A_ID,
          'non-existent-dep',
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on delete', async () => {
      mockPrisma.task_dependency.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDependency(
          TENANT_B_ID,
          PROJECT_ID,
          TASK_A_ID,
          DEP_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // =========================================================================
  // getTaskDependencies
  // =========================================================================

  describe('getTaskDependencies', () => {
    it('should return both directions of dependencies', async () => {
      // This task depends on B
      mockPrisma.task_dependency.findMany
        .mockResolvedValueOnce([
          {
            id: 'dep-1',
            depends_on_task_id: TASK_B_ID,
            dependency_type: 'finish_to_start',
            created_at: new Date(),
            depends_on_task: {
              id: TASK_B_ID,
              title: 'Remove old shingles',
              status: 'done',
            },
          },
        ])
        // C depends on this task
        .mockResolvedValueOnce([
          {
            id: 'dep-2',
            task_id: TASK_C_ID,
            dependency_type: 'finish_to_start',
            created_at: new Date(),
            task: {
              id: TASK_C_ID,
              title: 'Paint trim',
              status: 'not_started',
            },
          },
        ]);

      const result = await service.getTaskDependencies(TENANT_ID, TASK_A_ID);

      expect(result.depends_on).toHaveLength(1);
      expect(result.depends_on[0].depends_on_task_id).toBe(TASK_B_ID);
      expect(result.depends_on[0].depends_on_task_title).toBe('Remove old shingles');

      expect(result.depended_on_by).toHaveLength(1);
      expect(result.depended_on_by[0].task_id).toBe(TASK_C_ID);
      expect(result.depended_on_by[0].task_title).toBe('Paint trim');
    });

    it('should return empty arrays when no dependencies exist', async () => {
      mockPrisma.task_dependency.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getTaskDependencies(TENANT_ID, TASK_A_ID);

      expect(result.depends_on).toEqual([]);
      expect(result.depended_on_by).toEqual([]);
    });

    it('should filter by tenant_id', async () => {
      mockPrisma.task_dependency.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getTaskDependencies(TENANT_B_ID, TASK_A_ID);

      expect(mockPrisma.task_dependency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B_ID }),
        }),
      );
    });
  });

  // =========================================================================
  // validateStatusTransition
  // =========================================================================

  describe('validateStatusTransition', () => {
    it('should return empty array when transitioning to non-in_progress status', async () => {
      const result = await service.validateStatusTransition(
        TENANT_ID,
        TASK_A_ID,
        'blocked',
      );
      expect(result).toEqual([]);
      // Should not even query the database
      expect(mockPrisma.task_dependency.findMany).not.toHaveBeenCalled();
    });

    it('should return empty array when transitioning to done', async () => {
      const result = await service.validateStatusTransition(
        TENANT_ID,
        TASK_A_ID,
        'done',
      );
      expect(result).toEqual([]);
    });

    it('should return empty array when all finish_to_start prereqs are done', async () => {
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          depends_on_task_id: TASK_B_ID,
          dependency_type: 'finish_to_start',
          depends_on_task: {
            id: TASK_B_ID,
            title: 'Remove old shingles',
            status: 'done',
          },
        },
      ]);

      const result = await service.validateStatusTransition(
        TENANT_ID,
        TASK_A_ID,
        'in_progress',
      );

      expect(result).toEqual([]);
    });

    it('should return blocking dependencies when prereqs are not done', async () => {
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        {
          id: 'dep-1',
          depends_on_task_id: TASK_B_ID,
          dependency_type: 'finish_to_start',
          depends_on_task: {
            id: TASK_B_ID,
            title: 'Remove old shingles',
            status: 'in_progress',
          },
        },
        {
          id: 'dep-2',
          depends_on_task_id: TASK_C_ID,
          dependency_type: 'finish_to_start',
          depends_on_task: {
            id: TASK_C_ID,
            title: 'Order materials',
            status: 'not_started',
          },
        },
      ]);

      const result = await service.validateStatusTransition(
        TENANT_ID,
        TASK_A_ID,
        'in_progress',
      );

      expect(result).toHaveLength(2);
      expect(result[0].depends_on_task_id).toBe(TASK_B_ID);
      expect(result[0].depends_on_task_status).toBe('in_progress');
      expect(result[1].depends_on_task_id).toBe(TASK_C_ID);
      expect(result[1].depends_on_task_status).toBe('not_started');
    });

    it('should only check finish_to_start dependencies', async () => {
      mockPrisma.task_dependency.findMany.mockResolvedValue([]);

      await service.validateStatusTransition(
        TENANT_ID,
        TASK_A_ID,
        'in_progress',
      );

      expect(mockPrisma.task_dependency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dependency_type: 'finish_to_start',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // detectCircularDependency — 5 test cases per sprint requirement
  // =========================================================================

  describe('detectCircularDependency', () => {
    it('Case 1: should return false when no cycle exists (safe to add)', async () => {
      // No existing dependencies — adding A → B is safe
      mockPrisma.task_dependency.findMany.mockResolvedValue([]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        TASK_B_ID,
      );

      expect(result).toBe(false);
    });

    it('Case 2: should return true for direct cycle (A→B, adding B→A)', async () => {
      // Existing: A depends on B (A → B)
      // Adding: B depends on A (B → A)
      // Cycle: B → A → B
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_A_ID, depends_on_task_id: TASK_B_ID },
      ]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_B_ID,
        TASK_A_ID,
      );

      expect(result).toBe(true);
    });

    it('Case 3: should return true for indirect cycle (A→B, B→C, adding C→A)', async () => {
      // Existing: A→B, B→C (A depends on B, B depends on C)
      // Adding: C→A (C depends on A)
      // Cycle: C → A → B → C
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_A_ID, depends_on_task_id: TASK_B_ID },
        { task_id: TASK_B_ID, depends_on_task_id: TASK_C_ID },
      ]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_C_ID,
        TASK_A_ID,
      );

      expect(result).toBe(true);
    });

    it('Case 4: should handle self-reference (A→A) — caught before DFS in addDependency, but DFS also detects it', async () => {
      // Self-reference: A → A
      mockPrisma.task_dependency.findMany.mockResolvedValue([]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        TASK_A_ID,
      );

      // DFS starts from A, immediately finds A → cycle detected
      expect(result).toBe(true);
    });

    it('Case 5: should return false when tasks from different chains exist (no cycle)', async () => {
      // Existing: A→B, C→D (two independent chains)
      // Adding: A→C (connecting chains, but no cycle)
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_A_ID, depends_on_task_id: TASK_B_ID },
        { task_id: TASK_C_ID, depends_on_task_id: TASK_D_ID },
      ]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        TASK_C_ID,
      );

      expect(result).toBe(false);
    });

    it('should return false for a valid chain extension (A→B, adding A→C)', async () => {
      // Existing: A→B
      // Adding: A→C (no cycle — A just has two dependencies)
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_A_ID, depends_on_task_id: TASK_B_ID },
      ]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_A_ID,
        TASK_C_ID,
      );

      expect(result).toBe(false);
    });

    it('should detect cycle in complex graph (A→B, B→C, C→D, adding D→A)', async () => {
      // Existing: A→B, B→C, C→D
      // Adding: D→A
      // Cycle: D → A → B → C → D
      mockPrisma.task_dependency.findMany.mockResolvedValue([
        { task_id: TASK_A_ID, depends_on_task_id: TASK_B_ID },
        { task_id: TASK_B_ID, depends_on_task_id: TASK_C_ID },
        { task_id: TASK_C_ID, depends_on_task_id: TASK_D_ID },
      ]);

      const result = await service.detectCircularDependency(
        TENANT_ID,
        PROJECT_ID,
        TASK_D_ID,
        TASK_A_ID,
      );

      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // Tenant Isolation
  // =========================================================================

  describe('tenant isolation', () => {
    it('should not find dependencies from other tenants in getTaskDependencies', async () => {
      mockPrisma.task_dependency.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.getTaskDependencies(TENANT_B_ID, TASK_A_ID);

      // Both calls should filter by TENANT_B_ID
      const calls = mockPrisma.task_dependency.findMany.mock.calls;
      expect(calls[0][0].where.tenant_id).toBe(TENANT_B_ID);
      expect(calls[1][0].where.tenant_id).toBe(TENANT_B_ID);
    });

    it('should not add dependency across tenants', async () => {
      mockPrisma.project_task.findFirst.mockResolvedValue(null);

      await expect(
        service.addDependency(TENANT_B_ID, PROJECT_ID, TASK_A_ID, USER_ID, {
          depends_on_task_id: TASK_B_ID,
          dependency_type: TaskDependencyTypeEnum.finish_to_start,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not remove dependency from other tenant', async () => {
      mockPrisma.task_dependency.findFirst.mockResolvedValue(null);

      await expect(
        service.removeDependency(
          TENANT_B_ID,
          PROJECT_ID,
          TASK_A_ID,
          DEP_ID,
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should filter validateStatusTransition by tenant_id', async () => {
      mockPrisma.task_dependency.findMany.mockResolvedValue([]);

      await service.validateStatusTransition(
        TENANT_B_ID,
        TASK_A_ID,
        'in_progress',
      );

      expect(mockPrisma.task_dependency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B_ID }),
        }),
      );
    });
  });
});
