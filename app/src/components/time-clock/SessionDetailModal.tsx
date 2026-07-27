'use client';

/**
 * SessionDetailModal — Sprint 6 (time-clock)
 * Displays the full detail of a clock session: times, GPS, breaks, edit log,
 * dispute status. Allows submitting a new dispute on completed sessions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Clock,
  Coffee,
  Flag,
  History,
  MapPin,
  StickyNote,
  UserCheck,
  XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import { DisputeForm } from './DisputeForm';

import { getSession as apiGetSession } from '@/lib/api/time-clock';
import type {
  BreakEntry,
  ClockSession,
  ClockSessionEditLog,
  DisputeStatus,
  TimeDispute,
} from '@/lib/types/time-clock';

interface SessionDetailModalProps {
  isOpen: boolean;
  sessionId: string | null;
  onClose: () => void;
  onDisputeSubmitted?: () => void | Promise<void>;
}

function formatDateTime(iso: string | null | undefined, pattern = 'MMM d, yyyy h:mm a'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return '—';
  }
}

function formatDurationFromMinutes(mins: number | null | undefined): string {
  if (mins == null) return '0h 00m';
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatCoords(
  lat: string | null | undefined,
  lng: string | null | undefined,
): string | null {
  if (!lat || !lng) return null;
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) return null;
  return `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
}

function disputeBadgeVariant(
  status: DisputeStatus,
): 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'resolved':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function SessionDetailModal({
  isOpen,
  sessionId,
  onClose,
  onDisputeSubmitted,
}: SessionDetailModalProps) {
  const [session, setSession] = useState<ClockSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [disputeFormOpen, setDisputeFormOpen] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      setLoadError(null);
      const data = await apiGetSession(sessionId);
      setSession(data);
    } catch (err) {
      console.error('[SessionDetailModal] Failed to load session', err);
      const e = err as { response?: { data?: { message?: string } } };
      setLoadError(e?.response?.data?.message || 'Could not load this session.');
      toast.error('Could not load session details.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadSession();
    } else if (!isOpen) {
      setSession(null);
      setLoadError(null);
      setDisputeFormOpen(false);
    }
  }, [isOpen, sessionId, loadSession]);

  const handleDisputeSubmitted = useCallback(async () => {
    await loadSession();
    if (onDisputeSubmitted) await onDisputeSubmitted();
  }, [loadSession, onDisputeSubmitted]);

  const pendingDispute = session?.disputes?.find((d) => d.status === 'pending') ?? null;
  const latestDispute =
    session?.disputes && session.disputes.length > 0
      ? [...session.disputes].sort((a, b) =>
          b.created_at.localeCompare(a.created_at),
        )[0]
      : null;

  const canSubmitDispute =
    session?.status === 'completed' && !pendingDispute && !loading && !loadError;

  return (
    <>
      <Modal
        isOpen={isOpen && !disputeFormOpen}
        onClose={onClose}
        size="xl"
        title={
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            Session Details
          </span>
        }
      >
        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          >
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Could not load session</p>
              <p className="mt-0.5 text-xs">{loadError}</p>
            </div>
          </div>
        ) : session ? (
          <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
            {/* Summary header */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <SessionStatusBadge status={session.status} />
                {session.is_flagged && (
                  <Badge variant="warning">
                    <Flag className="mr-1 h-3 w-3" aria-hidden="true" />
                    Flagged
                  </Badge>
                )}
                {session.is_manual_edit && (
                  <Badge variant="info">
                    <History className="mr-1 h-3 w-3" aria-hidden="true" />
                    Manually edited
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                {formatDurationFromMinutes(session.total_worked_minutes)}
              </p>
              {(session.regular_minutes != null || session.overtime_minutes != null) && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Regular: {formatDurationFromMinutes(session.regular_minutes)} • Overtime:{' '}
                  {formatDurationFromMinutes(session.overtime_minutes)}
                </p>
              )}
            </div>

            {/* Clock In / Out block */}
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50 sm:grid-cols-2">
              <DetailRow
                icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                label="Clocked In"
                value={formatDateTime(session.clock_in_at)}
                subValue={formatCoords(
                  session.clock_in_latitude,
                  session.clock_in_longitude,
                )}
                subIcon={<MapPin className="h-3 w-3" aria-hidden="true" />}
              />
              <DetailRow
                icon={<Clock className="h-4 w-4" aria-hidden="true" />}
                label="Clocked Out"
                value={
                  session.clock_out_at ? formatDateTime(session.clock_out_at) : 'Active'
                }
                subValue={formatCoords(
                  session.clock_out_latitude,
                  session.clock_out_longitude,
                )}
                subIcon={<MapPin className="h-3 w-3" aria-hidden="true" />}
              />
              <DetailRow
                icon={<Briefcase className="h-4 w-4" aria-hidden="true" />}
                label="Project"
                value={session.project?.name || 'No project'}
                subValue={session.project?.project_number || null}
              />
              {session.task?.title && (
                <DetailRow
                  icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  label="Task"
                  value={session.task.title}
                />
              )}
              {session.clockin_address?.label && (
                <DetailRow
                  icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                  label="Clock-in Address"
                  value={session.clockin_address.label}
                />
              )}
              {session.notes && (
                <div className="sm:col-span-2">
                  <DetailRow
                    icon={<StickyNote className="h-4 w-4" aria-hidden="true" />}
                    label="Notes"
                    value={session.notes}
                    multiline
                  />
                </div>
              )}
            </div>

            {session.is_flagged && session.flag_reason && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden="true"
                />
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                  {session.flag_reason}
                </p>
              </div>
            )}

            {/* Breaks */}
            <Section
              title="Breaks"
              icon={<Coffee className="h-4 w-4" aria-hidden="true" />}
              count={session.break_entries?.length ?? 0}
            >
              {session.break_entries && session.break_entries.length > 0 ? (
                <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                  {session.break_entries.map((b) => (
                    <BreakRow key={b.id} breakEntry={b} />
                  ))}
                </ul>
              ) : (
                <EmptyRow message="No breaks on this session." />
              )}
            </Section>

            {/* Edit log */}
            <Section
              title="Edit History"
              icon={<History className="h-4 w-4" aria-hidden="true" />}
              count={session.edit_logs?.length ?? 0}
            >
              {session.edit_logs && session.edit_logs.length > 0 ? (
                <ul className="space-y-2">
                  {session.edit_logs.map((e) => (
                    <EditLogRow key={e.id} log={e} />
                  ))}
                </ul>
              ) : (
                <EmptyRow message="This session has not been edited." />
              )}
            </Section>

            {/* Dispute */}
            <Section
              title="Dispute"
              icon={<Flag className="h-4 w-4" aria-hidden="true" />}
            >
              {latestDispute ? (
                <DisputeRow dispute={latestDispute} />
              ) : (
                <EmptyRow message="No dispute submitted for this session." />
              )}
            </Section>

            {/* Footer actions */}
            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} type="button">
                Close
              </Button>
              {canSubmitDispute && (
                <Button
                  variant="primary"
                  onClick={() => setDisputeFormOpen(true)}
                  type="button"
                >
                  <Flag className="h-4 w-4" aria-hidden="true" />
                  Submit Dispute
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {session && (
        <DisputeForm
          isOpen={disputeFormOpen}
          onClose={() => setDisputeFormOpen(false)}
          session={session}
          onSubmitted={handleDisputeSubmitted}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SessionStatusBadge({ status }: { status: ClockSession['status'] }) {
  if (status === 'completed') {
    return <Badge variant="success">Completed</Badge>;
  }
  if (status === 'active') {
    return <Badge variant="info">Active</Badge>;
  }
  return <Badge variant="warning">On Break</Badge>;
}

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string | null;
  subIcon?: React.ReactNode;
  multiline?: boolean;
}

function DetailRow({ icon, label, value, subValue, subIcon, multiline }: DetailRowProps) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-gray-500 dark:text-gray-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </dt>
        <dd
          className={`mt-0.5 text-sm font-semibold text-gray-900 dark:text-white ${
            multiline ? 'whitespace-pre-wrap' : 'truncate'
          }`}
        >
          {value}
        </dd>
        {subValue && (
          <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
            {subIcon}
            <span>{subValue}</span>
          </p>
        )}
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}

function Section({ title, icon, count, children }: SectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <div className="text-gray-500 dark:text-gray-400">{icon}</div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
          {title}
        </h3>
        {typeof count === 'number' && count > 0 && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-300 px-3 py-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
      {message}
    </p>
  );
}

function BreakRow({ breakEntry }: { breakEntry: BreakEntry }) {
  const isOpen = breakEntry.ended_at === null;
  return (
    <li className="flex items-start justify-between gap-3 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={breakEntry.break_type === 'paid' ? 'info' : 'neutral'}>
            {breakEntry.break_type === 'paid' ? 'Paid' : 'Unpaid'}
          </Badge>
          {breakEntry.break_label && (
            <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
              {breakEntry.break_label}
            </span>
          )}
          {isOpen && <Badge variant="warning">Open</Badge>}
        </div>
        <p className="mt-1 font-mono text-xs text-gray-600 dark:text-gray-400">
          {formatDateTime(breakEntry.started_at, 'h:mm a')}
          {' → '}
          {breakEntry.ended_at ? formatDateTime(breakEntry.ended_at, 'h:mm a') : '—'}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Duration
        </p>
        <p className="font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
          {formatDurationFromMinutes(breakEntry.duration_minutes)}
        </p>
      </div>
    </li>
  );
}

function EditLogRow({ log }: { log: ClockSessionEditLog }) {
  const editor = log.edited_by
    ? `${log.edited_by.first_name ?? ''} ${log.edited_by.last_name ?? ''}`.trim() ||
      'Manager'
    : 'Manager';
  return (
    <li className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-900 dark:text-white">
          {log.field_changed}
        </span>
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {formatDateTime(log.edited_at, 'MMM d, h:mm a')}
        </span>
      </div>
      <div className="mt-1.5 flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300 sm:flex-row sm:items-center sm:gap-2">
        <span className="line-through opacity-70">{log.original_value || '—'}</span>
        <span className="text-gray-400">→</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {log.new_value || '—'}
        </span>
      </div>
      {log.reason && (
        <p className="mt-1.5 text-[11px] text-gray-600 dark:text-gray-400">
          <span className="font-semibold">Reason:</span> {log.reason}
        </p>
      )}
      <p className="mt-1 flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
        <UserCheck className="h-3 w-3" aria-hidden="true" />
        {editor}
      </p>
    </li>
  );
}

function DisputeRow({ dispute }: { dispute: TimeDispute }) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={disputeBadgeVariant(dispute.status)}>
            {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
          </Badge>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">
            {dispute.dispute_type === 'flag_only' ? 'Flag for Review' : 'Correction Request'}
          </span>
        </div>
        <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
          {formatDateTime(dispute.created_at, 'MMM d, h:mm a')}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-xs text-gray-700 dark:text-gray-300">
        {dispute.description}
      </p>
      {dispute.review_notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-2 text-xs dark:border-gray-700 dark:bg-gray-900">
          <p className="font-semibold text-gray-900 dark:text-white">Manager&apos;s notes</p>
          <p className="mt-0.5 whitespace-pre-wrap text-gray-700 dark:text-gray-300">
            {dispute.review_notes}
          </p>
        </div>
      )}
    </div>
  );
}

export default SessionDetailModal;
