'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Search, UserPlus, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import type { SelectOption } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import InviteUserModal from '@/components/users/InviteUserModal';
import ChangeRoleModal from '@/components/users/ChangeRoleModal';
import DeactivateUserModal from '@/components/users/DeactivateUserModal';
import ReactivateUserModal from '@/components/users/ReactivateUserModal';
import DeleteUserModal from '@/components/users/DeleteUserModal';
import { useRBAC } from '@/contexts/RBACContext';
import { listUsers } from '@/lib/api/users';
import type { MembershipItem, MembershipStatus, ListUsersParams } from '@/lib/types/users';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusBadgeVariant: Record<MembershipStatus, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  INACTIVE: 'neutral',
};

const statusLabel: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Invited',
  INACTIVE: 'Inactive',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Returns a display name for a user reference.
 * If the user object is null (soft-deleted), returns '[Deactivated User]'.
 * Used for invited_by, assigned_by, and any other user FK references.
 */
function displayUserName(user: { first_name: string; last_name: string } | null): string {
  if (!user) return '[Deactivated User]';
  return `${user.first_name} ${user.last_name}`;
}

const statusFilterOptions: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Inactive' },
];

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function UsersListPage() {
  const [members, setMembers] = useState<MembershipItem[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | ''>('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Action modal state
  const { hasRole } = useRBAC();
  const [selectedMember, setSelectedMember] = useState<MembershipItem | null>(null);
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params: ListUsersParams = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const response = await listUsers(params);
      setMembers(response.data);
      setMeta(response.meta);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as Record<string, unknown>).message)
            : 'Failed to load users';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as MembershipStatus | '');
    setPage(1);
  };

  // -----------------------------------------------------------------------
  // Client-side search filtering (backend has no search param)
  // -----------------------------------------------------------------------

  const filteredMembers = members.filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    );
  });

  // -----------------------------------------------------------------------
  // Pagination helpers
  // -----------------------------------------------------------------------

  const goToNextPage = () => setPage((p) => Math.min(p + 1, meta.total_pages));
  const goToPrevPage = () => setPage((p) => Math.max(p - 1, 1));

  const showingFrom = meta.total === 0 ? 0 : (page - 1) * meta.limit + 1;
  const showingTo = Math.min(page * meta.limit, meta.total);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
            <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:underline">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/settings/profile" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium hover:underline">
              Settings
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">Users</span>
          </div>

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Team Members</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage your team&apos;s access and roles
              </p>
            </div>
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="w-4 h-4" />
              Invite User
            </Button>
          </div>

          {/* Filters row */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search input */}
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-5 h-5" />}
                />
              </div>

              {/* Status dropdown */}
              <div className="sm:w-48">
                <Select
                  options={statusFilterOptions}
                  value={statusFilter}
                  onChange={handleStatusFilterChange}
                  placeholder="All Statuses"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <LoadingSpinner centered />
          ) : filteredMembers.length === 0 ? (
            /* Empty state */
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {searchQuery || statusFilter ? 'No team members found' : 'No team members yet'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {searchQuery || statusFilter
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Invite your first team member to get started.'}
                </p>
                {!searchQuery && !statusFilter && (
                  <Button size="sm" onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4" />
                    Invite User
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Joined
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Invited By
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {member.first_name} {member.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{member.email}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="info">{member.role.name}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant={statusBadgeVariant[member.status]}>
                            {statusLabel[member.status]}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(member.joined_at)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {displayUserName(member.invited_by)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {member.status !== 'INACTIVE' && (
                              <button
                                type="button"
                                onClick={() => { setSelectedMember(member); setShowChangeRoleModal(true); }}
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                Change Role
                              </button>
                            )}
                            {member.status === 'ACTIVE' && (
                              <button
                                type="button"
                                onClick={() => { setSelectedMember(member); setShowDeactivateModal(true); }}
                                className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline font-medium"
                              >
                                Deactivate
                              </button>
                            )}
                            {member.status === 'INACTIVE' && (
                              <button
                                type="button"
                                onClick={() => { setSelectedMember(member); setShowReactivateModal(true); }}
                                className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                              >
                                Reactivate
                              </button>
                            )}
                            {hasRole('Owner') && (
                              <button
                                type="button"
                                onClick={() => { setSelectedMember(member); setShowDeleteModal(true); }}
                                className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {member.first_name} {member.last_name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="info">{member.role.name}</Badge>
                      <Badge variant={statusBadgeVariant[member.status]}>
                        {statusLabel[member.status]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Joined: </span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {formatDate(member.joined_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Invited by: </span>
                        <span className="text-gray-900 dark:text-gray-100 font-medium">
                          {displayUserName(member.invited_by)}
                        </span>
                      </div>
                    </div>

                    {/* Mobile action buttons */}
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      {member.status !== 'INACTIVE' && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMember(member); setShowChangeRoleModal(true); }}
                          className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Change Role
                        </button>
                      )}
                      {member.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMember(member); setShowDeactivateModal(true); }}
                          className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline font-medium"
                        >
                          Deactivate
                        </button>
                      )}
                      {member.status === 'INACTIVE' && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMember(member); setShowReactivateModal(true); }}
                          className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                        >
                          Reactivate
                        </button>
                      )}
                      {hasRole('Owner') && (
                        <button
                          type="button"
                          onClick={() => { setSelectedMember(member); setShowDeleteModal(true); }}
                          className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {meta.total_pages > 1 && (
                <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 px-4 py-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      Showing <span className="font-semibold">{showingFrom}</span> to{' '}
                      <span className="font-semibold">{showingTo}</span> of{' '}
                      <span className="font-semibold">{meta.total}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={goToPrevPage}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                        Page {page} of {meta.total_pages}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={page >= meta.total_pages}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Invite User Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => fetchUsers()}
      />

      {/* Action Modals */}
      <ChangeRoleModal
        isOpen={showChangeRoleModal}
        onClose={() => { setShowChangeRoleModal(false); setSelectedMember(null); }}
        onSuccess={() => fetchUsers()}
        member={selectedMember}
      />
      <DeactivateUserModal
        isOpen={showDeactivateModal}
        onClose={() => { setShowDeactivateModal(false); setSelectedMember(null); }}
        onSuccess={() => fetchUsers()}
        member={selectedMember}
      />
      <ReactivateUserModal
        isOpen={showReactivateModal}
        onClose={() => { setShowReactivateModal(false); setSelectedMember(null); }}
        onSuccess={() => fetchUsers()}
        member={selectedMember}
      />
      <DeleteUserModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedMember(null); }}
        onSuccess={() => fetchUsers()}
        member={selectedMember}
      />
    </ProtectedRoute>
  );
}
