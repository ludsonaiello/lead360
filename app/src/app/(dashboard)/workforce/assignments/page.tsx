'use client';

/**
 * Employee-Project Assignments — /workforce/assignments (Sprint 7, time-clock)
 *
 * Lists all `(employee, project)` pairs for the tenant, with filters to slice
 * by employee or project. Used in `specific_addresses` / `active_job_sites`
 * clock-in modes to control which employees can clock into which projects.
 *
 * Endpoints:
 *  • GET    /api/v1/time-clock/employee-projects
 *  • POST   /api/v1/time-clock/employee-projects
 *  • DELETE /api/v1/time-clock/employee-projects/:id
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import {
  AlertCircle,
  Briefcase,
  ChevronLeft,
  Filter,
  Link2,
  RefreshCw,
  Trash2,
  User as UserIcon,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';

import { AssignEmployeeModal } from '@/components/time-clock/AssignEmployeeModal';

import { useAuth } from '@/contexts/AuthContext';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

import {
  deleteEmployeeProject,
  listEmployeeProfiles,
  listEmployeeProjects,
} from '@/lib/api/time-clock';
import { getProjects } from '@/lib/api/projects';
import type {
  EmployeeProfile,
  EmployeeProjectAssignment,
  ListEmployeeProjectsParams,
} from '@/lib/types/time-clock';
import type { Project } from '@/lib/types/projects';

const PAGE_SIZE = 20;

// The axios interceptor rewrites rejected errors to `{ status, message, error,
// data }` at the top level. See src/lib/api/axios.ts response interceptor.
interface ApiErrorShape {
  status?: number;
  message?: string | string[];
  error?: string;
  data?: { message?: string | string[] };
}

function readApiMessage(err: unknown): string | undefined {
  const e = err as ApiErrorShape;
  const raw = e?.message ?? e?.data?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return typeof raw === 'string' ? raw : undefined;
}

function formatEmployeeName(e?: EmployeeProfile): string {
  if (!e?.user) return 'Unknown Employee';
  const name = [e.user.first_name, e.user.last_name].filter(Boolean).join(' ').trim();
  return name || e.user.email || 'Unknown Employee';
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

function AssignmentsPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-10 w-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-6 h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AssignmentsPage() {
  usePageTitle('Assignments — Time Clock');
  const router = useRouter();
  const { isLoading: authLoading } = useAuth();
  const { canPerform, loading: rbacLoading } = useRBAC();
  const canManage = canPerform('timeclock', 'manage_employees');

  const [assignments, setAssignments] = useState<EmployeeProjectAssignment[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [refsReady, setRefsReady] = useState(false);

  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<EmployeeProjectAssignment | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);
  const [successState, setSuccessState] = useState<{ title: string; message: string } | null>(
    null,
  );
  const [errorState, setErrorState] = useState<{ title: string; message: string } | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // RBAC gate
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rbacLoading && !canManage) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canManage, router]);

  // ---------------------------------------------------------------------------
  // Load employees + projects (for filter dropdowns + assign modal)
  // ---------------------------------------------------------------------------
  const loadReferences = useCallback(async () => {
    try {
      const [empRes, projRes] = await Promise.all([
        listEmployeeProfiles({ limit: 100, is_active: true }).catch(() => null),
        getProjects({ limit: 100 }).catch(() => null),
      ]);
      setEmployees(empRes?.data ?? []);
      setProjects(projRes?.data ?? []);
    } catch (err) {
      console.error('[AssignmentsPage] Failed to load references', err);
    } finally {
      setRefsReady(true);
    }
  }, []);

  useEffect(() => {
    if (rbacLoading || !canManage) return;
    loadReferences();
  }, [rbacLoading, canManage, loadReferences]);

  // ---------------------------------------------------------------------------
  // Assignments loader
  // ---------------------------------------------------------------------------
  const loadAssignments = useCallback(async () => {
    if (rbacLoading || !canManage) return;
    setLoading(true);
    setListError(null);
    try {
      const params: ListEmployeeProjectsParams = { page, limit: PAGE_SIZE };
      if (employeeFilter) params.employee_profile_id = employeeFilter;
      if (projectFilter) params.project_id = projectFilter;
      const res = await listEmployeeProjects(params);
      setAssignments(res.data || []);
      setTotalPages(Math.max(1, res.meta?.totalPages ?? 1));
      setTotalRows(res.meta?.total ?? 0);
    } catch (err) {
      console.error('[AssignmentsPage] Failed to load assignments', err);
      setListError(readApiMessage(err) || 'Could not load assignments.');
    } finally {
      setLoading(false);
    }
  }, [rbacLoading, canManage, page, employeeFilter, projectFilter]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const resetFilters = useCallback(() => {
    setEmployeeFilter('');
    setProjectFilter('');
    setPage(1);
  }, []);

  const handleAssignSuccess = useCallback(
    async (info: { employeeName: string; projectName: string }) => {
      setAssignOpen(false);
      setSuccessState({
        title: 'Assignment created',
        message: `${info.employeeName} can now clock in to ${info.projectName}.`,
      });
      setPage(1);
      await loadAssignments();
    },
    [loadAssignments],
  );

  const handleRemoveConfirm = useCallback(async () => {
    if (!pendingRemoval) return;
    setRemoving(true);
    try {
      await deleteEmployeeProject(pendingRemoval.id);
      const name = formatEmployeeName(pendingRemoval.employee_profile);
      const proj = pendingRemoval.project?.name ?? 'the project';
      setPendingRemoval(null);
      setSuccessState({
        title: 'Assignment removed',
        message: `${name} is no longer assigned to ${proj}.`,
      });
      await loadAssignments();
    } catch (err) {
      console.error('[AssignmentsPage] Failed to delete assignment', err);
      setPendingRemoval(null);
      setErrorState({
        title: 'Could not remove assignment',
        message: readApiMessage(err) || 'Please try again in a moment.',
      });
    } finally {
      setRemoving(false);
    }
  }, [pendingRemoval, loadAssignments]);

  // ---------------------------------------------------------------------------
  // Filter option lists
  // ---------------------------------------------------------------------------
  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...employees
        .map((e) => ({ value: e.id, label: formatEmployeeName(e) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [employees],
  );

  const projectOptions = useMemo(
    () => [
      { value: '', label: 'All projects' },
      ...projects
        .map((p) => ({
          value: p.id,
          label: p.project_number ? `${p.project_number} — ${p.name}` : p.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [projects],
  );

  const activeFilterCount = [employeeFilter, projectFilter].filter(Boolean).length;
  const isInitialLoad = loading && assignments.length === 0 && !listError;

  // ---------------------------------------------------------------------------
  // Gates
  // ---------------------------------------------------------------------------
  if (authLoading || rbacLoading) return <AssignmentsPageSkeleton />;
  if (!canManage) return null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6 sm:pt-6">
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'Assignments' },
          ]}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/workforce/clock"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to Workforce
          </Link>
          <button
            type="button"
            onClick={() => {
              loadReferences();
              loadAssignments();
            }}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
            aria-label="Refresh assignments"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>

        <header className="mt-4 mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
            <Link2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Employee Assignments
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Control which employees can clock in to which projects.
            </p>
          </div>
        </header>

        {/* Primary action — full width on mobile for thumb reach */}
        <div className="mb-5">
          <Button
            onClick={() => setAssignOpen(true)}
            className="w-full sm:w-auto"
            disabled={!refsReady || employees.length === 0 || projects.length === 0}
          >
            <UserPlus className="h-5 w-5" aria-hidden="true" />
            Assign Employee
          </Button>
          {refsReady && (employees.length === 0 || projects.length === 0) && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              You need at least one employee profile and one project before you can
              create an assignment.
            </p>
          )}
        </div>

        {/* Filters */}
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 sm:cursor-default"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="assignments-filters"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                Filters
              </h2>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {activeFilterCount} active
                </span>
              )}
            </div>
          </button>

          <div
            id="assignments-filters"
            className={`${filtersOpen ? 'mt-4' : 'mt-0 hidden'} sm:mt-4 sm:block`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Employee"
                options={employeeOptions}
                value={employeeFilter}
                onChange={(v) => {
                  setEmployeeFilter(v);
                  setPage(1);
                }}
                searchable={employeeOptions.length > 6}
                disabled={!refsReady}
              />
              <Select
                label="Project"
                options={projectOptions}
                value={projectFilter}
                onChange={(v) => {
                  setProjectFilter(v);
                  setPage(1);
                }}
                searchable={projectOptions.length > 6}
                disabled={!refsReady}
              />
            </div>

            {activeFilterCount > 0 && (
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters} type="button">
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* List */}
        <section className="mt-5" aria-live="polite">
          {listError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border-2 border-red-200 bg-red-50 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
            >
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Could not load assignments</p>
                <p className="mt-0.5 text-xs">{listError}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadAssignments}
                  className="mt-3"
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </Button>
              </div>
            </div>
          ) : isInitialLoad ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-700"
                />
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                {activeFilterCount > 0 ? 'No matches' : 'No assignments yet'}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {activeFilterCount > 0
                  ? 'Try clearing the filters to see all assignments.'
                  : 'Link employees to projects to control clock-in access.'}
              </p>
              {activeFilterCount > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-4"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {totalRows} assignment{totalRows === 1 ? '' : 's'}
              </p>
              <ul className="space-y-3">
                {assignments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800 sm:p-5"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                            <UserIcon className="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-bold text-gray-900 dark:text-white">
                              {formatEmployeeName(a.employee_profile)}
                            </p>
                            {a.employee_profile?.user?.email && (
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {a.employee_profile.user.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <Briefcase className="h-4 w-4 flex-shrink-0 text-gray-400" aria-hidden="true" />
                          <span className="truncate font-medium">
                            {a.project?.name || 'Unknown project'}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Assigned {formatDateShort(a.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingRemoval(a)}
                          className="min-h-[44px] min-w-[44px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          aria-label={`Remove ${formatEmployeeName(a.employee_profile)} from ${a.project?.name ?? 'this project'}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {totalPages > 1 && (
                <PaginationControls
                  className="mt-6"
                  currentPage={page}
                  totalPages={totalPages}
                  onPrevious={() => handlePageChange(Math.max(1, page - 1))}
                  onNext={() => handlePageChange(Math.min(totalPages, page + 1))}
                  onGoToPage={handlePageChange}
                />
              )}
            </>
          )}
        </section>
      </div>

      <AssignEmployeeModal
        isOpen={assignOpen}
        onClose={() => setAssignOpen(false)}
        onSuccess={handleAssignSuccess}
        onConflict={(err) => {
          setAssignOpen(false);
          setErrorState(err);
        }}
        employees={employees}
        projects={projects}
      />

      <ConfirmModal
        isOpen={pendingRemoval !== null}
        onClose={() => (removing ? undefined : setPendingRemoval(null))}
        onConfirm={handleRemoveConfirm}
        title="Remove assignment?"
        message={
          pendingRemoval
            ? `Remove ${formatEmployeeName(
                pendingRemoval.employee_profile,
              )} from ${pendingRemoval.project?.name ?? 'this project'}? They will no longer be able to clock in to this project.`
            : ''
        }
        confirmText="Remove"
        cancelText="Keep"
        variant="danger"
        loading={removing}
      />

      <SuccessModal
        isOpen={successState !== null}
        onClose={() => setSuccessState(null)}
        title={successState?.title ?? ''}
        message={successState?.message ?? ''}
      />

      <ErrorModal
        isOpen={errorState !== null}
        onClose={() => setErrorState(null)}
        title={errorState?.title ?? ''}
        message={errorState?.message ?? ''}
      />
    </div>
  );
}
