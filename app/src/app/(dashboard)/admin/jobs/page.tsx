/**
 * Background Jobs Management Page
 * Consolidated page with tab navigation for all job management features
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Activity,
  ListChecks,
  Clock,
  Mail,
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus,
  CheckCircle,
  XCircle,
} from 'lucide-react';

// UI Components
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { PaginationControls } from '@/components/ui/PaginationControls';

// Jobs Components
import { QueueHealthCard } from '@/components/jobs/QueueHealthCard';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobList } from '@/components/jobs/JobList';
import { JobDetailModal } from '@/components/jobs/JobDetailModal';
import { ScheduledJobCard } from '@/components/jobs/ScheduledJobCard';
import { ScheduleEditor } from '@/components/jobs/ScheduleEditor';
import { SmtpSettingsForm } from '@/components/jobs/SmtpSettingsForm';
import { EmailTemplateList } from '@/components/jobs/EmailTemplateList';

// Hooks
import { useJobs } from '@/lib/hooks/useJobs';
import { useScheduledJobs } from '@/lib/hooks/useScheduledJobs';
import { useEmailSettings } from '@/lib/hooks/useEmailSettings';

// API
import {
  retryJob,
  getScheduledJobs,
  getEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
} from '@/lib/api/jobs';

// Types
import type { Job, ScheduledJob, EmailTemplate, CreateEmailTemplateDto, UpdateEmailTemplateDto } from '@/lib/types/jobs';

const tabs: TabItem[] = [
  { id: 'queue-health', label: 'Queue Health', icon: Activity },
  { id: 'job-monitor', label: 'Job Monitor', icon: ListChecks },
  { id: 'scheduled-jobs', label: 'Scheduled Jobs', icon: Clock },
  { id: 'email-settings', label: 'Email Settings', icon: Mail },
  { id: 'email-templates', label: 'Email Templates', icon: FileText },
];

export default function JobsPage() {
  const router = useRouter();

  // Get tab from URL or default to 'queue-health'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tab') || 'queue-health';
    }
    return 'queue-health';
  });

  // Update URL when tab changes (without page reload)
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Background Jobs Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage background jobs, scheduled tasks, email settings, and templates
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'queue-health' && <QueueHealthTab />}
        {activeTab === 'job-monitor' && <JobMonitorTab />}
        {activeTab === 'scheduled-jobs' && <ScheduledJobsTab />}
        {activeTab === 'email-settings' && <EmailSettingsTab />}
        {activeTab === 'email-templates' && <EmailTemplatesTab />}
      </div>
    </div>
  );
}

// ============================================================================
// Tab 1: Queue Health
// ============================================================================

function QueueHealthTab() {
  return (
    <div className="space-y-6">
      <QueueHealthCard className="w-full" />

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
              About Queue Health
            </h3>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Monitor your BullMQ job queues in real-time. This shows jobs waiting to be processed,
              actively processing, completed, and failed. A healthy system should have low wait times
              and minimal failures.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab 2: Job Monitor
// ============================================================================

function JobMonitorTab() {
  const {
    jobs,
    pagination,
    filters,
    isLoading,
    error,
    setFilters,
    resetFilters,
    nextPage,
    previousPage,
    goToPage,
    refresh,
  } = useJobs({ autoRefresh: false });

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleJobClick = (job: Job) => {
    setSelectedJobId(job.id);
    setIsDetailModalOpen(true);
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
      toast.success('Job queued for retry');
      refresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to retry job');
    }
  };

  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Failed Jobs Alert */}
      {failedCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>{failedCount}</strong> failed job{failedCount !== 1 ? 's' : ''} in current view
              </p>
            </div>
            <Link href="/admin/jobs/failed">
              <Button variant="secondary" size="sm">
                View All Failed Jobs
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
        <JobFilters filters={filters} onFilterChange={setFilters} onReset={resetFilters} />
      </div>

      {/* Job List */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Jobs ({pagination.total_count})
        </h2>

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button variant="secondary" onClick={refresh} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <JobList
              jobs={jobs}
              isLoading={isLoading}
              onJobClick={handleJobClick}
              onRetry={handleRetry}
            />

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <PaginationControls
                  currentPage={pagination.current_page}
                  totalPages={pagination.total_pages}
                  onGoToPage={goToPage}
                  onNext={nextPage}
                  onPrevious={previousPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Job Detail Modal */}
      <JobDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        jobId={selectedJobId}
        onJobUpdated={refresh}
      />
    </div>
  );
}

// ============================================================================
// Tab 3: Scheduled Jobs
// ============================================================================

function ScheduledJobsTab() {
  const router = useRouter();
  const { enableJob, disableJob, triggerJob, updateSchedule } = useScheduledJobs();

  const [schedules, setSchedules] = useState<ScheduledJob[]>([]);
  const [summary, setSummary] = useState<{
    total_jobs: number;
    system_jobs: number;
    quote_reports: number;
    active_jobs: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduledJob | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'system' | 'quote-report'>('all');

  const fetchSchedules = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getScheduledJobs();
      setSchedules(response.data);
      if (response.summary) {
        setSummary(response.summary);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduled jobs');
      console.error('[ScheduledJobsTab] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      if (enabled) {
        await enableJob(id);
      } else {
        await disableJob(id);
      }
      // Refresh local state after hook completes
      await fetchSchedules();
    } catch (err: any) {
      console.error('[ScheduledJobsTab] Toggle error:', err);
      // Error toast already shown by hook
    }
  };

  const handleTrigger = async (id: string) => {
    try {
      await triggerJob(id);
      fetchSchedules();
    } catch (err: any) {
      console.error('[ScheduledJobsTab] Trigger error:', err);
    }
  };

  const handleEdit = (schedule: ScheduledJob) => {
    setSelectedSchedule(schedule);
    setIsEditorOpen(true);
  };

  const handleSave = async (data: any) => {
    if (!selectedSchedule) return;

    try {
      await updateSchedule(selectedSchedule.id, data);
      await fetchSchedules();
    } catch (err: any) {
      throw err;
    }
  };

  const handleViewHistory = (id: string) => {
    router.push(`/admin/jobs/schedules/${id}/history`);
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Scheduled Jobs
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage cron-based scheduled tasks
          </p>
        </div>
        <Button variant="ghost" onClick={fetchSchedules}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Jobs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.total_jobs}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">System Jobs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.system_jobs}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Quote Reports</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.quote_reports}
                </p>
              </div>
              <FileText className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {summary.active_jobs}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>
      )}

      {/* Filter Buttons */}
      {!isLoading && schedules.length > 0 && (
        <div className="flex items-center gap-2">
          <Button
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({schedules.length})
          </Button>
          <Button
            variant={filter === 'system' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('system')}
          >
            System Jobs ({schedules.filter(s => s.type === 'system' || s.job_type !== 'scheduled-report').length})
          </Button>
          <Button
            variant={filter === 'quote-report' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter('quote-report')}
          >
            Quote Reports ({schedules.filter(s => s.type === 'quote-report' || s.job_type === 'scheduled-report').length})
          </Button>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" onClick={fetchSchedules} className="mt-4">
            Retry
          </Button>
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No scheduled jobs found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {schedules
            .filter((schedule) => {
              if (filter === 'all') return true;
              if (filter === 'system') return schedule.type === 'system' || schedule.job_type !== 'scheduled-report';
              if (filter === 'quote-report') return schedule.type === 'quote-report' || schedule.job_type === 'scheduled-report';
              return true;
            })
            .map((schedule) => (
              <ScheduledJobCard
                key={schedule.id}
                schedule={schedule}
                onEdit={handleEdit}
                onTrigger={handleTrigger}
                onToggle={handleToggle}
                onViewHistory={handleViewHistory}
              />
            ))}
        </div>
      )}

      {/* Schedule Editor Modal */}
      <ScheduleEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================================
// Tab 4: Email Settings
// ============================================================================

function EmailSettingsTab() {
  const { settings, isLoading, error, updateSettings, testEmail, isSaving, isTesting } =
    useEmailSettings();

  const handleTest = async (email: string) => {
    await testEmail({ to_email: email });
  };

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Platform Email Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure SMTP settings for system emails
          </p>
        </div>
        {settings && (
          <div>
            {settings.is_verified ? (
              <Badge variant="success" icon={CheckCircle}>
                Verified
              </Badge>
            ) : (
              <Badge variant="warning" icon={XCircle}>
                Not Verified
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <SmtpSettingsForm
            settings={settings}
            onSave={updateSettings}
            onTest={handleTest}
            isSaving={isSaving}
            isTesting={isTesting}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Tab 5: Email Templates
// ============================================================================

function EmailTemplatesTab() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getEmailTemplates();
      setTemplates(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      console.error('[EmailTemplatesTab] Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleCreate = () => {
    router.push('/admin/jobs/email-templates/new');
  };

  const handleEdit = (template: EmailTemplate) => {
    router.push(`/admin/jobs/email-templates/${template.template_key}`);
  };


  const handleDelete = async (templateKey: string) => {
    try {
      await deleteEmailTemplate(templateKey);
      toast.success('Template deleted successfully');
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const handlePreview = async (template: EmailTemplate) => {
    setPreviewTemplate(template);

    // Generate sample variables
    const sampleVariables: Record<string, string> = {};
    template.variables.forEach((variable) => {
      sampleVariables[variable] = `[${variable}]`;
    });

    try {
      const preview = await previewEmailTemplate(template.template_key, {
        variables: sampleVariables,
      });
      setPreviewHtml(preview.html_body);
      setIsPreviewOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to preview template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Email Templates
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage Handlebars-based email templates
          </p>
        </div>
        <Button variant="primary" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-1" />
          Create Template
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button variant="secondary" onClick={fetchTemplates} className="mt-4">
            Retry
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <EmailTemplateList
            templates={templates}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPreview={handlePreview}
            isLoading={false}
          />
        </div>
      )}

      {/* Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Preview: ${previewTemplate?.template_key || ''}`}
        size="xl"
      >
        <ModalContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Subject
              </h4>
              <p className="text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 p-3 rounded">
                {previewTemplate?.subject}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                HTML Preview
              </h4>
              <div
                className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-white dark:bg-gray-900 overflow-auto max-h-96"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
