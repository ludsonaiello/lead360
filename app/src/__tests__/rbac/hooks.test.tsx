/**
 * RBAC Hooks Tests
 * Tests for custom RBAC hooks
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useRole } from '@/lib/hooks/useRole';
import { usePermission } from '@/lib/hooks/usePermission';
import { usePermissionMatrix } from '@/lib/hooks/usePermissionMatrix';
import { useCurrentUserRoles } from '@/lib/hooks/useCurrentUserRoles';
import { RBACProvider } from '@/contexts/RBACContext';
import { AuthProvider } from '@/contexts/AuthContext';
import * as rbacApi from '@/lib/api/rbac';
import { ReactNode } from 'react';

// Mock the API
jest.mock('@/lib/api/rbac');
const mockRbacApi = rbacApi as jest.Mocked<typeof rbacApi>;

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

describe('RBAC Hooks', () => {
  const mockUserRoles = {
    roles: [
      {
        id: 'role-1',
        user_id: 'user-123',
        role_id: 'owner-role',
        tenant_id: 'tenant-1',
        assigned_by_user_id: null,
        assigned_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: {
          id: 'owner-role',
          name: 'Owner',
          description: 'Business owner',
          is_system: true,
          is_active: true,
          created_by_user_id: null,
          deleted_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      },
      {
        id: 'role-2',
        user_id: 'user-123',
        role_id: 'admin-role',
        tenant_id: 'tenant-1',
        assigned_by_user_id: null,
        assigned_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        role: {
          id: 'admin-role',
          name: 'Admin',
          description: 'Administrator',
          is_system: true,
          is_active: true,
          created_by_user_id: null,
          deleted_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      },
    ],
  };

  const mockUserPermissions = {
    permissions: [
      {
        id: 'perm-1',
        module_id: 'leads-module',
        action: 'view',
        display_name: 'View Leads',
        description: 'Can view leads',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        module: {
          id: 'leads-module',
          name: 'leads',
          display_name: 'Leads',
          description: 'Lead management',
          is_active: true,
          sort_order: 1,
          icon: 'users',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      },
      {
        id: 'perm-2',
        module_id: 'leads-module',
        action: 'edit',
        display_name: 'Edit Leads',
        description: 'Can edit leads',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        module: {
          id: 'leads-module',
          name: 'leads',
          display_name: 'Leads',
          description: 'Lead management',
          is_active: true,
          sort_order: 1,
          icon: 'users',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRbacApi.getUserRoles.mockResolvedValue(mockUserRoles);
    mockRbacApi.getUserPermissions.mockResolvedValue(mockUserPermissions);
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider>
      <RBACProvider>{children}</RBACProvider>
    </AuthProvider>
  );

  describe('useRole', () => {
    it('should provide role checking methods', async () => {
      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('Owner')).toBe(true);
      expect(result.current.hasRole('Admin')).toBe(true);
      expect(result.current.hasRole('Estimator')).toBe(false);
    });

    it('should check if user has ANY role', async () => {
      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasAnyRole(['Owner', 'Estimator'])).toBe(true);
      expect(result.current.hasAnyRole(['Estimator', 'Installer'])).toBe(false);
    });

    it('should check if user has ALL roles', async () => {
      const { result } = renderHook(() => useRole(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasAllRoles(['Owner', 'Admin'])).toBe(true);
      expect(result.current.hasAllRoles(['Owner', 'Estimator'])).toBe(false);
    });
  });

  describe('usePermission', () => {
    it('should provide permission checking methods', async () => {
      const { result } = renderHook(() => usePermission(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission('leads:view')).toBe(true);
      expect(result.current.hasPermission('leads:edit')).toBe(true);
      expect(result.current.hasPermission('leads:delete')).toBe(false);
    });

    it('should check if user has ANY permission', async () => {
      const { result } = renderHook(() => usePermission(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasAnyPermission(['leads:view', 'leads:delete'])).toBe(true);
      expect(result.current.hasAnyPermission(['leads:delete', 'quotes:view'])).toBe(false);
    });

    it('should check if user has ALL permissions', async () => {
      const { result } = renderHook(() => usePermission(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasAllPermissions(['leads:view', 'leads:edit'])).toBe(true);
      expect(result.current.hasAllPermissions(['leads:view', 'leads:delete'])).toBe(false);
    });

    it('should check if user can perform action on module', async () => {
      const { result } = renderHook(() => usePermission(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canPerform('leads', 'view')).toBe(true);
      expect(result.current.canPerform('leads', 'edit')).toBe(true);
      expect(result.current.canPerform('leads', 'delete')).toBe(false);
    });
  });

  describe('useCurrentUserRoles', () => {
    it('should provide user roles and permissions', async () => {
      const { result } = renderHook(() => useCurrentUserRoles(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.roles).toHaveLength(2);
      expect(result.current.permissions).toHaveLength(2);
    });

    it('should provide refresh method', async () => {
      const { result } = renderHook(() => useCurrentUserRoles(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.refresh).toBeInstanceOf(Function);
    });
  });

  describe('usePermissionMatrix', () => {
    const mockMatrix = {
      matrix: {
        Owner: {
          leads: ['view', 'create', 'edit', 'delete'],
          quotes: ['view', 'create', 'edit', 'delete'],
        },
        Admin: {
          leads: ['view', 'create', 'edit'],
          quotes: ['view', 'create'],
        },
      },
      modules: [
        {
          id: 'leads-module',
          name: 'leads',
          display_name: 'Leads',
          description: 'Lead management',
          is_active: true,
          sort_order: 1,
          icon: 'users',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          permissions: [
            { id: 'perm-1', action: 'view', display_name: 'View' },
            { id: 'perm-2', action: 'create', display_name: 'Create' },
          ],
        },
      ],
    };

    beforeEach(() => {
      mockRbacApi.getPermissionMatrix.mockResolvedValue(mockMatrix);
    });

    it('should load permission matrix on mount', async () => {
      const { result } = renderHook(() => usePermissionMatrix(), { wrapper });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.matrix).toEqual(mockMatrix);
      expect(mockRbacApi.getPermissionMatrix).toHaveBeenCalledTimes(1);
    });

    it('should not auto-load if autoLoad is false', async () => {
      const { result } = renderHook(() => usePermissionMatrix(false), { wrapper });

      expect(result.current.loading).toBe(false);
      expect(result.current.matrix).toBeNull();
      expect(mockRbacApi.getPermissionMatrix).not.toHaveBeenCalled();
    });

    it('should handle API errors', async () => {
      mockRbacApi.getPermissionMatrix.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => usePermissionMatrix(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.matrix).toBeNull();
      expect(result.current.error).toBeTruthy();
    });

    it('should support manual refresh', async () => {
      const { result } = renderHook(() => usePermissionMatrix(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      mockRbacApi.getPermissionMatrix.mockClear();

      await result.current.refresh();

      expect(mockRbacApi.getPermissionMatrix).toHaveBeenCalledTimes(1);
    });
  });
});
