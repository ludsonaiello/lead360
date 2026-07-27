'use client';

/**
 * DisputeForm — Sprint 6 (time-clock)
 * Modal to submit a dispute on a completed session. Supports both
 * `flag_only` and `correction_request` dispute types.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, Flag, Pencil, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { Select } from '@/components/ui/Select';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

import {
  submitDispute as apiSubmitDispute,
  getMyAvailableProjects,
} from '@/lib/api/time-clock';
import { getProjectTasks } from '@/lib/api/projects';
import type { AvailableProject, ClockSession, DisputeType } from '@/lib/types/time-clock';
import type { ProjectTask } from '@/lib/types/projects';

interface DisputeFormProps {
  isOpen: boolean;
  onClose: () => void;
  session: ClockSession;
  onSubmitted: () => void | Promise<void>;
}

interface DateTimePair {
  date: string;
  time: string;
}

function splitIsoToLocalPair(iso: string | null | undefined): DateTimePair {
  if (!iso) return { date: '', time: '' };
  try {
    const d = parseISO(iso);
    if (Number.isNaN(d.getTime())) return { date: '', time: '' };
    return { date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') };
  } catch {
    return { date: '', time: '' };
  }
}

function localPairToIso(pair: DateTimePair): string | null {
  if (!pair.date || !pair.time) return null;
  const combined = new Date(`${pair.date}T${pair.time}:00`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined.toISOString();
}

function extractErrorStatus(err: unknown): number | null {
  const e = err as { response?: { status?: number } };
  return e?.response?.status ?? null;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e?.message || fallback;
}

export function DisputeForm({ isOpen, onClose, session, onSubmitted }: DisputeFormProps) {
  const [disputeType, setDisputeType] = useState<DisputeType>('flag_only');
  const [description, setDescription] = useState('');
  const [descError, setDescError] = useState<string | undefined>(undefined);

  const initialClockIn = useMemo(
    () => splitIsoToLocalPair(session.clock_in_at),
    [session.clock_in_at],
  );
  const initialClockOut = useMemo(
    () => splitIsoToLocalPair(session.clock_out_at),
    [session.clock_out_at],
  );

  const [clockInPair, setClockInPair] = useState<DateTimePair>(initialClockIn);
  const [clockOutPair, setClockOutPair] = useState<DateTimePair>(initialClockOut);
  const [projectId, setProjectId] = useState<string | null>(session.project_id ?? null);
  const [taskId, setTaskId] = useState<string | null>(session.task_id ?? null);
  const [proposedNotes, setProposedNotes] = useState('');

  const [projects, setProjects] = useState<AvailableProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  const resetForm = useCallback(() => {
    setDisputeType('flag_only');
    setDescription('');
    setDescError(undefined);
    setClockInPair(initialClockIn);
    setClockOutPair(initialClockOut);
    setProjectId(session.project_id ?? null);
    setTaskId(session.task_id ?? null);
    setProposedNotes('');
  }, [initialClockIn, initialClockOut, session.project_id, session.task_id]);

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, resetForm]);

  useEffect(() => {
    if (!isOpen || disputeType !== 'correction_request' || projects.length > 0) return;
    let cancelled = false;
    const load = async () => {
      try {
        setProjectsLoading(true);
        const list = await getMyAvailableProjects();
        if (!cancelled) setProjects(list || []);
      } catch (err) {
        if (!cancelled) {
          toast.error('Could not load your projects.');
          console.error('[DisputeForm] Failed to load projects', err);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, disputeType, projects.length]);

  useEffect(() => {
    if (!isOpen || disputeType !== 'correction_request' || !projectId) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        setTasksLoading(true);
        const res = await getProjectTasks(projectId, { limit: 200 });
        if (!cancelled) setTasks(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setTasks([]);
          console.error('[DisputeForm] Failed to load tasks', err);
        }
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, disputeType, projectId]);

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        value: p.id,
        label: p.project_number ? `${p.project_number} — ${p.name}` : p.name,
      })),
    [projects],
  );

  const taskOptions = useMemo(
    () =>
      tasks.map((t) => ({
        value: t.id,
        label: t.title,
      })),
    [tasks],
  );

  const fieldsChanged = useMemo(() => {
    if (disputeType !== 'correction_request') return false;
    const proposedIn = localPairToIso(clockInPair);
    const proposedOut = localPairToIso(clockOutPair);
    const originalIn = session.clock_in_at ? parseISO(session.clock_in_at).toISOString() : null;
    const originalOut = session.clock_out_at ? parseISO(session.clock_out_at).toISOString() : null;
    return Boolean(
      (proposedIn && proposedIn !== originalIn) ||
        (proposedOut && proposedOut !== originalOut) ||
        (projectId && projectId !== session.project_id) ||
        (taskId && taskId !== session.task_id) ||
        (proposedNotes && proposedNotes !== (session.notes ?? '')),
    );
  }, [
    disputeType,
    clockInPair,
    clockOutPair,
    projectId,
    taskId,
    proposedNotes,
    session.clock_in_at,
    session.clock_out_at,
    session.project_id,
    session.task_id,
    session.notes,
  ]);

  const validate = useCallback((): boolean => {
    let valid = true;
    const trimmed = description.trim();
    if (!trimmed) {
      setDescError('Please describe the issue with this session.');
      valid = false;
    } else if (trimmed.length > 2000) {
      setDescError('Description must be 2000 characters or fewer.');
      valid = false;
    } else {
      setDescError(undefined);
    }
    if (disputeType === 'correction_request' && !fieldsChanged) {
      setErrorModal({
        open: true,
        title: 'No Correction Provided',
        message:
          'Change at least one field (time, project, task, or notes) to request a correction, or switch to "Flag for Review".',
      });
      valid = false;
    }
    return valid;
  }, [description, disputeType, fieldsChanged]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!validate()) return;

    const payload = {
      dispute_type: disputeType,
      description: description.trim(),
      ...(disputeType === 'correction_request'
        ? (() => {
            const proposedIn = localPairToIso(clockInPair);
            const proposedOut = localPairToIso(clockOutPair);
            const originalIn = session.clock_in_at
              ? parseISO(session.clock_in_at).toISOString()
              : null;
            const originalOut = session.clock_out_at
              ? parseISO(session.clock_out_at).toISOString()
              : null;
            return {
              proposed_clock_in_at:
                proposedIn && proposedIn !== originalIn ? proposedIn : undefined,
              proposed_clock_out_at:
                proposedOut && proposedOut !== originalOut ? proposedOut : undefined,
              proposed_project_id:
                projectId && projectId !== session.project_id ? projectId : undefined,
              proposed_task_id: taskId && taskId !== session.task_id ? taskId : undefined,
              proposed_notes:
                proposedNotes && proposedNotes !== (session.notes ?? '')
                  ? proposedNotes.trim()
                  : undefined,
            };
          })()
        : {}),
    };

    try {
      setSubmitting(true);
      await apiSubmitDispute(session.id, payload);
      setSuccessModalOpen(true);
    } catch (err) {
      const status = extractErrorStatus(err);
      const message = extractErrorMessage(err, 'Unable to submit dispute.');
      if (status === 409) {
        setErrorModal({
          open: true,
          title: 'Dispute Already Pending',
          message:
            'A pending dispute already exists for this session. Please wait for it to be reviewed or cancel it first.',
        });
      } else if (status === 400) {
        if (/description/i.test(message)) {
          setDescError(message);
        }
        setErrorModal({
          open: true,
          title: 'Check Your Entries',
          message,
        });
      } else if (status === 404) {
        setErrorModal({
          open: true,
          title: 'Session Not Found',
          message: 'This session could not be found. Refresh and try again.',
        });
      } else {
        setErrorModal({
          open: true,
          title: 'Could Not Submit Dispute',
          message,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    validate,
    disputeType,
    description,
    clockInPair,
    clockOutPair,
    projectId,
    taskId,
    proposedNotes,
    session.id,
    session.clock_in_at,
    session.clock_out_at,
    session.project_id,
    session.task_id,
    session.notes,
  ]);

  const handleSuccessClose = useCallback(async () => {
    setSuccessModalOpen(false);
    onClose();
    await onSubmitted();
  }, [onClose, onSubmitted]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={submitting ? () => undefined : onClose}
        title={
          <span className="flex items-center gap-2 text-gray-900 dark:text-white">
            <Flag className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            Submit Dispute
          </span>
        }
        size="xl"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-3 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            Disputes are reviewed by a manager. Provide as much detail as possible so they
            can act quickly.
          </div>

          {/* Dispute type */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-gray-900 dark:text-white">
              Dispute type <span className="text-red-500">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <DisputeTypeRadio
                name="dispute_type"
                value="flag_only"
                selected={disputeType === 'flag_only'}
                onSelect={() => setDisputeType('flag_only')}
                title="Flag for Review"
                description="Call attention to this session without proposing changes."
                icon={<Flag className="h-5 w-5" aria-hidden="true" />}
                disabled={submitting}
              />
              <DisputeTypeRadio
                name="dispute_type"
                value="correction_request"
                selected={disputeType === 'correction_request'}
                onSelect={() => setDisputeType('correction_request')}
                title="Request Correction"
                description="Propose new times, project, task, or notes."
                icon={<Pencil className="h-5 w-5" aria-hidden="true" />}
                disabled={submitting}
              />
            </div>
          </fieldset>

          {/* Description */}
          <Textarea
            id="dispute-description"
            label="Description"
            required
            placeholder="Describe the issue with this session..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (descError) setDescError(undefined);
            }}
            maxLength={2000}
            showCharacterCount
            rows={4}
            error={descError}
            disabled={submitting}
          />

          {/* Correction fields */}
          {disputeType === 'correction_request' && (
            <div className="space-y-4 rounded-xl border-2 border-dashed border-gray-300 p-4 dark:border-gray-700">
              <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
                  aria-hidden="true"
                />
                <p>
                  Adjust only the fields that are wrong. Unchanged values will be left as-is
                  on the session.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DatePicker
                  id="proposed-clock-in-date"
                  label="Proposed clock-in date"
                  value={clockInPair.date}
                  onChange={(e) =>
                    setClockInPair((prev) => ({ ...prev, date: e.target.value }))
                  }
                  disabled={submitting}
                />
                <TimePicker
                  id="proposed-clock-in-time"
                  label="Proposed clock-in time"
                  value={clockInPair.time}
                  onChange={(e) =>
                    setClockInPair((prev) => ({ ...prev, time: e.target.value }))
                  }
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DatePicker
                  id="proposed-clock-out-date"
                  label="Proposed clock-out date"
                  value={clockOutPair.date}
                  onChange={(e) =>
                    setClockOutPair((prev) => ({ ...prev, date: e.target.value }))
                  }
                  disabled={submitting}
                />
                <TimePicker
                  id="proposed-clock-out-time"
                  label="Proposed clock-out time"
                  value={clockOutPair.time}
                  onChange={(e) =>
                    setClockOutPair((prev) => ({ ...prev, time: e.target.value }))
                  }
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {projectsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <LoadingSpinner size="sm" />
                    Loading projects…
                  </div>
                ) : (
                  <Select
                    label="Proposed project"
                    options={projectOptions}
                    value={projectId ?? ''}
                    onChange={(v) => {
                      setProjectId(v || null);
                      setTaskId(null);
                    }}
                    placeholder="Select a project"
                    searchable={projectOptions.length > 5}
                    disabled={submitting}
                  />
                )}

                {projectId && (
                  tasksLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <LoadingSpinner size="sm" />
                      Loading tasks…
                    </div>
                  ) : taskOptions.length > 0 ? (
                    <Select
                      label="Proposed task (optional)"
                      options={taskOptions}
                      value={taskId ?? ''}
                      onChange={(v) => setTaskId(v || null)}
                      placeholder="Select a task"
                      searchable={taskOptions.length > 5}
                      disabled={submitting}
                    />
                  ) : null
                )}

                <Textarea
                  id="proposed-notes"
                  label="Proposed notes (optional)"
                  placeholder="Updated notes to be applied on approval…"
                  value={proposedNotes}
                  maxLength={2000}
                  showCharacterCount
                  rows={3}
                  onChange={(e) => setProposedNotes(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
        </div>

        <ModalActions>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
            type="button"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Submit Dispute
          </Button>
        </ModalActions>
      </Modal>

      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />

      <SuccessModal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Dispute Submitted"
        message="Your dispute has been submitted and is awaiting review by a manager."
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Dispute type radio card
// ---------------------------------------------------------------------------

interface DisputeTypeRadioProps {
  name: string;
  value: string;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

function DisputeTypeRadio({
  name,
  value,
  selected,
  onSelect,
  title,
  description,
  icon,
  disabled,
}: DisputeTypeRadioProps) {
  return (
    <label
      className={`relative flex min-h-[72px] cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="radio"
        className="sr-only"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
      />
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
          selected
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </label>
  );
}

export default DisputeForm;
