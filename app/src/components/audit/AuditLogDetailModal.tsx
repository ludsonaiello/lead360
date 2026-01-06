// Audit Log Detail Modal
// Full details of a single audit log entry with tabs

'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { BeforeAfterDiff } from './BeforeAfterDiff';
import { ActionTypeBadge } from './ActionTypeBadge';
import { StatusBadge } from './StatusBadge';
import { Copy, Download, AlertCircle } from 'lucide-react';
import { getAuditLog } from '@/lib/api/audit';
import {
  formatAbsoluteTime,
  formatActorName,
  formatEntityType,
  formatIpAddress,
  formatUserAgent
} from '@/lib/utils/audit-helpers';
import type { AuditLog } from '@/lib/types/audit';
import toast from 'react-hot-toast';

interface AuditLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  logId: string;
  tenantId?: string; // Optional: For Platform Admin viewing cross-tenant logs
}

type TabType = 'changes' | 'metadata' | 'raw';

/**
 * Modal for displaying full audit log details
 *
 * Features:
 * - Fetches full log details on open
 * - 3 tabs: Changes, Metadata, Raw JSON
 * - Copy/Download buttons
 * - Loading and error states
 * - Supports cross-tenant access for Platform Admin (via tenantId)
 *
 * Tabs:
 * 1. Changes - BeforeAfterDiff component
 * 2. Metadata - Key-value display of metadata_json
 * 3. Raw JSON - Syntax-highlighted JSON with copy/download
 *
 * @example
 * ```tsx
 * // Tenant user view
 * <AuditLogDetailModal
 *   isOpen={!!selectedLog}
 *   onClose={() => setSelectedLog(null)}
 *   logId={selectedLog?.id || ''}
 * />
 *
 * // Platform Admin cross-tenant view
 * <AuditLogDetailModal
 *   isOpen={!!selectedLog}
 *   onClose={() => setSelectedLog(null)}
 *   logId={selectedLog?.id || ''}
 *   tenantId={selectedLog?.tenant_id || undefined}
 * />
 * ```
 */
export function AuditLogDetailModal({
  isOpen,
  onClose,
  logId,
  tenantId
}: AuditLogDetailModalProps) {
  const [log, setLog] = useState<AuditLog | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('changes');

  // Fetch log details when modal opens
  useEffect(() => {
    if (isOpen && logId) {
      fetchLogDetails();
    }
  }, [isOpen, logId, tenantId]);

  const fetchLogDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAuditLog(logId, tenantId);
      setLog(data);
      setActiveTab('changes'); // Reset to changes tab
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load audit log details');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy JSON to clipboard
  const handleCopyJson = async () => {
    if (!log) return;

    const json = JSON.stringify(log, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      toast.success('Copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Download JSON file
  const handleDownloadJson = () => {
    if (!log) return;

    const json = JSON.stringify(log, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-${log.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Audit Log Details
        </h2>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Error loading details</p>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        )}

        {/* Log Details */}
        {log && !isLoading && (
          <>
            {/* Metadata Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-md">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Action</span>
                <div className="mt-1">
                  <ActionTypeBadge actionType={log.action_type} />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
                <div className="mt-1">
                  <StatusBadge status={log.status} showLabel />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Entity Type</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatEntityType(log.entity_type)}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Entity ID</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">
                  {log.entity_id}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Actor</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatActorName(log)}
                  {log.actor?.email && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{log.actor.email}</span>
                  )}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Timestamp</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatAbsoluteTime(log.created_at)}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">IP Address</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-mono">
                  {formatIpAddress(log.ip_address)}
                </p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">User Agent</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {formatUserAgent(log.user_agent)}
                </p>
              </div>

              {log.error_message && (
                <div className="md:col-span-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Error Message</span>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {log.error_message}
                  </p>
                </div>
              )}

              <div className="md:col-span-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</span>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {log.description}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <nav className="flex gap-4">
                <button
                  onClick={() => setActiveTab('changes')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'changes'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Changes
                </button>
                <button
                  onClick={() => setActiveTab('metadata')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'metadata'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Metadata
                </button>
                <button
                  onClick={() => setActiveTab('raw')}
                  className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'raw'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Raw JSON
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="max-h-96 overflow-y-auto">
              {activeTab === 'changes' && (
                <BeforeAfterDiff before={log.before_json} after={log.after_json} />
              )}

              {activeTab === 'metadata' && (
                <div>
                  {log.metadata_json && Object.keys(log.metadata_json).length > 0 ? (
                    <dl className="space-y-3">
                      {Object.entries(log.metadata_json).map(([key, value]) => (
                        <div key={key} className="flex gap-4">
                          <dt className="font-medium text-sm text-gray-700 dark:text-gray-300 w-1/3">
                            {key}:
                          </dt>
                          <dd className="text-sm text-gray-900 dark:text-gray-100 w-2/3 font-mono break-all">
                            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                      No metadata available
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'raw' && (
                <pre className="p-4 bg-gray-100 dark:bg-gray-900 rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(log, null, 2)}
                </pre>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal Actions */}
      <ModalActions>
        {log && (
          <>
            <Button variant="secondary" onClick={handleCopyJson} className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              Copy JSON
            </Button>
            <Button variant="secondary" onClick={handleDownloadJson} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download JSON
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
