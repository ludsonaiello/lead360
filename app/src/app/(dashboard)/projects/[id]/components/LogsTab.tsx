'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ScrollText,
  AlertTriangle,
  Trash2,
  Eye,
  CloudRain,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker } from '@/components/ui/DatePicker';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectLogs,
  deleteProjectLog,
  formatDate,
  getFileUrl,
} from '@/lib/api/projects';
import type { ProjectLog, ListLogsResponse } from '@/lib/types/projects';
import toast from 'react-hot-toast';
import CreateLogModal from './CreateLogModal';

interface LogsTabProps {
  projectId: string;
}

export default function LogsTab({ projectId }: LogsTabProps) {
  const { hasRole } = useRBAC();
  const canCreate = hasRole(['Owner', 'Admin', 'Manager', 'Field']);
  const canDelete = hasRole(['Owner', 'Admin']);

  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [meta, setMeta] = useState<ListLogsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [publicFilter, setPublicFilter] = useState<string>('');
  const [attachmentFilter, setAttachmentFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | boolean> = { page, limit: 20 };
      if (publicFilter === 'true') params.is_public = true;
      if (publicFilter === 'false') params.is_public = false;
      if (attachmentFilter === 'true') params.has_attachments = true;
      if (attachmentFilter === 'false') params.has_attachments = false;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const result = await getProjectLogs(projectId, params);
      setLogs(result.data);
      setMeta(result.meta);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [projectId, page, publicFilter, attachmentFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProjectLog(projectId, deleteTarget.id);
      setLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Log deleted');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete log');
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setPublicFilter('');
    setAttachmentFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = publicFilter || attachmentFilter || dateFrom || dateTo;

  const publicOptions = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Public' },
    { value: 'false', label: 'Private' },
  ];

  const attachmentOptions = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Has Attachments' },
    { value: 'false', label: 'No Attachments' },
  ];

  const getAttachmentIcon = (fileType: string) => {
    if (fileType === 'photo') return <ImageIcon className="w-4 h-4" />;
    if (fileType === 'pdf') return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  if (loading && logs.length === 0) {
    return (
      <Card className="p-12 mt-6">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  if (error && logs.length === 0) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadLogs} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={hasActiveFilters ? 'text-blue-600 dark:text-blue-400' : ''}
        >
          <Filter className="w-4 h-4" />
          Filters {hasActiveFilters ? '(active)' : ''}
        </Button>
        {canCreate && (
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" />
            Add Log Entry
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Visibility"
              options={publicOptions}
              value={publicFilter}
              onChange={(val) => { setPublicFilter(val); setPage(1); }}
            />
            <Select
              label="Attachments"
              options={attachmentOptions}
              value={attachmentFilter}
              onChange={(val) => { setAttachmentFilter(val); setPage(1); }}
            />
            <DatePicker
              label="From"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <DatePicker
              label="To"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-2">
              <X className="w-3 h-3" />
              Clear Filters
            </Button>
          )}
        </Card>
      )}

      {/* Log feed */}
      {logs.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <ScrollText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Log Entries
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {hasActiveFilters ? 'No logs match your filters.' : 'Create your first log entry.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id} className="p-5">
              {/* Log header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-300">
                    {log.author.first_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {log.author.first_name} {log.author.last_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(log.log_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {log.is_public && (
                    <Badge variant="green" icon={Eye} label="Public" />
                  )}
                  {log.weather_delay && (
                    <Badge variant="yellow" icon={CloudRain} label="Weather Delay" />
                  )}
                  {canDelete && (
                    <button
                      onClick={() => setDeleteTarget(log)}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Log content */}
              <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
                {log.content}
              </div>

              {/* Attachments */}
              {log.attachments.length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Paperclip className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {log.attachments.length} attachment{log.attachments.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {log.attachments.map((att) => {
                      const url = getFileUrl(att.file_url);
                      const isImage = att.file_type === 'photo';
                      return (
                        <a
                          key={att.id}
                          href={url || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          {isImage && url ? (
                            <img src={url} alt={att.file_name} className="w-8 h-8 object-cover rounded" />
                          ) : (
                            getAttachmentIcon(att.file_type)
                          )}
                          <span className="text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                            {att.file_name}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <PaginationControls
          currentPage={page}
          totalPages={meta.totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
        />
      )}

      {/* Create Log Modal */}
      {showCreateModal && (
        <CreateLogModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          projectId={projectId}
          onSuccess={() => {
            loadLogs();
          }}
        />
      )}

      {/* Delete Confirmation */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Log Entry"
        message="Are you sure you want to delete this log entry? All attachments will be permanently removed."
        isDeleting={deleting}
      />
    </div>
  );
}
