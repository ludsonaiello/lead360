/**
 * Portal Project List
 * Displays customer's projects with status, progress, and dates.
 * Protected by portal JWT authentication.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import {
  FolderKanban,
  Calendar,
  ArrowRight,
  LogOut,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PortalShell } from '@/components/portal/PortalShell';
import { getTenantBranding, listPortalProjects } from '@/lib/api/portal';
import { extractTenantSlug, sanitizeHexColor } from '@/lib/utils/portal';
import type { PortalBranding, PortalProject } from '@/lib/types/portal';

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

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Planned', color: 'text-blue-700', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  on_hold: { label: 'On Hold', color: 'text-red-700', bg: 'bg-red-100' },
  completed: { label: 'Completed', color: 'text-green-700', bg: 'bg-green-100' },
};

// ============================================================================
// Page
// ============================================================================

export default function PortalProjectListPage() {
  const params = useParams();
  const router = useRouter();
  const customerSlug = params?.customerSlug as string;

  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [brandingLoading, setBrandingLoading] = useState(true);
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Auth check
  const token = typeof window !== 'undefined' ? Cookies.get('portal_token') || '' : '';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!Cookies.get('portal_token')) {
        router.replace('/public/login');
        return;
      }
      setCustomerName(Cookies.get('portal_customer_name') || 'Customer');
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

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    if (!token || !customerSlug) return;
    setLoading(true);
    setError('');
    try {
      const response = await listPortalProjects(token, customerSlug, { limit: 100 });
      setProjects(response.data);
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (apiErr?.response?.status === 401 || apiErr?.response?.status === 403) {
        Cookies.remove('portal_token', { path: '/' });
        Cookies.remove('portal_customer_slug', { path: '/' });
        Cookies.remove('portal_customer_name', { path: '/' });
        router.replace('/public/login');
        return;
      }
      setError(apiErr?.response?.data?.message || 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [token, customerSlug, router]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleLogout = () => {
    Cookies.remove('portal_token', { path: '/' });
    Cookies.remove('portal_customer_slug', { path: '/' });
    Cookies.remove('portal_customer_name', { path: '/' });
    router.replace('/public/login');
  };

  const primaryColor = sanitizeHexColor(branding?.primary_color, '#1e40af');

  return (
    <PortalShell branding={branding} brandingLoading={brandingLoading}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Welcome, {customerName}
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">Your active projects</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors self-start"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={fetchProjects}
            className="mt-4 text-sm font-medium hover:underline"
            style={{ color: primaryColor }}
          >
            Try again
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No projects yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Your projects will appear here once they are started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => {
            const status = statusConfig[project.status] || statusConfig.planned;
            return (
              <a
                key={project.id}
                href={`/public/${customerSlug}/projects/${project.id}`}
                className="block bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all p-5 group"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${primaryColor}15` }}
                    >
                      <FolderKanban className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:underline">
                        {project.name}
                      </h3>
                      <p className="text-xs text-gray-400">{project.project_number}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-2 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span className="font-medium">{Math.round(project.progress_percent)}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(project.progress_percent, 100)}%`,
                        backgroundColor: primaryColor,
                      }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {project.start_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Start: {formatDate(project.start_date)}</span>
                    </div>
                  )}
                  {project.target_completion_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Target: {formatDate(project.target_completion_date)}</span>
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </PortalShell>
  );
}
