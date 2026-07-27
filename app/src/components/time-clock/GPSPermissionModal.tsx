'use client';

import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Apple,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Monitor,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import type { GPSPermissionState, GPSStatus } from '@/lib/hooks/useGPSPosition';

export type DevicePlatform = 'ios' | 'android' | 'desktop';

interface GPSPermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequest: () => void;
  permissionState: GPSPermissionState;
  status: GPSStatus;
  gpsRequired: boolean;
  canContinueWithoutGps: boolean;
  onContinueWithoutGps?: () => void;
}

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  // iPadOS 13+ reports as Mac but has touch support
  if (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document) {
    return 'ios';
  }
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

interface InstructionStep {
  n: number;
  text: string;
}

function getInstructions(platform: DevicePlatform): {
  heading: string;
  steps: InstructionStep[];
  Icon: typeof Smartphone;
} {
  if (platform === 'ios') {
    return {
      heading: 'On iPhone or iPad',
      Icon: Apple,
      steps: [
        { n: 1, text: 'Open the Settings app on your device.' },
        { n: 2, text: 'Tap Privacy & Security → Location Services.' },
        { n: 3, text: 'Make sure Location Services is turned on.' },
        {
          n: 4,
          text: 'Scroll to Safari Websites (or your browser) and select While Using the App.',
        },
        {
          n: 5,
          text: 'Return here and tap "I\u2019ve enabled it" below.',
        },
      ],
    };
  }

  if (platform === 'android') {
    return {
      heading: 'On Android',
      Icon: Smartphone,
      steps: [
        { n: 1, text: 'Tap the lock icon in the address bar at the top of this page.' },
        { n: 2, text: 'Tap Permissions (or Site settings).' },
        { n: 3, text: 'Set Location to Allow.' },
        { n: 4, text: 'If needed, also enable Location under your phone Settings → Location.' },
        {
          n: 5,
          text: 'Return here and tap "I\u2019ve enabled it" below.',
        },
      ],
    };
  }

  return {
    heading: 'On Desktop (Chrome, Edge, Firefox, Safari)',
    Icon: Monitor,
    steps: [
      { n: 1, text: 'Click the lock icon on the left side of the address bar.' },
      { n: 2, text: 'Open Site Settings (or Permissions).' },
      { n: 3, text: 'Set Location to Allow.' },
      { n: 4, text: 'Reload the page if prompted.' },
      {
        n: 5,
        text: 'Return here and tap "I\u2019ve enabled it" below.',
      },
    ],
  };
}

export function GPSPermissionModal({
  isOpen,
  onClose,
  onRequest,
  permissionState,
  status,
  gpsRequired,
  canContinueWithoutGps,
  onContinueWithoutGps,
}: GPSPermissionModalProps) {
  const platform = useMemo(() => detectPlatform(), []);
  const isDenied = permissionState === 'denied' || status === 'denied';
  const isUnsupported = permissionState === 'unsupported';
  const isAcquiring = status === 'acquiring';

  const instructions = useMemo(() => getInstructions(platform), [platform]);

  // Dismissible only if GPS isn't strictly required. When it's required, we
  // still render without a top-right close (the user can still tap the
  // backdrop to close — but our parent keeps re-opening it).
  const dismissible = !gpsRequired || canContinueWithoutGps;

  // --- UNSUPPORTED state --------------------------------------------------
  if (isUnsupported) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={dismissible}>
        <div className="-mt-2 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-10 w-10 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Location Not Supported
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Your device or browser does not support location services. Please use a modern
            mobile browser (Chrome, Safari, Firefox) to clock in with GPS tracking.
          </p>
          {canContinueWithoutGps && onContinueWithoutGps && (
            <button
              type="button"
              onClick={onContinueWithoutGps}
              className="mt-6 w-full rounded-xl border-2 border-gray-200 bg-white px-5 py-3.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
            >
              Continue Without GPS
            </button>
          )}
        </div>
      </Modal>
    );
  }

  // --- DENIED state — show platform-specific instructions -----------------
  if (isDenied) {
    const StepIcon = instructions.Icon;
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md" showCloseButton={dismissible}>
        <div className="-mt-2">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-900/30">
              <Lock className="h-10 w-10 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Location Access Blocked
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              To clock in, this site needs permission to read your location. You&apos;ve
              previously blocked it — here&apos;s how to turn it back on.
            </p>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                <StepIcon className="h-4 w-4" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {instructions.heading}
              </h3>
            </div>
            <ol className="space-y-2.5">
              {instructions.steps.map((step) => (
                <li key={step.n} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    {step.n}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">{step.text}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={onRequest}
              disabled={isAcquiring}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-900"
              style={{ minHeight: 52 }}
            >
              {isAcquiring ? (
                <>
                  <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
                  Checking…
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  I&rsquo;ve enabled it — try again
                </>
              )}
            </button>

            {canContinueWithoutGps && onContinueWithoutGps && (
              <button
                type="button"
                onClick={onContinueWithoutGps}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
                style={{ minHeight: 44 }}
              >
                Continue Without GPS
              </button>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  // --- PROMPT state — the "first-time" onboarding card --------------------
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={dismissible}>
      <div className="-mt-2 flex flex-col items-center text-center">
        <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30">
          <MapPin className="h-12 w-12 text-white" aria-hidden="true" />
          <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md dark:bg-gray-800">
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
          </span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Enable Location
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
          To accurately record your clock-ins and verify you&rsquo;re at the job site, we need
          access to your device&rsquo;s location.
        </p>

        <ul className="mt-5 w-full space-y-2.5 text-left">
          <li className="flex items-start gap-2.5 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
            <Shield
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
              Your location is only captured at clock-in and clock-out.
            </span>
          </li>
          <li className="flex items-start gap-2.5 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
            <MapPin
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
              It&rsquo;s used to verify job site presence — not to track you.
            </span>
          </li>
          <li className="flex items-start gap-2.5 rounded-xl bg-blue-50 px-3 py-2.5 dark:bg-blue-950/30">
            <Globe
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-blue-900 dark:text-blue-200">
              You&rsquo;ll see a browser prompt next — tap{' '}
              <span className="font-bold">Allow</span> to continue.
            </span>
          </li>
        </ul>

        <button
          type="button"
          onClick={onRequest}
          disabled={isAcquiring}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus:ring-blue-900"
          style={{ minHeight: 56 }}
        >
          {isAcquiring ? (
            <>
              <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />
              Requesting…
            </>
          ) : (
            <>
              <MapPin className="h-5 w-5" aria-hidden="true" />
              Allow Location Access
            </>
          )}
        </button>

        {canContinueWithoutGps && onContinueWithoutGps && (
          <button
            type="button"
            onClick={onContinueWithoutGps}
            className="mt-2 w-full rounded-xl px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus:ring-gray-700"
            style={{ minHeight: 44 }}
          >
            Not Now
          </button>
        )}

      </div>
    </Modal>
  );
}

export default GPSPermissionModal;
