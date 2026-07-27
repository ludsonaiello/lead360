'use client';

/**
 * BreakControls — Sprint 6 (time-clock)
 * Start/end break controls that live inside the active session card on the
 * Clock page. Mobile-first, production-grade, accessible.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { differenceInSeconds, parseISO } from 'date-fns';
import { Coffee, Pause, Play } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ErrorModal } from '@/components/ui/ErrorModal';

import { startBreak as apiStartBreak, endBreak as apiEndBreak } from '@/lib/api/time-clock';
import type { BreakType } from '@/lib/types/time-clock';

interface BreakControlsProps {
  sessionId: string;
  isOnBreak: boolean;
  currentBreakStartedAt?: string | null;
  onBreakStarted: () => void | Promise<void>;
  onBreakEnded: () => void | Promise<void>;
}

const BREAK_TYPE_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid Break' },
  { value: 'paid', label: 'Paid Break' },
];

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

function formatBreakDuration(seconds: number): string {
  const safe = seconds < 0 ? 0 : seconds;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function BreakTimer({ startedAt }: { startedAt: string }) {
  const compute = useCallback(() => {
    try {
      return differenceInSeconds(new Date(), parseISO(startedAt));
    } catch {
      return 0;
    }
  }, [startedAt]);

  const [elapsed, setElapsed] = useState<number>(compute);

  useEffect(() => {
    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(id);
  }, [compute]);

  const display = formatBreakDuration(elapsed);

  return (
    <div
      className="flex flex-col items-center"
      aria-live="polite"
      aria-atomic="true"
      role="timer"
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        Break Time
      </span>
      <span
        className="mt-0.5 font-mono text-3xl font-bold tabular-nums text-amber-700 dark:text-amber-300 sm:text-4xl"
        aria-label={`Break duration ${display}`}
      >
        {display}
      </span>
    </div>
  );
}

export function BreakControls({
  sessionId,
  isOnBreak,
  currentBreakStartedAt,
  onBreakStarted,
  onBreakEnded,
}: BreakControlsProps) {
  const [breakType, setBreakType] = useState<BreakType>('unpaid');
  const [breakLabel, setBreakLabel] = useState('');
  const [labelError, setLabelError] = useState<string | undefined>(undefined);
  const [startingBreak, setStartingBreak] = useState(false);
  const [endingBreak, setEndingBreak] = useState(false);
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });

  const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBreakLabel(value);
    if (value.length > 50) {
      setLabelError('Break label must be 50 characters or fewer.');
    } else {
      setLabelError(undefined);
    }
  }, []);

  const handleStartBreak = useCallback(async () => {
    if (startingBreak) return;
    if (breakLabel.length > 50) {
      setLabelError('Break label must be 50 characters or fewer.');
      return;
    }

    try {
      setStartingBreak(true);
      await apiStartBreak(sessionId, {
        break_type: breakType,
        break_label: breakLabel.trim() ? breakLabel.trim() : undefined,
      });
      setBreakLabel('');
      setLabelError(undefined);
      await onBreakStarted();
    } catch (err) {
      const status = extractErrorStatus(err);
      const message = extractErrorMessage(err, 'Unable to start your break.');
      if (status === 400) {
        setErrorModal({
          open: true,
          title: 'Cannot Start Break',
          message: message || 'Your session is not active — clock in before starting a break.',
        });
      } else if (status === 409) {
        setErrorModal({
          open: true,
          title: 'Break Already Active',
          message: 'A break is already running on this session. Refresh to sync.',
        });
        await onBreakStarted();
      } else if (status === 403) {
        setErrorModal({
          open: true,
          title: 'Not Allowed',
          message: 'You can only manage breaks on your own sessions.',
        });
      } else if (status === 404) {
        setErrorModal({
          open: true,
          title: 'Session Not Found',
          message: 'This clock session could not be found. Refresh and try again.',
        });
      } else {
        setErrorModal({
          open: true,
          title: 'Could Not Start Break',
          message,
        });
      }
    } finally {
      setStartingBreak(false);
    }
  }, [sessionId, breakType, breakLabel, onBreakStarted, startingBreak]);

  const handleEndBreak = useCallback(async () => {
    if (endingBreak) return;
    try {
      setEndingBreak(true);
      await apiEndBreak(sessionId);
      await onBreakEnded();
    } catch (err) {
      const status = extractErrorStatus(err);
      const message = extractErrorMessage(err, 'Unable to end your break.');
      if (status === 404) {
        setErrorModal({
          open: true,
          title: 'No Active Break',
          message: 'There is no active break on this session to end. Refresh to sync.',
        });
        await onBreakEnded();
      } else if (status === 403) {
        setErrorModal({
          open: true,
          title: 'Not Allowed',
          message: 'You can only manage breaks on your own sessions.',
        });
      } else {
        setErrorModal({
          open: true,
          title: 'Could Not End Break',
          message,
        });
      }
    } finally {
      setEndingBreak(false);
    }
  }, [sessionId, onBreakEnded, endingBreak]);

  const startDisabled = useMemo(
    () => startingBreak || Boolean(labelError),
    [startingBreak, labelError],
  );

  return (
    <>
      <section
        aria-label="Break controls"
        className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 sm:p-5"
      >
        {!isOnBreak ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
                  Take a break
                </h3>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  Pause your session for lunch or rest — your timer will pause.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Break type"
                options={BREAK_TYPE_OPTIONS}
                value={breakType}
                onChange={(v) => setBreakType(v as BreakType)}
                disabled={startingBreak}
              />
              <Input
                id="break-label"
                label="Label (optional)"
                placeholder="e.g., Lunch"
                value={breakLabel}
                onChange={handleLabelChange}
                maxLength={50}
                disabled={startingBreak}
                error={labelError}
                autoComplete="off"
                inputMode="text"
              />
            </div>

            <Button
              variant="secondary"
              size="lg"
              loading={startingBreak}
              disabled={startDisabled}
              onClick={handleStartBreak}
              className="w-full min-h-[52px] bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-300 dark:bg-amber-600 dark:hover:bg-amber-700"
              aria-label="Start break"
            >
              <Pause className="h-5 w-5" aria-hidden="true" />
              Start Break
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <Coffee className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-amber-900 dark:text-amber-200">
                  You are on break
                </h3>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  Your session timer is paused. Tap below when you return.
                </p>
              </div>
              {currentBreakStartedAt && (
                <BreakTimer key={currentBreakStartedAt} startedAt={currentBreakStartedAt} />
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              loading={endingBreak}
              disabled={endingBreak}
              onClick={handleEndBreak}
              className="w-full min-h-[52px] bg-green-600 text-white hover:bg-green-700 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700"
              aria-label="End break and resume session"
            >
              <Play className="h-5 w-5" aria-hidden="true" />
              End Break
            </Button>
          </div>
        )}
      </section>

      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />
    </>
  );
}

export default BreakControls;
