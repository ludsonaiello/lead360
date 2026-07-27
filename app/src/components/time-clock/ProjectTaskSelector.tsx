'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, CheckSquare, Info, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getProjectTasks } from '@/lib/api/projects';
import type { ProjectTask } from '@/lib/types/projects';
import type {
  AvailableProject,
  AvailableProjectAddress,
  ClockInMode,
} from '@/lib/types/time-clock';
import {
  formatDistanceUS,
  haversineMeters,
  parseCoord,
} from '@/lib/utils/geo-distance';

interface ProjectTaskSelectorProps {
  projects: AvailableProject[];
  projectsLoading: boolean;
  projectId: string | null;
  taskId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onTaskChange: (taskId: string | null) => void;
  projectRequired?: boolean;
  taskRequired?: boolean;
  mode?: ClockInMode;
  projectError?: string;
  taskError?: string;
  disabled?: boolean;
  userLatitude?: number | null;
  userLongitude?: number | null;
}

interface ProjectWithDistance {
  project: AvailableProject;
  nearestAddress: AvailableProjectAddress | null;
  distanceMeters: number | null;
}

function computeNearest(
  project: AvailableProject,
  userLat: number | null,
  userLng: number | null,
): { nearestAddress: AvailableProjectAddress | null; distanceMeters: number | null } {
  if (userLat == null || userLng == null) {
    return { nearestAddress: null, distanceMeters: null };
  }
  const addresses = project.clockin_addresses ?? [];
  let best: { addr: AvailableProjectAddress; meters: number } | null = null;
  for (const addr of addresses) {
    const lat = parseCoord(addr.latitude);
    const lng = parseCoord(addr.longitude);
    if (lat == null || lng == null) continue;
    const meters = haversineMeters(userLat, userLng, lat, lng);
    if (!Number.isFinite(meters)) continue;
    if (best === null || meters < best.meters) {
      best = { addr, meters };
    }
  }
  return best
    ? { nearestAddress: best.addr, distanceMeters: best.meters }
    : { nearestAddress: null, distanceMeters: null };
}

export function ProjectTaskSelector({
  projects,
  projectsLoading,
  projectId,
  taskId,
  onProjectChange,
  onTaskChange,
  projectRequired = false,
  taskRequired = false,
  projectError,
  taskError,
  disabled = false,
  userLatitude = null,
  userLongitude = null,
}: ProjectTaskSelectorProps) {
  const [tasksByProject, setTasksByProject] = useState<Record<string, ProjectTask[]>>({});
  const [tasksLoading, setTasksLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !taskRequired) return;
    if (tasksByProject[projectId]) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setTasksLoading(true);
    });
    getProjectTasks(projectId, { limit: 200 })
      .then((res) => {
        if (cancelled) return;
        setTasksByProject((prev) => ({ ...prev, [projectId]: res.data || [] }));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[ProjectTaskSelector] Failed to load tasks', err);
        toast.error('Could not load tasks for the selected project.');
        setTasksByProject((prev) => ({ ...prev, [projectId]: [] }));
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, taskRequired, tasksByProject]);

  const tasks: ProjectTask[] = useMemo(
    () => (projectId ? tasksByProject[projectId] || [] : []),
    [projectId, tasksByProject],
  );

  // Rank projects: with-distance first (ascending), then without-distance
  // alphabetically. When no GPS is available, fall back to alphabetical only.
  const rankedProjects = useMemo<ProjectWithDistance[]>(() => {
    const enriched = projects.map<ProjectWithDistance>((project) => {
      const { nearestAddress, distanceMeters } = computeNearest(
        project,
        userLatitude,
        userLongitude,
      );
      return { project, nearestAddress, distanceMeters };
    });

    enriched.sort((a, b) => {
      const aHas = a.distanceMeters != null;
      const bHas = b.distanceMeters != null;
      if (aHas && bHas) {
        return (a.distanceMeters as number) - (b.distanceMeters as number);
      }
      if (aHas) return -1;
      if (bHas) return 1;
      return a.project.name.localeCompare(b.project.name);
    });

    return enriched;
  }, [projects, userLatitude, userLongitude]);

  const projectOptions = useMemo(
    () =>
      rankedProjects.map(({ project, distanceMeters }, idx) => {
        const base = project.project_number
          ? `${project.name} · ${project.project_number}`
          : project.name;
        if (distanceMeters != null) {
          const dist = formatDistanceUS(distanceMeters);
          const nearestTag = idx === 0 ? ' · 📍 Nearest' : '';
          return {
            value: project.id,
            label: `${base}  —  ${dist}${nearestTag}`,
          };
        }
        return { value: project.id, label: base };
      }),
    [rankedProjects],
  );

  const selectedProjectContext = useMemo(() => {
    if (!projectId) return null;
    return rankedProjects.find((p) => p.project.id === projectId) ?? null;
  }, [projectId, rankedProjects]);

  const hasUserCoords = userLatitude != null && userLongitude != null;
  const rankedCount = rankedProjects.filter((p) => p.distanceMeters != null).length;

  const taskOptions = useMemo(
    () =>
      tasks.map((t) => ({
        value: t.id,
        label: t.title,
      })),
    [tasks],
  );

  if (projectsLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-5 dark:border-gray-700 dark:bg-gray-800/60">
        <LoadingSpinner size="sm" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Loading your projects…
        </p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">No projects assigned</p>
          <p className="mt-0.5 text-xs">
            Ask an admin to assign you to a project before clocking in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          <label
            htmlFor="time-clock-project"
            className="text-sm font-semibold text-gray-900 dark:text-gray-100"
          >
            Project
            {projectRequired && (
              <span className="ml-1 text-red-500 dark:text-red-400" aria-hidden="true">
                *
              </span>
            )}
          </label>
        </div>
        <Select
          name="time-clock-project"
          options={projectOptions}
          value={projectId ?? ''}
          onChange={(val) => {
            onProjectChange(val || null);
            onTaskChange(null);
          }}
          placeholder="Search or select a project…"
          searchable
          disabled={disabled}
          required={projectRequired}
          error={projectError}
        />

        {hasUserCoords && rankedCount > 0 && !projectError && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            Sorted by distance from your current location.
          </p>
        )}

        {selectedProjectContext?.nearestAddress && selectedProjectContext.distanceMeters != null && !projectError && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/50 dark:bg-blue-950/30">
            <MapPin
              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 text-xs leading-tight">
              <p className="font-semibold text-blue-900 dark:text-blue-200">
                {selectedProjectContext.nearestAddress.label}
                <span className="ml-1.5 font-mono font-bold">
                  · {formatDistanceUS(selectedProjectContext.distanceMeters)} away
                </span>
              </p>
              <p className="mt-0.5 text-blue-800/80 dark:text-blue-300/80">
                {selectedProjectContext.nearestAddress.address_line1},{' '}
                {selectedProjectContext.nearestAddress.city},{' '}
                {selectedProjectContext.nearestAddress.state}
              </p>
            </div>
          </div>
        )}
      </div>

      {taskRequired && projectId && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <label
              htmlFor="time-clock-task"
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
            >
              Task
              <span className="ml-1 text-red-500 dark:text-red-400" aria-hidden="true">
                *
              </span>
            </label>
          </div>
          {tasksLoading ? (
            <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800/60">
              <LoadingSpinner size="sm" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Loading tasks…
              </p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              This project has no tasks yet. Ask an admin to add one.
            </div>
          ) : (
            <Select
              name="time-clock-task"
              options={taskOptions}
              value={taskId ?? ''}
              onChange={(val) => onTaskChange(val || null)}
              placeholder="Select a task…"
              searchable={tasks.length > 5}
              disabled={disabled}
              required
              error={taskError}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default ProjectTaskSelector;
