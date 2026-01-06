/**
 * Roles Page Integration Tests
 * Tests for role management list page
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRouter } from 'next/navigation';
import RolesPage from '../page';
import * as rbacApi from '@/lib/api/rbac';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/lib/api/rbac');

vi.mock('@/components/rbac/shared/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockRoles = [
  {
    id: 'role-1',
    tenant_id: 'tenant-1',
    name: 'Owner',
    description: 'Full system access',
    is_system_role: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    _count: { role_permissions: 50, user_roles: 2 },
  },
  {
    id: 'role-2',
    tenant_id: 'tenant-1',
    name: 'Manager',
    description: 'Management access',
    is_system_role: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    _count: { role_permissions: 25, user_roles: 5 },
  },
  {
    id: 'role-3',
    tenant_id: 'tenant-1',
    name: 'Viewer',
    description: 'Read-only access',
    is_system_role: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    _count: { role_permissions: 10, user_roles: 15 },
  },
];

describe('RolesPage', () => {
  const mockPush = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
    } as any);
    vi.mocked(rbacApi.getAllRoles).mockResolvedValue(mockRoles as any);
  });

  it('renders page title and description', async () => {
    render(<RolesPage />);

    expect(screen.getByText('Roles')).toBeInTheDocument();
    expect(screen.getByText(/manage user roles and permissions/i)).toBeInTheDocument();
  });

  it('displays create role button', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument();
    });
  });

  it('navigates to create role page on button click', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument();
    });

    const createButton = screen.getByRole('button', { name: /create role/i });
    await user.click(createButton);

    expect(mockPush).toHaveBeenCalledWith('/admin/rbac/roles/new');
  });

  it('loads and displays all roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Manager')).toBeInTheDocument();
      expect(screen.getByText('Viewer')).toBeInTheDocument();
    });

    expect(rbacApi.getAllRoles).toHaveBeenCalledTimes(1);
  });

  it('displays role descriptions', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Full system access')).toBeInTheDocument();
      expect(screen.getByText('Management access')).toBeInTheDocument();
      expect(screen.getByText('Read-only access')).toBeInTheDocument();
    });
  });

  it('displays permission counts for roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('50 permissions')).toBeInTheDocument();
      expect(screen.getByText('25 permissions')).toBeInTheDocument();
      expect(screen.getByText('10 permissions')).toBeInTheDocument();
    });
  });

  it('displays user counts for roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('2 users')).toBeInTheDocument();
      expect(screen.getByText('5 users')).toBeInTheDocument();
      expect(screen.getByText('15 users')).toBeInTheDocument();
    });
  });

  it('displays system role badge', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('System Role')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(rbacApi.getAllRoles).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<RolesPage />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('displays error message when API fails', async () => {
    vi.mocked(rbacApi.getAllRoles).mockRejectedValue(new Error('API Error'));

    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load roles/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no roles exist', async () => {
    vi.mocked(rbacApi.getAllRoles).mockResolvedValue([]);

    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText(/no roles found/i)).toBeInTheDocument();
    });
  });

  it('provides edit action for roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);

    await user.click(editButtons[0]);

    expect(mockPush).toHaveBeenCalledWith('/admin/rbac/roles/role-1');
  });

  it('provides clone action for non-system roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Manager')).toBeInTheDocument();
    });

    const cloneButtons = screen.getAllByRole('button', { name: /clone/i });
    expect(cloneButtons.length).toBeGreaterThan(0);
  });

  it('does not show delete action for system roles', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    // Find Owner role card
    const ownerCard = screen.getByText('Owner').closest('[data-testid="role-card"]');

    // Should not have delete button for system role
    if (ownerCard) {
      const deleteButton = within(ownerCard).queryByRole('button', { name: /delete/i });
      expect(deleteButton).not.toBeInTheDocument();
    }
  });

  it('filters roles by search query', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search roles/i);
    await user.type(searchInput, 'manager');

    await waitFor(() => {
      expect(screen.getByText('Manager')).toBeInTheDocument();
      expect(screen.queryByText('Owner')).not.toBeInTheDocument();
      expect(screen.queryByText('Viewer')).not.toBeInTheDocument();
    });
  });

  it('displays role statistics summary', async () => {
    render(<RolesPage />);

    await waitFor(() => {
      expect(screen.getByText('3 roles')).toBeInTheDocument();
      expect(screen.getByText('22 total users')).toBeInTheDocument(); // 2 + 5 + 15
    });
  });
});
