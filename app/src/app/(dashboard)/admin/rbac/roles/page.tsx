// ============================================================================
// Roles List Page
// ============================================================================
// List all roles with search, filtering, and actions.
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { RoleWithPermissions } from '@/lib/types/rbac';
import RoleList from '@/components/rbac/role-management/RoleList';
import CloneRoleModal from '@/components/rbac/role-management/CloneRoleModal';
import DeleteRoleModal from '@/components/rbac/role-management/DeleteRoleModal';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import * as rbacApi from '@/lib/api/rbac';
import toast from 'react-hot-toast';

export default function RolesPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<RoleWithPermissions | null>(null);
  const [cloneModalOpen, setCloneModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  /**
   * Load all roles
   */
  const loadRoles = async () => {
    setLoading(true);
    try {
      const rolesData = await rbacApi.getAllRoles();
      setRoles(rolesData);
    } catch (err) {
      console.error('[RolesPage] Failed to load roles:', err);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
  }, []);

  /**
   * Handle edit role
   */
  const handleEdit = (roleId: string) => {
    router.push(`/admin/rbac/roles/${roleId}`);
  };

  /**
   * Handle clone role
   */
  const handleClone = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      setCloneModalOpen(true);
    }
  };

  /**
   * Handle delete role
   */
  const handleDelete = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    if (role) {
      setSelectedRole(role);
      setDeleteModalOpen(true);
    }
  };

  /**
   * Handle create new role
   */
  const handleCreate = () => {
    router.push('/admin/rbac/roles/new');
  };

  return (
    <ProtectedRoute requiredPermission="rbac:view">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Roles
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage roles and their permissions
          </p>
        </div>

        {/* Role List */}
        <RoleList
          roles={roles}
          loading={loading}
          onEdit={handleEdit}
          onClone={handleClone}
          onDelete={handleDelete}
          onCreate={handleCreate}
        />

        {/* Clone Modal */}
        {selectedRole && (
          <CloneRoleModal
            role={selectedRole}
            isOpen={cloneModalOpen}
            onClose={() => {
              setCloneModalOpen(false);
              setSelectedRole(null);
            }}
            onSuccess={() => {
              setCloneModalOpen(false);
              setSelectedRole(null);
              loadRoles();
            }}
          />
        )}

        {/* Delete Modal */}
        {selectedRole && (
          <DeleteRoleModal
            role={selectedRole}
            isOpen={deleteModalOpen}
            onClose={() => {
              setDeleteModalOpen(false);
              setSelectedRole(null);
            }}
            onSuccess={() => {
              setDeleteModalOpen(false);
              setSelectedRole(null);
              loadRoles();
            }}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
