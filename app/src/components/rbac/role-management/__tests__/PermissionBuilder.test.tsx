/**
 * PermissionBuilder Component Tests
 * Tests for the most complex RBAC component - permission selection matrix
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PermissionBuilder from '../PermissionBuilder';
import * as rbacApi from '@/lib/api/rbac';

// Mock the API
vi.mock('@/lib/api/rbac');

const mockModules = [
  {
    id: 'module-1',
    name: 'Users',
    display_name: 'User Management',
    description: 'Manage user accounts',
    is_active: true,
    sort_order: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: [
      {
        id: 'perm-1',
        module_id: 'module-1',
        name: 'users:view',
        display_name: 'View Users',
        description: 'View user list',
        resource: 'users',
        action: 'view',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'perm-2',
        module_id: 'module-1',
        name: 'users:create',
        display_name: 'Create Users',
        description: 'Create new users',
        resource: 'users',
        action: 'create',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'perm-3',
        module_id: 'module-1',
        name: 'users:edit',
        display_name: 'Edit Users',
        description: 'Edit existing users',
        resource: 'users',
        action: 'edit',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'module-2',
    name: 'Documents',
    display_name: 'Document Management',
    description: 'Manage documents',
    is_active: true,
    sort_order: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    permissions: [
      {
        id: 'perm-4',
        module_id: 'module-2',
        name: 'documents:view',
        display_name: 'View Documents',
        description: 'View document list',
        resource: 'documents',
        action: 'view',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
];

describe('PermissionBuilder', () => {
  const mockOnChange = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.getAllModules).mockResolvedValue(mockModules as any);
  });

  it('renders loading state initially', () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText(/loading permissions/i)).toBeInTheDocument();
  });

  it('loads and displays modules with permissions', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Document Management')).toBeInTheDocument();
    });

    expect(rbacApi.getAllModules).toHaveBeenCalledTimes(1);
  });

  it('displays permissions grouped by module', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Should show permission count
    expect(screen.getByText('3 permissions')).toBeInTheDocument();
    expect(screen.getByText('1 permission')).toBeInTheDocument();
  });

  it('selects permissions via checkbox', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('View Users')).toBeInTheDocument();
    });

    const viewUsersCheckbox = screen.getByLabelText('View Users');
    await user.click(viewUsersCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(['perm-1']);
  });

  it('deselects permissions via checkbox', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={['perm-1', 'perm-2']}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('View Users')).toBeInTheDocument();
    });

    const viewUsersCheckbox = screen.getByLabelText('View Users');
    expect(viewUsersCheckbox).toBeChecked();

    await user.click(viewUsersCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith(['perm-2']);
  });

  it('selects all permissions in a module', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    const selectAllButton = screen.getByRole('button', { name: /select all/i });
    await user.click(selectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith(['perm-1', 'perm-2', 'perm-3']);
  });

  it('deselects all permissions in a module', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={['perm-1', 'perm-2', 'perm-3']}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
    await user.click(deselectAllButton);

    expect(mockOnChange).toHaveBeenCalledWith([]);
  });

  it('expands and collapses module sections', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('User Management')).toBeInTheDocument();
    });

    // Should be expanded by default
    expect(screen.getByText('View Users')).toBeVisible();

    // Click module header to collapse
    const moduleHeader = screen.getByText('User Management').closest('button');
    if (moduleHeader) {
      await user.click(moduleHeader);
    }

    // Permissions should be hidden
    expect(screen.queryByText('View Users')).not.toBeVisible();
  });

  it('filters permissions by search query', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('View Users')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search permissions/i);
    await user.type(searchInput, 'create');

    // Should only show permissions matching "create"
    await waitFor(() => {
      expect(screen.getByText('Create Users')).toBeInTheDocument();
      expect(screen.queryByText('View Users')).not.toBeInTheDocument();
    });
  });

  it('displays error state when API fails', async () => {
    vi.mocked(rbacApi.getAllModules).mockRejectedValue(new Error('API Error'));

    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load permissions/i)).toBeInTheDocument();
    });
  });

  it('shows selected count badge', async () => {
    render(
      <PermissionBuilder
        selectedPermissionIds={['perm-1', 'perm-2']}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
    });
  });

  it('handles empty modules list', async () => {
    vi.mocked(rbacApi.getAllModules).mockResolvedValue([]);

    render(
      <PermissionBuilder
        selectedPermissionIds={[]}
        onChange={mockOnChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/no permissions available/i)).toBeInTheDocument();
    });
  });
});
