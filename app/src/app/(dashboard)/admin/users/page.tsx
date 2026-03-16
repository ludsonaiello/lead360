// ============================================================================
// Platform Admin — Users List Page
// ============================================================================
// Cross-tenant user list with search, status filter, tenant filter (via URL
// query param), pagination, and Create User flow.
// Protected by platform_admin:view_all_tenants permission.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserPlus,
  Building2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import AdminCreateUserModal from '@/components/admin/users/AdminCreateUserModal';
import { adminListUsers } from '@/lib/api/users';
import { getAllTenants } from '@/lib/api/admin';
import type { AdminUserListItem, AdminUserListParams, PaginationMeta } from '@/lib/types/users';
import type { TenantListItem } from '@/lib/api/admin';
import toast from 'react-hot-toast';

// ============================================================================
// Status Badge Helper
// ============================================================================

function getUserStatusBadge(user: AdminUserListItem) {
  if (user.is_platform_admin) {
    return <Badge variant="purple">Platform Admin</Badge>;
  }
  return user.is_active
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="neutral">Inactive</Badge>;
}

// ============================================================================
// Date Formatter
// ============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid date';
  }
}

// ============================================================================
// Status Filter Options
// ============================================================================

type StatusFilter = '' | 'active' | 'inactive' | 'deleted';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'deleted', label: 'Deleted' },
];

// ============================================================================
// Skeleton Row Component
// ============================================================================

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-48 mt-2" />
      </td>
      <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
      </td>
      <td className="hidden lg:table-cell px-4 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28" />
      </td>
      <td className="hidden sm:table-cell px-4 py-4 whitespace-nowrap">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
      </td>
      <td className="hidden xl:table-cell px-4 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </td>
    </tr>
  );
}

// ============================================================================
// Inner Component (uses useSearchParams)
// ============================================================================

function AdminUsersPageInner() {
  const searchParams = useSearchParams();
  const urlTenantId = searchParams.get('tenant_id') || '';

  // State
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [tenantIdFilter, setTenantIdFilter] = useState(urlTenantId);
  const [tenantFilterName, setTenantFilterName] = useState('');

  // Create User modal states
  const [showSelectTenantModal, setShowSelectTenantModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createTenantId, setCreateTenantId] = useState('');
  const [createTenantName, setCreateTenantName] = useState('');
  const [tenants, setTenants] = useState<{ id: string; company_name: string }[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // Resolve tenant name for the filter banner
  useEffect(() => {
    if (tenantIdFilter && !tenantFilterName) {
      getAllTenants({ limit: 100 }).then((res) => {
        const match = res.data.find((t: TenantListItem) => t.id === tenantIdFilter);
        if (match) setTenantFilterName(match.company_name);
      }).catch(() => {
        // Silently fail — the filter still works, just without the name
      });
    }
  }, [tenantIdFilter, tenantFilterName]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset to page 1 when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, tenantIdFilter]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: AdminUserListParams = { page, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (tenantIdFilter) params.tenant_id = tenantIdFilter;
      const response = await adminListUsers(params);
      setUsers(response.data);
      setPagination(response.pagination);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load users';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, tenantIdFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Pagination handlers
  const goToPreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const goToNextPage = () => {
    if (page < pagination.total_pages) setPage(page + 1);
  };

  // Clear tenant filter
  const clearTenantFilter = () => {
    setTenantIdFilter('');
    setTenantFilterName('');
    // Update URL without tenant_id param
    const url = new URL(window.location.href);
    url.searchParams.delete('tenant_id');
    window.history.replaceState({}, '', url.toString());
  };

  // Fetch tenants for the select tenant modal
  useEffect(() => {
    if (showSelectTenantModal) {
      setLoadingTenants(true);
      setSelectedTenantId('');
      getAllTenants({ limit: 100 })
        .then((res) => {
          setTenants(
            res.data
              .filter((t: TenantListItem) => !t.deleted_at)
              .map((t: TenantListItem) => ({ id: t.id, company_name: t.company_name }))
          );
        })
        .catch(() => {
          toast.error('Failed to load tenants');
        })
        .finally(() => setLoadingTenants(false));
    }
  }, [showSelectTenantModal]);

  // Handle tenant selection confirm
  const handleTenantSelected = () => {
    const selected = tenants.find((t) => t.id === selectedTenantId);
    if (!selected) return;
    setCreateTenantId(selected.id);
    setCreateTenantName(selected.company_name);
    setShowSelectTenantModal(false);
    setShowCreateUserModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            User Accounts
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            View and manage all users across all tenants
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowSelectTenantModal(true)}
        >
          <UserPlus className="w-4 h-4" />
          Create User
        </Button>
      </div>

      {/* Active tenant filter banner */}
      {tenantIdFilter && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Building2 className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Filtered by tenant: <span className="font-semibold">{tenantFilterName || tenantIdFilter}</span>
          </span>
          <button
            onClick={clearTenantFilter}
            className="ml-auto text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            title="Clear tenant filter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              transition-all duration-200"
          />
        </div>

        {/* Status Filter */}
        <div className="relative sm:w-48">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              transition-all duration-200 appearance-none cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results summary */}
      {!loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {users.length} of {pagination.total} user{pagination.total !== 1 ? 's' : ''}
          {debouncedSearch && (
            <span> matching &ldquo;<span className="font-medium text-gray-700 dark:text-gray-300">{debouncedSearch}</span>&rdquo;</span>
          )}
          {statusFilter && (
            <span> with status <span className="font-medium text-gray-700 dark:text-gray-300">{statusFilter}</span></span>
          )}
        </p>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="hidden md:table-cell px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="hidden lg:table-cell px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Tenant
                </th>
                <th scope="col" className="hidden sm:table-cell px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role(s)
                </th>
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="hidden xl:table-cell px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Login
                </th>
                <th scope="col" className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Loading skeleton */}
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {/* Empty state */}
              {!loading && users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
                    <p className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      No users found
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {debouncedSearch || statusFilter || tenantIdFilter
                        ? 'Try adjusting your search or filter criteria.'
                        : 'No users exist in the system yet.'}
                    </p>
                  </td>
                </tr>
              )}

              {/* User rows */}
              {!loading && users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {/* Name (+ email on mobile) */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user.first_name} {user.last_name}
                    </div>
                    <div className="md:hidden text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {user.email}
                    </div>
                    {/* Show tenant on mobile when hidden from dedicated column */}
                    <div className="lg:hidden text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {user.tenant_company_name || 'No Tenant'}
                    </div>
                  </td>

                  {/* Email (hidden on mobile) */}
                  <td className="hidden md:table-cell px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {user.email}
                    </span>
                  </td>

                  {/* Tenant (hidden on small screens) */}
                  <td className="hidden lg:table-cell px-4 py-4 whitespace-nowrap">
                    {user.tenant_company_name ? (
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user.tenant_company_name}
                      </span>
                    ) : (
                      <Badge variant="gray">No Tenant</Badge>
                    )}
                  </td>

                  {/* Roles */}
                  <td className="hidden sm:table-cell px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="blue">{role}</Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">No roles</span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    {getUserStatusBadge(user)}
                  </td>

                  {/* Last Login (hidden on smaller screens) */}
                  <td className="hidden xl:table-cell px-4 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(user.last_login_at)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && pagination.total_pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-white dark:bg-gray-800">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {pagination.total_pages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={goToPreviousPage}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg
                  border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                  hover:bg-gray-50 dark:hover:bg-gray-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={goToNextPage}
                disabled={page >= pagination.total_pages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg
                  border border-gray-300 dark:border-gray-600
                  text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                  hover:bg-gray-50 dark:hover:bg-gray-600
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Select Tenant Modal */}
      <Modal
        isOpen={showSelectTenantModal}
        onClose={() => setShowSelectTenantModal(false)}
        title="Select Tenant"
        size="md"
      >
        <ModalContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Choose the tenant where you want to create a new user.
          </p>

          {loadingTenants ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Loading tenants...</span>
            </div>
          ) : (
            <div>
              <label
                htmlFor="select-tenant-dropdown"
                className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
              >
                Tenant <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              </label>
              <select
                id="select-tenant-dropdown"
                className="w-full rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200"
                value={selectedTenantId}
                onChange={(e) => setSelectedTenantId(e.target.value)}
              >
                <option value="">Select a tenant...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </ModalContent>

        <ModalActions>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSelectTenantModal(false)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleTenantSelected}
            disabled={!selectedTenantId || loadingTenants}
          >
            Continue
          </Button>
        </ModalActions>
      </Modal>

      {/* Create User Modal */}
      <AdminCreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={fetchUsers}
        tenantId={createTenantId}
        tenantName={createTenantName}
      />
    </div>
  );
}

// ============================================================================
// Main Page Component (with Suspense boundary for useSearchParams)
// ============================================================================

export default function AdminUsersPage() {
  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <Suspense fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              User Accounts
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              View and manage all users across all tenants
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      }>
        <AdminUsersPageInner />
      </Suspense>
    </ProtectedRoute>
  );
}
