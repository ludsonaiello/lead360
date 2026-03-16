'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Image,
  ScrollText,
  Shield,
  DollarSign,
  CheckSquare,
  AlertTriangle,
} from 'lucide-react';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { useRBAC } from '@/contexts/RBACContext';
import { getProjectById } from '@/lib/api/projects';
import type { Project } from '@/lib/types/projects';
import ProjectHeader from './components/ProjectHeader';
import ProjectOverviewTab from './components/ProjectOverviewTab';
import TasksTab from './components/TasksTab';
import LogsTab from './components/LogsTab';
import PhotosTab from './components/PhotosTab';
import EditProjectModal from './components/EditProjectModal';
import StatusChangeModal from './components/StatusChangeModal';

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tasks', label: 'Tasks', icon: ClipboardList },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'permits', label: 'Permits', icon: Shield },
  { id: 'financial', label: 'Financial', icon: DollarSign },
  { id: 'completion', label: 'Completion', icon: CheckSquare },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission, loading: rbacLoading } = useRBAC();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getProjectById(projectId);
        setProject(data);
      } catch (err: unknown) {
        const error = err as { message?: string; status?: number };
        if (error.status === 404) {
          setError('Project not found');
        } else {
          setError(error.message || 'Failed to load project');
        }
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId]);

  // Permission check
  if (rbacLoading) return null;

  if (!hasPermission('projects:view')) {
    router.push('/forbidden');
    return null;
  }

  const canEdit = hasPermission('projects:edit');

  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  if (error || !project) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">{error || 'Project not found'}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-4">The project you are looking for does not exist or you do not have permission to view it.</p>
        <button
          onClick={() => router.push('/projects')}
          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Back to Projects
        </button>
      </Card>
    );
  }

  const handleProjectUpdated = (updated: Project) => {
    setProject(updated);
  };

  const handleRefreshProject = async () => {
    try {
      const data = await getProjectById(projectId);
      setProject(data);
    } catch {
      // ignore
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <ProjectOverviewTab project={project} />;
      case 'tasks':
        return <TasksTab projectId={projectId} onTaskCountChange={handleRefreshProject} />;
      case 'logs':
        return <LogsTab projectId={projectId} />;
      case 'photos':
        return <PhotosTab projectId={projectId} />;
      case 'documents':
      case 'permits':
      case 'financial':
      case 'completion':
        return (
          <Card className="p-12 text-center mt-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              This tab will be available in a future sprint.
            </p>
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ProjectHeader
        project={project}
        onEditClick={() => setShowEditModal(true)}
        onStatusChangeClick={() => setShowStatusModal(true)}
        canEdit={canEdit}
      />

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {renderTabContent()}

      {/* Modals */}
      {showEditModal && (
        <EditProjectModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleProjectUpdated}
          project={project}
        />
      )}

      {showStatusModal && (
        <StatusChangeModal
          isOpen={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          onSuccess={handleProjectUpdated}
          project={project}
        />
      )}
    </div>
  );
}
