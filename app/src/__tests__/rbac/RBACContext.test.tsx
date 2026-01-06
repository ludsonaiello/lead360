/**
 * RBAC Context Tests
 * Tests for RBACContext functionality and integration with AuthContext
 */

import { renderHook, waitFor } from '@testing-library/react';
import { RBACProvider, useRBAC } from '@/contexts/RBACContext';
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

describe('RBACContext', () => {
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
        action: 'create',
        display_name: 'Create Leads',
        description: 'Can create leads',
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

  describe('initialization', () => {
    it('should load user roles and permissions on mount', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Check roles loaded
      expect(result.current.roles).toHaveLength(1);
      expect(result.current.roles[0].name).toBe('Owner');

      // Check permissions loaded
      expect(result.current.permissions).toHaveLength(2);

      // Check API was called
      expect(mockRbacApi.getUserRoles).toHaveBeenCalledWith('user-123');
      expect(mockRbacApi.getUserPermissions).toHaveBeenCalledWith('user-123');
    });

    it('should build role and permission lookup sets', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Check role names set
      expect(result.current.roleNames.has('Owner')).toBe(true);

      // Check permission codes set
      expect(result.current.permissionCodes.has('leads:view')).toBe(true);
      expect(result.current.permissionCodes.has('leads:create')).toBe(true);
    });
  });

  describe('hasRole', () => {
    it('should return true if user has the role', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('Owner')).toBe(true);
    });

    it('should return false if user does not have the role', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole('Admin')).toBe(false);
    });

    it('should support array of roles (ANY)', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasRole(['Owner', 'Admin'])).toBe(true);
      expect(result.current.hasRole(['Admin', 'Estimator'])).toBe(false);
    });

    it('should return false while loading', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      // While loading
      expect(result.current.hasRole('Owner')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    it('should return true if user has the permission', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission('leads:view')).toBe(true);
      expect(result.current.hasPermission('leads:create')).toBe(true);
    });

    it('should return false if user does not have the permission', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission('leads:delete')).toBe(false);
    });

    it('should support array of permissions (ANY)', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hasPermission(['leads:view', 'leads:delete'])).toBe(true);
      expect(result.current.hasPermission(['leads:delete', 'leads:edit'])).toBe(false);
    });

    it('should return false while loading', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      // While loading
      expect(result.current.hasPermission('leads:view')).toBe(false);
    });
  });

  describe('canPerform', () => {
    it('should return true if user can perform the action', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canPerform('leads', 'view')).toBe(true);
      expect(result.current.canPerform('leads', 'create')).toBe(true);
    });

    it('should return false if user cannot perform the action', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canPerform('leads', 'delete')).toBe(false);
    });

    it('should return false while loading', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      // While loading
      expect(result.current.canPerform('leads', 'view')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully (fail closed)', async () => {
      mockRbacApi.getUserRoles.mockRejectedValue(new Error('API Error'));
      mockRbacApi.getUserPermissions.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have no permissions on error (fail closed)
      expect(result.current.roles).toHaveLength(0);
      expect(result.current.permissions).toHaveLength(0);
      expect(result.current.error).toBeTruthy();

      // Permission checks should fail
      expect(result.current.hasRole('Owner')).toBe(false);
      expect(result.current.hasPermission('leads:view')).toBe(false);
    });
  });

  describe('refresh', () => {
    it('should reload permissions when refresh is called', async () => {
      const { result } = renderHook(() => useRBAC(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear mock call history
      mockRbacApi.getUserRoles.mockClear();
      mockRbacApi.getUserPermissions.mockClear();

      // Call refresh
      await result.current.refresh();

      // Should have called API again
      expect(mockRbacApi.getUserRoles).toHaveBeenCalledTimes(1);
      expect(mockRbacApi.getUserPermissions).toHaveBeenCalledTimes(1);
    });
  });
});
