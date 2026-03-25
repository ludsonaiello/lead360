'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Edit3,
  Trash2,
  Users,
  Link2,
  CalendarPlus,
  MessageSquare,
  AlertTriangle,
  X,
  Calendar,
  UserPlus,
  Plus,
} from 'lucide-react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  updateProjectTask,
  getProjectTaskById,
  formatTaskStatus,
  getTaskStatusBadgeVariant,
  getValidStatusTransitions,
  formatTaskCategory,
  formatDate,
  addTaskDependency,
  removeTaskDependency,
  addTaskAssignee,
  removeTaskAssignee,
  sendTaskSms,
  getTaskCalendarEvents,
  createTaskCalendarEvent,
  deleteTaskCalendarEvent,
} from '@/lib/api/projects';
import { getCrewMembers } from '@/lib/api/crew';
import { getSubcontractors } from '@/lib/api/subcontractors';
import { listUsers } from '@/lib/api/users';
import type {
  ProjectTask,
  TaskStatus,
  TaskCategory,
  UpdateTaskDto,
  TaskAssignee,
  TaskCalendarEvent,
  DependencyType,
  AssigneeType,
} from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  task: ProjectTask;
  allTasks: ProjectTask[];
  canManage: boolean;
  onTaskUpdated: (task: ProjectTask) => void;
  onTaskDeleted: (taskId: string) => void;
}

type DetailTab = 'details' | 'assignments' | 'dependencies' | 'calendar' | 'sms';

export default function TaskDetailModal({
  isOpen,
  onClose,
  projectId,
  task,
  allTasks,
  canManage,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentTask, setCurrentTask] = useState<ProjectTask>(task);

  useEffect(() => {
    setCurrentTask(task);
  }, [task]);

  const tabs: { id: DetailTab; label: string; icon: React.ElementType }[] = [
    { id: 'details', label: 'Details', icon: Edit3 },
    { id: 'assignments', label: 'Assignees', icon: Users },
    { id: 'dependencies', label: 'Dependencies', icon: Link2 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'sms', label: 'SMS', icon: MessageSquare },
  ];

  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await updateProjectTask(projectId, currentTask.id, { status: newStatus as TaskStatus });
      setCurrentTask(updated);
      onTaskUpdated(updated);
      toast.success(`Status changed to ${formatTaskStatus(newStatus)}`);
    } catch (err: unknown) {
      const e = err as { message?: string; data?: { blocking_dependencies?: Array<{ title: string }> } };
      if (e.data?.blocking_dependencies) {
        const blockers = e.data.blocking_dependencies.map((d) => d.title).join(', ');
        toast.error(`Blocked by dependencies: ${blockers}`);
      } else {
        toast.error(e.message || 'Failed to update status');
      }
    }
  };

  const validTransitions = getValidStatusTransitions(currentTask.status);

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={currentTask.title} size="xl">
        {/* Status + delay indicator */}
        <div className="flex items-center gap-3 mb-4">
          <Badge variant={getTaskStatusBadgeVariant(currentTask.status)} label={formatTaskStatus(currentTask.status)} />
          {currentTask.is_delayed && (
            <span className="flex items-center gap-1 text-sm font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              Delayed
            </span>
          )}
          {canManage && validTransitions.length > 0 && (
            <div className="ml-auto">
              <Select
                options={validTransitions.map((s) => ({ value: s, label: formatTaskStatus(s) }))}
                value=""
                onChange={handleStatusChange}
                placeholder="Change status..."
                className="w-44"
              />
            </div>
          )}
        </div>

        {/* Inner tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav className="-mb-px flex space-x-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        <div className="min-h-[300px] max-h-[60vh] overflow-y-auto">
          {activeTab === 'details' && (
            <DetailsSection
              task={currentTask}
              projectId={projectId}
              canManage={canManage}
              isEditing={isEditing}
              setIsEditing={setIsEditing}
              onTaskUpdated={(updated) => {
                setCurrentTask(updated);
                onTaskUpdated(updated);
              }}
            />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsSection
              task={currentTask}
              projectId={projectId}
              canManage={canManage}
              onTaskUpdated={(updated) => {
                setCurrentTask(updated);
                onTaskUpdated(updated);
              }}
            />
          )}
          {activeTab === 'dependencies' && (
            <DependenciesSection
              task={currentTask}
              projectId={projectId}
              allTasks={allTasks}
              canManage={canManage}
              onTaskUpdated={(updated) => {
                setCurrentTask(updated);
                onTaskUpdated(updated);
              }}
            />
          )}
          {activeTab === 'calendar' && (
            <CalendarSection
              task={currentTask}
              projectId={projectId}
              canManage={canManage}
            />
          )}
          {activeTab === 'sms' && (
            <SmsSection
              task={currentTask}
              projectId={projectId}
              canManage={canManage}
            />
          )}
        </div>

        {/* Footer */}
        <ModalActions>
          {canManage && (
            <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </ModalActions>
      </Modal>

      <DeleteConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => onTaskDeleted(currentTask.id)}
        title="Delete Task"
        message={`Are you sure you want to delete "${currentTask.title}"? This action cannot be undone.`}
      />
    </>
  );
}

// ============================================================
// DETAILS SECTION
// ============================================================

function DetailsSection({
  task,
  projectId,
  canManage,
  isEditing,
  setIsEditing,
  onTaskUpdated,
}: {
  task: ProjectTask;
  projectId: string;
  canManage: boolean;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  onTaskUpdated: (t: ProjectTask) => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    estimated_duration_days: task.estimated_duration_days?.toString() || '',
    estimated_start_date: task.estimated_start_date?.split('T')[0] || '',
    estimated_end_date: task.estimated_end_date?.split('T')[0] || '',
    category: task.category || '',
    notes: task.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const categoryOptions = [
    { value: '', label: 'None' },
    { value: 'labor', label: 'Labor' },
    { value: 'material', label: 'Material' },
    { value: 'subcontractor', label: 'Subcontractor' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'other', label: 'Other' },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const dto: UpdateTaskDto = {};
      if (form.title.trim() !== task.title) dto.title = form.title.trim();
      if (form.description.trim() !== (task.description || '')) dto.description = form.description.trim();
      if (form.estimated_duration_days !== (task.estimated_duration_days?.toString() || '')) {
        dto.estimated_duration_days = form.estimated_duration_days ? Number(form.estimated_duration_days) : undefined;
      }
      if (form.estimated_start_date !== (task.estimated_start_date?.split('T')[0] || '')) {
        dto.estimated_start_date = form.estimated_start_date || undefined;
      }
      if (form.estimated_end_date !== (task.estimated_end_date?.split('T')[0] || '')) {
        dto.estimated_end_date = form.estimated_end_date || undefined;
      }
      if (form.category !== (task.category || '')) {
        dto.category = (form.category || undefined) as TaskCategory | undefined;
      }
      if (form.notes.trim() !== (task.notes || '')) dto.notes = form.notes.trim();

      if (Object.keys(dto).length === 0) {
        setIsEditing(false);
        return;
      }

      const updated = await updateProjectTask(projectId, task.id, dto);
      onTaskUpdated(updated);
      setIsEditing(false);
      toast.success('Task updated');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-4">
        {canManage && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-4 h-4" />
              Edit
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoField label="Category" value={formatTaskCategory(task.category)} />
          <InfoField label="Duration" value={task.estimated_duration_days ? `${task.estimated_duration_days} days` : '-'} />
          <InfoField label="Est. Start" value={formatDate(task.estimated_start_date)} />
          <InfoField label="Est. End" value={formatDate(task.estimated_end_date)} />
          <InfoField label="Actual Start" value={formatDate(task.actual_start_date)} />
          <InfoField label="Actual End" value={formatDate(task.actual_end_date)} />
        </div>
        {task.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Description</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{task.description}</p>
          </div>
        )}
        {task.notes && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Notes</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{task.notes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        label="Title"
        required
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        maxLength={200}
      />
      <Textarea
        label="Description"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        rows={3}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Start Date"
          value={form.estimated_start_date}
          onChange={(e) => setForm((f) => ({ ...f, estimated_start_date: e.target.value }))}
        />
        <DatePicker
          label="End Date"
          value={form.estimated_end_date}
          onChange={(e) => setForm((f) => ({ ...f, estimated_end_date: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Duration (days)"
          type="number"
          min={1}
          value={form.estimated_duration_days}
          onChange={(e) => setForm((f) => ({ ...f, estimated_duration_days: e.target.value }))}
        />
        <Select
          label="Category"
          options={categoryOptions}
          value={form.category}
          onChange={(val) => setForm((f) => ({ ...f, category: val }))}
        />
      </div>
      <Textarea
        label="Notes"
        value={form.notes}
        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        rows={2}
      />
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} loading={saving}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

// ============================================================
// ASSIGNMENTS SECTION
// ============================================================

function AssignmentsSection({
  task,
  projectId,
  canManage,
  onTaskUpdated,
}: {
  task: ProjectTask;
  projectId: string;
  canManage: boolean;
  onTaskUpdated: (t: ProjectTask) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [assigneeType, setAssigneeType] = useState<AssigneeType>('crew_member');
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const typeOptions = [
    { value: 'crew_member', label: 'Crew Member' },
    { value: 'subcontractor', label: 'Subcontractor' },
    { value: 'user', label: 'User' },
  ];

  const loadOptions = useCallback(async (type: AssigneeType) => {
    setLoadingOptions(true);
    try {
      if (type === 'crew_member') {
        const res = await getCrewMembers({ limit: 100 });
        setOptions(res.data.map((c) => ({ value: c.id, label: `${c.first_name} ${c.last_name}` })));
      } else if (type === 'subcontractor') {
        const res = await getSubcontractors({ limit: 100 });
        setOptions(res.data.map((s) => ({ value: s.id, label: s.business_name })));
      } else {
        const res = await listUsers({ limit: 100 });
        setOptions(res.data.map((u) => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` })));
      }
    } catch {
      setOptions([]);
      toast.error('Failed to load assignee options');
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => {
    if (showAdd) {
      loadOptions(assigneeType);
    }
  }, [showAdd, assigneeType, loadOptions]);

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    try {
      const dto: { assignee_type: AssigneeType; crew_member_id?: string; subcontractor_id?: string; user_id?: string } = {
        assignee_type: assigneeType,
      };
      if (assigneeType === 'crew_member') dto.crew_member_id = selectedId;
      else if (assigneeType === 'subcontractor') dto.subcontractor_id = selectedId;
      else dto.user_id = selectedId;

      await addTaskAssignee(projectId, task.id, dto);
      // Refresh task to get updated assignees
      const updated = await getProjectTaskById(projectId, task.id);
      onTaskUpdated(updated);
      setSelectedId('');
      setShowAdd(false);
      toast.success('Assignee added');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to add assignee');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (assigneeId: string) => {
    setRemovingId(assigneeId);
    try {
      await removeTaskAssignee(projectId, task.id, assigneeId);
      const updated = await getProjectTaskById(projectId, task.id);
      onTaskUpdated(updated);
      toast.success('Assignee removed');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to remove assignee');
    } finally {
      setRemovingId(null);
    }
  };

  const getAssigneeName = (a: TaskAssignee): string => {
    if (a.crew_member) return `${a.crew_member.first_name} ${a.crew_member.last_name}`;
    if (a.subcontractor) return a.subcontractor.business_name;
    if (a.user) return `${a.user.first_name} ${a.user.last_name}`;
    return 'Unknown';
  };

  const getAssigneeTypeBadge = (type: AssigneeType) => {
    const map: Record<AssigneeType, { variant: 'blue' | 'purple' | 'cyan'; label: string }> = {
      crew_member: { variant: 'blue', label: 'Crew' },
      subcontractor: { variant: 'purple', label: 'Sub' },
      user: { variant: 'cyan', label: 'User' },
    };
    return map[type] || { variant: 'neutral' as const, label: type };
  };

  return (
    <div className="space-y-4">
      {/* Add button */}
      {canManage && !showAdd && (
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
          <UserPlus className="w-4 h-4" />
          Add Assignee
        </Button>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <Select
            label="Type"
            options={typeOptions}
            value={assigneeType}
            onChange={(val) => { setAssigneeType(val as AssigneeType); setSelectedId(''); }}
          />
          {loadingOptions ? (
            <LoadingSpinner size="sm" />
          ) : (
            <Select
              label={assigneeType === 'crew_member' ? 'Crew Member' : assigneeType === 'subcontractor' ? 'Subcontractor' : 'User'}
              options={options}
              value={selectedId}
              onChange={setSelectedId}
              placeholder={`Select ${assigneeType.replace('_', ' ')}...`}
              searchable
            />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!selectedId}>
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Current assignees */}
      {task.assignees.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No assignees yet</p>
      ) : (
        <div className="space-y-2">
          {task.assignees.map((a) => {
            const badge = getAssigneeTypeBadge(a.assignee_type);
            return (
              <div
                key={a.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300">
                    {getAssigneeName(a).charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{getAssigneeName(a)}</p>
                    <Badge variant={badge.variant} label={badge.label} className="mt-0.5" />
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleRemove(a.id)}
                    disabled={removingId === a.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {removingId === a.id ? <LoadingSpinner size="sm" /> : <X className="w-4 h-4" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// DEPENDENCIES SECTION
// ============================================================

function DependenciesSection({
  task,
  projectId,
  allTasks,
  canManage,
  onTaskUpdated,
}: {
  task: ProjectTask;
  projectId: string;
  allTasks: ProjectTask[];
  canManage: boolean;
  onTaskUpdated: (t: ProjectTask) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [depTaskId, setDepTaskId] = useState('');
  const [depType, setDepType] = useState<DependencyType>('finish_to_start');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Available tasks to depend on (exclude self and already-added)
  const existingDepIds = new Set(task.dependencies.map((d) => d.depends_on_task_id));
  const availableTasks = allTasks
    .filter((t) => t.id !== task.id && !existingDepIds.has(t.id))
    .map((t) => ({ value: t.id, label: t.title }));

  const depTypeOptions = [
    { value: 'finish_to_start', label: 'Finish to Start' },
    { value: 'start_to_start', label: 'Start to Start' },
    { value: 'finish_to_finish', label: 'Finish to Finish' },
  ];

  const handleAdd = async () => {
    if (!depTaskId) return;
    setAdding(true);
    try {
      await addTaskDependency(projectId, task.id, {
        depends_on_task_id: depTaskId,
        dependency_type: depType,
      });
      const updated = await getProjectTaskById(projectId, task.id);
      onTaskUpdated(updated);
      setDepTaskId('');
      setShowAdd(false);
      toast.success('Dependency added');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to add dependency');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (depId: string) => {
    setRemovingId(depId);
    try {
      await removeTaskDependency(projectId, task.id, depId);
      const updated = await getProjectTaskById(projectId, task.id);
      onTaskUpdated(updated);
      toast.success('Dependency removed');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to remove dependency');
    } finally {
      setRemovingId(null);
    }
  };

  const formatDepType = (type: DependencyType): string => {
    const map: Record<DependencyType, string> = {
      finish_to_start: 'Finish → Start',
      start_to_start: 'Start → Start',
      finish_to_finish: 'Finish → Finish',
    };
    return map[type] || type;
  };

  return (
    <div className="space-y-4">
      {canManage && !showAdd && availableTasks.length > 0 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" />
          Add Dependency
        </Button>
      )}

      {showAdd && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <Select
            label="Depends On"
            options={availableTasks}
            value={depTaskId}
            onChange={setDepTaskId}
            placeholder="Select a task..."
            searchable
          />
          <Select
            label="Dependency Type"
            options={depTypeOptions}
            value={depType}
            onChange={(val) => setDepType(val as DependencyType)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={!depTaskId}>
              Add
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {task.dependencies.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No dependencies</p>
      ) : (
        <div className="space-y-2">
          {task.dependencies.map((dep) => (
            <div
              key={dep.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{dep.depends_on_task_title}</p>
                <Badge variant="indigo" label={formatDepType(dep.dependency_type)} className="mt-1" />
              </div>
              {canManage && (
                <button
                  onClick={() => handleRemove(dep.id)}
                  disabled={removingId === dep.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {removingId === dep.id ? <LoadingSpinner size="sm" /> : <X className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CALENDAR SECTION
// ============================================================

function CalendarSection({
  task,
  projectId,
  canManage,
}: {
  task: ProjectTask;
  projectId: string;
  canManage: boolean;
}) {
  const [events, setEvents] = useState<TaskCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
  });
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTaskCalendarEvents(projectId, task.id);
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [projectId, task.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.start_datetime || !form.end_datetime) {
      toast.error('Title, start and end times are required');
      return;
    }
    setCreating(true);
    try {
      await createTaskCalendarEvent(projectId, task.id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: new Date(form.end_datetime).toISOString(),
      });
      toast.success('Calendar event created');
      setShowCreate(false);
      setForm({ title: '', description: '', start_datetime: '', end_datetime: '' });
      loadEvents();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    setDeletingId(eventId);
    try {
      await deleteTaskCalendarEvent(projectId, task.id, eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      toast.success('Event deleted');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingSpinner size="sm" centered />;

  return (
    <div className="space-y-4">
      {canManage && !showCreate && (
        <Button variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
          <CalendarPlus className="w-4 h-4" />
          Create Calendar Event
        </Button>
      )}

      {showCreate && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
          <Input
            label="Event Title"
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="e.g., Foundation Inspection"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Start</label>
              <input
                type="datetime-local"
                value={form.start_datetime}
                onChange={(e) => setForm((f) => ({ ...f, start_datetime: e.target.value }))}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">End</label>
              <input
                type="datetime-local"
                value={form.end_datetime}
                onChange={(e) => setForm((f) => ({ ...f, end_datetime: e.target.value }))}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              />
            </div>
          </div>
          <Textarea
            label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate} loading={creating}>
              Create Event
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">No calendar events</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(event.start_datetime).toLocaleString()} — {new Date(event.end_datetime).toLocaleString()}
                </p>
              </div>
              {canManage && (
                <button
                  onClick={() => handleDelete(event.id)}
                  disabled={deletingId === event.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                >
                  {deletingId === event.id ? <LoadingSpinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SMS SECTION
// ============================================================

function SmsSection({
  task,
  projectId,
  canManage,
}: {
  task: ProjectTask;
  projectId: string;
  canManage: boolean;
}) {
  const [form, setForm] = useState({
    to_phone: '',
    text_body: `Task Update: "${task.title}"`,
  });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.text_body.trim()) {
      toast.error('Message body is required');
      return;
    }
    setSending(true);
    try {
      await sendTaskSms(projectId, task.id, {
        text_body: form.text_body.trim(),
        to_phone: form.to_phone.trim() || undefined,
      });
      toast.success('SMS sent successfully');
      setForm((f) => ({ ...f, text_body: '' }));
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to send SMS');
    } finally {
      setSending(false);
    }
  };

  if (!canManage) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">You do not have permission to send SMS</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Send an SMS in the context of this task. Leave phone blank to use the project lead's phone number.
      </p>
      <Input
        label="Phone (optional)"
        value={form.to_phone}
        onChange={(e) => setForm((f) => ({ ...f, to_phone: e.target.value }))}
        placeholder="+19781234567"
        helperText="Leave blank to use project lead phone"
      />
      <Textarea
        label="Message"
        required
        value={form.text_body}
        onChange={(e) => setForm((f) => ({ ...f, text_body: e.target.value }))}
        rows={4}
        maxLength={1600}
        showCharacterCount
      />
      <Button onClick={handleSend} loading={sending} disabled={!form.text_body.trim()}>
        <MessageSquare className="w-4 h-4" />
        Send SMS
      </Button>
    </div>
  );
}
