'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  DollarSign,
  ClipboardList,
  User,
  Clock,
  FileText,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { Project, ProjectFinancialSummary } from '@/lib/types/projects';
import { getProjectSummary, formatCurrency, formatDate } from '@/lib/api/projects';

interface ProjectOverviewTabProps {
  project: Project;
}

export default function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getProjectSummary(project.id);
        setSummary(data);
      } catch {
        // Summary is optional — fail silently
      } finally {
        setSummaryLoading(false);
      }
    };
    loadSummary();
  }, [project.id]);

  return (
    <div className="space-y-6 mt-6">
      {/* Key Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Key Dates */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Key Dates</h3>
          </div>
          <div className="space-y-3">
            <InfoRow label="Start Date" value={formatDate(project.start_date)} />
            <InfoRow label="Target Completion" value={formatDate(project.target_completion_date)} />
            <InfoRow label="Actual Completion" value={formatDate(project.actual_completion_date)} />
            <InfoRow label="Created" value={formatDate(project.created_at)} />
          </div>
        </Card>

        {/* Project Details */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Project Details</h3>
          </div>
          <div className="space-y-3">
            <InfoRow label="Project Number" value={project.project_number} />
            <InfoRow label="Type" value={project.is_standalone ? 'Standalone' : 'From Quote'} />
            {project.assigned_pm && (
              <InfoRow label="Project Manager" value={`${project.assigned_pm.first_name} ${project.assigned_pm.last_name}`} />
            )}
            <InfoRow label="Permit Required" value={project.permit_required ? 'Yes' : 'No'} />
            <InfoRow label="Portal Enabled" value={project.portal_enabled ? 'Yes' : 'No'} />
            {project.created_by_user && (
              <InfoRow label="Created By" value={`${project.created_by_user.first_name} ${project.created_by_user.last_name}`} />
            )}
          </div>
        </Card>
      </div>

      {/* Description */}
      {project.description && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Description</h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.description}</p>
        </Card>
      )}

      {/* Notes */}
      {project.notes && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Notes</h3>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{project.notes}</p>
        </Card>
      )}

      {/* Financial Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Financial Summary</h3>
        </div>
        {summaryLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner size="md" />
          </div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FinancialCard label="Contract Value" value={formatCurrency(summary.contract_value)} />
              <FinancialCard label="Estimated Cost" value={formatCurrency(summary.estimated_cost)} />
              <FinancialCard label="Actual Cost" value={formatCurrency(summary.total_actual_cost)} />
              <FinancialCard
                label="Margin"
                value={
                  summary.contract_value && summary.total_actual_cost !== undefined
                    ? formatCurrency(summary.contract_value - summary.total_actual_cost)
                    : '-'
                }
                highlight={
                  summary.contract_value && summary.total_actual_cost !== undefined
                    ? summary.contract_value - summary.total_actual_cost >= 0
                    : undefined
                }
              />
            </div>

            {/* Cost Breakdown */}
            {summary.entry_count > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Cost Breakdown</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(summary.cost_by_category).map(([category, amount]) => (
                    <div key={category} className="text-center p-2 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{category}</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Progress */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span>Tasks: {summary.completed_task_count}/{summary.task_count} completed</span>
              <span>Financial entries: {summary.entry_count}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">Financial summary unavailable</p>
        )}
      </Card>

      {/* Linked Resources */}
      {(project.quote || project.lead) && (
        <Card className="p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Linked Resources</h3>
          <div className="space-y-2">
            {project.quote && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Quote:</span>
                <Link
                  href={`/quotes/${project.quote.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {project.quote.quote_number} - {project.quote.title}
                </Link>
              </div>
            )}
            {project.lead && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                <Link
                  href={`/leads/${project.lead.id}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {project.lead.first_name} {project.lead.last_name}
                </Link>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  );
}

function FinancialCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${
        highlight === true ? 'text-green-600 dark:text-green-400' :
        highlight === false ? 'text-red-600 dark:text-red-400' :
        'text-gray-900 dark:text-gray-100'
      }`}>
        {value}
      </p>
    </div>
  );
}
