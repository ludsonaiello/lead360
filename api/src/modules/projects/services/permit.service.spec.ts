import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PermitService } from './permit.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';
import { InspectionService } from './inspection.service';
import { PermitStatusEnum } from '../dto/create-permit.dto';

describe('PermitService', () => {
  let service: PermitService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;
  let activityService: ProjectActivityService;

  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';
  const PROJECT_ID = 'project-uuid';
  const USER_ID = 'user-uuid';
  const PERMIT_ID = 'permit-uuid';

  const mockProject = {
    id: PROJECT_ID,
    name: 'Test Project',
    tenant_id: TENANT_A,
  };

  const mockPermit = {
    id: PERMIT_ID,
    tenant_id: TENANT_A,
    project_id: PROJECT_ID,
    permit_number: 'BP-2026-0001',
    permit_type: 'Building',
    status: 'pending_application',
    submitted_date: null,
    approved_date: null,
    expiry_date: null,
    issuing_authority: 'City of Boston',
    notes: null,
    created_by_user_id: USER_ID,
    deleted_at: null,
    created_at: new Date('2026-03-15T10:00:00.000Z'),
    updated_at: new Date('2026-03-15T10:00:00.000Z'),
  };

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
    },
    permit: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockAuditLogger = {
    logTenantChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockActivityService = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  const mockInspectionService = {
    findByPermitRaw: jest.fn().mockResolvedValue([]),
    countByPermit: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermitService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: ProjectActivityService, useValue: mockActivityService },
        { provide: InspectionService, useValue: mockInspectionService },
      ],
    }).compile();

    service = module.get<PermitService>(PermitService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);
    activityService = module.get<ProjectActivityService>(ProjectActivityService);

    jest.clearAllMocks();
  });

  // ===========================================================================
  // create
  // ===========================================================================
  describe('create', () => {
    it('should create a permit with correct tenant_id and project_id', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.create.mockResolvedValue({ ...mockPermit });

      const dto = {
        permit_type: 'Building',
        permit_number: 'BP-2026-0001',
        issuing_authority: 'City of Boston',
      };

      const result = await service.create(TENANT_A, PROJECT_ID, USER_ID, dto);

      expect(result).toBeDefined();
      expect(result.permit_type).toBe('Building');
      expect(result.permit_number).toBe('BP-2026-0001');
      expect(result.inspections).toEqual([]);

      // Verify Prisma was called with correct tenant_id
      expect(mockPrismaService.permit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          created_by_user_id: USER_ID,
          permit_type: 'Building',
        }),
      });
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_A, 'nonexistent-id', USER_ID, {
          permit_type: 'Building',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-set approved_date when status is approved and no date provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.create.mockResolvedValue({
        ...mockPermit,
        status: 'approved',
        approved_date: new Date(),
      });

      await service.create(TENANT_A, PROJECT_ID, USER_ID, {
        permit_type: 'Electrical',
        status: PermitStatusEnum.approved,
      });

      expect(mockPrismaService.permit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'approved',
          approved_date: expect.any(Date),
        }),
      });
    });

    it('should not override approved_date if provided by user', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      const providedDate = new Date('2026-03-10');
      mockPrismaService.permit.create.mockResolvedValue({
        ...mockPermit,
        status: 'approved',
        approved_date: providedDate,
      });

      await service.create(TENANT_A, PROJECT_ID, USER_ID, {
        permit_type: 'Electrical',
        status: PermitStatusEnum.approved,
        approved_date: '2026-03-10',
      });

      expect(mockPrismaService.permit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          approved_date: providedDate,
        }),
      });
    });

    it('should create audit log on permit creation', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.create.mockResolvedValue({ ...mockPermit });

      await service.create(TENANT_A, PROJECT_ID, USER_ID, {
        permit_type: 'Building',
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'permit',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log project activity on permit creation', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.create.mockResolvedValue({ ...mockPermit });

      await service.create(TENANT_A, PROJECT_ID, USER_ID, {
        permit_type: 'Building',
      });

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          user_id: USER_ID,
          activity_type: 'permit_created',
        }),
      );
    });
  });

  // ===========================================================================
  // findAll
  // ===========================================================================
  describe('findAll', () => {
    it('should return permits for tenant + project, excluding soft-deleted', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.findMany.mockResolvedValue([mockPermit]);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].permit_type).toBe('Building');
      expect(mockPrismaService.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            project_id: PROJECT_ID,
            deleted_at: null,
          }),
        }),
      );
    });

    it('should filter by status when provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID, { status: 'approved' });

      expect(mockPrismaService.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
          }),
        }),
      );
    });

    it('should throw NotFoundException if project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_A, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include inspections array in each response', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.findMany.mockResolvedValue([mockPermit]);
      mockInspectionService.findByPermitRaw.mockResolvedValue([]);

      const result = await service.findAll(TENANT_A, PROJECT_ID);

      expect(result[0].inspections).toEqual([]);
      expect(mockInspectionService.findByPermitRaw).toHaveBeenCalledWith(
        TENANT_A,
        PERMIT_ID,
      );
    });
  });

  // ===========================================================================
  // findOne
  // ===========================================================================
  describe('findOne', () => {
    it('should return a single permit by id, tenant, and project', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);

      const result = await service.findOne(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result.id).toBe(PERMIT_ID);
      expect(mockPrismaService.permit.findFirst).toHaveBeenCalledWith({
        where: {
          id: PERMIT_ID,
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          deleted_at: null,
        },
      });
    });

    it('should throw NotFoundException if permit does not exist', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_A, PROJECT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ===========================================================================
  // update
  // ===========================================================================
  describe('update', () => {
    it('should update permit fields', async () => {
      const updated = { ...mockPermit, status: 'submitted', submitted_date: new Date() };
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        USER_ID,
        { status: PermitStatusEnum.submitted, submitted_date: '2026-03-01' },
      );

      expect(result.status).toBe('submitted');
    });

    it('should auto-set approved_date when transitioning to approved', async () => {
      const before = { ...mockPermit, status: 'submitted' };
      const after = { ...before, status: 'approved', approved_date: new Date() };
      mockPrismaService.permit.findFirst.mockResolvedValue(before);
      mockPrismaService.permit.update.mockResolvedValue(after);

      await service.update(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        status: PermitStatusEnum.approved,
      });

      expect(mockPrismaService.permit.update).toHaveBeenCalledWith({
        where: { id: PERMIT_ID },
        data: expect.objectContaining({
          status: 'approved',
          approved_date: expect.any(Date),
        }),
      });
    });

    it('should NOT auto-set approved_date if already set', async () => {
      const before = {
        ...mockPermit,
        status: 'submitted',
        approved_date: new Date('2026-01-01'),
      };
      const after = { ...before, status: 'approved' };
      mockPrismaService.permit.findFirst.mockResolvedValue(before);
      mockPrismaService.permit.update.mockResolvedValue(after);

      await service.update(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        status: PermitStatusEnum.approved,
      });

      // Should NOT have approved_date in update data (already set)
      const updateCall = mockPrismaService.permit.update.mock.calls[0][0];
      expect(updateCall.data.approved_date).toBeUndefined();
    });

    it('should throw NotFoundException when permit not found', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, PROJECT_ID, 'nonexistent', USER_ID, {
          notes: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log with before/after state', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.update.mockResolvedValue({
        ...mockPermit,
        notes: 'updated',
      });

      await service.update(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        notes: 'updated',
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'permit',
          before: mockPermit,
          after: expect.objectContaining({ notes: 'updated' }),
        }),
      );
    });

    it('should log activity on status change', async () => {
      const before = { ...mockPermit, status: 'pending_application' };
      mockPrismaService.permit.findFirst.mockResolvedValue(before);
      mockPrismaService.permit.update.mockResolvedValue({
        ...before,
        status: 'submitted',
      });

      await service.update(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        status: PermitStatusEnum.submitted,
      });

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          activity_type: 'permit_status_changed',
          metadata: expect.objectContaining({
            old_status: 'pending_application',
            new_status: 'submitted',
          }),
        }),
      );
    });

    it('should NOT log activity if status did not change', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.update.mockResolvedValue({
        ...mockPermit,
        notes: 'updated notes',
      });

      await service.update(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        notes: 'updated notes',
      });

      expect(mockActivityService.logActivity).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // hardDelete
  // ===========================================================================
  describe('hardDelete', () => {
    it('should hard-delete a permit', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.delete.mockResolvedValue(mockPermit);

      await service.hardDelete(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID);

      expect(mockPrismaService.permit.delete).toHaveBeenCalledWith({
        where: { id: PERMIT_ID },
      });
    });

    it('should throw NotFoundException when permit not found', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.hardDelete(TENANT_A, PROJECT_ID, 'nonexistent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on hard delete', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.delete.mockResolvedValue(mockPermit);

      await service.hardDelete(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID);

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'permit',
          before: mockPermit,
        }),
      );
    });

    it('should throw ConflictException when permit has linked inspections', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockInspectionService.countByPermit.mockResolvedValue(2);

      await expect(
        service.hardDelete(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID),
      ).rejects.toThrow(ConflictException);

      // Should NOT have called delete
      expect(mockPrismaService.permit.delete).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // deactivate (soft delete)
  // ===========================================================================
  describe('deactivate', () => {
    it('should set deleted_at on permit', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.permit.update.mockResolvedValue({
        ...mockPermit,
        deleted_at: new Date(),
      });

      const result = await service.deactivate(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        USER_ID,
      );

      expect(mockPrismaService.permit.update).toHaveBeenCalledWith({
        where: { id: PERMIT_ID },
        data: { deleted_at: expect.any(Date) },
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when permit not found', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivate(TENANT_A, PROJECT_ID, 'nonexistent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not find already-deactivated permits', async () => {
      // findFirst is called with deleted_at: null filter
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivate(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.permit.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          deleted_at: null,
        }),
      });
    });
  });

  // ===========================================================================
  // Tenant Isolation Tests
  // ===========================================================================
  describe('Tenant Isolation', () => {
    it('should not return permits from another tenant in findAll', async () => {
      // Project does not exist for tenant B
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(TENANT_B, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return a permit belonging to another tenant in findOne', async () => {
      // findFirst with tenant_B returns null because permit belongs to tenant_A
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_B, PROJECT_ID, PERMIT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update a permit belonging to another tenant', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B, PROJECT_ID, PERMIT_ID, USER_ID, {
          notes: 'hacked',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not hard-delete a permit belonging to another tenant', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.hardDelete(TENANT_B, PROJECT_ID, PERMIT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not deactivate a permit belonging to another tenant', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivate(TENANT_B, PROJECT_ID, PERMIT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should always include tenant_id in findAll query', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.findMany.mockResolvedValue([]);

      await service.findAll(TENANT_A, PROJECT_ID);

      expect(mockPrismaService.permit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
          }),
        }),
      );
    });

    it('should always include tenant_id in create data', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.permit.create.mockResolvedValue(mockPermit);

      await service.create(TENANT_A, PROJECT_ID, USER_ID, {
        permit_type: 'Building',
      });

      expect(mockPrismaService.permit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
        }),
      });
    });
  });

  // ===========================================================================
  // Response format
  // ===========================================================================
  describe('Response format', () => {
    it('should return inspections array (empty when no inspections exist)', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockInspectionService.findByPermitRaw.mockResolvedValue([]);

      const result = await service.findOne(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result.inspections).toEqual([]);
    });

    it('should format dates as YYYY-MM-DD strings', async () => {
      const permitWithDates = {
        ...mockPermit,
        submitted_date: new Date('2026-03-01T00:00:00.000Z'),
        approved_date: new Date('2026-03-15T00:00:00.000Z'),
        expiry_date: new Date('2027-03-15T00:00:00.000Z'),
      };
      mockPrismaService.permit.findFirst.mockResolvedValue(permitWithDates);

      const result = await service.findOne(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result.submitted_date).toBe('2026-03-01');
      expect(result.approved_date).toBe('2026-03-15');
      expect(result.expiry_date).toBe('2027-03-15');
    });

    it('should return null for missing dates', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);

      const result = await service.findOne(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result.submitted_date).toBeNull();
      expect(result.approved_date).toBeNull();
      expect(result.expiry_date).toBeNull();
    });

    it('should return ISO string for created_at', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);

      const result = await service.findOne(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result.created_at).toBe('2026-03-15T10:00:00.000Z');
    });
  });
});
