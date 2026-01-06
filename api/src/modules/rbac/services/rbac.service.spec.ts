import { Test, TestingModule } from '@nestjs/testing';
import { RBACService } from './rbac.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

describe('RBACService', () => {
  let service: RBACService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPlatformAdmin = {
    id: 'platform-admin-id',
    is_platform_admin: true,
  };

  const mockRegularUser = {
    id: 'user-id-123',
    is_platform_admin: false,
  };

  const mockTenantId = 'tenant-id-456';

  const mockUserRoles = [
    {
      id: 'user-role-id-1',
      user_id: 'user-id-123',
      role_id: 'role-id-admin',
      tenant_id: 'tenant-id-456',
      role: {
        id: 'role-id-admin',
        name: 'Admin',
        is_active: true,
      },
    },
  ];

  const mockRolePermissions = [
    {
      id: 'role-perm-id-1',
      role_id: 'role-id-admin',
      permission_id: 'perm-id-123',
      permission: {
        id: 'perm-id-123',
        module_id: 'module-id-leads',
        action: 'view',
        is_active: true,
        module: {
          id: 'module-id-leads',
          name: 'leads',
          is_active: true,
        },
      },
    },
    {
      id: 'role-perm-id-2',
      role_id: 'role-id-admin',
      permission_id: 'perm-id-124',
      permission: {
        id: 'perm-id-124',
        module_id: 'module-id-leads',
        action: 'create',
        is_active: true,
        module: {
          id: 'module-id-leads',
          name: 'leads',
          is_active: true,
        },
      },
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findUnique: jest.fn(),
      },
      userRole: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      rolePermission: {
        findMany: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
      },
      module: {
        findMany: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
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
        RBACService,
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

    service = module.get<RBACService>(RBACService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPermission', () => {
    it('should return true for platform admin', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockPlatformAdmin);

      const result = await service.checkPermission(
        'platform-admin-id',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(true);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'platform-admin-id' },
        select: { is_platform_admin: true },
      });
      // Should not query roles or permissions for platform admin
      expect(prismaService.userRole.findMany).not.toHaveBeenCalled();
    });

    it('should return false when user has no roles', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(false);
      expect(prismaService.userRole.findMany).toHaveBeenCalledWith({
        where: {
          user_id: 'user-id-123',
          tenant_id: mockTenantId,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              is_active: true,
            },
          },
        },
      });
    });

    it('should return true when user has matching permission', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(
        mockRolePermissions,
      );

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(true);
      expect(prismaService.rolePermission.findMany).toHaveBeenCalledWith({
        where: {
          role_id: 'role-id-admin',
        },
        include: {
          permission: {
            include: {
              module: true,
            },
          },
        },
      });
    });

    it('should return false when user lacks permission', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(
        mockRolePermissions,
      );

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'quotes',
        'delete',
      );

      expect(result).toBe(false);
    });

    it('should skip inactive roles', async () => {
      const inactiveUserRole = [
        {
          ...mockUserRoles[0],
          role: {
            ...mockUserRoles[0].role,
            is_active: false,
          },
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(inactiveUserRole);

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(false);
      // Should not query permissions for inactive role
      expect(prismaService.rolePermission.findMany).not.toHaveBeenCalled();
    });

    it('should return false when permission is inactive', async () => {
      const inactivePermission = [
        {
          ...mockRolePermissions[0],
          permission: {
            ...mockRolePermissions[0].permission,
            is_active: false,
          },
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(
        inactivePermission,
      );

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(false);
    });

    it('should return false when module is inactive', async () => {
      const inactiveModule = [
        {
          ...mockRolePermissions[0],
          permission: {
            ...mockRolePermissions[0].permission,
            module: {
              ...mockRolePermissions[0].permission.module,
              is_active: false,
            },
          },
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(inactiveModule);

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(false);
    });

    it('should return false on error (fail closed)', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.checkPermission(
        'user-id-123',
        mockTenantId,
        'leads',
        'view',
      );

      expect(result).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    const mockPermissions = [
      {
        id: 'perm-id-123',
        module_id: 'module-id-leads',
        action: 'view',
        display_name: 'View Leads',
        is_active: true,
        module: {
          id: 'module-id-leads',
          name: 'leads',
          display_name: 'Lead Management',
          is_active: true,
        },
      },
      {
        id: 'perm-id-124',
        module_id: 'module-id-leads',
        action: 'create',
        display_name: 'Create Leads',
        is_active: true,
        module: {
          id: 'module-id-leads',
          name: 'leads',
          display_name: 'Lead Management',
          is_active: true,
        },
      },
    ];

    it('should return all permissions for platform admin', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockPlatformAdmin);
      prismaService.permission.findMany.mockResolvedValue(mockPermissions);

      const result = await service.getUserPermissions(
        'platform-admin-id',
        mockTenantId,
      );

      expect(result).toEqual(mockPermissions);
      expect(prismaService.permission.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        include: { module: true },
      });
    });

    it('should return empty array when user has no roles', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue([]);

      const result = await service.getUserPermissions(
        'user-id-123',
        mockTenantId,
      );

      expect(result).toEqual([]);
    });

    it('should return deduplicated permissions', async () => {
      const mockRolePermissionsWithDupes = [
        {
          id: 'role-perm-id-1',
          permission: mockPermissions[0],
        },
        {
          id: 'role-perm-id-2',
          permission: mockPermissions[0], // Duplicate
        },
        {
          id: 'role-perm-id-3',
          permission: mockPermissions[1],
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(
        mockRolePermissionsWithDupes,
      );

      const result = await service.getUserPermissions(
        'user-id-123',
        mockTenantId,
      );

      // Should only have 2 unique permissions, not 3
      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining([mockPermissions[0], mockPermissions[1]]),
      );
    });

    it('should filter out permissions with null module', async () => {
      const mockRolePermissionsWithNull = [
        {
          id: 'role-perm-id-1',
          permission: null, // Invalid
        },
        {
          id: 'role-perm-id-2',
          permission: {
            ...mockPermissions[0],
            module: null, // Invalid
          },
        },
        {
          id: 'role-perm-id-3',
          permission: mockPermissions[1], // Valid
        },
      ];

      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.findMany.mockResolvedValue(mockUserRoles);
      prismaService.rolePermission.findMany.mockResolvedValue(
        mockRolePermissionsWithNull,
      );

      const result = await service.getUserPermissions(
        'user-id-123',
        mockTenantId,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockPermissions[1]);
    });

    it('should return empty array on error', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.getUserPermissions(
        'user-id-123',
        mockTenantId,
      );

      expect(result).toEqual([]);
    });
  });

  describe('hasAnyRole', () => {
    it('should return true for platform admin', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockPlatformAdmin);

      const result = await service.hasAnyRole(
        'platform-admin-id',
        mockTenantId,
        ['Owner', 'Admin'],
      );

      expect(result).toBe(true);
      // Should not query user_role table
      expect(prismaService.userRole.count).not.toHaveBeenCalled();
    });

    it('should return true when user has one of the roles', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.count.mockResolvedValue(1);

      const result = await service.hasAnyRole('user-id-123', mockTenantId, [
        'Owner',
        'Admin',
      ]);

      expect(result).toBe(true);
      expect(prismaService.userRole.count).toHaveBeenCalledWith({
        where: {
          user_id: 'user-id-123',
          tenant_id: mockTenantId,
          role: {
            name: { in: ['Owner', 'Admin'] },
            is_active: true,
          },
        },
      });
    });

    it('should return false when user has none of the roles', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.count.mockResolvedValue(0);

      const result = await service.hasAnyRole('user-id-123', mockTenantId, [
        'Owner',
        'Admin',
      ]);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      prismaService.user.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.hasAnyRole('user-id-123', mockTenantId, [
        'Owner',
      ]);

      expect(result).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('should call hasAnyRole with single role', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockRegularUser);
      prismaService.userRole.count.mockResolvedValue(1);

      const result = await service.hasRole(
        'user-id-123',
        mockTenantId,
        'Owner',
      );

      expect(result).toBe(true);
      expect(prismaService.userRole.count).toHaveBeenCalledWith({
        where: {
          user_id: 'user-id-123',
          tenant_id: mockTenantId,
          role: {
            name: { in: ['Owner'] },
            is_active: true,
          },
        },
      });
    });
  });

  describe('getPermissionMatrix', () => {
    const mockRoles = [
      {
        id: 'role-id-1',
        name: 'Owner',
        is_active: true,
        deleted_at: null,
        role_permissions: [
          {
            permission: {
              id: 'perm-id-1',
              action: 'view',
              is_active: true,
              module: {
                id: 'module-id-1',
                name: 'leads',
                is_active: true,
              },
            },
          },
          {
            permission: {
              id: 'perm-id-2',
              action: 'create',
              is_active: true,
              module: {
                id: 'module-id-1',
                name: 'leads',
                is_active: true,
              },
            },
          },
        ],
      },
      {
        id: 'role-id-2',
        name: 'Admin',
        is_active: true,
        deleted_at: null,
        role_permissions: [
          {
            permission: {
              id: 'perm-id-1',
              action: 'view',
              is_active: true,
              module: {
                id: 'module-id-1',
                name: 'leads',
                is_active: true,
              },
            },
          },
        ],
      },
    ];

    const mockModules = [
      {
        id: 'module-id-1',
        name: 'leads',
        is_active: true,
        permissions: [
          { id: 'perm-id-1', action: 'view', display_name: 'View Leads' },
          { id: 'perm-id-2', action: 'create', display_name: 'Create Leads' },
        ],
      },
    ];

    it('should return permission matrix', async () => {
      prismaService.role.findMany.mockResolvedValue(mockRoles);
      prismaService.module.findMany.mockResolvedValue(mockModules);

      const result = await service.getPermissionMatrix();

      expect(result).toHaveProperty('matrix');
      expect(result).toHaveProperty('modules');
      expect(result.matrix).toEqual({
        Owner: {
          leads: ['view', 'create'],
        },
        Admin: {
          leads: ['view'],
        },
      });
      expect(result.modules).toEqual(mockModules);
    });

    it('should handle roles with null permissions', async () => {
      const rolesWithNulls = [
        {
          ...mockRoles[0],
          role_permissions: [
            {
              permission: null,
            },
            {
              permission: {
                id: 'perm-id-1',
                action: 'view',
                is_active: true,
                module: null,
              },
            },
          ],
        },
      ];

      prismaService.role.findMany.mockResolvedValue(rolesWithNulls);
      prismaService.module.findMany.mockResolvedValue(mockModules);

      const result = await service.getPermissionMatrix();

      expect(result.matrix).toEqual({
        Owner: {},
      });
    });
  });
});
