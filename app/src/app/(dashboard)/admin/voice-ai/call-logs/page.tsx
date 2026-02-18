/**
 * Voice AI Admin — Call Logs Page
 * Sprint FSA05: Cross-tenant paginated call log with filters and detail modal
 *
 * Route: /admin/voice-ai/call-logs
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  Search,
  X,
  CheckCircle,
  Link as LinkIcon,
  Eye,
  PhoneCall,
  AlertCircle,
  Clock,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { getAdminCallLogs, getTenantsVoiceAiOverview } from '@/lib/api/voice-ai-admin';
import type { VoiceCallLog, TenantVoiceAiOverview } from '@/lib/types/voice-ai-admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_OPTIONS = [
  { value: '', label: 'All Outcomes' },
  { value: 'completed', label: 'Completed' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'abandoned', label: 'Abandoned' },
  { value: 'error', label: 'Error' },
];

const PAGE_LIMIT = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format seconds as m:ss */
function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Resolve total pages from paginated meta (handles camelCase or snake_case) */
function resolveTotalPages(meta: Record<string, unknown>, limit: number): number {
  if (typeof meta.totalPages === 'number') return meta.totalPages;
  if (typeof meta.total_pages === 'number') return meta.total_pages as number;
  if (typeof meta.total === 'number') return Math.ceil((meta.total as number) / limit);
  return 1;
}

// ─── Outcome Badge ─────────────────────────────────────────────────────────

const OUTCOME_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  transferred: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  voicemail: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  abandoned: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  const cls = OUTCOME_COLORS[outcome] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {outcome}
    </span>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────

interface DetailModalProps {
  log: VoiceCallLog | null;
  tenantMap: Map<string, string>;
  onClose: () => void;
}

function CallDetailModal({ log, tenantMap, onClose }: DetailModalProps) {
  if (!log) return null;

  const tenantName = tenantMap.get(log.tenant_id) ?? log.tenant_id;

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Call SID', value: <span className="font-mono text-xs break-all">{log.call_sid}</span> },
    { label: 'Tenant', value: tenantName },
    { label: 'From Number', value: log.from_number },
    { label: 'To Number', value: log.to_number },
    { label: 'Direction', value: <span className="capitalize">{log.direction}</span> },
    { label: 'Status', value: <span className="capitalize">{log.status}</span> },
    { label: 'Outcome', value: <OutcomeBadge outcome={log.outcome} /> },
    { label: 'Duration', value: formatDuration(log.duration_seconds) },
    { label: 'Overage', value: log.is_overage ? <span className="text-orange-600 dark:text-orange-400 font-medium">Yes — Overage Call</span> : 'No' },
    {
      label: 'Lead Linked',
      value: log.lead_id ? (
        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <CheckCircle className="w-3.5 h-3.5" />
          <span className="font-mono text-xs">{log.lead_id}</span>
        </span>
      ) : (
        <span className="text-gray-400 dark:text-gray-500">No lead linked</span>
      ),
    },
    {
      label: 'Started At',
      value: format(new Date(log.started_at), 'MMM d, yyyy h:mm:ss a'),
    },
    {
      label: 'Ended At',
      value: log.ended_at ? format(new Date(log.ended_at), 'MMM d, yyyy h:mm:ss a') : '—',
    },
  ];

  if (log.actions_taken) {
    const actions = Array.isArray(log.actions_taken)
      ? log.actions_taken
      : (() => { try { return JSON.parse(log.actions_taken as unknown as string); } catch { return []; } })();
    fields.push({
      label: 'Actions Taken',
      value: actions.length > 0
        ? <span className="font-mono text-xs">{(actions as string[]).join(', ')}</span>
        : <span className="text-gray-400">None</span>,
    });
  }

  return (
    <Modal isOpen={!!log} onClose={onClose} title="Call Detail" size="lg">
      <ModalContent>
        <div className="space-y-4">
          {/* Field grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {fields.map(({ label, value }) => (
              <div key={label} className="border-b border-gray-100 dark:border-gray-700/50 pb-2">
                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                  {label}
                </dt>
                <dd className="text-sm text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </div>

          {/* Transcript Summary */}
          {log.transcript_summary && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Transcript Summary
              </h4>
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {log.transcript_summary}
                </p>
              </div>
            </div>
          )}

          {/* Full Transcript (collapsed if long) */}
          {log.full_transcript && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Full Transcript
              </h4>
              <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4 max-h-48 overflow-y-auto">
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-mono whitespace-pre-wrap">
                  {log.full_transcript}
                </p>
              </div>
            </div>
          )}

          {!log.transcript_summary && !log.full_transcript && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
              No transcript available for this call.
            </p>
          )}
        </div>
      </ModalContent>
      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {log.lead_id && (
          <Button
            onClick={() => window.open(`/leads/${log.lead_id}`, '_blank')}
          >
            <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
            View Lead
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export default function VoiceAiCallLogsPage() {
  // ── Data state
  const [logs, setLogs] = useState<VoiceCallLog[]>([]);
  const [tenants, setTenants] = useState<TenantVoiceAiOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ── Filter state
  const [tenantId, setTenantId] = useState('');
  const [dateStart, setDateStart] = useState<Date | null>(null);
  const [dateEnd, setDateEnd] = useState<Date | null>(null);
  const [outcome, setOutcome] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  // ── Detail modal
  const [selectedLog, setSelectedLog] = useState<VoiceCallLog | null>(null);

  // ── Error modal
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const showError = (title: string, message: string) =>
    setErrorModal({ open: true, title, message });

  // ── Tenant name lookup map
  const tenantMap = new Map<string, string>(
    tenants.map((t) => [t.tenant_id, t.company_name])
  );

  // ── Load tenants once for dropdown
  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await getTenantsVoiceAiOverview({ limit: 100 });
        setTenants(res.data);
      } catch {
        // Non-critical — dropdown will just be empty
      }
    }
    loadTenants();
  }, []);

  // ── Load call logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAdminCallLogs({
        tenantId: tenantId || undefined,
        from: dateStart ? format(dateStart, 'yyyy-MM-dd') : undefined,
        to: dateEnd ? format(dateEnd, 'yyyy-MM-dd') : undefined,
        outcome: outcome || undefined,
        search: phoneSearch || undefined,
        page,
        limit: PAGE_LIMIT,
      });
      setLogs(res.data);
      const meta = res.meta as unknown as Record<string, unknown>;
      setTotalPages(resolveTotalPages(meta, PAGE_LIMIT));
      setTotalCount(typeof meta.total === 'number' ? meta.total : 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load call logs';
      showError('Load Failed', msg);
    } finally {
      setLoading(false);
    }
  }, [tenantId, dateStart, dateEnd, outcome, phoneSearch, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ── Apply filters (reset to page 1)
  const applyFilters = () => {
    setPage(1);
    setPhoneSearch(phoneInput);
  };

  const clearFilters = () => {
    setTenantId('');
    setDateStart(null);
    setDateEnd(null);
    setOutcome('');
    setPhoneSearch('');
    setPhoneInput('');
    setPage(1);
  };

  const hasFilters = !!(tenantId || dateStart || dateEnd || outcome || phoneSearch);

  // ── Shared class strings
  const selectClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white ' +
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white ' +
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <PhoneCall className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Voice AI — Call Logs
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Cross-tenant call history with filters and transcript review
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-5">
        <div className="space-y-4">
          {/* Row 1: Tenant + Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tenant selector */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Tenant
              </label>
              <select
                value={tenantId}
                onChange={(e) => { setTenantId(e.target.value); setPage(1); }}
                className={selectClass}
              >
                <option value="">All Tenants</option>
                {tenants.map((t) => (
                  <option key={t.tenant_id} value={t.tenant_id}>
                    {t.company_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Outcome */}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Outcome
              </label>
              <select
                value={outcome}
                onChange={(e) => { setOutcome(e.target.value); setPage(1); }}
                className={selectClass}
              >
                {OUTCOME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone search */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
                Search by Phone Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                    placeholder="+1 (555) 000-0000"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <Button size="sm" onClick={applyFilters}>
                  Search
                </Button>
                {hasFilters && (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Date range */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              Date Range
            </label>
            <DateRangePicker
              startDate={dateStart}
              endDate={dateEnd}
              onChange={(s, e) => { setDateStart(s); setDateEnd(e); setPage(1); }}
            />
          </div>
        </div>
      </Card>

      {/* Results count */}
      {!loading && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 0
              ? 'No calls found'
              : `${totalCount} call${totalCount !== 1 ? 's' : ''} found`}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20">
            <Phone className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">No call logs found</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {hasFilters ? 'Try adjusting your filters.' : 'No Voice AI calls have been made yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {[
                      'Date / Time',
                      'Tenant',
                      'From Number',
                      'Duration',
                      'Outcome',
                      'Flags',
                      'Lead',
                      'Actions',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* Date/Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {format(new Date(log.started_at), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {format(new Date(log.started_at), 'h:mm:ss a')}
                        </div>
                      </td>

                      {/* Tenant */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white truncate max-w-[140px]">
                            {tenantMap.get(log.tenant_id) ?? (
                              <span className="font-mono text-xs text-gray-400">
                                {log.tenant_id.slice(0, 8)}…
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* From Number */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                          {log.from_number}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {formatDuration(log.duration_seconds)}
                        </div>
                      </td>

                      {/* Outcome */}
                      <td className="px-4 py-3">
                        <OutcomeBadge outcome={log.outcome} />
                      </td>

                      {/* Overage flag */}
                      <td className="px-4 py-3">
                        {log.is_overage ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <AlertCircle className="w-3 h-3" />
                            Overage
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>

                      {/* Lead linked */}
                      <td className="px-4 py-3">
                        {log.lead_id ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Linked
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white font-mono">
                        {log.from_number}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {tenantMap.get(log.tenant_id) ?? log.tenant_id.slice(0, 8)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <OutcomeBadge outcome={log.outcome} />
                    {log.is_overage && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <AlertCircle className="w-3 h-3" />
                        Overage
                      </span>
                    )}
                    {log.lead_id && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3 h-3" />
                        Lead
                      </span>
                    )}
                  </div>

                  {/* Time + duration */}
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{format(new Date(log.started_at), 'MMM d, yyyy h:mm a')}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(log.duration_seconds)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                  onGoToPage={setPage}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Modal */}
      <CallDetailModal
        log={selectedLog}
        tenantMap={tenantMap}
        onClose={() => setSelectedLog(null)}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}
