/**
 * EditUserRolesModal Component Tests
 * Tests for user role assignment functionality
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditUserRolesModal from '../EditUserRolesModal';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

// Mock dependencies
vi.mock('@/lib/api/rbac');
vi.mock('react-hot-toast');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  is_active: true,
  is_email_verified: true,
  tenant_id: 'tenant-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockRoles = [
  {
    id: 'role-1',
    tenant_id: 'tenant-1',
    name: 'Owner',
    description: 'Full system access',
    is_system_role: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-2',
    tenant_id: 'tenant-1',
    name: 'Admin',
    description: 'Administrative access',
    is_system_role: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'role-3',
    tenant_id: 'tenant-1',
    name: 'Manager',
    description: 'Management access',
    is_system_role: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
];

const mockUserRoles = [
  {
    id: 'user-role-1',
    user_id: 'user-1',
    role_id: 'role-2',
    assigned_by: 'admin-1',
    assigned_at: '2024-01-01T00:00:00Z',
  },
];

describe('EditUserRolesModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rbacApi.getAllRoles).mockResolvedValue(mockRoles as any);
    vi.mocked(rbacApi.getUserRoles).mockResolvedValue(mockUserRoles as any);
    vi.mocked(rbacApi.assignRoleToUser).mockResolvedValue(undefined);
    vi.mocked(rbacApi.removeRoleFromUser).mockResolvedValue(undefined);
  });

  it('renders modal when open', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/edit roles for/i)).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('does not render when closed', () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.queryByText(/edit roles for/i)).not.toBeInTheDocument();
  });

  it('loads and displays available roles', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Admin')).toBeInTheDocument();
      expect(screen.getByText('Manager')).toBeInTheDocument();
    });
  });

  it('shows currently assigned roles as checked', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      const adminCheckbox = screen.getByLabelText('Admin');
      expect(adminCheckbox).toBeChecked();

      const ownerCheckbox = screen.getByLabelText('Owner');
      expect(ownerCheckbox).not.toBeChecked();
    });
  });

  it('assigns new role when checkbox is checked', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const ownerCheckbox = screen.getByLabelText('Owner');
    await user.click(ownerCheckbox);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(rbacApi.assignRoleToUser).toHaveBeenCalledWith('user-1', 'role-1');
      expect(toast.success).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('removes role when checkbox is unchecked', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    const adminCheckbox = screen.getByLabelText('Admin');
    expect(adminCheckbox).toBeChecked();

    await user.click(adminCheckbox);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(rbacApi.removeRoleFromUser).toHaveBeenCalledWith('user-1', 'role-2');
      expect(toast.success).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('handles assigning and removing multiple roles', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    // Assign Owner
    const ownerCheckbox = screen.getByLabelText('Owner');
    await user.click(ownerCheckbox);

    // Remove Admin
    const adminCheckbox = screen.getByLabelText('Admin');
    await user.click(adminCheckbox);

    // Assign Manager
    const managerCheckbox = screen.getByLabelText('Manager');
    await user.click(managerCheckbox);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(rbacApi.assignRoleToUser).toHaveBeenCalledWith('user-1', 'role-1');
      expect(rbacApi.assignRoleToUser).toHaveBeenCalledWith('user-1', 'role-3');
      expect(rbacApi.removeRoleFromUser).toHaveBeenCalledWith('user-1', 'role-2');
    });
  });

  it('displays system role badge', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getAllByText('System Role').length).toBeGreaterThan(0);
    });
  });

  it('closes modal on cancel', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(rbacApi.assignRoleToUser).not.toHaveBeenCalled();
    expect(rbacApi.removeRoleFromUser).not.toHaveBeenCalled();
  });

  it('handles API error during save', async () => {
    vi.mocked(rbacApi.assignRoleToUser).mockRejectedValue(new Error('API Error'));

    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const ownerCheckbox = screen.getByLabelText('Owner');
    await user.click(ownerCheckbox);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it('disables save button while submitting', async () => {
    // Make API slow to test loading state
    vi.mocked(rbacApi.assignRoleToUser).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    const ownerCheckbox = screen.getByLabelText('Owner');
    await user.click(ownerCheckbox);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(saveButton).toBeDisabled();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it('displays no changes message when no modifications made', async () => {
    render(
      <EditUserRolesModal
        user={mockUser}
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('No changes to save');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
