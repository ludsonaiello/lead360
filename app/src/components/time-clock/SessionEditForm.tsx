'use client';

/**
 * SessionEditForm — Sprint 10 (time-clock)
 * Manual session edit form for Owner/Admin users.
 * Allows editing clock_in_at, clock_out_at, project, task, notes.
 * Requires a reason for every edit (creates immutable audit log).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Pencil, Save } from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

import { editSession } from '@/lib/api/time-clock';
import { getProjects, getProjectTasks } from '@/lib/api/projects';
import type { ClockSession, EditSessionRequest } from '@/lib/types/time-clock';

interface SessionEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  session: ClockSession;
  onSaved: () => void | Promise<void>;
}

function isoToDateValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function isoToTimeValue(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
}

function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

/**
 * Truncate an ISO timestamp to minute precision for comparison.
 * The time picker only captures HH:MM, so comparing with full precision
 * would detect phantom changes from the lost seconds/milliseconds.
 */
function truncateToMinute(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = parseISO(iso);
    d.setSeconds(0, 0);
    return d.toISOString();
  } catch {
    return null;
  }
}

export function SessionEditForm({
  isOpen,
  onClose,
  session,
  onSaved,
}: SessionEditFormProps) {
  // Form state
  const [clockInDate, setClockInDate] = useState('');
  const [clockInTime, setClockInTime] = useState('');
  const [clockOutDate, setClockOutDate] = useState('');
  const [clockOutTime, setClockOutTime] = useState('');
  const [projectId, setProjectId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Data state
  const [projectOptions, setProjectOptions] = useState<SelectOption[]>([]);
  const [taskOptions, setTaskOptions] = useState<SelectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Prefill form when session changes or modal opens
  useEffect(() => {
    if (isOpen && session) {
      setClockInDate(isoToDateValue(session.clock_in_at));
      setClockInTime(isoToTimeValue(session.clock_in_at));
      setClockOutDate(isoToDateValue(session.clock_out_at));
      setClockOutTime(isoToTimeValue(session.clock_out_at));
      setProjectId(session.project_id || '');
      setTaskId(session.task_id || '');
      setNotes(session.notes || '');
      setReason('');
      setReasonError('');
    }
  }, [isOpen, session]);

  // Fetch projects on open
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const res = await getProjects({ page: 1, limit: 100 });
        if (!cancelled) {
          const opts: SelectOption[] = [
            { value: '', label: 'No project' },
            ...res.data.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.project_number})`,
            })),
          ];
          setProjectOptions(opts);
        }
      } catch (err) {
        console.error('[SessionEditForm] Failed to load projects', err);
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    };
    loadProjects();
    return () => { cancelled = true; };
  }, [isOpen]);

  // Fetch tasks when project changes
  const loadTasks = useCallback(async (pid: string) => {
    if (!pid) {
      setTaskOptions([]);
      setTaskId('');
      return;
    }
    setLoadingTasks(true);
    try {
      const res = await getProjectTasks(pid, { page: 1, limit: 100 });
      const opts: SelectOption[] = [
        { value: '', label: 'No task' },
        ...res.data.map((t) => ({
          value: t.id,
          label: t.title,
        })),
      ];
      setTaskOptions(opts);
    } catch (err) {
      console.error('[SessionEditForm] Failed to load tasks', err);
      setTaskOptions([]);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && projectId) {
      loadTasks(projectId);
    } else if (isOpen) {
      setTaskOptions([]);
    }
  }, [isOpen, projectId, loadTasks]);

  const handleProjectChange = (val: string) => {
    if (val !== projectId) {
      setProjectId(val);
      setTaskId('');
    }
  };

  const handleSubmit = async () => {
    // Validate reason
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setReasonError('Reason is required for manual edits');
      return;
    }
    if (trimmedReason.length > 500) {
      setReasonError('Reason must be 500 characters or less');
      return;
    }
    setReasonError('');

    // Build request — only send changed fields
    const dto: EditSessionRequest = { reason: trimmedReason };

    const newClockIn = combineDateAndTime(clockInDate, clockInTime);
    if (newClockIn && truncateToMinute(newClockIn) !== truncateToMinute(session.clock_in_at)) {
      dto.clock_in_at = newClockIn;
    }

    const newClockOut = combineDateAndTime(clockOutDate, clockOutTime);
    const currentClockOut = session.clock_out_at || null;
    if (truncateToMinute(newClockOut) !== truncateToMinute(currentClockOut)) {
      if (newClockOut) {
        dto.clock_out_at = newClockOut;
      }
    }

    const newProjectId = projectId || null;
    if (newProjectId !== (session.project_id || null)) {
      dto.project_id = newProjectId;
    }

    const newTaskId = taskId || null;
    if (newTaskId !== (session.task_id || null)) {
      dto.task_id = newTaskId;
    }

    const trimmedNotes = notes.trim() || null;
    if (trimmedNotes !== (session.notes || null)) {
      dto.notes = trimmedNotes;
    }

    setSubmitting(true);
    try {
      await editSession(session.id, dto);
      toast.success('Session updated successfully');
      onClose();
      await onSaved();
    } catch (err) {
      const e = err as { message?: string; data?: { message?: string | string[] } };
      const msg = Array.isArray(e?.data?.message)
        ? e.data.message.join(', ')
        : e?.data?.message || e?.message || 'Failed to update session';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <span className="flex items-center gap-2 text-gray-900 dark:text-white">
          <Pencil className="h-5 w-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Edit Session
        </span>
      }
    >
      <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        {/* Warning banner — always shown */}
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Editing this session will create an immutable audit log entry.
          </p>
        </div>

        {/* Extra warning if labor cost posted */}
        {session.labor_cost_posted && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30"
          >
            <AlertTriangle
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-red-900 dark:text-red-200">
              Labor cost has been posted to financials. Editing will flag this session for reconciliation.
            </p>
          </div>
        )}

        {/* Clock In */}
        <fieldset>
          <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Clock In
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker
              label="Date"
              value={clockInDate}
              onChange={(e) => setClockInDate(e.target.value)}
              aria-label="Clock in date"
            />
            <TimePicker
              label="Time"
              value={clockInTime}
              onChange={(e) => setClockInTime(e.target.value)}
              aria-label="Clock in time"
            />
          </div>
        </fieldset>

        {/* Clock Out */}
        <fieldset>
          <legend className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Clock Out
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DatePicker
              label="Date"
              value={clockOutDate}
              onChange={(e) => setClockOutDate(e.target.value)}
              aria-label="Clock out date"
            />
            <TimePicker
              label="Time"
              value={clockOutTime}
              onChange={(e) => setClockOutTime(e.target.value)}
              aria-label="Clock out time"
            />
          </div>
          {!session.clock_out_at && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This session is still active — setting a clock-out time will complete it.
            </p>
          )}
        </fieldset>

        {/* Project & Task */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Project"
            options={projectOptions}
            value={projectId}
            onChange={handleProjectChange}
            placeholder={loadingProjects ? 'Loading...' : 'Select project'}
            searchable
            disabled={loadingProjects}
          />
          <Select
            label="Task"
            options={taskOptions}
            value={taskId}
            onChange={setTaskId}
            placeholder={
              loadingTasks
                ? 'Loading...'
                : !projectId
                  ? 'Select a project first'
                  : 'Select task'
            }
            searchable
            disabled={loadingTasks || !projectId}
          />
        </div>

        {/* Notes */}
        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional session notes"
          rows={3}
          maxLength={500}
          showCharacterCount
          resize="vertical"
        />

        {/* Reason — REQUIRED */}
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError) setReasonError('');
          }}
          placeholder="Why is this session being edited? (Required)"
          rows={3}
          maxLength={500}
          showCharacterCount
          required
          error={reasonError}
          resize="vertical"
        />
      </div>

      <ModalActions>
        <Button variant="secondary" onClick={onClose} type="button" size="sm">
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting}
          type="button"
          size="sm"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Save Changes
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default SessionEditForm;
