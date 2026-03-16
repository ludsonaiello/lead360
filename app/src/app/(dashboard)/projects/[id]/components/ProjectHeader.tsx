'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit2, GanttChart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Project } from '@/lib/types/projects';
import {
  formatProjectStatus,
  getStatusBadgeVariant,
  formatCurrency,
  formatPMName,
} from '@/lib/api/projects';

interface ProjectHeaderProps {
  project: Project;
  onEditClick: () => void;
  onStatusChangeClick: () => void;
  canEdit: boolean;
}

export default function ProjectHeader({ project, onEditClick, onStatusChangeClick, canEdit }: ProjectHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
            <button onClick={onStatusChangeClick} disabled={!canEdit}>
              <Badge
                variant={getStatusBadgeVariant(project.status)}
                label={formatProjectStatus(project.status)}
                className={canEdit ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
              />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="font-medium">{project.project_number}</span>
            {project.assigned_pm && (
              <span>PM: {formatPMName(project.assigned_pm)}</span>
            )}
            {project.contract_value !== null && (
              <span>Contract: {formatCurrency(project.contract_value)}</span>
            )}
            {project.estimated_cost !== null && (
              <span>Estimated: {formatCurrency(project.estimated_cost)}</span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-3 max-w-md">
            <div className="flex-1 h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  project.progress_percent >= 100 ? 'bg-green-500' :
                  project.progress_percent >= 50 ? 'bg-blue-500' :
                  'bg-blue-400'
                }`}
                style={{ width: `${Math.min(project.progress_percent, 100)}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {project.progress_percent.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/projects/${project.id}/gantt`}>
            <Button variant="ghost" size="sm">
              <GanttChart className="w-4 h-4" />
              <span className="hidden sm:inline">Gantt</span>
            </Button>
          </Link>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={onEditClick}>
              <Edit2 className="w-4 h-4" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
