/**
 * Portal Project Detail Page
 * Shows project status, progress, tasks, permits, public logs, and photo gallery.
 * Protected by portal JWT authentication.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Shield,
  FileText,
  Image as ImageIcon,
  CloudRain,
  User,
  ChevronDown,
  ChevronUp,
  X,
  LogOut,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PortalShell } from '@/components/portal/PortalShell';
import { buildFileUrl } from '@/lib/api/files';
import {
  getTenantBranding,
  getPortalProject,
  getPortalProjectLogs,
  getPortalProjectPhotos,
} from '@/lib/api/portal';
import { extractTenantSlug, sanitizeHexColor } from '@/lib/utils/portal';
import type {
  PortalBranding,
  PortalProjectDetail,
  PortalTask,
  PortalPermit,
  PortalLog,
  PortalPhoto,
} from '@/lib/types/portal';

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const projectStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  on_hold: { label: 'On Hold', color: 'text-red-700', bg: 'bg-red-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

const taskStatusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  not_started: { label: 'Not Started', icon: <Clock className="w-4 h-4" />, color: 'text-gray-400' },
  in_progress: { label: 'In Progress', icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-amber-500' },
  blocked: { label: 'Blocked', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-500' },
  done: { label: 'Done', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-500' },
};

const permitStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending_application: { label: 'Pending', color: 'text-gray-600', bg: 'bg-gray-100' },
  submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100' },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100' },
  active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bg: 'bg-gray-100' },
};

// ============================================================================
// Page
// ============================================================================

export default function PortalProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerSlug = params?.customerSlug as string;
  const projectId = params?.id as string;

  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [project, setProject] = useState<PortalProjectDetail | null>(null);
  const [logs, setLogs] = useState<PortalLog[]>([]);
  const [photos, setPhotos] = useState<PortalPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'photos'>('overview');
  const [lightboxPhoto, setLightboxPhoto] = useState<PortalPhoto | null>(null);

  const token = typeof window !== 'undefined' ? Cookies.get('portal_token') || '' : '';

  // Auth check
  useEffect(() => {
    if (typeof window !== 'undefined' && !Cookies.get('portal_token')) {
      router.replace('/public/login');
    }
  }, [router]);

  // Fetch branding
  useEffect(() => {
    const slug = extractTenantSlug();
    if (!slug) { setBrandingLoading(false); return; }
    getTenantBranding(slug)
      .then(setBranding)
      .catch(() => {})
      .finally(() => setBrandingLoading(false));
  }, []);

  // Fetch project
  const fetchProject = useCallback(async () => {
    if (!token || !customerSlug || !projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPortalProject(token, customerSlug, projectId);
      setProject(data);
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (apiErr?.response?.status === 401 || apiErr?.response?.status === 403) {
        Cookies.remove('portal_token', { path: '/' });
        router.replace('/public/login');
        return;
      }
      setError(apiErr?.response?.data?.message || 'Failed to load project.');
    } finally {
      setLoading(false);
    }
  }, [token, customerSlug, projectId, router]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!token || !customerSlug || !projectId) return;
    setLogsLoading(true);
    try {
      const data = await getPortalProjectLogs(token, customerSlug, projectId, { limit: 50 });
      setLogs(data.data);
    } catch {
      // Non-blocking
    } finally {
      setLogsLoading(false);
    }
  }, [token, customerSlug, projectId]);

  // Fetch photos
  const fetchPhotos = useCallback(async () => {
    if (!token || !customerSlug || !projectId) return;
    setPhotosLoading(true);
    try {
      const data = await getPortalProjectPhotos(token, customerSlug, projectId, { limit: 50 });
      setPhotos(data.data);
    } catch {
      // Non-blocking
    } finally {
      setPhotosLoading(false);
    }
  }, [token, customerSlug, projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const primaryColor = sanitizeHexColor(branding?.primary_color, '#1e40af');
  const status = project ? (projectStatusConfig[project.status] || projectStatusConfig.planned) : null;
  const completedTasks = project?.tasks.filter((t) => t.status === 'done').length || 0;
  const totalTasks = project?.tasks.length || 0;

  return (
    <PortalShell branding={branding} brandingLoading={brandingLoading}>
      {/* Back + Logout */}
      <div className="flex items-center justify-between mb-4">
        <a
          href={`/public/${customerSlug}`}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </a>
        <button
          onClick={() => {
            Cookies.remove('portal_token', { path: '/' });
            Cookies.remove('portal_customer_slug', { path: '/' });
            Cookies.remove('portal_customer_name', { path: '/' });
            router.replace('/public/login');
          }}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button onClick={fetchProject} className="mt-4 text-sm font-medium hover:underline" style={{ color: primaryColor }}>
            Try again
          </button>
        </div>
      ) : project ? (
        <div className="space-y-6">
          {/* Project header card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{project.name}</h2>
                <p className="text-sm text-gray-400 mt-0.5">{project.project_number}</p>
              </div>
              {status && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status.bg} ${status.color} self-start`}>
                  {status.label}
                </span>
              )}
            </div>

            {project.description && (
              <p className="text-gray-600 text-sm mb-4">{project.description}</p>
            )}

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1.5">
                <span>Overall Progress</span>
                <span className="font-semibold">{Math.round(project.progress_percent)}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(project.progress_percent, 100)}%`, backgroundColor: primaryColor }}
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <DateCard label="Start Date" value={formatDate(project.start_date)} />
              <DateCard label="Target Completion" value={formatDate(project.target_completion_date)} />
              {project.actual_completion_date && (
                <DateCard label="Completed" value={formatDate(project.actual_completion_date)} />
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['overview', 'logs', 'photos'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'logs' ? `Logs (${logs.length})` : `Photos (${photos.length})`}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Tasks */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" style={{ color: primaryColor }} />
                    Tasks ({completedTasks}/{totalTasks} completed)
                  </h3>
                </div>
                {project.tasks.length === 0 ? (
                  <div className="px-5 py-8 text-center text-gray-400 text-sm">No tasks scheduled yet</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {project.tasks
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((task) => (
                        <TaskRow key={task.id} task={task} />
                      ))}
                  </div>
                )}
              </div>

              {/* Permits */}
              {project.permit_required && project.permits.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Shield className="w-5 h-5" style={{ color: primaryColor }} />
                      Permits
                    </h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {project.permits.map((permit) => (
                      <PermitRow key={permit.id} permit={permit} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <LogsSection logs={logs} loading={logsLoading} />
          )}

          {activeTab === 'photos' && (
            <PhotosSection
              photos={photos}
              loading={photosLoading}
              onPhotoClick={setLightboxPhoto}
            />
          )}
        </div>
      ) : null}

      {/* Lightbox */}
      {lightboxPhoto && (
        <Lightbox photo={lightboxPhoto} onClose={() => setLightboxPhoto(null)} />
      )}
    </PortalShell>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-gray-400" />
        {value}
      </p>
    </div>
  );
}

function TaskRow({ task }: { task: PortalTask }) {
  const config = taskStatusConfig[task.status] || taskStatusConfig.not_started;
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className={config.color}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
          {task.title}
        </p>
        {(task.estimated_start_date || task.estimated_end_date) && (
          <p className="text-xs text-gray-400 mt-0.5">
            {formatDate(task.estimated_start_date)} — {formatDate(task.estimated_end_date)}
          </p>
        )}
      </div>
      <span className={`text-xs font-medium ${config.color} hidden sm:block`}>{config.label}</span>
    </div>
  );
}

function PermitRow({ permit }: { permit: PortalPermit }) {
  const config = permitStatusConfig[permit.status] || permitStatusConfig.pending_application;
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <Shield className="w-4 h-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-800">{permit.permit_type}</p>
          <p className="text-xs text-gray-400">
            {permit.submitted_date ? `Submitted: ${formatDate(permit.submitted_date)}` : 'Not submitted'}
            {permit.approved_date && ` · Approved: ${formatDate(permit.approved_date)}`}
          </p>
        </div>
      </div>
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
}

function LogsSection({ logs, loading }: { logs: PortalLog[]; loading: boolean }) {
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>;
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No project logs available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {logs.map((log) => {
        const isExpanded = expandedLog === log.id;
        return (
          <div key={log.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedLog(isExpanded ? null : log.id)}
              className="w-full px-5 py-4 text-left flex items-start justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {formatDate(log.log_date)}
                  </span>
                  {log.weather_delay && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                      <CloudRain className="w-3 h-3" />
                      Weather Delay
                    </span>
                  )}
                </div>
                <p className={`text-sm text-gray-600 ${isExpanded ? '' : 'line-clamp-2'}`}>
                  {log.content}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
              )}
            </button>

            {isExpanded && (
              <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
                {log.author && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.author}
                  </p>
                )}

                {log.attachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {log.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={buildFileUrl(att.file_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {att.file_type === 'photo' ? (
                          <img
                            src={buildFileUrl(att.file_url)}
                            alt={att.file_name}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                        ) : (
                          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <FileText className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-600 truncate">{att.file_name}</span>
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhotosSection({
  photos,
  loading,
  onPhotoClick,
}: {
  photos: PortalPhoto[];
  loading: boolean;
  onPhotoClick: (photo: PortalPhoto) => void;
}) {
  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="md" /></div>;
  }

  if (photos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
        <ImageIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No photos available yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo) => (
        <button
          key={photo.id}
          onClick={() => onPhotoClick(photo)}
          className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow bg-gray-100"
        >
          <img
            src={buildFileUrl(photo.thumbnail_url || photo.file_url)}
            alt={photo.caption || 'Project photo'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {photo.caption && (
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="text-white text-xs truncate">{photo.caption}</p>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function Lightbox({ photo, onClose }: { photo: PortalPhoto; onClose: () => void }) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <img
          src={buildFileUrl(photo.file_url)}
          alt={photo.caption || 'Project photo'}
          className="w-full max-h-[80vh] object-contain rounded-lg"
        />
        {(photo.caption || photo.taken_at) && (
          <div className="text-center mt-3 space-y-1">
            {photo.caption && <p className="text-white text-sm">{photo.caption}</p>}
            {photo.taken_at && <p className="text-white/60 text-xs">{formatDate(photo.taken_at)}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
