import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('RoleService', () => {
  let service: RoleService;
  let prisma: {
    role: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      role: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: AuditLoggerService,
          useValue: { logRBACChange: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  describe('listActiveRoles', () => {
    const mockRoles = [
      { id: 'role-1', name: 'Owner', description: 'Full access to all features' },
      { id: 'role-2', name: 'Admin', description: 'Administrative access' },
      { id: 'role-3', name: 'Estimator', description: 'Create and manage quotes' },
      { id: 'role-4', name: 'Project Manager', description: 'Manage active projects' },
      { id: 'role-5', name: 'Bookkeeper', description: 'Manage all financial data' },
      { id: 'role-6', name: 'Employee', description: 'Limited access for field workers' },
      { id: 'role-7', name: 'Read-only', description: null },
    ];

    it('should return only active, non-deleted roles', async () => {
      prisma.role.findMany.mockResolvedValue(mockRoles);

      const result = await service.listActiveRoles();

      expect(prisma.role.findMany).toHaveBeenCalledWith({
        where: {
          is_active: true,
          deleted_at: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
        orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
      });

      expect(result).toEqual(mockRoles);
    });

    it('should select only id, name, description — no permission data', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.listActiveRoles();

      const callArgs = prisma.role.findMany.mock.calls[0][0];

      // Verify select includes ONLY the 3 required fields
      expect(callArgs.select).toEqual({
        id: true,
        name: true,
        description: true,
      });

      // Verify no include (no role_permission, no _count)
      expect(callArgs.include).toBeUndefined();
    });

    it('should order system roles first, then alphabetical', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.listActiveRoles();

      const callArgs = prisma.role.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual([
        { is_system: 'desc' },
        { name: 'asc' },
      ]);
    });

    it('should filter out inactive roles via where clause', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      await service.listActiveRoles();

      const callArgs = prisma.role.findMany.mock.calls[0][0];
      expect(callArgs.where.is_active).toBe(true);
      expect(callArgs.where.deleted_at).toBeNull();
    });

    it('should return empty array when no active roles exist', async () => {
      prisma.role.findMany.mockResolvedValue([]);

      const result = await service.listActiveRoles();

      expect(result).toEqual([]);
    });

    it('should handle roles with null description', async () => {
      const rolesWithNullDesc = [
        { id: 'role-1', name: 'Owner', description: null },
      ];
      prisma.role.findMany.mockResolvedValue(rolesWithNullDesc);

      const result = await service.listActiveRoles();

      expect(result).toEqual(rolesWithNullDesc);
      expect(result[0].description).toBeNull();
    });
  });
});
