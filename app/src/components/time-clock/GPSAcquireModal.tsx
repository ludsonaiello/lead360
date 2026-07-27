'use client';

import React from 'react';
import {
  AlertTriangle,
  Flag,
  Loader2,
  MapPin,
  RefreshCw,
  Satellite,
  ShieldAlert,
} from 'lucide-react';

import { Modal } from '@/components/ui/Modal';

export type GPSAcquirePhase = 'acquiring' | 'failed';

interface GPSAcquireModalProps {
  isOpen: boolean;
  phase: GPSAcquirePhase;
  action: 'clock-in' | 'clock-out';
  errorMessage?: string | null;
  canContinueWithoutGps: boolean;
  onRetry: () => void;
  onContinueAnyway?: () => void;
  onCancel: () => void;
}

export function GPSAcquireModal({
  isOpen,
  phase,
  action,
  errorMessage,
  canContinueWithoutGps,
  onRetry,
  onContinueAnyway,
  onCancel,
}: GPSAcquireModalProps) {
  const actionLabel = action === 'clock-in' ? 'Clocking In' : 'Clocking Out';

  if (phase === 'failed') {
    const blocked = !canContinueWithoutGps;
    return (
      <Modal isOpen={isOpen} onClose={onCancel} size="sm" showCloseButton={false}>
        <div className="-mt-2 flex flex-col items-center text-center">
          <div
            className={`relative mb-5 flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg ${
              blocked
                ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-red-500/30'
                : 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30'
            }`}
          >
            {blocked ? (
              <ShieldAlert className="h-12 w-12 text-white" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-12 w-12 text-white" aria-hidden="true" />
            )}
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {blocked ? 'Location Required' : 'Location Unavailable'}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            {errorMessage ||
              (blocked
                ? 'We couldn\u2019t confirm your location. You cannot clock in until location is available.'
                : 'We couldn\u2019t confirm your location right now.')}
          </p>

          {!blocked && (
            <div className="mt-4 flex w-full items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-left dark:border-amber-900/50 dark:bg-amber-950/30">
              <Flag
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                If you continue, this session will be <span className="font-bold">flagged</span>{' '}
                for review by your administrator.
              </p>
            </div>
          )}

          <div className="mt-5 w-full space-y-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-900"
              style={{ minHeight: 52 }}
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Try Again
            </button>

            {!blocked && onContinueAnyway && (
              <button
                type="button"
                onClick={onContinueAnyway}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 focus:outline-none focus:ring-4 focus:ring-amber-200 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70 dark:focus:ring-amber-900"
                style={{ minHeight: 48 }}
              >
                <Flag className="h-4 w-4" aria-hidden="true" />
                Continue &amp; Flag Session
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-xl px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-700"
              style={{ minHeight: 44 }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Acquiring phase — animated GPS lock UI
  return (
    <Modal isOpen={isOpen} onClose={onCancel} size="sm" showCloseButton={false}>
      <div className="-mt-2 flex flex-col items-center text-center">
        {/* Radar-style pulsing rings with center map pin */}
        <div className="relative my-3 flex h-32 w-32 items-center justify-center">
          {/* Pulsing rings */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-blue-500/20 motion-safe:animate-ping"
            style={{ animationDuration: '2s' }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-3 rounded-full bg-blue-500/30 motion-safe:animate-ping"
            style={{ animationDuration: '2s', animationDelay: '0.4s' }}
          />
          <span
            aria-hidden="true"
            className="absolute inset-6 rounded-full bg-blue-500/40 motion-safe:animate-ping"
            style={{ animationDuration: '2s', animationDelay: '0.8s' }}
          />
          {/* Center tile */}
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40">
            <MapPin className="h-10 w-10 text-white" aria-hidden="true" />
          </div>
          {/* Orbit satellite badge */}
          <span className="absolute -right-1 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md dark:bg-gray-800">
            <Satellite className="h-4 w-4 text-blue-600 motion-safe:animate-spin dark:text-blue-400" style={{ animationDuration: '3s' }} aria-hidden="true" />
          </span>
        </div>

        <h2
          className="text-xl font-bold text-gray-900 dark:text-white"
          aria-live="polite"
        >
          Getting GPS Data
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          Locking onto your location before {actionLabel.toLowerCase()}.
        </p>

        {/* Status pill */}
        <div className="mt-5 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex items-center gap-2.5 text-sm">
            <Loader2
              className="h-4 w-4 flex-shrink-0 text-blue-600 motion-safe:animate-spin dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="font-medium text-gray-700 dark:text-gray-300">
              Acquiring your location signal…
            </span>
          </div>
          <p className="mt-1.5 pl-6 text-[11px] text-gray-500 dark:text-gray-500">
            This usually takes a few seconds. Hold tight.
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-5 w-full rounded-xl px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-700"
          style={{ minHeight: 44 }}
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export default GPSAcquireModal;
