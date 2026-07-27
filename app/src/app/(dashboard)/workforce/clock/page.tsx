'use client';

/**
 * Clock In/Out Page — /workforce/clock
 * Mobile-first, production-grade clock-in/out experience.
 * Roles: Owner, Admin, Project Manager, Employee (timeclock:clock_in)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import {
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flag,
  MapPin,
  ShieldAlert,
  StickyNote,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { Badge } from '@/components/ui/Badge';

import { BreakControls } from '@/components/time-clock/BreakControls';
import { ClockButton } from '@/components/time-clock/ClockButton';
import { SessionDurationTimer } from '@/components/time-clock/SessionDurationTimer';
import { GPSStatusIndicator } from '@/components/time-clock/GPSStatusIndicator';
import { GPSPermissionModal } from '@/components/time-clock/GPSPermissionModal';
import { GPSAcquireModal } from '@/components/time-clock/GPSAcquireModal';
import type { GPSAcquirePhase } from '@/components/time-clock/GPSAcquireModal';
import { ProjectTaskSelector } from '@/components/time-clock/ProjectTaskSelector';
import { PushNotificationBanner } from '@/components/time-clock/PushNotificationBanner';
import { TodaysSessionsSummary } from '@/components/time-clock/TodaysSessionsSummary';

import { useAuth } from '@/contexts/AuthContext';
import { useGPSPosition } from '@/lib/hooks/useGPSPosition';
import { usePageTitle } from '@/lib/hooks/usePageTitle';

import {
  clockIn as apiClockIn,
  clockOut as apiClockOut,
  getMyActiveSession,
  getMyAvailableProjects,
  getMySessionHistory,
  getTimeClockSettings,
} from '@/lib/api/time-clock';

import type {
  AvailableProject,
  ClockInRequest,
  ClockOutRequest,
  ClockSession,
  TimeClockSettings,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// Minimum display time for the GPS acquiring modal — guarantees the user
// perceives the modal even when GPS resolves instantly from a warm cache.
const GPS_ACQUIRE_MIN_MS = 1100;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function roundToFixed(n: number | null, places = 6): number | undefined {
  if (n == null || Number.isNaN(n)) return undefined;
  return Number(n.toFixed(places));
}

function formatDurationFromMinutes(mins: number | null): string {
  if (mins == null) return '0h 00m';
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ClockPage() {
  usePageTitle('Clock In/Out — Time Clock');
  const { isLoading: authLoading } = useAuth();

  // Data state
  const [settings, setSettings] = useState<TimeClockSettings | null>(null);
  const [activeSession, setActiveSession] = useState<ClockSession | null>(null);
  const [availableProjects, setAvailableProjects] = useState<AvailableProject[]>([]);
  const [todaysSessions, setTodaysSessions] = useState<ClockSession[]>([]);

  // Loading flags
  const [bootLoading, setBootLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // Clock-in form
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [projectFieldError, setProjectFieldError] = useState<string | undefined>();
  const [taskFieldError, setTaskFieldError] = useState<string | undefined>();

  // Modals
  const [confirmClockOutOpen, setConfirmClockOutOpen] = useState(false);
  const [gpsModalDismissed, setGpsModalDismissed] = useState(false);
  const [gpsAcquireModal, setGpsAcquireModal] = useState<{
    open: boolean;
    phase: GPSAcquirePhase;
    action: 'clock-in' | 'clock-out';
    error: string | null;
  }>({ open: false, phase: 'acquiring', action: 'clock-in', error: null });
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });
  const [successModal, setSuccessModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });

  // GPS — requested automatically on mount
  const gps = useGPSPosition();

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const isClockedIn = activeSession !== null;
  const projectRequired = settings?.require_job_tag ?? false;
  const taskRequired = settings?.require_task_tag ?? false;
  const gpsRequired = settings?.gps_required ?? false;
  const gpsBlocksOnMissing = settings?.gps_unavailable_action === 'block';

  // The GPS onboarding modal opens the moment we detect that permission is
  // not already granted, and stays open until either the user grants it or
  // explicitly dismisses it (only possible when clock-in can proceed without GPS).
  const canContinueWithoutGps = !gpsBlocksOnMissing;
  const shouldShowGpsModal =
    !bootLoading &&
    !gpsModalDismissed &&
    !isClockedIn &&
    (gps.permissionState === 'prompt' ||
      gps.permissionState === 'denied' ||
      gps.permissionState === 'unsupported' ||
      gps.status === 'denied');

  const clockInDisabled =
    bootLoading ||
    gpsAcquireModal.open ||
    availableProjects.length === 0 ||
    (projectRequired && !selectedProjectId) ||
    (taskRequired && !selectedTaskId) ||
    (gpsRequired && gpsBlocksOnMissing && gps.permissionState === 'denied');

  const clockInDisabledReason = useMemo(() => {
    if (bootLoading) return 'Loading your clock…';
    if (gpsAcquireModal.open) return 'Getting GPS data…';
    if (gpsRequired && gpsBlocksOnMissing && gps.permissionState === 'denied')
      return 'Enable location services — GPS is required to clock in.';
    if (availableProjects.length === 0)
      return 'No projects available. Ask an admin to assign you to a project.';
    if (projectRequired && !selectedProjectId) return 'Select a project to continue.';
    if (taskRequired && !selectedTaskId) return 'Select a task to continue.';
    return undefined;
  }, [
    bootLoading,
    gpsAcquireModal.open,
    gpsRequired,
    gpsBlocksOnMissing,
    gps.permissionState,
    availableProjects.length,
    projectRequired,
    selectedProjectId,
    taskRequired,
    selectedTaskId,
  ]);

  // -------------------------------------------------------------------------
  // Data loaders
  // -------------------------------------------------------------------------

  const loadTodaysSessions = useCallback(async () => {
    try {
      setSessionsLoading(true);
      const now = new Date();
      const res = await getMySessionHistory({
        date_from: startOfDay(now).toISOString(),
        date_to: endOfDay(now).toISOString(),
        page: 1,
        limit: 50,
      });
      setTodaysSessions(res.data || []);
    } catch (err) {
      console.error('[ClockPage] Failed to load today sessions', err);
      toast.error('Could not load today\u2019s sessions.');
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const loadActiveSession = useCallback(async () => {
    const session = await getMyActiveSession();
    setActiveSession(session);
    if (session?.project_id) {
      setSelectedProjectId(session.project_id);
    }
    if (session?.task_id) {
      setSelectedTaskId(session.task_id);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      setProjectsLoading(true);
      const list = await getMyAvailableProjects();
      setAvailableProjects(list || []);
    } catch (err) {
      console.error('[ClockPage] Failed to load available projects', err);
      toast.error('Could not load available projects.');
      setAvailableProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  const bootClock = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setBootLoading(true);
        setBootError(null);
        const [settingsRes] = await Promise.all([
          getTimeClockSettings(),
          loadActiveSession(),
          loadProjects(),
          loadTodaysSessions(),
        ]);
        if (isCancelled?.()) return;
        setSettings(settingsRes);
      } catch (err) {
        if (isCancelled?.()) return;
        console.error('[ClockPage] Boot failed', err);
        setBootError(extractErrorMessage(err, 'Could not load the time clock.'));
      } finally {
        if (!isCancelled?.()) setBootLoading(false);
      }
    },
    [loadActiveSession, loadProjects, loadTodaysSessions],
  );

  useEffect(() => {
    let cancelled = false;
    void bootClock(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [bootClock]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  // Performs the actual POST /clock-in call. Called after GPS is resolved
  // (or skipped with user consent on allow_flagged mode).
  const performClockIn = useCallback(
    async (coords: { latitude?: number; longitude?: number }) => {
      const payload: ClockInRequest = {
        location_source: 'browser_gps',
        latitude: coords.latitude,
        longitude: coords.longitude,
        project_id: selectedProjectId ?? undefined,
        task_id: selectedTaskId ?? undefined,
        notes: notes.trim() ? notes.trim() : undefined,
      };

      try {
        setClockingIn(true);
        const session = await apiClockIn(payload);
        setActiveSession(session);
        setNotes('');
        await loadTodaysSessions();
        toast.success('Clocked in successfully');

        if (session.is_flagged && session.flag_reason) {
          setErrorModal({
            open: true,
            title: 'Session Flagged',
            message: `You are clocked in, but this session has been flagged:\n\n${session.flag_reason}`,
          });
        }
      } catch (err) {
        const status = extractErrorStatus(err);
        const message = extractErrorMessage(err, 'Unable to clock in.');
        if (status === 409) {
          setErrorModal({
            open: true,
            title: 'Already Clocked In',
            message: 'You already have an active clock session. Refresh to see it.',
          });
          await loadActiveSession();
        } else if (status === 403) {
          setErrorModal({
            open: true,
            title: 'Clock-In Blocked',
            message,
          });
        } else if (status === 400) {
          if (/project/i.test(message)) {
            setProjectFieldError(message);
          } else if (/task/i.test(message)) {
            setTaskFieldError(message);
          }
          setErrorModal({
            open: true,
            title: 'Check Your Entries',
            message,
          });
        } else {
          setErrorModal({
            open: true,
            title: 'Clock-In Failed',
            message,
          });
        }
      } finally {
        setClockingIn(false);
      }
    },
    [
      selectedProjectId,
      selectedTaskId,
      notes,
      loadTodaysSessions,
      loadActiveSession,
    ],
  );

  const acquireGpsForClockIn = useCallback(async () => {
    setGpsAcquireModal({
      open: true,
      phase: 'acquiring',
      action: 'clock-in',
      error: null,
    });
    const minDelay = sleep(GPS_ACQUIRE_MIN_MS);
    try {
      const fresh = await gps.requestFresh();
      await minDelay;
      setGpsAcquireModal((s) => ({ ...s, open: false }));
      await performClockIn({
        latitude: roundToFixed(fresh.latitude),
        longitude: roundToFixed(fresh.longitude),
      });
    } catch (err) {
      await minDelay;
      setGpsAcquireModal({
        open: true,
        phase: 'failed',
        action: 'clock-in',
        error: extractErrorMessage(err, 'Unable to acquire GPS location.'),
      });
    }
  }, [gps, performClockIn]);

  const handleClockIn = useCallback(async () => {
    if (clockingIn) return;

    setProjectFieldError(undefined);
    setTaskFieldError(undefined);

    if (projectRequired && !selectedProjectId) {
      setProjectFieldError('Project is required.');
      return;
    }
    if (taskRequired && !selectedTaskId) {
      setTaskFieldError('Task is required.');
      return;
    }

    await acquireGpsForClockIn();
  }, [
    clockingIn,
    projectRequired,
    taskRequired,
    selectedProjectId,
    selectedTaskId,
    acquireGpsForClockIn,
  ]);

  const requestClockOut = useCallback(() => {
    if (!activeSession || clockingOut) return;
    setConfirmClockOutOpen(true);
  }, [activeSession, clockingOut]);

  const performClockOut = useCallback(
    async (coords: { latitude?: number; longitude?: number }) => {
      if (!activeSession) return;

      const payload: ClockOutRequest = {
        location_source: 'browser_gps',
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      try {
        setClockingOut(true);
        const finished = await apiClockOut(payload);
        setActiveSession(null);
        setSelectedProjectId(null);
        setSelectedTaskId(null);
        setConfirmClockOutOpen(false);
        await loadTodaysSessions();

        const durationLabel = formatDurationFromMinutes(finished.total_worked_minutes);
        const projectLine = finished.project?.name
          ? `Project: ${finished.project.name}`
          : 'No project assigned';
        setSuccessModal({
          open: true,
          title: 'Clocked Out',
          message: `${projectLine}\nWorked: ${durationLabel}`,
        });
        toast.success('Clocked out successfully');
      } catch (err) {
        const status = extractErrorStatus(err);
        const message = extractErrorMessage(err, 'Unable to clock out.');
        if (status === 404) {
          setErrorModal({
            open: true,
            title: 'No Active Session',
            message: 'There is no active session to clock out. Refresh to sync.',
          });
          await loadActiveSession();
          setConfirmClockOutOpen(false);
        } else {
          setErrorModal({
            open: true,
            title: 'Clock-Out Failed',
            message,
          });
        }
      } finally {
        setClockingOut(false);
      }
    },
    [activeSession, loadTodaysSessions, loadActiveSession],
  );

  const acquireGpsForClockOut = useCallback(async () => {
    if (!activeSession) return;
    setConfirmClockOutOpen(false);
    setGpsAcquireModal({
      open: true,
      phase: 'acquiring',
      action: 'clock-out',
      error: null,
    });
    const minDelay = sleep(GPS_ACQUIRE_MIN_MS);
    try {
      const fresh = await gps.requestFresh();
      await minDelay;
      setGpsAcquireModal((s) => ({ ...s, open: false }));
      await performClockOut({
        latitude: roundToFixed(fresh.latitude),
        longitude: roundToFixed(fresh.longitude),
      });
    } catch (err) {
      await minDelay;
      setGpsAcquireModal({
        open: true,
        phase: 'failed',
        action: 'clock-out',
        error: extractErrorMessage(err, 'Unable to acquire GPS location.'),
      });
    }
  }, [activeSession, gps, performClockOut]);

  const confirmClockOut = useCallback(async () => {
    await acquireGpsForClockOut();
  }, [acquireGpsForClockOut]);

  const handleGpsAcquireRetry = useCallback(() => {
    if (gpsAcquireModal.action === 'clock-in') {
      void acquireGpsForClockIn();
    } else {
      void acquireGpsForClockOut();
    }
  }, [gpsAcquireModal.action, acquireGpsForClockIn, acquireGpsForClockOut]);

  const handleGpsAcquireContinueAnyway = useCallback(async () => {
    setGpsAcquireModal((s) => ({ ...s, open: false }));
    if (gpsAcquireModal.action === 'clock-in') {
      await performClockIn({});
    } else {
      await performClockOut({});
    }
  }, [gpsAcquireModal.action, performClockIn, performClockOut]);

  const handleGpsAcquireCancel = useCallback(() => {
    setGpsAcquireModal((s) => ({ ...s, open: false }));
  }, []);

  // -------------------------------------------------------------------------
  // Render — gates
  // -------------------------------------------------------------------------

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 pb-24 dark:bg-gray-900">
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6 sm:pt-6">
        <Breadcrumb
          items={[
            { label: 'Workforce', href: '/workforce/clock' },
            { label: 'Clock In/Out' },
          ]}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </Link>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {format(new Date(), 'EEEE')}
            </div>
            <div className="font-mono text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
              {format(new Date(), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        <header className="mt-4 mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
            <Clock className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Clock In/Out
            </h1>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              Track your hours on the go.
            </p>
          </div>
        </header>

        {/* Web Push opt-in — silent on unsupported browsers, denied users, or when VAPID key is unset */}
        <PushNotificationBanner />

        {/* GPS Status */}
        <GPSStatusIndicator
          status={gps.status}
          accuracy={gps.accuracy}
          error={gps.error}
          onRetry={() => {
            setGpsModalDismissed(false);
            if (gps.permissionState === 'granted') {
              gps.request();
            }
          }}
        />

        {bootError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Could not load your clock</p>
                <p className="mt-0.5 text-xs">{bootError}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void bootClock()}
              disabled={bootLoading}
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-900/30"
            >
              {bootLoading ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        )}

        {/* Boot loading skeleton */}
        {bootLoading ? (
          <div className="mt-5 space-y-4">
            <div className="h-48 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
            <div className="h-20 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
            <div className="h-40 animate-pulse rounded-2xl bg-white dark:bg-gray-800" />
          </div>
        ) : isClockedIn && activeSession ? (
          <ActiveSessionSection
            session={activeSession}
            loading={clockingOut}
            onClockOut={requestClockOut}
            onBreakChanged={loadActiveSession}
          />
        ) : (
          <ClockInSection
            projects={availableProjects}
            projectsLoading={projectsLoading}
            projectId={selectedProjectId}
            taskId={selectedTaskId}
            onProjectChange={setSelectedProjectId}
            onTaskChange={setSelectedTaskId}
            projectRequired={projectRequired}
            taskRequired={taskRequired}
            projectError={projectFieldError}
            taskError={taskFieldError}
            notes={notes}
            onNotesChange={setNotes}
            clockingIn={clockingIn}
            clockInDisabled={clockInDisabled}
            clockInDisabledReason={clockInDisabledReason}
            onClockIn={handleClockIn}
            userLatitude={gps.latitude}
            userLongitude={gps.longitude}
          />
        )}

        {/* Today's Sessions */}
        {!bootLoading && (
          <TodaysSessionsSummary
            className="mt-5"
            sessions={todaysSessions}
            loading={sessionsLoading}
          />
        )}
      </div>

      {/* GPS permission onboarding modal */}
      <GPSPermissionModal
        isOpen={shouldShowGpsModal}
        onClose={() => {
          if (canContinueWithoutGps) setGpsModalDismissed(true);
        }}
        onRequest={() => gps.request()}
        permissionState={gps.permissionState}
        status={gps.status}
        gpsRequired={gpsRequired}
        canContinueWithoutGps={canContinueWithoutGps}
        onContinueWithoutGps={
          canContinueWithoutGps ? () => setGpsModalDismissed(true) : undefined
        }
      />

      {/* Confirm clock-out modal */}
      <ConfirmModal
        isOpen={confirmClockOutOpen}
        onClose={() => {
          if (!clockingOut) setConfirmClockOutOpen(false);
        }}
        onConfirm={confirmClockOut}
        title="Clock out of this session?"
        message={
          activeSession?.project?.name
            ? `You are about to clock out of "${activeSession.project.name}". This will end your current session.`
            : 'You are about to clock out of your current session.'
        }
        confirmText="Yes, Clock Out"
        cancelText="Cancel"
        variant="warning"
        loading={clockingOut}
      />

      {/* GPS acquiring modal — shown during clock-in / clock-out */}
      <GPSAcquireModal
        isOpen={gpsAcquireModal.open}
        phase={gpsAcquireModal.phase}
        action={gpsAcquireModal.action}
        errorMessage={gpsAcquireModal.error}
        canContinueWithoutGps={canContinueWithoutGps}
        onRetry={handleGpsAcquireRetry}
        onContinueAnyway={
          canContinueWithoutGps ? handleGpsAcquireContinueAnyway : undefined
        }
        onCancel={handleGpsAcquireCancel}
      />

      {/* Error modal */}
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />

      {/* Success modal */}
      <SuccessModal
        isOpen={successModal.open}
        onClose={() => setSuccessModal((s) => ({ ...s, open: false }))}
        title={successModal.title}
        message={successModal.message}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active Session Section
// ---------------------------------------------------------------------------

interface ActiveSessionSectionProps {
  session: ClockSession;
  loading: boolean;
  onClockOut: () => void;
  onBreakChanged: () => void | Promise<void>;
}

function ActiveSessionSection({
  session,
  loading,
  onClockOut,
  onBreakChanged,
}: ActiveSessionSectionProps) {
  const isOnBreak = session.status === 'on_break';
  const currentBreakStartedAt =
    (session.break_entries ?? []).find((b) => !b.ended_at)?.started_at ?? null;
  const clockInLabel = (() => {
    try {
      return format(parseISO(session.clock_in_at), 'h:mm a');
    } catch {
      return '—';
    }
  })();

  return (
    <section
      aria-label="Active session"
      className="mt-5 space-y-4"
    >
      <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-white to-blue-50/40 p-5 shadow-lg shadow-blue-500/5 dark:border-blue-900/40 dark:from-gray-800 dark:to-blue-950/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400">
              {isOnBreak ? 'On Break' : 'Active Session'}
            </p>
          </div>
          {session.is_flagged && (
            <Badge variant="warning">
              <Flag className="mr-1 h-3 w-3" aria-hidden="true" />
              Flagged
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center">
          <SessionDurationTimer
            clockInAt={session.clock_in_at}
            isPaused={isOnBreak}
            label="Elapsed"
          />
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-blue-100 pt-4 dark:border-blue-900/30 sm:grid-cols-2">
          <div className="flex items-start gap-2.5">
            <Briefcase
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Project
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-white">
                {session.project?.name || 'No Project'}
              </dd>
              {session.project?.project_number && (
                <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">
                  {session.project.project_number}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Clocked In
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                {clockInLabel}
              </dd>
            </div>
          </div>

          {session.task?.title && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <CheckCircle2
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Task
                </dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {session.task.title}
                </dd>
              </div>
            </div>
          )}

          {session.notes && (
            <div className="flex items-start gap-2.5 sm:col-span-2">
              <StickyNote
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Notes
                </dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {session.notes}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {session.is_flagged && session.flag_reason && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-900/50 dark:bg-amber-950/30"
          >
            <MapPin
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              {session.flag_reason}
            </p>
          </div>
        )}
      </div>

      <BreakControls
        sessionId={session.id}
        isOnBreak={isOnBreak}
        currentBreakStartedAt={currentBreakStartedAt}
        onBreakStarted={onBreakChanged}
        onBreakEnded={onBreakChanged}
      />

      <div className="flex justify-center pt-2">
        <ClockButton
          status={session.status}
          loading={loading}
          disabled={isOnBreak}
          disabledReason={isOnBreak ? 'End your break before clocking out.' : undefined}
          onClockIn={() => undefined}
          onClockOut={onClockOut}
        />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Clock In Section
// ---------------------------------------------------------------------------

interface ClockInSectionProps {
  projects: AvailableProject[];
  projectsLoading: boolean;
  projectId: string | null;
  taskId: string | null;
  onProjectChange: (value: string | null) => void;
  onTaskChange: (value: string | null) => void;
  projectRequired: boolean;
  taskRequired: boolean;
  projectError?: string;
  taskError?: string;
  notes: string;
  onNotesChange: (value: string) => void;
  clockingIn: boolean;
  clockInDisabled: boolean;
  clockInDisabledReason?: string;
  onClockIn: () => void;
  userLatitude: number | null;
  userLongitude: number | null;
}

function ClockInSection(props: ClockInSectionProps) {
  const {
    projects,
    projectsLoading,
    projectId,
    taskId,
    onProjectChange,
    onTaskChange,
    projectRequired,
    taskRequired,
    projectError,
    taskError,
    notes,
    onNotesChange,
    clockingIn,
    clockInDisabled,
    clockInDisabledReason,
    onClockIn,
    userLatitude,
    userLongitude,
  } = props;

  return (
    <section aria-label="Start a new session" className="mt-5 space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
          Start a new session
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {projectRequired
            ? 'Select the project you\u2019re working on, then clock in.'
            : 'Add optional details, then clock in.'}
        </p>

        <div className="mt-5">
          <ProjectTaskSelector
            projects={projects}
            projectsLoading={projectsLoading}
            projectId={projectId}
            taskId={taskId}
            onProjectChange={onProjectChange}
            onTaskChange={onTaskChange}
            projectRequired={projectRequired}
            taskRequired={taskRequired}
            projectError={projectError}
            taskError={taskError}
            disabled={clockingIn}
            userLatitude={userLatitude}
            userLongitude={userLongitude}
          />
        </div>

        <div className="mt-4">
          <Textarea
            id="clock-in-notes"
            label="Notes (optional)"
            placeholder="Starting morning shift…"
            value={notes}
            maxLength={500}
            showCharacterCount
            rows={3}
            onChange={(e) => onNotesChange(e.target.value)}
            disabled={clockingIn}
          />
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <ClockButton
          status="clocked_out"
          loading={clockingIn}
          disabled={clockInDisabled}
          disabledReason={clockInDisabledReason}
          onClockIn={onClockIn}
          onClockOut={() => undefined}
        />
      </div>
    </section>
  );
}
