/**
 * Crew Hours List Page
 * Sprint 23 — Crew Hours & Payments Management
 * List, filter, create, edit crew hour logs
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Plus,
  Users,
  ArrowLeft,
  Edit2,
  Eye,
  AlertCircle,
  Zap,
  PenLine,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  getCrewHours,
  logCrewHours,
  updateCrewHourLog,
} from '@/lib/api/financial';
import { getCrewMembers } from '@/lib/api/crew';
import { getProjects, getProjectTasks, formatDate } from '@/lib/api/projects';
import type {
  CrewHourLog,
  CreateCrewHourDto,
  UpdateCrewHourDto,
  PaginatedResponse,
} from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';

// ========== CONSTANTS ==========

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_EDIT_ROLES = ['Owner', 'Admin', 'Manager'];
const PAGE_SIZE = 20;

// ========== TYPES ==========

interface CrewOption {
  value: string;
  label: string;
}

interface ProjectOption {
  value: string;
  label: string;
}

// ========== COMPONENT ==========

export default function CrewHoursPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();

  // Access control
  const canView = hasRole(CAN_VIEW_ROLES);
  const canEdit = hasRole(CAN_EDIT_ROLES);

  // List state
  const [hours, setHours] = useState<PaginatedResponse<CrewHourLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // Filter state
  const [filterCrewMember, setFilterCrewMember] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // Filter options
  const [crewOptions, setCrewOptions] = useState<CrewOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<ProjectOption[]>([]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    crew_member_id: '',
    project_id: '',
    task_id: '',
    log_date: new Date().toISOString().split('T')[0],
    hours_regular: '',
    hours_overtime: '',
    notes: '',
  });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [createTasks, setCreateTasks] = useState<ProjectTask[]>([]);
  const [loadingCreateTasks, setLoadingCreateTasks] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<CrewHourLog | null>(null);
  const [editForm, setEditForm] = useState({
    task_id: '',
    log_date: '',
    hours_regular: '',
    hours_overtime: '',
    notes: '',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editTasks, setEditTasks] = useState<ProjectTask[]>([]);
  const [loadingEditTasks, setLoadingEditTasks] = useState(false);

  // View modal for clockin entries
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewItem, setViewItem] = useState<CrewHourLog | null>(null);

  // ========== DATA LOADING ==========

  const loadFilterOptions = useCallback(async () => {
    try {
      const [crewData, projectData] = await Promise.all([
        getCrewMembers({ limit: 100 }),
        getProjects({ limit: 100 }),
      ]);
      setCrewOptions(
        crewData.data
          .filter((c) => c.is_active)
          .map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` }))
      );
      setProjectOptions(
        projectData.data.map((p) => ({
          value: p.id,
          label: `${p.name} (${p.project_number})`,
        }))
      );
    } catch {
      // Filters will be empty — non-blocking
    }
  }, []);

  const loadHours = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCrewHours({
        page,
        limit: PAGE_SIZE,
        crew_member_id: filterCrewMember || undefined,
        project_id: filterProject || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
      });
      setHours(data);
    } catch {
      toast.error('Failed to load crew hours');
    } finally {
      setLoading(false);
    }
  }, [page, filterCrewMember, filterProject, filterDateFrom, filterDateTo]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    if (canView) loadHours();
  }, [loadHours, canView]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filterCrewMember, filterProject, filterDateFrom, filterDateTo]);

  // ========== CREATE MODAL LOGIC ==========

  const openCreateModal = () => {
    setCreateForm({
      crew_member_id: '',
      project_id: '',
      task_id: '',
      log_date: new Date().toISOString().split('T')[0],
      hours_regular: '',
      hours_overtime: '',
      notes: '',
    });
    setCreateErrors({});
    setCreateTasks([]);
    setShowCreateModal(true);
  };

  // Cascading task select: load tasks when project changes
  useEffect(() => {
    if (!createForm.project_id) {
      setCreateTasks([]);
      setCreateForm((prev) => ({ ...prev, task_id: '' }));
      return;
    }
    let cancelled = false;
    setLoadingCreateTasks(true);
    getProjectTasks(createForm.project_id, { limit: 100 })
      .then((res) => {
        if (!cancelled) setCreateTasks(res.data);
      })
      .catch(() => {
        if (!cancelled) setCreateTasks([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCreateTasks(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createForm.project_id]);

  const validateCreate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!createForm.crew_member_id) errs.crew_member_id = 'Crew member is required';
    if (!createForm.project_id) errs.project_id = 'Project is required';
    if (!createForm.log_date) errs.log_date = 'Date is required';
    const reg = parseFloat(createForm.hours_regular);
    if (!createForm.hours_regular || isNaN(reg) || reg < 0.01) {
      errs.hours_regular = 'Regular hours must be at least 0.01';
    }
    if (createForm.hours_overtime) {
      const ot = parseFloat(createForm.hours_overtime);
      if (isNaN(ot) || ot < 0) errs.hours_overtime = 'Overtime hours must be 0 or more';
    }
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreate()) return;

    setCreateSubmitting(true);
    try {
      const dto: CreateCrewHourDto = {
        crew_member_id: createForm.crew_member_id,
        project_id: createForm.project_id,
        task_id: createForm.task_id || undefined,
        log_date: createForm.log_date,
        hours_regular: parseFloat(createForm.hours_regular),
        hours_overtime: createForm.hours_overtime ? parseFloat(createForm.hours_overtime) : undefined,
        notes: createForm.notes || undefined,
      };
      await logCrewHours(dto);

      const memberName = crewOptions.find((c) => c.value === createForm.crew_member_id)?.label || 'crew member';
      toast.success(`Hours logged for ${memberName}`);
      setShowCreateModal(false);
      loadHours();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to log hours');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // ========== EDIT MODAL LOGIC ==========

  const openEditModal = (log: CrewHourLog) => {
    setEditItem(log);
    setEditForm({
      task_id: log.task_id || '',
      log_date: log.log_date.split('T')[0],
      hours_regular: parseFloat(log.hours_regular).toString(),
      hours_overtime: parseFloat(log.hours_overtime).toString(),
      notes: log.notes || '',
    });
    setEditErrors({});
    setShowEditModal(true);

    // Load tasks for the log's project
    setLoadingEditTasks(true);
    getProjectTasks(log.project_id, { limit: 100 })
      .then((res) => setEditTasks(res.data))
      .catch(() => setEditTasks([]))
      .finally(() => setLoadingEditTasks(false));
  };

  const validateEdit = (): boolean => {
    const errs: Record<string, string> = {};
    if (!editForm.log_date) errs.log_date = 'Date is required';
    const reg = parseFloat(editForm.hours_regular);
    if (!editForm.hours_regular || isNaN(reg) || reg < 0.01) {
      errs.hours_regular = 'Regular hours must be at least 0.01';
    }
    if (editForm.hours_overtime) {
      const ot = parseFloat(editForm.hours_overtime);
      if (isNaN(ot) || ot < 0) errs.hours_overtime = 'Overtime hours must be 0 or more';
    }
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !validateEdit()) return;

    setEditSubmitting(true);
    try {
      const dto: UpdateCrewHourDto = {
        task_id: editForm.task_id || undefined,
        log_date: editForm.log_date,
        hours_regular: parseFloat(editForm.hours_regular),
        hours_overtime: editForm.hours_overtime ? parseFloat(editForm.hours_overtime) : 0,
        notes: editForm.notes || undefined,
      };
      await updateCrewHourLog(editItem.id, dto);
      toast.success('Hours updated');
      setShowEditModal(false);
      loadHours();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to update hours');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ========== VIEW MODAL LOGIC ==========

  const openViewModal = (log: CrewHourLog) => {
    setViewItem(log);
    setShowViewModal(true);
  };

  // ========== HELPERS ==========

  const today = new Date().toISOString().split('T')[0];

  const createTaskOptions = createTasks.map((t) => ({
    value: t.id,
    label: t.title,
  }));

  const editTaskOptions = editTasks.map((t) => ({
    value: t.id,
    label: t.title,
  }));

  const clearFilters = () => {
    setFilterCrewMember('');
    setFilterProject('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = filterCrewMember || filterProject || filterDateFrom || filterDateTo;

  // ========== RBAC GUARD ==========

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" centered />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">You do not have permission to view crew hours.</p>
        <Link href="/financial">
          <Button variant="secondary" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Financial
          </Button>
        </Link>
      </div>
    );
  }

  // ========== RENDER ==========

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/financial" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Crew Hours</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Track and manage crew member work hours
            </p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={openCreateModal} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Log Hours
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Crew Member"
            searchable
            options={[{ value: '', label: 'All Crew Members' }, ...crewOptions]}
            value={filterCrewMember}
            onChange={(val) => setFilterCrewMember(val)}
            placeholder="All Crew Members"
          />
          <Select
            label="Project"
            searchable
            options={[{ value: '', label: 'All Projects' }, ...projectOptions]}
            value={filterProject}
            onChange={(val) => setFilterProject(val)}
            placeholder="All Projects"
          />
          <DatePicker
            label="Date From"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            max={filterDateTo || today}
          />
          <DatePicker
            label="Date To"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            min={filterDateFrom}
            max={today}
          />
        </div>
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </Card>

      {/* Content */}
      <Card className="p-6">
        {loading ? (
          <div className="py-16">
            <LoadingSpinner size="lg" centered />
          </div>
        ) : !hours || hours.data.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Clock className="w-7 h-7 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No hours logged
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {hasActiveFilters
                ? 'No hours match your current filters. Try adjusting your search criteria.'
                : 'Start logging crew hours to track labor on your projects.'}
            </p>
            {canEdit && !hasActiveFilters && (
              <Button onClick={openCreateModal} className="flex items-center gap-2 mx-auto">
                <Plus className="w-4 h-4" />
                Log Hours
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Crew Member</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Project</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Task</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Date</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Regular</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Overtime</th>
                    <th className="text-left py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Source</th>
                    <th className="text-right py-3 px-3 text-gray-500 dark:text-gray-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.data.map((log) => {
                    const regular = parseFloat(log.hours_regular);
                    const overtime = parseFloat(log.hours_overtime);
                    const isManual = log.source === 'manual';
                    return (
                      <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-3 px-3 text-gray-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium">
                              {log.crew_member.first_name} {log.crew_member.last_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          <div>
                            <div className="font-medium">{log.project.name}</div>
                            <div className="text-xs text-gray-400">{log.project.project_number}</div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                          {log.task?.title || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatDate(log.log_date)}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-gray-900 dark:text-white">
                          {regular.toFixed(1)}h
                        </td>
                        <td className="py-3 px-3 text-right font-medium">
                          {overtime > 0 ? (
                            <span className="text-orange-600 dark:text-orange-400">{overtime.toFixed(1)}h</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {isManual ? (
                            <Badge variant="blue" icon={PenLine}>Manual</Badge>
                          ) : (
                            <Badge variant="green" icon={Zap}>Clock-In</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isManual && canEdit ? (
                              <button
                                onClick={() => openEditModal(log)}
                                className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title="Edit hours"
                                aria-label={`Edit hours for ${log.crew_member.first_name} ${log.crew_member.last_name}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            ) : null}
                            <button
                              onClick={() => openViewModal(log)}
                              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="View details"
                              aria-label={`View details for ${log.crew_member.first_name} ${log.crew_member.last_name}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {hours.data.map((log) => {
                const regular = parseFloat(log.hours_regular);
                const overtime = parseFloat(log.hours_overtime);
                const total = regular + overtime;
                const isManual = log.source === 'manual';
                return (
                  <div key={log.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {log.crew_member.first_name} {log.crew_member.last_name}
                        </span>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {log.project.name} ({log.project.project_number})
                        </div>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white text-lg">
                        {total.toFixed(1)}h
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>{formatDate(log.log_date)}</span>
                        {isManual ? (
                          <Badge variant="blue" icon={PenLine}>Manual</Badge>
                        ) : (
                          <Badge variant="green" icon={Zap}>Clock-In</Badge>
                        )}
                      </div>
                      <div>
                        Regular: {regular.toFixed(1)}h
                        {overtime > 0 && (
                          <span className="text-orange-600 dark:text-orange-400 ml-2">
                            | OT: {overtime.toFixed(1)}h
                          </span>
                        )}
                      </div>
                      {log.task && <div>Task: {log.task.title}</div>}
                      {log.notes && <div className="truncate">Notes: {log.notes}</div>}
                    </div>
                    <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      {isManual && canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEditModal(log)}
                          className="flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openViewModal(log)}
                        className="flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {(hours.meta.pages ?? 0) > 1 && (
              <div className="mt-6">
                <PaginationControls
                  currentPage={page}
                  totalPages={hours.meta.pages ?? 1}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* ========== CREATE MODAL ========== */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Log Crew Hours" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Crew Member"
            required
            searchable
            options={crewOptions}
            value={createForm.crew_member_id}
            onChange={(val) => setCreateForm({ ...createForm, crew_member_id: val })}
            error={createErrors.crew_member_id}
            placeholder="Select crew member"
          />

          <Select
            label="Project"
            required
            searchable
            options={projectOptions}
            value={createForm.project_id}
            onChange={(val) => setCreateForm({ ...createForm, project_id: val, task_id: '' })}
            error={createErrors.project_id}
            placeholder="Select project"
          />

          <Select
            label="Task"
            searchable
            options={createTaskOptions}
            value={createForm.task_id}
            onChange={(val) => setCreateForm({ ...createForm, task_id: val })}
            placeholder={
              !createForm.project_id
                ? 'Select a project first'
                : loadingCreateTasks
                  ? 'Loading tasks...'
                  : createTasks.length === 0
                    ? 'No tasks available'
                    : 'Select task (optional)'
            }
            disabled={!createForm.project_id || loadingCreateTasks}
          />

          <DatePicker
            label="Date"
            required
            value={createForm.log_date}
            onChange={(e) => setCreateForm({ ...createForm, log_date: e.target.value })}
            max={today}
            error={createErrors.log_date}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Regular Hours"
              required
              type="number"
              step="0.01"
              min="0.01"
              value={createForm.hours_regular}
              onChange={(e) => setCreateForm({ ...createForm, hours_regular: e.target.value })}
              error={createErrors.hours_regular}
              placeholder="8.0"
            />
            <Input
              label="Overtime Hours"
              type="number"
              step="0.01"
              min="0"
              value={createForm.hours_overtime}
              onChange={(e) => setCreateForm({ ...createForm, hours_overtime: e.target.value })}
              error={createErrors.hours_overtime}
              placeholder="0.0"
            />
          </div>

          <Textarea
            label="Notes"
            value={createForm.notes}
            onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            placeholder="Optional notes"
            rows={2}
          />

          <ModalActions>
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} disabled={createSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={createSubmitting} disabled={createSubmitting}>
              Log Hours
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ========== EDIT MODAL ========== */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Crew Hours" size="lg">
        {editItem && (
          <form onSubmit={handleEdit} className="space-y-4">
            {/* Read-only fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Crew Member
                </label>
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  {editItem.crew_member.first_name} {editItem.crew_member.last_name}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project
                </label>
                <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  {editItem.project.name} ({editItem.project.project_number})
                </div>
              </div>
            </div>

            <Select
              label="Task"
              searchable
              options={editTaskOptions}
              value={editForm.task_id}
              onChange={(val) => setEditForm({ ...editForm, task_id: val })}
              placeholder={loadingEditTasks ? 'Loading tasks...' : editTasks.length === 0 ? 'No tasks available' : 'Select task (optional)'}
              disabled={loadingEditTasks}
            />

            <DatePicker
              label="Date"
              required
              value={editForm.log_date}
              onChange={(e) => setEditForm({ ...editForm, log_date: e.target.value })}
              max={today}
              error={editErrors.log_date}
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Regular Hours"
                required
                type="number"
                step="0.01"
                min="0.01"
                value={editForm.hours_regular}
                onChange={(e) => setEditForm({ ...editForm, hours_regular: e.target.value })}
                error={editErrors.hours_regular}
                placeholder="8.0"
              />
              <Input
                label="Overtime Hours"
                type="number"
                step="0.01"
                min="0"
                value={editForm.hours_overtime}
                onChange={(e) => setEditForm({ ...editForm, hours_overtime: e.target.value })}
                error={editErrors.hours_overtime}
                placeholder="0.0"
              />
            </div>

            <Textarea
              label="Notes"
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              placeholder="Optional notes"
              rows={2}
            />

            <ModalActions>
              <Button type="button" variant="secondary" onClick={() => setShowEditModal(false)} disabled={editSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={editSubmitting} disabled={editSubmitting}>
                Update Hours
              </Button>
            </ModalActions>
          </form>
        )}
      </Modal>

      {/* ========== VIEW MODAL ========== */}
      <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)} title="Hour Log Details" size="lg">
        {viewItem && (
          <div className="space-y-4">
            {viewItem.source !== 'manual' && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Clock-in entries cannot be edited from here.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Crew Member
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {viewItem.crew_member.first_name} {viewItem.crew_member.last_name}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Project
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {viewItem.project.name}
                </p>
                <p className="text-xs text-gray-400">{viewItem.project.project_number}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Task
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {viewItem.task?.title || '—'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Date
                </label>
                <p className="text-sm text-gray-900 dark:text-white">{formatDate(viewItem.log_date)}</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Regular Hours
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {parseFloat(viewItem.hours_regular).toFixed(1)}h
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Overtime Hours
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {parseFloat(viewItem.hours_overtime) > 0 ? (
                    <span className="text-orange-600 dark:text-orange-400">
                      {parseFloat(viewItem.hours_overtime).toFixed(1)}h
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Source
                </label>
                <div>
                  {viewItem.source === 'manual' ? (
                    <Badge variant="blue" icon={PenLine}>Manual</Badge>
                  ) : (
                    <Badge variant="green" icon={Zap}>Clock-In</Badge>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Total Hours
                </label>
                <p className="text-sm text-gray-900 dark:text-white font-bold">
                  {(parseFloat(viewItem.hours_regular) + parseFloat(viewItem.hours_overtime)).toFixed(1)}h
                </p>
              </div>
            </div>

            {viewItem.notes && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                  Notes
                </label>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{viewItem.notes}</p>
              </div>
            )}

            <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
              Created: {formatDate(viewItem.created_at)}
              {viewItem.updated_at !== viewItem.created_at && (
                <> · Updated: {formatDate(viewItem.updated_at)}</>
              )}
            </div>

            <ModalActions>
              <Button type="button" variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
              {viewItem.source === 'manual' && canEdit && (
                <Button
                  onClick={() => {
                    setShowViewModal(false);
                    openEditModal(viewItem);
                  }}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
              )}
            </ModalActions>
          </div>
        )}
      </Modal>
    </div>
  );
}
