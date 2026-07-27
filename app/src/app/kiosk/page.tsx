'use client';

import React, { Suspense, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AxiosError, AxiosInstance } from 'axios';
import {
  CheckCircle2,
  Search,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  createKioskApi,
  KioskEmployee,
  KioskErrorResponse,
} from '@/lib/kiosk-api';
import KioskPINPad from '@/components/time-clock/KioskPINPad';

// ── Constants ────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;
const SUCCESS_DISPLAY_MS = 3_000;
const LOCKOUT_REDIRECT_MS = 3_000;
const ERROR_REDIRECT_MS = 5_000;
const RATE_LIMIT_DISABLE_MS = 10_000;

type Screen = 'employee_list' | 'pin_entry' | 'success';

// 401 messages that mean the kiosk TOKEN is bad (not the PIN)
const TOKEN_ERROR_MESSAGES = ['Invalid kiosk token', 'Missing X-Kiosk-Token header'];

// ── Exported Page (Suspense wrapper for useSearchParams) ─────────────────

export default function KioskPage() {
  return (
    <Suspense fallback={<KioskLoadingScreen />}>
      <KioskPageInner />
    </Suspense>
  );
}

// ── Loading Screen ───────────────────────────────────────────────────────

function KioskLoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 text-gray-500 animate-spin" />
    </div>
  );
}

// ── Inner Page (reads searchParams, resolves token client-side) ──────────

function KioskPageInner() {
  const searchParams = useSearchParams();

  // Safe to call synchronously: inside Suspense + useSearchParams, this component
  // only renders on the client — never on the server. No hydration mismatch.
  const kioskToken = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const urlToken = searchParams.get('token');
    if (urlToken) {
      sessionStorage.setItem('kiosk_token', urlToken);
      return urlToken;
    }
    return sessionStorage.getItem('kiosk_token');
  }, [searchParams]);

  if (!kioskToken) {
    return <InvalidTokenScreen />;
  }

  return <KioskApp token={kioskToken} />;
}

// ── Invalid Token Screen ─────────────────────────────────────────────────

function InvalidTokenScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center gap-6">
      <ShieldAlert className="w-16 h-16 text-red-400" />
      <h1 className="text-2xl sm:text-3xl font-bold text-white">
        Invalid Kiosk Configuration
      </h1>
      <p className="text-gray-400 text-base sm:text-lg max-w-md leading-relaxed">
        This kiosk has not been set up yet. Please contact your administrator
        to generate a kiosk access link.
      </p>
    </div>
  );
}

// ── Kiosk App (has a valid token) ────────────────────────────────────────

interface KioskAppProps {
  token: string;
}

function KioskApp({ token }: KioskAppProps) {
  const api = useMemo(() => createKioskApi(token), [token]);

  const [screen, setScreen] = useState<Screen>('employee_list');
  const [employees, setEmployees] = useState<KioskEmployee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<KioskEmployee | null>(null);
  const [successData, setSuccessData] = useState<{
    action: 'in' | 'out';
    time: Date;
  } | null>(null);

  // Track the success-screen auto-return timeout so we can cancel on unmount
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    };
  }, []);

  // ── Fetch employees ──────────────────────────────────────────────────

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/time-clock/kiosk/employees');
      setEmployees(res.data.data);
      setEmployeeError(null);
    } catch (err) {
      const axErr = err as AxiosError<KioskErrorResponse>;
      if (axErr.response?.status === 401) {
        setEmployeeError(
          'Kiosk token expired or invalid. Please contact your administrator.',
        );
      } else {
        setEmployeeError('Unable to load employees. Please try again.');
      }
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [api]);

  // Initial fetch
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Auto-refresh every 30s — only on employee list screen
  useEffect(() => {
    if (screen !== 'employee_list') return;
    const interval = setInterval(fetchEmployees, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [screen, fetchEmployees]);

  // ── Screen transitions ───────────────────────────────────────────────

  const selectEmployee = useCallback((emp: KioskEmployee) => {
    setSelectedEmployee(emp);
    setScreen('pin_entry');
  }, []);

  const goToEmployeeList = useCallback(() => {
    setSelectedEmployee(null);
    setSuccessData(null);
    setScreen('employee_list');
    fetchEmployees();
  }, [fetchEmployees]);

  const showSuccess = useCallback(
    (action: 'in' | 'out') => {
      setSuccessData({ action, time: new Date() });
      setScreen('success');

      // Cancel any previous pending auto-return
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = setTimeout(goToEmployeeList, SUCCESS_DISPLAY_MS);
    },
    [goToEmployeeList],
  );

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto px-4 py-6 sm:py-10 min-h-screen">
      {/* Logo / Title */}
      <div className="flex items-center gap-3 mb-6 sm:mb-10">
        <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-blue-400" />
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
          Lead360 Time Clock
        </h1>
      </div>

      {screen === 'employee_list' && (
        <EmployeeListScreen
          employees={employees}
          isLoading={isLoadingEmployees}
          error={employeeError}
          onSelect={selectEmployee}
          onRetry={fetchEmployees}
        />
      )}

      {screen === 'pin_entry' && selectedEmployee && (
        <PinEntryScreen
          employee={selectedEmployee}
          api={api}
          onSuccess={showSuccess}
          onBack={goToEmployeeList}
        />
      )}

      {screen === 'success' && selectedEmployee && successData && (
        <SuccessScreen
          employee={selectedEmployee}
          action={successData.action}
          time={successData.time}
        />
      )}
    </div>
  );
}

// ── Employee List Screen ─────────────────────────────────────────────────

interface EmployeeListScreenProps {
  employees: KioskEmployee[];
  isLoading: boolean;
  error: string | null;
  onSelect: (emp: KioskEmployee) => void;
  onRetry: () => void;
}

function EmployeeListScreen({
  employees,
  isLoading,
  error,
  onSelect,
  onRetry,
}: EmployeeListScreenProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) =>
        e.user.first_name.toLowerCase().includes(q) ||
        e.user.last_name.toLowerCase().includes(q),
    );
  }, [employees, search]);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-4">
        <AlertTriangle className="w-14 h-14 text-amber-400" />
        <p className="text-lg text-gray-300 max-w-sm leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95 text-white font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-950"
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state — skeleton cards
  if (isLoading) {
    return (
      <div className="w-full flex-1">
        <div className="h-12 rounded-xl bg-gray-800 animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-2xl bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
        <Users className="w-14 h-14 text-gray-600" />
        <p className="text-lg text-gray-400">No employees configured for kiosk</p>
        <p className="text-sm text-gray-500 max-w-xs">
          Ask your administrator to set up employee PINs for kiosk clock-in.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex-1">
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search employees..."
          className="w-full h-12 pl-12 pr-4 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          aria-label="Search employees by name"
        />
      </div>

      {/* Employee grid */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-500 text-base py-10">
          No employees match &ldquo;{search}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelect(emp)}
              className="flex flex-col items-center justify-center gap-2 min-h-[120px] rounded-2xl bg-gray-800/80 border border-gray-700/50 hover:bg-gray-700/80 active:bg-gray-700 active:scale-[0.97] transition-all duration-100 p-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              aria-label={`${emp.user.first_name} ${emp.user.last_name}, ${emp.is_clocked_in ? 'currently clocked in' : 'not clocked in'}`}
            >
              {/* Avatar circle */}
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold ${
                  emp.is_clocked_in
                    ? 'bg-emerald-600/20 text-emerald-400'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {emp.user.first_name.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <span className="text-lg font-semibold text-white truncate max-w-full">
                {emp.user.first_name} {emp.user.last_name}
              </span>

              {/* Status badge */}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                  emp.is_clocked_in
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-gray-700/60 text-gray-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    emp.is_clocked_in ? 'bg-emerald-400' : 'bg-gray-500'
                  }`}
                />
                {emp.is_clocked_in ? 'Clocked In' : 'Not Clocked In'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PIN Entry Screen ─────────────────────────────────────────────────────

interface PinEntryScreenProps {
  employee: KioskEmployee;
  api: AxiosInstance;
  onSuccess: (action: 'in' | 'out') => void;
  onBack: () => void;
}

function PinEntryScreen({ employee, api, onSuccess, onBack }: PinEntryScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<'error' | 'warning'>('error');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [numpadDisabled, setNumpadDisabled] = useState(false);
  const [pinResetKey, setPinResetKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending timeout before setting a new one
  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(fn, ms);
  }, []);

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const action = employee.is_clocked_in ? 'out' : 'in';
  const endpoint =
    action === 'in'
      ? '/time-clock/kiosk/clock-in'
      : '/time-clock/kiosk/clock-out';

  const handlePinSubmit = useCallback(
    async (pin: string) => {
      setIsSubmitting(true);
      setError(null);
      setRemainingAttempts(null);

      try {
        await api.post(endpoint, {
          employee_profile_id: employee.id,
          pin,
        });
        onSuccess(action);
      } catch (err) {
        const axErr = err as AxiosError<KioskErrorResponse>;
        const status = axErr.response?.status;
        const data = axErr.response?.data;
        const msg = typeof data?.message === 'string' ? data.message : '';

        // Bump reset key to force PIN pad to remount with cleared input
        setPinResetKey((k) => k + 1);
        setErrorVariant('error');

        // Distinguish kiosk token 401 from PIN 401
        if (status === 401 && TOKEN_ERROR_MESSAGES.includes(msg)) {
          setError('Kiosk token expired. Please contact your administrator.');
          setNumpadDisabled(true);
          scheduleTimeout(onBack, ERROR_REDIRECT_MS);
          return;
        }

        switch (status) {
          case 400: {
            // Validation error (e.g., require_job_tag on but no project sent)
            setError(msg || 'Invalid request. Please try again.');
            scheduleTimeout(onBack, ERROR_REDIRECT_MS);
            break;
          }

          case 401: {
            // Invalid PIN — stay on screen, let user retry
            setError(msg || 'Invalid PIN');
            if (data?.remaining_attempts != null) {
              setRemainingAttempts(data.remaining_attempts);
            }
            break;
          }

          case 404: {
            // Employee not found or no active session
            setError(msg || 'Employee or session not found');
            scheduleTimeout(onBack, LOCKOUT_REDIRECT_MS);
            break;
          }

          case 409:
            // Already clocked in/out
            setError(
              employee.is_clocked_in
                ? 'Already clocked out'
                : 'Already clocked in',
            );
            scheduleTimeout(onBack, LOCKOUT_REDIRECT_MS);
            break;

          case 423:
            // Account locked
            setError('Account locked for 15 minutes');
            setNumpadDisabled(true);
            scheduleTimeout(onBack, LOCKOUT_REDIRECT_MS);
            break;

          case 429:
            // Rate limited
            setError('Too many attempts, please wait');
            setErrorVariant('warning');
            setNumpadDisabled(true);
            scheduleTimeout(() => {
              setNumpadDisabled(false);
              setError(null);
              setErrorVariant('error');
            }, RATE_LIMIT_DISABLE_MS);
            break;

          default:
            setError('Something went wrong. Please try again.');
            scheduleTimeout(onBack, ERROR_REDIRECT_MS);
            break;
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [api, endpoint, employee, action, onSuccess, onBack, scheduleTimeout],
  );

  return (
    <div className="flex flex-col items-center w-full flex-1 gap-6 sm:gap-8">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        disabled={isSubmitting}
        className="self-start flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium -mt-1 focus:outline-none focus:text-white disabled:opacity-40"
        aria-label="Back to employee list"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Employee info */}
      <div className="flex flex-col items-center gap-3">
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-full text-2xl font-bold ${
            employee.is_clocked_in
              ? 'bg-emerald-600/20 text-emerald-400'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {employee.user.first_name.charAt(0).toUpperCase()}
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          {employee.user.first_name} {employee.user.last_name}
        </h2>

        <span
          className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${
            employee.is_clocked_in
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-gray-700/60 text-gray-400'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              employee.is_clocked_in ? 'bg-emerald-400' : 'bg-gray-500'
            }`}
          />
          {employee.is_clocked_in ? 'Clocked In' : 'Not Clocked In'}
        </span>

        <p className="text-gray-500 text-sm mt-1">
          Enter PIN to{' '}
          <span className="text-gray-300 font-semibold">
            Clock {action === 'in' ? 'In' : 'Out'}
          </span>
        </p>
      </div>

      {/* Loading overlay on the PIN pad area */}
      <div className="relative w-full max-w-xs mx-auto">
        {isSubmitting && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/60 rounded-2xl">
            <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
          </div>
        )}

        <KioskPINPad
          key={pinResetKey}
          onSubmit={handlePinSubmit}
          disabled={isSubmitting || numpadDisabled}
          error={error}
          errorVariant={errorVariant}
          remainingAttempts={remainingAttempts}
        />
      </div>
    </div>
  );
}

// ── Success Screen ───────────────────────────────────────────────────────

interface SuccessScreenProps {
  employee: KioskEmployee;
  action: 'in' | 'out';
  time: Date;
}

function SuccessScreen({ employee, action, time }: SuccessScreenProps) {
  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(time);
  }, [time]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center px-4 animate-fade-in">
      {/* Animated check */}
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-emerald-500/20 motion-safe:animate-ping" />
        <CheckCircle2 className="relative w-24 h-24 sm:w-28 sm:h-28 text-emerald-400 animate-scale-in" />
      </div>

      <h2 className="text-3xl sm:text-4xl font-bold text-white">
        Clocked {action === 'in' ? 'In' : 'Out'}!
      </h2>

      <p className="text-xl text-gray-300 font-medium">
        {employee.user.first_name} {employee.user.last_name}
      </p>

      <p className="text-2xl sm:text-3xl text-gray-400 font-light tabular-nums">
        {formattedTime}
      </p>
    </div>
  );
}
