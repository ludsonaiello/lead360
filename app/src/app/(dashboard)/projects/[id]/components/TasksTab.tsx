'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ClipboardList,
  AlertTriangle,
  GripVertical,
  Clock,
  Users,
  Link2,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SortableList } from '@/components/ui/SortableList';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectTasks,
  updateProjectTask,
  deleteProjectTask,
  formatTaskStatus,
  getTaskStatusBadgeVariant,
  formatDate,
} from '@/lib/api/projects';
import type { ProjectTask, TaskStatus } from '@/lib/types/projects';
import toast from 'react-hot-toast';
import CreateTaskModal from './CreateTaskModal';
import TaskDetailModal from './TaskDetailModal';

interface TasksTabProps {
  projectId: string;
  onTaskCountChange?: () => void;
}

// Sortable task card rendered inside SortableList
function SortableTaskCard({
  task,
  canManage,
  onSelect,
}: {
  task: ProjectTask;
  canManage: boolean;
  onSelect: (task: ProjectTask) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canManage });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect(task)}
    >
      {/* Drag handle */}
      {canManage && (
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      {/* Task content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
            {task.title}
          </h4>
          {task.is_delayed && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              Delayed
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {task.estimated_start_date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(task.estimated_start_date)} - {formatDate(task.estimated_end_date)}
            </span>
          )}
          {task.assignees.length > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {task.assignees.length}
            </span>
          )}
          {task.dependencies.length > 0 && (
            <span className="flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              {task.dependencies.length}
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <Badge variant={getTaskStatusBadgeVariant(task.status)} label={formatTaskStatus(task.status)} />
    </div>
  );
}

export default function TasksTab({ projectId, onTaskCountChange }: TasksTabProps) {
  const { hasRole } = useRBAC();
  const canManage = hasRole(['Owner', 'Admin', 'Manager']);

  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { limit: number; status?: TaskStatus } = { limit: 100 };
      if (statusFilter) params.status = statusFilter as TaskStatus;
      const result = await getProjectTasks(projectId, params);
      // Sort by order_index
      const sorted = [...result.data].sort((a, b) => a.order_index - b.order_index);
      setTasks(sorted);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleReorder = async (reorderedTasks: ProjectTask[]) => {
    setTasks(reorderedTasks);
    // Update order_index for all tasks that changed position
    try {
      const updates = reorderedTasks.map((task, index) => ({
        id: task.id,
        newIndex: index,
        oldIndex: task.order_index,
      })).filter((u) => u.newIndex !== u.oldIndex);

      await Promise.all(
        updates.map((u) =>
          updateProjectTask(projectId, u.id, { order_index: u.newIndex })
        )
      );
    } catch {
      toast.error('Failed to reorder tasks');
      loadTasks();
    }
  };

  const handleTaskCreated = () => {
    loadTasks();
    onTaskCountChange?.();
  };

  const handleTaskUpdated = (updated: ProjectTask) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.order_index - b.order_index)
    );
    onTaskCountChange?.();
  };

  const handleTaskDeleted = async (taskId: string) => {
    try {
      await deleteProjectTask(projectId, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedTask(null);
      toast.success('Task deleted');
      onTaskCountChange?.();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete task');
    }
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'not_started', label: 'Not Started' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' },
  ];

  if (loading) {
    return (
      <Card className="p-12 mt-6">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadTasks} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="w-full sm:w-48">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter by status"
          />
        </div>
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
            Add Task
          </Button>
        )}
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Tasks Yet
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {statusFilter ? 'No tasks match this filter.' : 'Create your first task to start managing this project.'}
          </p>
          {canManage && !statusFilter && (
            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create First Task
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          <SortableList
            items={tasks}
            onReorder={handleReorder}
            getItemId={(task) => task.id}
            disabled={!canManage}
          >
            {(task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                canManage={canManage}
                onSelect={setSelectedTask}
              />
            )}
          </SortableList>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId}
          nextOrderIndex={tasks.length}
          onSuccess={handleTaskCreated}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          projectId={projectId}
          task={selectedTask}
          allTasks={tasks}
          canManage={canManage}
          onTaskUpdated={handleTaskUpdated}
          onTaskDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
