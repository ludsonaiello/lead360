'use client';

/**
 * Disputes Management Page — /workforce/disputes (Sprint 9, time-clock)
 * Admin view for reviewing, approving, and rejecting employee time disputes.
 * Features: tab navigation, employee/status filters, paginated table,
 * detail slide-over, approve/reject flows with modals.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Flag,
  Inbox,
  ListFilter,
  Pencil,
  RefreshCw,
  User,
  X,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { SkeletonTable } from '@/components/ui/Skeleton';

import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { LoadFailure } from '@/components/time-clock/LoadFailure';

import {
  listDisputes,
  getDispute,
  approveDispute,
  rejectDispute,
  listEmployeeProfiles,
} from '@/lib/api/time-clock';
import type {
  TimeDispute,
  DisputeStatus,
  DisputeFilterParams,
  EmployeeProfile,
  ClockSessionEditLog,
  BreakEntry,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const DISPUTE_TABS: TabItem[] = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'all', label: 'All', icon: ListFilter },
  { id: 'approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'rejected', label: 'Rejected', icon: XCircle },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'resolved', label: 'Resolved' },
];

const STATUS_BADGE_MAP: Record<string, { variant: 'amber' | 'success' | 'danger' | 'neutral'; label: string }> = {
  pending: { variant: 'amber', label: 'Pending' },
  approved: { variant: 'success', label: 'Approved' },
  rejected: { variant: 'danger', label: 'Rejected' },
  resolved: { variant: 'neutral', label: 'Resolved' },
};

const TYPE_BADGE_MAP: Record<string, { variant: 'info' | 'warning'; label: string }> = {
  flag_only: { variant: 'warning', label: 'Flag Only' },
  correction_request: { variant: 'info', label: 'Correction Request' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return format(parseISO(iso), 'MMM d, yyyy h:mm a');
  } catch {
    return '\u2014';
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return format(parseISO(iso), 'h:mm a');
  } catch {
    return '\u2014';
  }
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return '\u2014';
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

function employeeFullName(dispute: TimeDispute): string {
  const profile = dispute.clock_session?.employee_profile;
  const user = profile?.user;
  if (user) return `${user.first_name} ${user.last_name}`;
  const submitter = dispute.submitted_by;
  if (submitter) return `${submitter.first_name} ${submitter.last_name}`;
  return 'Unknown';
}

function extractApiErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message);
  }
  return 'An unexpected error occurred';
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DisputesPage() {
  usePageTitle('Disputes — Time Clock');
  const router = useRouter();
  const { hasPermission, hasRole, loading: rbacLoading } = useRBAC();

  // -- State: list & filters
  const [disputes, setDisputes] = useState<TimeDispute[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pending');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // -- State: employee dropdown
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  // -- State: detail
  const [selectedDispute, setSelectedDispute] = useState<TimeDispute | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // -- State: approve modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [approving, setApproving] = useState(false);

  // -- State: reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // RBAC gate
  const canReviewDisputes = hasPermission('timeclock:review_disputes') || hasRole(['Owner', 'Admin']);

  // -- Employee options for filter
  const employeeOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: 'All Employees' }];
    employees.forEach((ep) => {
      const name = ep.user ? `${ep.user.first_name} ${ep.user.last_name}` : `Employee ${ep.id.slice(0, 8)}`;
      opts.push({ value: ep.id, label: name });
    });
    return opts;
  }, [employees]);

  // -- Computed status from tab (tab overrides status filter)
  const effectiveStatus: DisputeStatus | undefined = useMemo(() => {
    if (activeTab !== 'all') return activeTab as DisputeStatus;
    if (statusFilter) return statusFilter as DisputeStatus;
    return undefined;
  }, [activeTab, statusFilter]);

  // -- Fetch employees for filter dropdown
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listEmployeeProfiles({ limit: 100, is_active: true });
        if (!cancelled) setEmployees(res.data);
      } catch {
        // Silent — employee dropdown is optional
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // -- Fetch disputes
  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const params: DisputeFilterParams = {
        page,
        limit: PAGE_SIZE,
      };
      if (effectiveStatus) params.status = effectiveStatus;
      if (employeeFilter) params.employee_profile_id = employeeFilter;

      const res = await listDisputes(params);
      setDisputes(res.data);
      setTotalPages(res.meta.totalPages);
      setLoadError(null);
    } catch (err) {
      const message = extractApiErrorMessage(err);
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, effectiveStatus, employeeFilter]);

  // Single effect — fires once whenever page, status, or employee changes
  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  // -- Filter change handlers (reset page to 1 inline)
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const handleEmployeeFilterChange = useCallback((val: string) => {
    setEmployeeFilter(val);
    setPage(1);
  }, []);

  // -- Open dispute detail
  const openDetail = useCallback(async (disputeId: string) => {
    setDetailLoading(true);
    setShowDetail(true);
    try {
      const detail = await getDispute(disputeId);
      setSelectedDispute(detail);
    } catch (err) {
      toast.error(extractApiErrorMessage(err));
      setShowDetail(false);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setShowDetail(false);
    setSelectedDispute(null);
  }, []);

  // -- Approve flow
  const handleApproveClick = useCallback(() => {
    setApproveNotes('');
    setShowApproveModal(true);
  }, []);

  const handleApproveConfirm = useCallback(async () => {
    if (!selectedDispute) return;
    setApproving(true);
    try {
      const updated = await approveDispute(selectedDispute.id, {
        review_notes: approveNotes.trim() || undefined,
      });
      setSelectedDispute(updated);
      setShowApproveModal(false);
      toast.success('Dispute approved successfully');
      fetchDisputes();
    } catch (err) {
      toast.error(extractApiErrorMessage(err));
    } finally {
      setApproving(false);
    }
  }, [selectedDispute, approveNotes, fetchDisputes]);

  // -- Reject flow
  const handleRejectClick = useCallback(() => {
    setRejectNotes('');
    setShowRejectModal(true);
  }, []);

  const handleRejectConfirm = useCallback(async () => {
    if (!selectedDispute || !rejectNotes.trim()) return;
    setRejecting(true);
    try {
      const updated = await rejectDispute(selectedDispute.id, {
        review_notes: rejectNotes.trim(),
      });
      setSelectedDispute(updated);
      setShowRejectModal(false);
      toast.success('Dispute rejected');
      fetchDisputes();
    } catch (err) {
      toast.error(extractApiErrorMessage(err));
    } finally {
      setRejecting(false);
    }
  }, [selectedDispute, rejectNotes, fetchDisputes]);

  // -- RBAC guard
  if (!rbacLoading && !canReviewDisputes) {
    router.replace('/forbidden');
    return null;
  }

  return (
    <div className="min-h-screen">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Workforce', href: '/workforce/clock' },
          { label: 'Disputes' },
        ]}
        showHome
        className="mb-6"
      />

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Disputes Management
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review and manage employee time clock disputes
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchDisputes}
          disabled={loading}
          className="self-start sm:self-auto"
          aria-label="Refresh disputes"
        >
          <RefreshCw
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={DISPUTE_TABS}
        activeTab={activeTab}
        onChange={handleTabChange}
        className="mb-6"
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end mb-6">
        <div className="flex-1 max-w-xs">
          <Select
            label="Employee"
            options={employeeOptions}
            value={employeeFilter}
            onChange={handleEmployeeFilterChange}
            placeholder="All Employees"
            searchable
            disabled={employeesLoading}
          />
        </div>
        {activeTab === 'all' && (
          <div className="flex-1 max-w-xs">
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              placeholder="All Statuses"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {loadError && disputes.length === 0 ? (
        <LoadFailure
          message={loadError}
          onRetry={() => void fetchDisputes()}
          retrying={loading}
        />
      ) : loading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : disputes.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            No disputes found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {activeTab === 'pending'
              ? 'There are no pending disputes to review at this time.'
              : 'No disputes match the current filters.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Employee</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Session Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Submitted</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {disputes.map((d) => {
                    const statusBadge = STATUS_BADGE_MAP[d.status] ?? { variant: 'neutral' as const, label: d.status };
                    const typeBadge = TYPE_BADGE_MAP[d.dispute_type] ?? { variant: 'neutral' as const, label: d.dispute_type };
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        onClick={() => openDetail(d.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[160px]">
                              {employeeFullName(d)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(d.clock_session?.clock_in_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={typeBadge.variant}
                            label={typeBadge.label}
                            icon={d.dispute_type === 'flag_only' ? Flag : Pencil}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusBadge.variant} label={statusBadge.label} />
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(d.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetail(d.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="sr-only">View</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {disputes.map((d) => {
              const statusBadge = STATUS_BADGE_MAP[d.status] ?? { variant: 'neutral' as const, label: d.status };
              const typeBadge = TYPE_BADGE_MAP[d.dispute_type] ?? { variant: 'neutral' as const, label: d.dispute_type };
              return (
                <button
                  key={d.id}
                  type="button"
                  className="w-full text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  onClick={() => openDetail(d.id)}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {employeeFullName(d)}
                      </span>
                    </div>
                    <Badge variant={statusBadge.variant} label={statusBadge.label} />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge
                      variant={typeBadge.variant}
                      label={typeBadge.label}
                      icon={d.dispute_type === 'flag_only' ? Flag : Pencil}
                    />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(d.clock_session?.clock_in_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(d.created_at)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                onGoToPage={setPage}
              />
            </div>
          )}
        </>
      )}

      {/* ================================================================ */}
      {/* Dispute Detail Slide-Over Modal                                  */}
      {/* ================================================================ */}
      <Modal
        isOpen={showDetail}
        onClose={closeDetail}
        title="Dispute Details"
        size="xl"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading dispute details...</p>
            </div>
          </div>
        ) : selectedDispute ? (
          <ModalContent>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              {/* Header: status + type badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={STATUS_BADGE_MAP[selectedDispute.status]?.variant ?? 'neutral'}
                  label={STATUS_BADGE_MAP[selectedDispute.status]?.label ?? selectedDispute.status}
                />
                <Badge
                  variant={TYPE_BADGE_MAP[selectedDispute.dispute_type]?.variant ?? 'neutral'}
                  label={TYPE_BADGE_MAP[selectedDispute.dispute_type]?.label ?? selectedDispute.dispute_type}
                  icon={selectedDispute.dispute_type === 'flag_only' ? Flag : Pencil}
                />
              </div>

              {/* Employee info */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Employee
                </h4>
                <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {employeeFullName(selectedDispute)}
                    </p>
                    {selectedDispute.clock_session?.employee_profile?.user?.email && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {selectedDispute.clock_session.employee_profile.user.email}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Session info */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Session Information
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Clock In</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDateTime(selectedDispute.clock_session?.clock_in_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Clock Out</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDateTime(selectedDispute.clock_session?.clock_out_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Duration</span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDuration(selectedDispute.clock_session?.total_worked_minutes)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Status</span>
                      <p className="font-medium text-gray-900 dark:text-white capitalize">
                        {selectedDispute.clock_session?.status ?? '\u2014'}
                      </p>
                    </div>
                    {selectedDispute.clock_session?.project && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Project</span>
                        <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1">
                          <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                          {selectedDispute.clock_session.project.name}
                        </p>
                      </div>
                    )}
                    {selectedDispute.clock_session?.task && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Task</span>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedDispute.clock_session.task.title}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Break entries */}
                  {selectedDispute.clock_session?.break_entries && selectedDispute.clock_session.break_entries.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Breaks</span>
                      <div className="mt-1 space-y-1">
                        {selectedDispute.clock_session.break_entries.map((be: BreakEntry) => (
                          <div key={be.id} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <Badge variant={be.break_type === 'paid' ? 'green' : 'amber'} label={be.break_label || be.break_type} />
                            <span>{formatTime(be.started_at)} - {be.ended_at ? formatTime(be.ended_at) : 'Ongoing'}</span>
                            {be.duration_minutes != null && (
                              <span className="text-gray-400">({be.duration_minutes}m)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Dispute description */}
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                  Dispute Description
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap leading-relaxed">
                    {selectedDispute.description}
                  </p>
                </div>
              </section>

              {/* Proposed corrections (only for correction_request) */}
              {selectedDispute.dispute_type === 'correction_request' && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Proposed Corrections
                  </h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800 space-y-2 text-sm">
                    {selectedDispute.proposed_clock_in_at && (
                      <div className="flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-gray-500 dark:text-gray-400">Clock In:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDateTime(selectedDispute.proposed_clock_in_at)}
                        </span>
                      </div>
                    )}
                    {selectedDispute.proposed_clock_out_at && (
                      <div className="flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-gray-500 dark:text-gray-400">Clock Out:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDateTime(selectedDispute.proposed_clock_out_at)}
                        </span>
                      </div>
                    )}
                    {selectedDispute.proposed_notes && (
                      <div className="flex items-start gap-2">
                        <FileText className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                        <span className="text-gray-500 dark:text-gray-400">Notes:</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {selectedDispute.proposed_notes}
                        </span>
                      </div>
                    )}
                    {!selectedDispute.proposed_clock_in_at &&
                     !selectedDispute.proposed_clock_out_at &&
                     !selectedDispute.proposed_notes && (
                      <p className="text-gray-500 dark:text-gray-400 italic">No proposed corrections provided.</p>
                    )}
                  </div>
                </section>
              )}

              {/* Review info (for already-reviewed disputes) */}
              {selectedDispute.status !== 'pending' && selectedDispute.reviewed_by && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Review Details
                  </h4>
                  <div className={`rounded-lg p-3 border ${
                    selectedDispute.status === 'approved'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : selectedDispute.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {selectedDispute.status === 'approved' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedDispute.status === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                        {selectedDispute.reviewed_by.first_name} {selectedDispute.reviewed_by.last_name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {formatDateTime(selectedDispute.reviewed_at)}
                    </p>
                    {selectedDispute.review_notes && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-white/50 dark:bg-gray-800/50 rounded p-2">
                        {selectedDispute.review_notes}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Edit logs (if approval created edits) */}
              {selectedDispute.clock_session?.edit_logs && selectedDispute.clock_session.edit_logs.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Edit Logs
                  </h4>
                  <div className="space-y-2">
                    {selectedDispute.clock_session.edit_logs.map((log: ClockSessionEditLog) => (
                      <div
                        key={log.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-sm border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {log.field_changed.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Original:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">
                              {log.field_changed.includes('_at')
                                ? formatDateTime(log.original_value)
                                : log.original_value ?? '\u2014'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">New:</span>{' '}
                            <span className="text-gray-700 dark:text-gray-300">
                              {log.field_changed.includes('_at')
                                ? formatDateTime(log.new_value)
                                : log.new_value ?? '\u2014'}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {log.edited_by
                            ? `${log.edited_by.first_name} ${log.edited_by.last_name}`
                            : 'System'}{' '}
                          &middot; {formatDateTime(log.edited_at)}
                        </p>
                        {log.reason && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
                            {log.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Action buttons (only for pending disputes) */}
            {selectedDispute.status === 'pending' && (
              <div className="flex flex-col sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApproveClick}
                  className="flex-1 sm:flex-initial"
                >
                  <Check className="w-4 h-4" />
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleRejectClick}
                  className="flex-1 sm:flex-initial"
                >
                  <X className="w-4 h-4" />
                  Reject
                </Button>
              </div>
            )}
          </ModalContent>
        ) : null}
      </Modal>

      {/* ================================================================ */}
      {/* Approve Confirmation Modal                                       */}
      {/* ================================================================ */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => !approving && setShowApproveModal(false)}
        title="Approve Dispute"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-gray-700 dark:text-gray-300">
                  Are you sure you want to approve this dispute from{' '}
                  <span className="font-semibold">{selectedDispute ? employeeFullName(selectedDispute) : ''}</span>?
                </p>
                {selectedDispute?.dispute_type === 'correction_request' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Approving a correction request will modify the session&apos;s clock times.
                  </p>
                )}
              </div>
            </div>

            <Textarea
              label="Review Notes (optional)"
              placeholder="Add any notes about this approval..."
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              maxLength={2000}
              showCharacterCount
              rows={3}
            />
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowApproveModal(false)} disabled={approving}>
            Cancel
          </Button>
          <Button onClick={handleApproveConfirm} loading={approving}>
            <Check className="w-4 h-4" />
            Approve Dispute
          </Button>
        </ModalActions>
      </Modal>

      {/* ================================================================ */}
      {/* Reject Confirmation Modal                                        */}
      {/* ================================================================ */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => !rejecting && setShowRejectModal(false)}
        title="Reject Dispute"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to reject this dispute from{' '}
                <span className="font-semibold">{selectedDispute ? employeeFullName(selectedDispute) : ''}</span>?
                The employee will see your review notes.
              </p>
            </div>

            <Textarea
              label="Review Notes"
              placeholder="Explain why this dispute is being rejected..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              maxLength={2000}
              showCharacterCount
              rows={3}
              required
              helperText="Required — provide a clear reason so the employee can understand the decision."
            />
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setShowRejectModal(false)} disabled={rejecting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRejectConfirm}
            loading={rejecting}
            disabled={!rejectNotes.trim()}
          >
            <X className="w-4 h-4" />
            Reject Dispute
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
