'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import type { GanttTask, ProjectGanttListItem } from '@/lib/types/projects';
import '@/styles/frappe-gantt.css';

type ViewMode = 'Day' | 'Week' | 'Month';

interface GanttChartProps {
  tasks: GanttTask[];
  projectId?: string;
  onTaskClick?: (taskId: string) => void;
}

interface MultiProjectGanttProps {
  projects: ProjectGanttListItem[];
}

// Color mapping for task status
function getTaskClass(task: GanttTask): string {
  if (task.is_delayed) return 'gantt-bar-delayed';
  switch (task.status) {
    case 'done': return 'gantt-bar-done';
    case 'in_progress': return 'gantt-bar-progress';
    case 'blocked': return 'gantt-bar-blocked';
    case 'not_started':
    default: return 'gantt-bar-notstarted';
  }
}

// Convert our API task to frappe-gantt format
function toFrappeTask(task: GanttTask) {
  const start = task.estimated_start_date || task.actual_start_date;
  const end = task.estimated_end_date || task.actual_end_date;

  // frappe-gantt needs valid dates - skip tasks without dates
  if (!start || !end) return null;

  const progress = task.status === 'done' ? 100 :
                   task.status === 'in_progress' ? 50 :
                   0;

  const deps = task.dependencies.map(d => d.depends_on_task_id).join(', ');

  return {
    id: task.id,
    name: `${task.title}${task.assignees.length > 0 ? ' (' + task.assignees.map(a => a.name).join(', ') + ')' : ''}`,
    start: start.split('T')[0],
    end: end.split('T')[0],
    progress,
    dependencies: deps || '',
    custom_class: getTaskClass(task),
  };
}

export function SingleProjectGantt({ tasks, projectId, onTaskClick }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<unknown>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Week');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const frappeTasks = tasks
      .sort((a, b) => a.order_index - b.order_index)
      .map(toFrappeTask)
      .filter((t): t is NonNullable<typeof t> => t !== null);

    if (frappeTasks.length === 0) {
      containerRef.current.innerHTML = '';
      return;
    }

    // Dynamic import of frappe-gantt (not SSR-compatible)
    const loadGantt = async () => {
      try {
        const GanttModule = await import('frappe-gantt');
        const Gantt = GanttModule.default;

        // Clear previous instance
        containerRef.current!.innerHTML = '';

        // Create SVG container
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.id = `gantt-${projectId || 'chart'}`;
        containerRef.current!.appendChild(svgElement);

        ganttRef.current = new Gantt(svgElement, frappeTasks, {
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          on_click: (task: { id: string }) => {
            if (onTaskClick) onTaskClick(task.id);
          },
          custom_popup_html: (task: { name: string; _start: Date; _end: Date; progress: number }) => {
            const startDate = task._start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endDate = task._end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `
              <div class="gantt-popup">
                <div style="font-weight:600;margin-bottom:4px">${task.name}</div>
                <div style="font-size:12px;color:#666">${startDate} - ${endDate}</div>
                <div style="font-size:12px;color:#666">Progress: ${task.progress}%</div>
              </div>
            `;
          },
        });
      } catch (err) {
        console.error('Failed to load Gantt chart:', err);
      }
    };

    loadGantt();
  }, [mounted, tasks, viewMode, projectId, onTaskClick]);

  // Change view mode on existing instance
  useEffect(() => {
    if (ganttRef.current && typeof (ganttRef.current as { change_view_mode: (mode: string) => void }).change_view_mode === 'function') {
      (ganttRef.current as { change_view_mode: (mode: string) => void }).change_view_mode(viewMode);
    }
  }, [viewMode]);

  const noScheduledTasks = tasks.every(t => !t.estimated_start_date && !t.estimated_end_date);

  return (
    <div className="space-y-4">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Zoom:</span>
        {(['Day', 'Week', 'Month'] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode(mode)}
          >
            {mode}
          </Button>
        ))}
      </div>

      {/* Color Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-500" />
          <span className="text-gray-600 dark:text-gray-400">Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-500" />
          <span className="text-gray-600 dark:text-gray-400">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-500" />
          <span className="text-gray-600 dark:text-gray-400">Blocked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-gray-600 dark:text-gray-400">Delayed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">Not Started</span>
        </div>
      </div>

      {/* Chart Container */}
      {noScheduledTasks ? (
        <div className="p-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No tasks have scheduled dates. Add start and end dates to tasks to see them on the Gantt chart.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div ref={containerRef} className="gantt-container min-h-[200px]" />
        </div>
      )}

      {/* Custom CSS for gantt bar colors */}
      <style jsx global>{`
        .gantt-bar-done .bar-progress, .gantt-bar-done .bar { fill: #22c55e !important; }
        .gantt-bar-progress .bar-progress, .gantt-bar-progress .bar { fill: #3b82f6 !important; }
        .gantt-bar-blocked .bar-progress, .gantt-bar-blocked .bar { fill: #eab308 !important; }
        .gantt-bar-delayed .bar-progress, .gantt-bar-delayed .bar { fill: #ef4444 !important; }
        .gantt-bar-notstarted .bar-progress, .gantt-bar-notstarted .bar { fill: #9ca3af !important; }
        .gantt-bar-project .bar-progress, .gantt-bar-project .bar { fill: #6366f1 !important; }
        .gantt-container .gantt .grid-header { fill: #f9fafb; }
        .dark .gantt-container .gantt .grid-header { fill: #1f2937; }
        .gantt-container .gantt .grid-row { fill: transparent; }
        .gantt-container .gantt .grid-row:nth-child(even) { fill: #f9fafb; }
        .dark .gantt-container .gantt .grid-row:nth-child(even) { fill: #111827; }
        .gantt-container .gantt .row-line { stroke: #e5e7eb; }
        .dark .gantt-container .gantt .row-line { stroke: #374151; }
        .gantt-container .gantt .tick { stroke: #e5e7eb; }
        .dark .gantt-container .gantt .tick { stroke: #374151; }
        .gantt-container .gantt .bar-label { fill: #fff; font-size: 11px; }
        .gantt-container .gantt .lower-text, .gantt-container .gantt .upper-text { fill: #6b7280; font-size: 12px; }
        .dark .gantt-container .gantt .lower-text, .dark .gantt-container .gantt .upper-text { fill: #9ca3af; }
        .gantt-popup { padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .dark .gantt-popup { background: #1f2937; border-color: #374151; color: #e5e7eb; }
      `}</style>
    </div>
  );
}

export function MultiProjectGantt({ projects }: MultiProjectGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('Month');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current) return;

    const frappeTasks = projects
      .filter(p => p.start_date && p.target_completion_date)
      .map(p => ({
        id: p.id,
        name: `${p.project_number} - ${p.name} (${p.progress_percent.toFixed(0)}%)`,
        start: (p.start_date || '').split('T')[0],
        end: (p.target_completion_date || p.start_date || '').split('T')[0],
        progress: p.progress_percent,
        dependencies: '',
        custom_class: 'gantt-bar-project',
      }));

    if (frappeTasks.length === 0) {
      containerRef.current.innerHTML = '';
      return;
    }

    const loadGantt = async () => {
      try {
        const GanttModule = await import('frappe-gantt');
        const Gantt = GanttModule.default;

        containerRef.current!.innerHTML = '';
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.id = 'gantt-multi';
        containerRef.current!.appendChild(svgElement);

        new Gantt(svgElement, frappeTasks, {
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          on_click: (task: { id: string }) => {
            router.push(`/projects/${task.id}`);
          },
          custom_popup_html: (task: { name: string; _start: Date; _end: Date; progress: number }) => {
            const startDate = task._start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const endDate = task._end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return `
              <div class="gantt-popup">
                <div style="font-weight:600;margin-bottom:4px">${task.name}</div>
                <div style="font-size:12px;color:#666">${startDate} - ${endDate}</div>
                <div style="font-size:12px;color:#666">Progress: ${task.progress.toFixed(0)}%</div>
              </div>
            `;
          },
        });
      } catch (err) {
        console.error('Failed to load Gantt chart:', err);
      }
    };

    loadGantt();
  }, [mounted, projects, viewMode, router]);

  const projectsWithDates = projects.filter(p => p.start_date && p.target_completion_date);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Zoom:</span>
        {(['Day', 'Week', 'Month'] as ViewMode[]).map((mode) => (
          <Button
            key={mode}
            variant={viewMode === mode ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode(mode)}
          >
            {mode}
          </Button>
        ))}
      </div>

      {projectsWithDates.length === 0 ? (
        <div className="p-12 text-center bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No projects have both start and target dates set. Add dates to projects to see them on the timeline.</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div ref={containerRef} className="gantt-container min-h-[200px]" />
        </div>
      )}

      <style jsx global>{`
        .gantt-bar-done .bar-progress, .gantt-bar-done .bar { fill: #22c55e !important; }
        .gantt-bar-progress .bar-progress, .gantt-bar-progress .bar { fill: #3b82f6 !important; }
        .gantt-bar-blocked .bar-progress, .gantt-bar-blocked .bar { fill: #eab308 !important; }
        .gantt-bar-delayed .bar-progress, .gantt-bar-delayed .bar { fill: #ef4444 !important; }
        .gantt-bar-notstarted .bar-progress, .gantt-bar-notstarted .bar { fill: #9ca3af !important; }
        .gantt-bar-project .bar-progress, .gantt-bar-project .bar { fill: #6366f1 !important; }
        .gantt-container .gantt .grid-header { fill: #f9fafb; }
        .dark .gantt-container .gantt .grid-header { fill: #1f2937; }
        .gantt-container .gantt .grid-row { fill: transparent; }
        .gantt-container .gantt .grid-row:nth-child(even) { fill: #f9fafb; }
        .dark .gantt-container .gantt .grid-row:nth-child(even) { fill: #111827; }
        .gantt-container .gantt .row-line { stroke: #e5e7eb; }
        .dark .gantt-container .gantt .row-line { stroke: #374151; }
        .gantt-container .gantt .tick { stroke: #e5e7eb; }
        .dark .gantt-container .gantt .tick { stroke: #374151; }
        .gantt-container .gantt .bar-label { fill: #fff; font-size: 11px; }
        .gantt-container .gantt .lower-text, .gantt-container .gantt .upper-text { fill: #6b7280; font-size: 12px; }
        .dark .gantt-container .gantt .lower-text, .dark .gantt-container .gantt .upper-text { fill: #9ca3af; }
        .gantt-popup { padding: 8px 12px; background: white; border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .dark .gantt-popup { background: #1f2937; border-color: #374151; color: #e5e7eb; }
      `}</style>
    </div>
  );
}
