import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { UserRoleService } from './user-role.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('UserRoleService', () => {
  let service: UserRoleService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-id-123';
  const mockTenantId = 'tenant-id-456';
  const mockRoleId = 'role-id-789';
  const mockAssignedByUserId = 'admin-user-id';

  const mockUser = {
    id: mockUserId,
    email: 'user@example.com',
    tenant_id: mockTenantId,
  };

  const mockRole = {
    id: mockRoleId,
    name: 'Admin',
    is_active: true,
  };

  const mockOwnerRole = {
    id: 'owner-role-id',
    name: 'Owner',
    is_active: true,
  };

  const mockUserRole = {
    id: 'user-role-id-1',
    user_id: mockUserId,
    role_id: mockRoleId,
    tenant_id: mockTenantId,
    assigned_by_user_id: mockAssignedByUserId,
    assigned_at: new Date(),
    updated_at: new Date(),
    role: mockRole,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      userRole: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
    };

    const mockAuditLogger = {
      log: jest.fn(),
      logAuth: jest.fn(),
      logTenantChange: jest.fn(),
      logRBACChange: jest.fn(),
      logFailedAction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRoleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<UserRoleService>(UserRoleService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserRoles', () => {
    it('should return user roles', async () => {
      const mockUserRoles = [mockUserRole];
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);

      const result = await service.getUserRoles(mockUserId, mockTenantId);

      expect(result).toEqual(mockUserRoles);
      expect(prismaService.userRole.findMany).toHaveBeenCalledWith({
        where: {
          user_id: mockUserId,
          tenant_id: mockTenantId,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              is_system: true,
            },
          },
        },
        orderBy: {
          assigned_at: 'desc',
        },
      });
    });
  });

  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.role.findUnique.mockResolvedValue(mockRole);
      prismaService.userRole.findFirst.mockResolvedValue(null);
      prismaService.userRole.create.mockResolvedValue(mockUserRole);

      const result = await service.assignRoleToUser(
        mockUserId,
        mockTenantId,
        mockRoleId,
        mockAssignedByUserId,
      );

      expect(result).toEqual(mockUserRole);
      expect(prismaService.userRole.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUserId,
          role_id: mockRoleId,
          tenant_id: mockTenantId,
          assigned_by_user_id: mockAssignedByUserId,
        },
        include: {
          role: true,
        },
      });
      expect(prismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('User not found or does not belong to this tenant');
    });

    it('should throw NotFoundException when role not found', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.role.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('Role not found');
    });

    it('should throw BadRequestException when role is inactive', async () => {
      const inactiveRole = { ...mockRole, is_active: false };
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.role.findUnique.mockResolvedValue(inactiveRole);

      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.assignRoleToUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('Cannot assign inactive role');
    });

    it('should return existing assignment if already assigned', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      prismaService.role.findUnique.mockResolvedValue(mockRole);
      prismaService.userRole.findFirst.mockResolvedValue(mockUserRole);

      const result = await service.assignRoleToUser(
        mockUserId,
        mockTenantId,
        mockRoleId,
        mockAssignedByUserId,
      );

      expect(result).toEqual(mockUserRole);
      // Should not create new assignment
      expect(prismaService.userRole.create).not.toHaveBeenCalled();
    });
  });

  describe('removeRoleFromUser - Last Owner Protection', () => {
    const mockOwnerUserRole = {
      id: 'owner-user-role-id',
      user_id: mockUserId,
      role_id: 'owner-role-id',
      tenant_id: mockTenantId,
      role: mockOwnerRole,
    };

    it('should remove role from user', async () => {
      prismaService.userRole.findFirst.mockResolvedValue(mockUserRole);
      prismaService.userRole.delete.mockResolvedValue(mockUserRole);

      const result = await service.removeRoleFromUser(
        mockUserId,
        mockTenantId,
        mockRoleId,
        mockAssignedByUserId,
      );

      expect(result).toEqual({ message: 'Role removed successfully' });
      expect(prismaService.userRole.delete).toHaveBeenCalledWith({
        where: { id: mockUserRole.id },
      });
      expect(prismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not have role', async () => {
      prismaService.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.removeRoleFromUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeRoleFromUser(
          mockUserId,
          mockTenantId,
          mockRoleId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('User does not have this role');
    });

    it('CRITICAL: should prevent removing last Owner', async () => {
      prismaService.userRole.findFirst.mockResolvedValue(mockOwnerUserRole);
      prismaService.userRole.count.mockResolvedValue(1); // Only 1 Owner

      await expect(
        service.removeRoleFromUser(
          mockUserId,
          mockTenantId,
          'owner-role-id',
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.removeRoleFromUser(
          mockUserId,
          mockTenantId,
          'owner-role-id',
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('Cannot remove last Owner. Assign another Owner first.');

      // Should not delete
      expect(prismaService.userRole.delete).not.toHaveBeenCalled();
    });

    it('should allow removing Owner when there are multiple Owners', async () => {
      prismaService.userRole.findFirst.mockResolvedValue(mockOwnerUserRole);
      prismaService.userRole.count.mockResolvedValue(2); // 2 Owners
      prismaService.userRole.delete.mockResolvedValue(mockOwnerUserRole);

      const result = await service.removeRoleFromUser(
        mockUserId,
        mockTenantId,
        'owner-role-id',
        mockAssignedByUserId,
      );

      expect(result).toEqual({ message: 'Role removed successfully' });
      expect(prismaService.userRole.delete).toHaveBeenCalled();
    });
  });

  describe('replaceUserRoles - Last Owner Protection', () => {
    const mockCurrentUserRoles = [
      {
        id: 'user-role-id-1',
        user_id: mockUserId,
        role_id: 'owner-role-id',
        tenant_id: mockTenantId,
        role: mockOwnerRole,
      },
      {
        id: 'user-role-id-2',
        user_id: mockUserId,
        role_id: 'admin-role-id',
        tenant_id: mockTenantId,
        role: { id: 'admin-role-id', name: 'Admin' },
      },
    ];

    it('should replace user roles', async () => {
      const newRoleIds = ['admin-role-id', 'estimator-role-id'];
      const updatedRoles = [
        {
          id: 'user-role-id-3',
          user_id: mockUserId,
          role_id: 'admin-role-id',
          tenant_id: mockTenantId,
          role: { id: 'admin-role-id', name: 'Admin' },
        },
        {
          id: 'user-role-id-4',
          user_id: mockUserId,
          role_id: 'estimator-role-id',
          tenant_id: mockTenantId,
          role: { id: 'estimator-role-id', name: 'Estimator' },
        },
      ];

      prismaService.userRole.findMany
        .mockResolvedValueOnce(mockCurrentUserRoles) // First call in service
        .mockResolvedValueOnce(updatedRoles); // Second call in transaction

      prismaService.role.findFirst.mockResolvedValue(mockOwnerRole);
      prismaService.userRole.count.mockResolvedValue(2); // Other Owners exist

      const result = await service.replaceUserRoles(
        mockUserId,
        mockTenantId,
        newRoleIds,
        mockAssignedByUserId,
      );

      expect(result.roles_added).toBe(1); // estimator-role-id
      expect(result.roles_removed).toBe(1); // owner-role-id
      expect(result.current_roles).toEqual(updatedRoles);
      expect(prismaService.auditLog.create).toHaveBeenCalled();
    });

    it('CRITICAL: should prevent removing last Owner via replace', async () => {
      const newRoleIds = ['admin-role-id']; // Not including Owner

      prismaService.userRole.findMany.mockResolvedValue(mockCurrentUserRoles);
      prismaService.role.findFirst.mockResolvedValue(mockOwnerRole);
      prismaService.userRole.count.mockResolvedValue(0); // No other Owners

      await expect(
        service.replaceUserRoles(
          mockUserId,
          mockTenantId,
          newRoleIds,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.replaceUserRoles(
          mockUserId,
          mockTenantId,
          newRoleIds,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('Cannot remove last Owner. Assign another Owner first.');
    });

    it('should allow removing Owner if new roles include Owner', async () => {
      const newRoleIds = ['owner-role-id', 'admin-role-id']; // Still has Owner

      prismaService.userRole.findMany
        .mockResolvedValueOnce(mockCurrentUserRoles)
        .mockResolvedValueOnce([
          {
            id: 'user-role-id-5',
            user_id: mockUserId,
            role_id: 'owner-role-id',
            tenant_id: mockTenantId,
            role: mockOwnerRole,
          },
        ]);

      prismaService.role.findFirst.mockResolvedValue(mockOwnerRole);
      prismaService.userRole.count.mockResolvedValue(0); // No other Owners (but user will still have Owner)

      const result = await service.replaceUserRoles(
        mockUserId,
        mockTenantId,
        newRoleIds,
        mockAssignedByUserId,
      );

      expect(result).toBeDefined();
      // Should not throw error
    });
  });

  describe('batchAssignRoles', () => {
    const mockUserIds = ['user-1', 'user-2', 'user-3'];
    const mockRoleIds = ['role-1', 'role-2'];

    const mockRoles = [
      { id: 'role-1', name: 'Admin' },
      { id: 'role-2', name: 'Estimator' },
    ];

    const mockUsers = [
      { id: 'user-1', email: 'user1@example.com', tenant_id: mockTenantId },
      { id: 'user-2', email: 'user2@example.com', tenant_id: mockTenantId },
      { id: 'user-3', email: 'user3@example.com', tenant_id: mockTenantId },
    ];

    it('should assign roles to multiple users', async () => {
      prismaService.role.findMany.mockResolvedValue(mockRoles);
      prismaService.user.findMany.mockResolvedValue(mockUsers);
      prismaService.userRole.findFirst.mockResolvedValue(null); // No existing assignments
      prismaService.userRole.create.mockResolvedValue({} as any);

      const result = await service.batchAssignRoles(
        mockUserIds,
        mockRoleIds,
        mockTenantId,
        mockAssignedByUserId,
      );

      expect(result.users_updated).toBe(3);
      expect(result.roles_assigned).toBe(6); // 3 users × 2 roles
      expect(result.details).toHaveLength(3);
      expect(result.details[0].roles_added).toBe(2);
    });

    it('should skip duplicate assignments', async () => {
      prismaService.role.findMany.mockResolvedValue(mockRoles);
      prismaService.user.findMany.mockResolvedValue(mockUsers);
      prismaService.userRole.findFirst
        .mockResolvedValueOnce({ id: 'existing' } as any) // First assignment exists
        .mockResolvedValue(null); // Rest don't exist

      const result = await service.batchAssignRoles(
        mockUserIds,
        mockRoleIds,
        mockTenantId,
        mockAssignedByUserId,
      );

      // Should have 5 assignments (6 total - 1 duplicate)
      expect(result.roles_assigned).toBe(5);
    });

    it('should throw NotFoundException when roles not found', async () => {
      prismaService.role.findMany.mockResolvedValue([mockRoles[0]]); // Only 1 role found

      await expect(
        service.batchAssignRoles(
          mockUserIds,
          mockRoleIds,
          mockTenantId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.batchAssignRoles(
          mockUserIds,
          mockRoleIds,
          mockTenantId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('One or more roles not found');
    });

    it('should throw NotFoundException when users not found in tenant', async () => {
      prismaService.role.findMany.mockResolvedValue(mockRoles);
      prismaService.user.findMany.mockResolvedValue([mockUsers[0]]); // Only 1 user found

      await expect(
        service.batchAssignRoles(
          mockUserIds,
          mockRoleIds,
          mockTenantId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.batchAssignRoles(
          mockUserIds,
          mockRoleIds,
          mockTenantId,
          mockAssignedByUserId,
        ),
      ).rejects.toThrow('One or more users not found in this tenant');
    });
  });

  describe('getUsersWithRole', () => {
    const mockUsersWithRole = [
      {
        id: 'user-role-id-1',
        user_id: 'user-1',
        role_id: mockRoleId,
        tenant_id: mockTenantId,
        user: {
          id: 'user-1',
          email: 'user1@example.com',
          first_name: 'John',
          last_name: 'Doe',
        },
        role: {
          name: 'Admin',
        },
      },
    ];

    it('should return users with specific role', async () => {
      prismaService.userRole.findMany.mockResolvedValue(mockUsersWithRole);

      const result = await service.getUsersWithRole(mockTenantId, mockRoleId);

      expect(result).toEqual(mockUsersWithRole);
      expect(prismaService.userRole.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          role_id: mockRoleId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
          role: {
            select: {
              name: true,
            },
          },
        },
      });
    });
  });
});
