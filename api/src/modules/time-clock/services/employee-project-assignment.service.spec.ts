import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EmployeeProjectAssignmentService } from './employee-project-assignment.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateEmployeeProjectAssignmentDto,
  ListEmployeeProjectAssignmentsDto,
} from '../dto/employee-project-assignment.dto';

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-999';
const USER_ID = 'user-uuid-001';
const EMPLOYEE_PROFILE_ID = 'emp-uuid-001';
const PROJECT_ID = 'proj-uuid-001';
const ASSIGNMENT_ID = 'assignment-uuid-001';

const mockAssignmentRecord = (overrides: any = {}) => ({
  id: ASSIGNMENT_ID,
  tenant_id: TENANT_ID,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  project_id: PROJECT_ID,
  assigned_by_user_id: USER_ID,
  created_at: new Date('2026-04-12T10:00:00.000Z'),
  employee_profile: {
    id: EMPLOYEE_PROFILE_ID,
    user: {
      id: 'user-uuid-002',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
    },
  },
  project: { id: PROJECT_ID, name: 'Test Project' },
  ...overrides,
});

const mockAssignmentSelectRecord = () => ({
  id: ASSIGNMENT_ID,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  project_id: PROJECT_ID,
  assigned_by_user_id: USER_ID,
  created_at: new Date('2026-04-12T10:00:00.000Z'),
});

const mockPrismaService = {
  employee_project_assignment: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  employee_profile: {
    findFirst: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('EmployeeProjectAssignmentService', () => {
  let service: EmployeeProjectAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeProjectAssignmentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<EmployeeProjectAssignmentService>(
      EmployeeProjectAssignmentService,
    );

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // findAll()
  // -----------------------------------------------------------------------

  describe('findAll()', () => {
    it('should return paginated assignments with defaults and include tenant_id in queries', async () => {
      const records = [mockAssignmentRecord()];
      mockPrismaService.employee_project_assignment.findMany.mockResolvedValue(
        records,
      );
      mockPrismaService.employee_project_assignment.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, {});

      expect(result).toEqual({
        data: records,
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      });

      expect(
        mockPrismaService.employee_project_assignment.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID },
          skip: 0,
          take: 50,
          orderBy: { created_at: 'desc' },
        }),
      );
      expect(
        mockPrismaService.employee_project_assignment.count,
      ).toHaveBeenCalledWith({ where: { tenant_id: TENANT_ID } });
    });

    it('should apply custom pagination (page, limit) and compute totalPages', async () => {
      mockPrismaService.employee_project_assignment.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.employee_project_assignment.count.mockResolvedValue(
        45,
      );

      const query: ListEmployeeProjectAssignmentsDto = { page: 2, limit: 20 };
      const result = await service.findAll(TENANT_ID, query);

      expect(result.meta).toEqual({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
      expect(
        mockPrismaService.employee_project_assignment.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('should filter by employee_profile_id when provided', async () => {
      mockPrismaService.employee_project_assignment.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.employee_project_assignment.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        employee_profile_id: EMPLOYEE_PROFILE_ID,
      });

      expect(
        mockPrismaService.employee_project_assignment.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
          },
        }),
      );
    });

    it('should filter by project_id when provided', async () => {
      mockPrismaService.employee_project_assignment.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.employee_project_assignment.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { project_id: PROJECT_ID });

      expect(
        mockPrismaService.employee_project_assignment.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID, project_id: PROJECT_ID },
        }),
      );
    });

    it('should never leak across tenants', async () => {
      mockPrismaService.employee_project_assignment.findMany.mockResolvedValue(
        [],
      );
      mockPrismaService.employee_project_assignment.count.mockResolvedValue(0);

      await service.findAll(OTHER_TENANT_ID, {});

      const call =
        mockPrismaService.employee_project_assignment.findMany.mock.calls[0][0];
      expect(call.where.tenant_id).toBe(OTHER_TENANT_ID);
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    const dto: CreateEmployeeProjectAssignmentDto = {
      employee_profile_id: EMPLOYEE_PROFILE_ID,
      project_id: PROJECT_ID,
    };

    it('should create assignment and emit an audit log when preconditions pass', async () => {
      const created = mockAssignmentRecord();
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        null,
      );
      mockPrismaService.employee_project_assignment.create.mockResolvedValue(
        created,
      );

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(result).toBe(created);
      expect(mockPrismaService.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_PROFILE_ID, tenant_id: TENANT_ID },
        }),
      );
      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROJECT_ID, tenant_id: TENANT_ID },
        }),
      );
      expect(
        mockPrismaService.employee_project_assignment.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
            project_id: PROJECT_ID,
          },
        }),
      );
      expect(
        mockPrismaService.employee_project_assignment.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tenant_id: TENANT_ID,
            employee_profile_id: EMPLOYEE_PROFILE_ID,
            project_id: PROJECT_ID,
            assigned_by_user_id: USER_ID,
          },
        }),
      );
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'EmployeeProjectAssignment',
          entityId: ASSIGNMENT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should throw NotFoundException when employee profile does not belong to tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'Employee profile not found',
      );
      expect(mockPrismaService.project.findFirst).not.toHaveBeenCalled();
      expect(
        mockPrismaService.employee_project_assignment.create,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when project does not belong to tenant', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'Project not found',
      );
      expect(
        mockPrismaService.employee_project_assignment.create,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should throw ConflictException on pre-check duplicate', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        { id: ASSIGNMENT_ID },
      );

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'Employee is already assigned to this project',
      );
      expect(
        mockPrismaService.employee_project_assignment.create,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should translate a Prisma P2002 race condition into ConflictException', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        null,
      );

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '6.19.1',
          meta: {
            target: [
              'tenant_id',
              'employee_profile_id',
              'project_id',
            ],
          },
        },
      );
      mockPrismaService.employee_project_assignment.create.mockRejectedValue(
        prismaError,
      );

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'Employee is already assigned to this project',
      );
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should rethrow non-P2002 Prisma errors as-is', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue({
        id: EMPLOYEE_PROFILE_ID,
      });
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        null,
      );

      const unknownError = new Error('database connection lost');
      mockPrismaService.employee_project_assignment.create.mockRejectedValue(
        unknownError,
      );

      await expect(service.create(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        'database connection lost',
      );
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should never allow cross-tenant assignment creation', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(null);

      await expect(
        service.create(OTHER_TENANT_ID, USER_ID, dto),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_PROFILE_ID, tenant_id: OTHER_TENANT_ID },
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // remove()
  // -----------------------------------------------------------------------

  describe('remove()', () => {
    it('should hard-delete assignment and emit audit log when it belongs to tenant', async () => {
      const existing = mockAssignmentSelectRecord();
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        existing,
      );
      mockPrismaService.employee_project_assignment.delete.mockResolvedValue(
        mockAssignmentRecord(),
      );

      const result = await service.remove(TENANT_ID, USER_ID, ASSIGNMENT_ID);

      expect(result).toEqual({
        message: 'Assignment removed successfully',
      });
      expect(
        mockPrismaService.employee_project_assignment.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ASSIGNMENT_ID, tenant_id: TENANT_ID },
        }),
      );
      expect(
        mockPrismaService.employee_project_assignment.delete,
      ).toHaveBeenCalledWith({ where: { id: ASSIGNMENT_ID } });
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'EmployeeProjectAssignment',
          entityId: ASSIGNMENT_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: existing,
        }),
      );
    });

    it('should throw NotFoundException when assignment does not exist', async () => {
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.remove(TENANT_ID, USER_ID, ASSIGNMENT_ID),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.remove(TENANT_ID, USER_ID, ASSIGNMENT_ID),
      ).rejects.toThrow('Assignment not found');

      expect(
        mockPrismaService.employee_project_assignment.delete,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });

    it('should refuse to delete assignment owned by a different tenant', async () => {
      mockPrismaService.employee_project_assignment.findFirst.mockResolvedValue(
        null,
      );

      await expect(
        service.remove(OTHER_TENANT_ID, USER_ID, ASSIGNMENT_ID),
      ).rejects.toThrow(NotFoundException);

      expect(
        mockPrismaService.employee_project_assignment.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: ASSIGNMENT_ID, tenant_id: OTHER_TENANT_ID },
        }),
      );
      expect(
        mockPrismaService.employee_project_assignment.delete,
      ).not.toHaveBeenCalled();
      expect(mockAuditLoggerService.logTenantChange).not.toHaveBeenCalled();
    });
  });
});
