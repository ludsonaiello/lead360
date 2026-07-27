'use client';

/**
 * PushNotificationBanner — Time Clock
 *
 * Non-intrusive prompt that asks the user to enable Web Push notifications for
 * shift reminders, missed-shift alerts, and dispute status updates.
 *
 * Behavior:
 *   - Silently no-ops on unsupported browsers (including iOS Safari web, which
 *     does not expose PushManager outside installed PWAs).
 *   - Silently no-ops when the VAPID public key env var is not set.
 *   - When permission is `default` and the user has not recently dismissed,
 *     renders an inline banner with "Enable" and "Maybe Later" actions.
 *   - When permission is `granted` and we have not yet saved the subscription
 *     (first-party flag in localStorage), registers the service worker,
 *     subscribes, and POSTs the subscription JSON to the backend.
 *   - All side effects wrapped in try/catch — a banner failure NEVER breaks
 *     the Clock page.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { savePushSubscription } from '@/lib/api/time-clock';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISS_STORAGE_KEY = 'kiosk_push_dismissed_at';
const SUBSCRIPTION_SAVED_KEY = 'push_subscription_saved';
const SERVICE_WORKER_URL = '/sw.js';
const SERVICE_WORKER_SCOPE = '/';
const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type PushPermission = NotificationPermission | 'unsupported' | 'no-key';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function isBrowserPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function readDismissedTimestamp(): number | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecentlyDismissed(): boolean {
  const ts = readDismissedTimestamp();
  if (ts == null) return false;
  return Date.now() - ts < DISMISS_WINDOW_MS;
}

function markDismissed(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    /* storage unavailable (private mode, etc.) — degrade silently */
  }
}

function clearDismissed(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(DISMISS_STORAGE_KEY);
  } catch {
    /* silent */
  }
}

function isSubscriptionSaved(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SUBSCRIPTION_SAVED_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSubscriptionSaved(): void {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SUBSCRIPTION_SAVED_KEY, 'true');
  } catch {
    /* silent */
  }
}

/** Convert a VAPID URL-base64 public key into the Uint8Array PushManager requires. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function ensureRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const existing = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_SCOPE);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: SERVICE_WORKER_SCOPE,
    });
  } catch (err) {
    console.warn('[PushNotificationBanner] Service worker registration failed', err);
    return null;
  }
}

async function subscribeAndPersist(vapidKey: string): Promise<void> {
  const registration = await ensureRegistration();
  if (!registration) return;

  // Reuse an existing subscription where possible to avoid churn.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    // applicationServerKey accepts a BufferSource; Uint8Array is one, but the
    // lib DOM type narrowing requires an explicit assertion here.
    const applicationServerKey = urlBase64ToUint8Array(vapidKey)
      .buffer as ArrayBuffer;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await savePushSubscription({
    push_subscription_json: JSON.stringify(subscription),
  });

  markSubscriptionSaved();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PushNotificationBanner() {
  const vapidKey = useMemo(
    () => process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
    [],
  );

  const [permission, setPermission] = useState<PushPermission>('default');
  const [bannerVisible, setBannerVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // --- Boot --------------------------------------------------------------
  // Detect support, sync permission state, kick off a background subscription
  // refresh when permission is already granted.
  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!isBrowserPushSupported()) {
        if (!cancelled) setPermission('unsupported');
        return;
      }
      if (!vapidKey) {
        if (!cancelled) setPermission('no-key');
        return;
      }

      const current = Notification.permission;
      if (!cancelled) setPermission(current);

      if (current === 'default') {
        if (!isRecentlyDismissed() && !cancelled) {
          setBannerVisible(true);
        }
        return;
      }

      if (current === 'granted' && !isSubscriptionSaved()) {
        try {
          await subscribeAndPersist(vapidKey);
        } catch (err) {
          console.warn('[PushNotificationBanner] Background subscribe failed', err);
        }
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [vapidKey]);

  // --- Handlers ----------------------------------------------------------

  const handleEnable = useCallback(async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        clearDismissed();
        setBannerVisible(false);
        try {
          await subscribeAndPersist(vapidKey);
          toast.success('Notifications enabled');
        } catch (err) {
          console.warn('[PushNotificationBanner] Subscribe failed', err);
          toast.error('Could not finish notification setup. We will retry later.');
        }
      } else if (result === 'denied') {
        setBannerVisible(false);
        markDismissed();
      } else {
        setBannerVisible(false);
      }
    } catch (err) {
      console.warn('[PushNotificationBanner] requestPermission failed', err);
      setBannerVisible(false);
    } finally {
      setEnabling(false);
    }
  }, [enabling, vapidKey]);

  const handleDismiss = useCallback(() => {
    markDismissed();
    setBannerVisible(false);
  }, []);

  // --- Render ------------------------------------------------------------

  if (
    permission === 'unsupported' ||
    permission === 'no-key' ||
    permission === 'denied' ||
    permission === 'granted' ||
    !bannerVisible
  ) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Enable notifications"
      className="mb-4 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm dark:border-blue-900/50 dark:from-blue-950/40 dark:to-indigo-950/30 sm:p-5"
    >
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm dark:bg-blue-500"
            aria-hidden="true"
          >
            <Bell className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Enable notifications
            </p>
            <p className="mt-0.5 text-sm leading-snug text-gray-700 dark:text-gray-300">
              Get shift reminders, missed-shift alerts, and dispute updates on this
              device.
            </p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-shrink-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={enabling}
            onClick={handleEnable}
            className="min-h-[44px] flex-1 sm:flex-none"
          >
            {enabling ? 'Enabling…' : 'Enable'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={enabling}
            className="min-h-[44px] flex-1 sm:flex-none"
          >
            Maybe Later
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PushNotificationBanner;
