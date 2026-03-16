'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useRBAC } from '@/contexts/RBACContext';
import { getProjectGanttData } from '@/lib/api/projects';
import type { ProjectGanttData } from '@/lib/types/projects';
import { SingleProjectGantt } from '../../components/GanttChart';

export default function ProjectGanttPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const projectId = params.id as string;

  const [data, setData] = useState<ProjectGanttData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await getProjectGanttData(projectId);
        setData(result);
      } catch (err: unknown) {
        const error = err as { message?: string };
        setError(error.message || 'Failed to load Gantt data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (rbacLoading) return null;

  if (!hasPermission('projects:view')) {
    router.push('/forbidden');
    return null;
  }

  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (error || !data) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{error || 'Failed to load Gantt data'}</h2>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Back to Project
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Project
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{data.project.name} — Gantt Chart</h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Progress: {data.project.progress_percent.toFixed(0)}%</span>
          <span>{data.tasks.length} task{data.tasks.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Gantt Chart */}
      {data.tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">No tasks in this project yet. Add tasks to see them on the Gantt chart.</p>
        </Card>
      ) : (
        <SingleProjectGantt
          tasks={data.tasks}
          projectId={projectId}
        />
      )}
    </div>
  );
}
