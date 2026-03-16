// ============================================================================
// Platform Admin — User Detail Page
// ============================================================================
// Full user profile view with action buttons (Reset Password, Deactivate/
// Activate, Delete). Protected by platform_admin:view_all_tenants permission.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  User,
  CheckCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { adminGetUser } from '@/lib/api/users';
import type { AdminUserDetail } from '@/lib/types/users';
import toast from 'react-hot-toast';

import AdminResetPasswordModal from '@/components/admin/users/AdminResetPasswordModal';
import AdminDeactivateModal from '@/components/admin/users/AdminDeactivateModal';
import AdminActivateModal from '@/components/admin/users/AdminActivateModal';
import AdminDeleteUserModal from '@/components/admin/users/AdminDeleteUserModal';

// ============================================================================
// Date Formatter
// ============================================================================

function formatDate(dateStr: string | null | undefined): string {
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
// Status Badge
// ============================================================================

function getStatusBadge(user: AdminUserDetail) {
  if (user.is_platform_admin) {
    return <Badge variant="purple">Platform Admin</Badge>;
  }
  return user.is_active
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="neutral">Inactive</Badge>;
}

// ============================================================================
// Info Row Component
// ============================================================================

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function InfoRow({ icon, label, children }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {label}
        </p>
        <div className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Skeleton Loader
// ============================================================================

function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
      </div>

      {/* Cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  // State
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch user data
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminGetUser(userId);
      setUserDetail(data);
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'message' in error
        ? (error as { message: string }).message
        : 'User not found';
      toast.error(message);
      router.push('/admin/users');
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (userId) {
      fetchUser();
    }
  }, [userId, fetchUser]);

  const fullName = userDetail
    ? `${userDetail.first_name} ${userDetail.last_name}`
    : '';

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="mb-6">
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Users
            </Link>
          </nav>

          {/* Loading state */}
          {loading && <DetailSkeleton />}

          {/* User detail content */}
          {!loading && userDetail && (
            <div className="space-y-6">
              {/* Header: Name + Status + Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {fullName}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {userDetail.email}
                    </p>
                  </div>
                  <div className="ml-2">
                    {getStatusBadge(userDetail)}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowResetPasswordModal(true)}
                  >
                    Reset Password
                  </Button>

                  {userDetail.is_active ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowDeactivateModal(true)}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowActivateModal(true)}
                    >
                      Activate
                    </Button>
                  )}

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {/* Profile Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Profile Information
                </h2>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <InfoRow icon={<Mail className="h-4 w-4" />} label="Email">
                    {userDetail.email}
                  </InfoRow>

                  <InfoRow icon={<Phone className="h-4 w-4" />} label="Phone">
                    {userDetail.phone || (
                      <span className="text-gray-400 dark:text-gray-500 italic">Not provided</span>
                    )}
                  </InfoRow>

                  <InfoRow icon={<CheckCircle className="h-4 w-4" />} label="Email Verified">
                    {userDetail.email_verified ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="warning">No</Badge>
                    )}
                  </InfoRow>

                  <InfoRow icon={<ShieldCheck className="h-4 w-4" />} label="Platform Admin">
                    {userDetail.is_platform_admin ? (
                      <Badge variant="purple">Yes</Badge>
                    ) : (
                      <Badge variant="neutral">No</Badge>
                    )}
                  </InfoRow>

                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Account Created">
                    {formatDate(userDetail.created_at)}
                  </InfoRow>
                </div>
              </div>

              {/* Tenant & Roles Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Tenant & Roles
                </h2>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <InfoRow icon={<Building2 className="h-4 w-4" />} label="Tenant">
                    {userDetail.tenant ? (
                      <div>
                        <span className="font-medium">{userDetail.tenant.company_name}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          ({userDetail.tenant.subdomain})
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">No Tenant</span>
                    )}
                  </InfoRow>

                  <InfoRow icon={<Shield className="h-4 w-4" />} label="Roles">
                    {userDetail.roles.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {userDetail.roles.map((role) => (
                          <div key={role.id} className="flex flex-col">
                            <Badge variant="blue">{role.name}</Badge>
                            {role.description && (
                              <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 ml-1">
                                {role.description}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500 italic">No roles assigned</span>
                    )}
                  </InfoRow>
                </div>

                {userDetail.tenant && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={`/admin/users?tenant_id=${userDetail.tenant.id}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all users in {userDetail.tenant.company_name}
                    </Link>
                  </div>
                )}
              </div>

              {/* Activity Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Activity
                </h2>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  <InfoRow icon={<Clock className="h-4 w-4" />} label="Last Login">
                    {formatDate(userDetail.last_login_at)}
                  </InfoRow>

                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Created">
                    {formatDate(userDetail.created_at)}
                  </InfoRow>

                  <InfoRow icon={<Calendar className="h-4 w-4" />} label="Last Updated">
                    {formatDate(userDetail.updated_at)}
                  </InfoRow>
                </div>
              </div>
            </div>
          )}

          {/* Not found state */}
          {!loading && !userDetail && (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
              <p className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                User not found
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                The user you are looking for does not exist or has been removed.
              </p>
              <Link
                href="/admin/users"
                className="mt-4 inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Users
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AdminResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        onSuccess={fetchUser}
        user={userDetail}
      />

      <AdminDeactivateModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onSuccess={fetchUser}
        user={userDetail}
      />

      <AdminActivateModal
        isOpen={showActivateModal}
        onClose={() => setShowActivateModal(false)}
        onSuccess={fetchUser}
        user={userDetail}
      />

      <AdminDeleteUserModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        user={userDetail}
      />
    </ProtectedRoute>
  );
}
