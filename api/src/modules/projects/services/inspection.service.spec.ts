import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InspectionService } from './inspection.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';
import { InspectionResultEnum } from '../dto/create-inspection.dto';

describe('InspectionService', () => {
  let service: InspectionService;

  const TENANT_A = 'tenant-a-uuid';
  const TENANT_B = 'tenant-b-uuid';
  const PROJECT_ID = 'project-uuid';
  const PERMIT_ID = 'permit-uuid';
  const INSPECTION_ID = 'inspection-uuid';
  const USER_ID = 'user-uuid';

  const mockPermit = {
    id: PERMIT_ID,
    tenant_id: TENANT_A,
    project_id: PROJECT_ID,
    permit_type: 'Building',
  };

  const mockInspection = {
    id: INSPECTION_ID,
    tenant_id: TENANT_A,
    permit_id: PERMIT_ID,
    project_id: PROJECT_ID,
    inspection_type: 'Framing',
    scheduled_date: null,
    inspector_name: 'John Inspector',
    result: null,
    reinspection_required: false,
    reinspection_date: null,
    notes: null,
    inspected_by_user_id: null,
    deleted_at: null,
    created_at: new Date('2026-04-01T10:00:00.000Z'),
    updated_at: new Date('2026-04-01T10:00:00.000Z'),
  };

  const mockPrismaService = {
    permit: {
      findFirst: jest.fn(),
    },
    inspection: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuditLogger = {
    logTenantChange: jest.fn().mockResolvedValue(undefined),
  };

  const mockActivityService = {
    logActivity: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: ProjectActivityService, useValue: mockActivityService },
      ],
    }).compile();

    service = module.get<InspectionService>(InspectionService);

    jest.clearAllMocks();
  });

  // ===========================================================================
  // create
  // ===========================================================================
  describe('create', () => {
    it('should create an inspection with correct tenant_id, project_id, and permit_id', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({ ...mockInspection });

      const dto = {
        inspection_type: 'Framing',
        inspector_name: 'John Inspector',
      };

      const result = await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, dto);

      expect(result).toBeDefined();
      expect(result.inspection_type).toBe('Framing');
      expect(result.inspector_name).toBe('John Inspector');
      expect(result.reinspection_required).toBe(false);

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
          project_id: PROJECT_ID,
          permit_id: PERMIT_ID,
          inspection_type: 'Framing',
        }),
      });
    });

    it('should throw NotFoundException when permit does not exist', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_A, PROJECT_ID, 'nonexistent', USER_ID, {
          inspection_type: 'Framing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when permit belongs to another tenant', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_B, PROJECT_ID, PERMIT_ID, USER_ID, {
          inspection_type: 'Framing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should auto-set reinspection_required to true when result is fail', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({
        ...mockInspection,
        result: 'fail',
        reinspection_required: true,
      });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Electrical Rough-In',
        result: InspectionResultEnum.fail,
      });

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          result: 'fail',
          reinspection_required: true,
        }),
      });
    });

    it('should NOT auto-set reinspection_required for pass result', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({
        ...mockInspection,
        result: 'pass',
        reinspection_required: false,
      });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Final',
        result: InspectionResultEnum.pass,
      });

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          result: 'pass',
          reinspection_required: false,
        }),
      });
    });

    it('should convert date strings to Date objects', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({
        ...mockInspection,
        scheduled_date: new Date('2026-04-10'),
        reinspection_date: new Date('2026-04-17'),
      });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Framing',
        scheduled_date: '2026-04-10',
        reinspection_date: '2026-04-17',
      });

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          scheduled_date: new Date('2026-04-10'),
          reinspection_date: new Date('2026-04-17'),
        }),
      });
    });

    it('should create audit log on inspection creation', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({ ...mockInspection });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Framing',
      });

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'inspection',
          tenantId: TENANT_A,
          actorUserId: USER_ID,
        }),
      );
    });

    it('should log project activity on inspection creation', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({ ...mockInspection });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Framing',
      });

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          project_id: PROJECT_ID,
          user_id: USER_ID,
          activity_type: 'inspection_created',
          metadata: expect.objectContaining({
            inspection_id: INSPECTION_ID,
            permit_id: PERMIT_ID,
          }),
        }),
      );
    });

    it('should set inspected_by_user_id when provided', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue({
        ...mockInspection,
        inspected_by_user_id: USER_ID,
      });

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Framing',
        inspected_by_user_id: USER_ID,
      });

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inspected_by_user_id: USER_ID,
        }),
      });
    });
  });

  // ===========================================================================
  // update
  // ===========================================================================
  describe('update', () => {
    it('should update inspection fields', async () => {
      const updated = {
        ...mockInspection,
        result: 'pass',
        notes: 'All approved',
      };
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.update.mockResolvedValue(updated);

      const result = await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { result: InspectionResultEnum.pass, notes: 'All approved' },
      );

      expect(result.result).toBe('pass');
      expect(result.notes).toBe('All approved');
    });

    it('should auto-set reinspection_required to true when result changes to fail', async () => {
      const before = { ...mockInspection, result: 'pending' };
      const after = {
        ...before,
        result: 'fail',
        reinspection_required: true,
      };
      mockPrismaService.inspection.findFirst.mockResolvedValue(before);
      mockPrismaService.inspection.update.mockResolvedValue(after);

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { result: InspectionResultEnum.fail },
      );

      expect(mockPrismaService.inspection.update).toHaveBeenCalledWith({
        where: { id: INSPECTION_ID },
        data: expect.objectContaining({
          result: 'fail',
          reinspection_required: true,
        }),
      });
    });

    it('should NOT auto-set reinspection_required when result is not fail', async () => {
      const before = { ...mockInspection, result: 'pending' };
      const after = { ...before, result: 'pass' };
      mockPrismaService.inspection.findFirst.mockResolvedValue(before);
      mockPrismaService.inspection.update.mockResolvedValue(after);

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { result: InspectionResultEnum.pass },
      );

      const updateCall = mockPrismaService.inspection.update.mock.calls[0][0];
      expect(updateCall.data.reinspection_required).toBeUndefined();
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          TENANT_A,
          PROJECT_ID,
          PERMIT_ID,
          'nonexistent',
          USER_ID,
          { notes: 'test' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log with before/after state', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockInspection,
        notes: 'updated',
      });

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { notes: 'updated' },
      );

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'inspection',
          before: mockInspection,
          after: expect.objectContaining({ notes: 'updated' }),
        }),
      );
    });

    it('should log activity when result changes', async () => {
      const before = { ...mockInspection, result: 'pending' };
      mockPrismaService.inspection.findFirst.mockResolvedValue(before);
      mockPrismaService.inspection.update.mockResolvedValue({
        ...before,
        result: 'pass',
      });

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { result: InspectionResultEnum.pass },
      );

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          activity_type: 'inspection_result_changed',
          metadata: expect.objectContaining({
            old_result: 'pending',
            new_result: 'pass',
          }),
        }),
      );
    });

    it('should NOT log activity if result did not change', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockInspection,
        notes: 'updated notes',
      });

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { notes: 'updated notes' },
      );

      expect(mockActivityService.logActivity).not.toHaveBeenCalled();
    });

    it('should only update provided fields', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.update.mockResolvedValue({
        ...mockInspection,
        inspector_name: 'New Inspector',
      });

      await service.update(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
        { inspector_name: 'New Inspector' },
      );

      const updateCall = mockPrismaService.inspection.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ inspector_name: 'New Inspector' });
    });
  });

  // ===========================================================================
  // findByPermit
  // ===========================================================================
  describe('findByPermit', () => {
    it('should return inspections for permit, excluding soft-deleted', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].inspection_type).toBe('Framing');
      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
            permit_id: PERMIT_ID,
            deleted_at: null,
          }),
        }),
      );
    });

    it('should throw NotFoundException when permit does not exist', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.findByPermit(TENANT_A, PROJECT_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array when no inspections exist', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result).toEqual([]);
    });

    it('should order by created_at descending', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });
  });

  // ===========================================================================
  // findByPermitRaw
  // ===========================================================================
  describe('findByPermitRaw', () => {
    it('should return formatted inspections without permit validation', async () => {
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findByPermitRaw(TENANT_A, PERMIT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].inspection_type).toBe('Framing');
      // Should NOT call permit.findFirst
      expect(mockPrismaService.permit.findFirst).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // hardDelete
  // ===========================================================================
  describe('hardDelete', () => {
    it('should hard-delete an inspection', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.delete.mockResolvedValue(mockInspection);

      await service.hardDelete(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
      );

      expect(mockPrismaService.inspection.delete).toHaveBeenCalledWith({
        where: { id: INSPECTION_ID },
      });
    });

    it('should throw NotFoundException when inspection not found', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(null);

      await expect(
        service.hardDelete(TENANT_A, PROJECT_ID, PERMIT_ID, 'nonexistent', USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create audit log on hard delete', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.delete.mockResolvedValue(mockInspection);

      await service.hardDelete(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
      );

      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'deleted',
          entityType: 'inspection',
          before: mockInspection,
        }),
      );
    });

    it('should log project activity on hard delete', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(mockInspection);
      mockPrismaService.inspection.delete.mockResolvedValue(mockInspection);

      await service.hardDelete(
        TENANT_A,
        PROJECT_ID,
        PERMIT_ID,
        INSPECTION_ID,
        USER_ID,
      );

      expect(mockActivityService.logActivity).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({
          activity_type: 'inspection_deleted',
          metadata: expect.objectContaining({
            inspection_id: INSPECTION_ID,
            permit_id: PERMIT_ID,
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // countByPermit
  // ===========================================================================
  describe('countByPermit', () => {
    it('should return count of inspections for a permit', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(3);

      const result = await service.countByPermit(TENANT_A, PERMIT_ID);

      expect(result).toBe(3);
      expect(mockPrismaService.inspection.count).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_A,
          permit_id: PERMIT_ID,
        },
      });
    });

    it('should return 0 when no inspections exist', async () => {
      mockPrismaService.inspection.count.mockResolvedValue(0);

      const result = await service.countByPermit(TENANT_A, PERMIT_ID);

      expect(result).toBe(0);
    });
  });

  // ===========================================================================
  // Tenant Isolation Tests
  // ===========================================================================
  describe('Tenant Isolation', () => {
    it('should not create inspection for a permit belonging to another tenant', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_B, PROJECT_ID, PERMIT_ID, USER_ID, {
          inspection_type: 'Framing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not return inspections from another tenant in findByPermit', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(null);

      await expect(
        service.findByPermit(TENANT_B, PROJECT_ID, PERMIT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not update an inspection belonging to another tenant', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_B, PROJECT_ID, PERMIT_ID, INSPECTION_ID, USER_ID, {
          notes: 'hacked',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not hard-delete an inspection belonging to another tenant', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(null);

      await expect(
        service.hardDelete(TENANT_B, PROJECT_ID, PERMIT_ID, INSPECTION_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should always include tenant_id in findByPermit query', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([]);

      await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(mockPrismaService.inspection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_A,
          }),
        }),
      );
    });

    it('should always include tenant_id in create data', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.create.mockResolvedValue(mockInspection);

      await service.create(TENANT_A, PROJECT_ID, PERMIT_ID, USER_ID, {
        inspection_type: 'Framing',
      });

      expect(mockPrismaService.inspection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: TENANT_A,
        }),
      });
    });

    it('should always include tenant_id in findFirst for update', async () => {
      mockPrismaService.inspection.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_A, PROJECT_ID, PERMIT_ID, INSPECTION_ID, USER_ID, {
          notes: 'test',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.inspection.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          tenant_id: TENANT_A,
        }),
      });
    });
  });

  // ===========================================================================
  // Response format
  // ===========================================================================
  describe('Response format', () => {
    it('should format dates as YYYY-MM-DD strings', async () => {
      const inspectionWithDates = {
        ...mockInspection,
        scheduled_date: new Date('2026-04-10T00:00:00.000Z'),
        reinspection_date: new Date('2026-04-17T00:00:00.000Z'),
      };
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([inspectionWithDates]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result[0].scheduled_date).toBe('2026-04-10');
      expect(result[0].reinspection_date).toBe('2026-04-17');
    });

    it('should return null for missing dates', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result[0].scheduled_date).toBeNull();
      expect(result[0].reinspection_date).toBeNull();
    });

    it('should return ISO string for created_at and updated_at', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);

      expect(result[0].created_at).toBe('2026-04-01T10:00:00.000Z');
      expect(result[0].updated_at).toBe('2026-04-01T10:00:00.000Z');
    });

    it('should include all expected fields in response', async () => {
      mockPrismaService.permit.findFirst.mockResolvedValue(mockPermit);
      mockPrismaService.inspection.findMany.mockResolvedValue([mockInspection]);

      const result = await service.findByPermit(TENANT_A, PROJECT_ID, PERMIT_ID);
      const response = result[0];

      expect(response).toHaveProperty('id');
      expect(response).toHaveProperty('permit_id');
      expect(response).toHaveProperty('project_id');
      expect(response).toHaveProperty('inspection_type');
      expect(response).toHaveProperty('scheduled_date');
      expect(response).toHaveProperty('inspector_name');
      expect(response).toHaveProperty('result');
      expect(response).toHaveProperty('reinspection_required');
      expect(response).toHaveProperty('reinspection_date');
      expect(response).toHaveProperty('notes');
      expect(response).toHaveProperty('inspected_by_user_id');
      expect(response).toHaveProperty('created_at');
      expect(response).toHaveProperty('updated_at');
    });
  });
});
