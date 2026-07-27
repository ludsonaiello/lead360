/**
 * Time Clock Settings Page
 * Admin configuration for clock-in mode, GPS, geofence, overtime, pay period, kiosk
 * Roles: Owner, Admin (`timeclock:manage_settings`)
 */

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Clock,
  MapPin,
  TrendingUp,
  CalendarRange,
  Smartphone,
  Save,
  Loader2,
  Info,
  Copy,
  Check,
  RefreshCw,
  KeyRound,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { HoursInput } from '@/components/ui/HoursInput';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { EmployeeProfilesTab } from '@/components/time-clock/EmployeeProfilesTab';
import { ClockinAddressesTab } from '@/components/time-clock/ClockinAddressesTab';
import { LoadFailure } from '@/components/time-clock/LoadFailure';
import { useRBAC } from '@/contexts/RBACContext';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import {
  getTimeClockSettings,
  updateTimeClockSettings,
  regenerateKioskToken,
} from '@/lib/api/time-clock';
import type {
  TimeClockSettings,
  UpdateTimeClockSettingsRequest,
  ClockInMode,
  GeofenceViolationAction,
  GpsUnavailableAction,
  PayPeriodType,
} from '@/lib/types/time-clock';

// ---------------------------------------------------------------------------
// Defaults — used when GET returns id: null (no row yet) or null fields
// Mirrors Prisma defaults documented in api/documentation/time-clock_REST_API.md
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS: TimeClockSettings = {
  id: null,
  tenant_id: '',
  clock_in_mode: 'anywhere',
  geofence_violation_action: 'warn_only',
  gps_required: true,
  gps_unavailable_action: 'allow_flagged',
  require_job_tag: false,
  require_task_tag: false,
  overtime_enabled: true,
  overtime_daily_threshold_hours: '8.00',
  overtime_weekly_threshold_hours: '40.00',
  overtime_multiplier: '1.50',
  pay_period_type: 'biweekly',
  pay_period_start_day: null,
  pay_period_anchor_date: null,
  kiosk_mode_enabled: false,
  kiosk_token_hash: null,
  shift_reminder_minutes: 30,
  missed_shift_threshold_minutes: 30,
  native_app_features_enabled: false,
  created_at: '',
  updated_at: '',
};

// ---------------------------------------------------------------------------
// Select option lists
// ---------------------------------------------------------------------------
const CLOCK_IN_MODE_OPTIONS = [
  { value: 'anywhere', label: 'Anywhere' },
  { value: 'specific_addresses', label: 'Specific Addresses' },
  { value: 'active_job_sites', label: 'Active Job Sites' },
];

const GPS_UNAVAILABLE_OPTIONS = [
  { value: 'block', label: 'Block Clock-In' },
  { value: 'allow_flagged', label: 'Allow but Flag' },
];

const GEOFENCE_ACTION_OPTIONS = [
  { value: 'block', label: 'Block Clock-In' },
  { value: 'warn_only', label: 'Warn Only — Allow but Flag' },
];

const PAY_PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semi-monthly' },
  { value: 'monthly', label: 'Monthly' },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const toNum = (v: string | number | null | undefined, fallback: number): number => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

const isoToInputDate = (iso: string | null): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
};

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e?.message || fallback;
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
type TabId =
  | 'general'
  | 'geofence'
  | 'overtime'
  | 'payperiod'
  | 'kiosk'
  | 'addresses'
  | 'employees';

export default function TimeClockSettingsPage() {
  usePageTitle('Time Clock Settings');
  const router = useRouter();
  const { canPerform, loading: rbacLoading } = useRBAC();

  const canManage = canPerform('timeclock', 'manage_settings');

  const [settings, setSettings] = useState<TimeClockSettings>(DEFAULT_SETTINGS);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  // Kiosk token regeneration flow
  const [confirmRegenOpen, setConfirmRegenOpen] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // ---------------------------------------------------------------------
  // RBAC redirect — wait until RBAC finished loading
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!rbacLoading && !canManage) {
      router.replace('/forbidden');
    }
  }, [rbacLoading, canManage, router]);

  // ---------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------
  const loadSettings = useCallback(
    async (isCancelled?: () => boolean) => {
      try {
        setLoading(true);
        setLoadError(null);
        const data = await getTimeClockSettings();
        if (isCancelled?.()) return;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
        });
        setLoadedOnce(true);
      } catch (err) {
        if (isCancelled?.()) return;
        const message = extractErrorMessage(err, 'Failed to load settings');
        setLoadError(message);
        toast.error(message);
      } finally {
        if (!isCancelled?.()) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (rbacLoading || !canManage) return;
    let cancelled = false;
    void loadSettings(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [rbacLoading, canManage, loadSettings]);

  // ---------------------------------------------------------------------
  // Save — accepts the section payload, refreshes from response
  // ---------------------------------------------------------------------
  const handleSaveSection = async (payload: UpdateTimeClockSettingsRequest) => {
    try {
      setSaving(true);
      const updated = await updateTimeClockSettings(payload);
      setSettings({ ...DEFAULT_SETTINGS, ...updated });
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------
  // Kiosk token regeneration
  // ---------------------------------------------------------------------
  const handleRegenerateConfirmed = async () => {
    try {
      setRegenLoading(true);
      const res = await regenerateKioskToken();
      setRevealedToken(res.kiosk_token);
      // Refresh settings to update kiosk_token_hash
      const refreshed = await getTimeClockSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...refreshed });
      setConfirmRegenOpen(false);
      toast.success('New kiosk token generated');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to generate kiosk token'));
    } finally {
      setRegenLoading(false);
    }
  };

  const closeRevealedToken = () => {
    setRevealedToken(null);
    setTokenCopied(false);
    setUrlCopied(false);
  };

  const copyToClipboard = async (
    text: string,
    setFlag: (v: boolean) => void,
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setFlag(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setFlag(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  // ---------------------------------------------------------------------
  // Tab definitions
  // ---------------------------------------------------------------------
  const tabs = useMemo(
    () => [
      { id: 'general', label: 'General', icon: Clock },
      { id: 'geofence', label: 'Geofence', icon: MapPin },
      { id: 'overtime', label: 'Overtime', icon: TrendingUp },
      { id: 'payperiod', label: 'Pay Period', icon: CalendarRange },
      { id: 'kiosk', label: 'Kiosk', icon: Smartphone },
      { id: 'addresses', label: 'Addresses', icon: MapPin },
      { id: 'employees', label: 'Employees', icon: Users },
    ],
    [],
  );

  // ---------------------------------------------------------------------
  // Loading & access guard
  // ---------------------------------------------------------------------
  if (rbacLoading || (loading && canManage && !loadError && !loadedOnce)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canManage) {
    // useEffect has triggered redirect — render nothing while it happens
    return null;
  }

  if (loadError && !loadedOnce) {
    return (
      <div className="min-h-[60vh] max-w-2xl mx-auto px-4 py-12 sm:px-6">
        <Breadcrumb
          items={[
            { label: 'Settings', href: '/settings/business' },
            { label: 'Time Clock' },
          ]}
        />
        <LoadFailure
          title="Could not load time-clock settings"
          message={loadError}
          onRetry={() => void loadSettings()}
          retrying={loading}
          className="mt-8"
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Settings', href: '/settings/business' },
            { label: 'Time Clock' },
          ]}
        />

        {/* Header */}
        <div className="mt-4 mb-6 flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Time Clock Settings
            </h1>
            <p className="mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Configure clock-in rules, geofence enforcement, overtime, pay periods, and kiosk access.
            </p>
          </div>
        </div>

        {/* Card with tabs */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          <div className="px-3 sm:px-6 pt-2">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as TabId)}
            />
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'general' && (
              <GeneralTab
                settings={settings}
                saving={saving}
                onSave={handleSaveSection}
              />
            )}

            {activeTab === 'geofence' && (
              <GeofenceTab
                settings={settings}
                saving={saving}
                onSave={handleSaveSection}
              />
            )}

            {activeTab === 'overtime' && (
              <OvertimeTab
                settings={settings}
                saving={saving}
                onSave={handleSaveSection}
              />
            )}

            {activeTab === 'payperiod' && (
              <PayPeriodTab
                settings={settings}
                saving={saving}
                onSave={handleSaveSection}
              />
            )}

            {activeTab === 'kiosk' && (
              <KioskTab
                settings={settings}
                saving={saving}
                onSave={handleSaveSection}
                onRegenerate={() => setConfirmRegenOpen(true)}
              />
            )}

            {activeTab === 'addresses' && <ClockinAddressesTab />}

            {activeTab === 'employees' && <EmployeeProfilesTab />}
          </div>
        </div>
      </div>

      {/* Confirm regeneration */}
      <ConfirmModal
        isOpen={confirmRegenOpen}
        onClose={() => setConfirmRegenOpen(false)}
        onConfirm={handleRegenerateConfirmed}
        title="Regenerate kiosk token?"
        message="This will invalidate the current kiosk token. Any active kiosk devices will need to be reconfigured with the new token. Continue?"
        confirmText="Regenerate Token"
        cancelText="Cancel"
        variant="danger"
        loading={regenLoading}
      />

      {/* Reveal generated token (one-time) */}
      <Modal
        isOpen={!!revealedToken}
        onClose={closeRevealedToken}
        title={
          <span className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-green-600 dark:text-green-400" />
            New Kiosk Token
          </span>
        }
        size="xl"
      >
        {revealedToken && (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertDescription>
                Save this token now. It will <strong>not</strong> be shown again after closing this dialog.
              </AlertDescription>
            </Alert>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Kiosk Token
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 px-3 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-all min-h-[48px]">
                  {revealedToken}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyToClipboard(revealedToken, setTokenCopied)}
                  className="sm:w-auto w-full"
                >
                  {tokenCopied ? (
                    <>
                      <Check className="w-4 h-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Kiosk URL
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 px-3 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-xs sm:text-sm text-gray-900 dark:text-gray-100 break-all min-h-[48px]">
                  {`https://app.lead360.app/kiosk?token=${revealedToken}`}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    copyToClipboard(
                      `https://app.lead360.app/kiosk?token=${revealedToken}`,
                      setUrlCopied,
                    )
                  }
                  className="sm:w-auto w-full"
                >
                  {urlCopied ? (
                    <>
                      <Check className="w-4 h-4" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copy
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={closeRevealedToken}>I&apos;ve saved the token</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===========================================================================
// Section save button — shared
// ===========================================================================
function SectionFooter({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
      <Button onClick={onSave} disabled={saving} className="w-full sm:w-auto">
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        )}
      </Button>
    </div>
  );
}

// ===========================================================================
// General Tab
// ===========================================================================
interface TabProps {
  settings: TimeClockSettings;
  saving: boolean;
  onSave: (payload: UpdateTimeClockSettingsRequest) => Promise<void>;
}

function GeneralTab({ settings, saving, onSave }: TabProps) {
  const [clockInMode, setClockInMode] = useState<ClockInMode>(settings.clock_in_mode);
  const [gpsRequired, setGpsRequired] = useState(settings.gps_required);
  const [gpsUnavailableAction, setGpsUnavailableAction] = useState<GpsUnavailableAction>(
    settings.gps_unavailable_action,
  );
  const [requireJobTag, setRequireJobTag] = useState(settings.require_job_tag);
  const [requireTaskTag, setRequireTaskTag] = useState(settings.require_task_tag);

  // Sync from parent when settings reload
  useEffect(() => {
    setClockInMode(settings.clock_in_mode);
    setGpsRequired(settings.gps_required);
    setGpsUnavailableAction(settings.gps_unavailable_action);
    setRequireJobTag(settings.require_job_tag);
    setRequireTaskTag(settings.require_task_tag);
  }, [settings]);

  const handleSave = () => {
    void onSave({
      clock_in_mode: clockInMode,
      gps_required: gpsRequired,
      gps_unavailable_action: gpsUnavailableAction,
      require_job_tag: requireJobTag,
      require_task_tag: requireTaskTag && requireJobTag, // task tag only meaningful with job tag
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">General</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Control where employees can clock in and what data is required.
        </p>
      </div>

      <Select
        label="Clock-In Mode"
        required
        value={clockInMode}
        onChange={(v) => setClockInMode(v as ClockInMode)}
        options={CLOCK_IN_MODE_OPTIONS}
        helperText="Where employees are allowed to clock in from."
      />

      {clockInMode === 'anywhere' && (
        <Alert variant="default">
          <AlertDescription>
            Geofence enforcement is disabled in <strong>Anywhere</strong> mode. Employees can clock in from any location.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
        <ToggleSwitch
          enabled={gpsRequired}
          onChange={setGpsRequired}
          label="GPS Required"
          description="Require device GPS coordinates when clocking in."
        />
      </div>

      {!gpsRequired && (
        <Alert variant="warning">
          <AlertDescription>
            GPS is disabled. Geofence enforcement will not work regardless of clock-in mode.
          </AlertDescription>
        </Alert>
      )}

      <Select
        label="GPS Unavailable Action"
        required={gpsRequired}
        disabled={!gpsRequired}
        value={gpsUnavailableAction}
        onChange={(v) => setGpsUnavailableAction(v as GpsUnavailableAction)}
        options={GPS_UNAVAILABLE_OPTIONS}
        helperText="What happens when an employee's device cannot provide GPS coordinates."
      />

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40 space-y-4">
        <ToggleSwitch
          enabled={requireJobTag}
          onChange={setRequireJobTag}
          label="Require Project Tag"
          description="Employees must select a project when clocking in."
        />
        <ToggleSwitch
          enabled={requireTaskTag}
          onChange={setRequireTaskTag}
          label="Require Task Tag"
          description="Employees must also select a task when clocking in."
          disabled={!requireJobTag}
        />
        {requireJobTag && requireTaskTag && (
          <p className="text-xs text-gray-600 dark:text-gray-400 pl-14">
            Task tag is only enforced when project tag is required.
          </p>
        )}
      </div>

      <SectionFooter saving={saving} onSave={handleSave} />
    </div>
  );
}

// ===========================================================================
// Geofence Tab
// ===========================================================================
function GeofenceTab({ settings, saving, onSave }: TabProps) {
  const [violationAction, setViolationAction] = useState<GeofenceViolationAction>(
    settings.geofence_violation_action,
  );

  useEffect(() => {
    setViolationAction(settings.geofence_violation_action);
  }, [settings]);

  const isAnywhere = settings.clock_in_mode === 'anywhere';

  const handleSave = () => {
    void onSave({ geofence_violation_action: violationAction });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Geofence</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Define what happens when an employee tries to clock in outside the allowed area.
        </p>
      </div>

      {isAnywhere && (
        <Alert variant="default">
          <AlertDescription>
            Geofence settings are only applicable when Clock-In Mode is set to{' '}
            <strong>Specific Addresses</strong> or <strong>Active Job Sites</strong>. Switch the mode in the
            General tab to enforce geofencing.
          </AlertDescription>
        </Alert>
      )}

      <Select
        label="Geofence Violation Action"
        required
        disabled={isAnywhere}
        value={violationAction}
        onChange={(v) => setViolationAction(v as GeofenceViolationAction)}
        options={GEOFENCE_ACTION_OPTIONS}
      />

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Block</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Employees outside all configured addresses will be prevented from clocking in. An admin notification will be sent.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Warn Only</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Employees outside configured addresses can still clock in, but their session will be flagged for review. An admin notification will be sent.
          </p>
        </div>
      </div>

      <Alert variant="default">
        <AlertDescription>
          Clock-In Addresses are managed in a dedicated page (delivered in a future sprint). Geofence enforcement uses the addresses configured there.
        </AlertDescription>
      </Alert>

      <SectionFooter saving={saving} onSave={handleSave} />
    </div>
  );
}

// ===========================================================================
// Overtime Tab
// ===========================================================================
function OvertimeTab({ settings, saving, onSave }: TabProps) {
  const [enabled, setEnabled] = useState(settings.overtime_enabled);
  const [daily, setDaily] = useState(toNum(settings.overtime_daily_threshold_hours, 8));
  const [weekly, setWeekly] = useState(toNum(settings.overtime_weekly_threshold_hours, 40));
  const [multiplier, setMultiplier] = useState(toNum(settings.overtime_multiplier, 1.5));
  const [errors, setErrors] = useState<{ daily?: string; weekly?: string; multiplier?: string }>({});

  useEffect(() => {
    setEnabled(settings.overtime_enabled);
    setDaily(toNum(settings.overtime_daily_threshold_hours, 8));
    setWeekly(toNum(settings.overtime_weekly_threshold_hours, 40));
    setMultiplier(toNum(settings.overtime_multiplier, 1.5));
    setErrors({});
  }, [settings]);

  const validate = (): boolean => {
    const e: { daily?: string; weekly?: string; multiplier?: string } = {};
    if (enabled) {
      if (daily < 0 || daily > 24) e.daily = 'Must be between 0 and 24 hours';
      if (weekly < 0 || weekly > 168) e.weekly = 'Must be between 0 and 168 hours';
      if (multiplier < 1 || multiplier > 5) e.multiplier = 'Must be between 1.00 and 5.00';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload: UpdateTimeClockSettingsRequest = { overtime_enabled: enabled };
    if (enabled) {
      payload.overtime_daily_threshold_hours = daily;
      payload.overtime_weekly_threshold_hours = weekly;
      payload.overtime_multiplier = Math.round(multiplier * 100) / 100;
    }
    void onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Overtime</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Set the thresholds and multiplier used to calculate overtime hours.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
        <ToggleSwitch
          enabled={enabled}
          onChange={setEnabled}
          label="Overtime Enabled"
          description="Track overtime hours according to the thresholds below."
        />
      </div>

      {!enabled && (
        <Alert variant="default">
          <AlertDescription>
            Overtime tracking is disabled. All hours will be recorded as regular hours.
          </AlertDescription>
        </Alert>
      )}

      <div className={!enabled ? 'opacity-50 pointer-events-none space-y-6' : 'space-y-6'}>
        <HoursInput
          label="Daily Threshold"
          value={daily}
          onChange={setDaily}
          required={enabled}
          error={errors.daily}
          helperText="Hours per day before overtime kicks in."
        />

        <HoursInput
          label="Weekly Threshold"
          value={weekly}
          onChange={setWeekly}
          required={enabled}
          error={errors.weekly}
          helperText="Hours per week before overtime kicks in."
        />

        <Input
          label="Overtime Multiplier"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={1}
          max={5}
          required={enabled}
          value={Number.isFinite(multiplier) ? multiplier : ''}
          onChange={(e) => setMultiplier(parseFloat(e.target.value))}
          rightIcon={<span className="text-sm font-medium">x</span>}
          error={errors.multiplier}
          helperText="Multiplier applied to overtime hours for payroll (e.g. 1.50)."
        />
      </div>

      <SectionFooter saving={saving} onSave={handleSave} />
    </div>
  );
}

// ===========================================================================
// Pay Period Tab
// ===========================================================================
function PayPeriodTab({ settings, saving, onSave }: TabProps) {
  const [type, setType] = useState<PayPeriodType>(settings.pay_period_type);
  const [startDay, setStartDay] = useState<number | null>(settings.pay_period_start_day);
  const [anchorDate, setAnchorDate] = useState<string>(isoToInputDate(settings.pay_period_anchor_date));
  const [errors, setErrors] = useState<{ startDay?: string; anchorDate?: string }>({});

  useEffect(() => {
    setType(settings.pay_period_type);
    setStartDay(settings.pay_period_start_day);
    setAnchorDate(isoToInputDate(settings.pay_period_anchor_date));
    setErrors({});
  }, [settings]);

  const showStartDay = type === 'weekly' || type === 'biweekly';
  const showAnchor = type === 'biweekly';

  const validate = (): boolean => {
    const e: { startDay?: string; anchorDate?: string } = {};
    if (showStartDay && (startDay === null || startDay === undefined)) {
      e.startDay = 'Required';
    }
    if (showAnchor && !anchorDate) {
      e.anchorDate = 'Required for biweekly';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const payload: UpdateTimeClockSettingsRequest = { pay_period_type: type };
    if (showStartDay && startDay !== null) payload.pay_period_start_day = startDay;
    if (showAnchor && anchorDate) payload.pay_period_anchor_date = anchorDate;
    void onSave(payload);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Pay Period</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure how pay periods are calculated for payroll reports.
        </p>
      </div>

      <Select
        label="Pay Period Type"
        required
        value={type}
        onChange={(v) => setType(v as PayPeriodType)}
        options={PAY_PERIOD_OPTIONS}
      />

      {showStartDay && (
        <Select
          label="Start Day of Week"
          required
          value={startDay !== null ? String(startDay) : ''}
          onChange={(v) => setStartDay(v === '' ? null : Number(v))}
          options={DAY_OF_WEEK_OPTIONS}
          error={errors.startDay}
          helperText="Which day starts the work week?"
        />
      )}

      {showAnchor && (
        <DatePicker
          label="Anchor Date"
          required
          value={anchorDate}
          onChange={(e) => setAnchorDate(e.target.value)}
          error={errors.anchorDate}
          helperText="Reference date for biweekly period calculation. Pick any date that starts a pay period."
        />
      )}

      {(type === 'semimonthly' || type === 'monthly') && (
        <Alert variant="default">
          <AlertDescription>
            {type === 'semimonthly'
              ? 'Semi-monthly periods are automatically calculated: 1st–15th and 16th–end of month.'
              : 'Monthly periods are automatically calculated: 1st–end of month.'}
          </AlertDescription>
        </Alert>
      )}

      <SectionFooter saving={saving} onSave={handleSave} />
    </div>
  );
}

// ===========================================================================
// Kiosk Tab
// ===========================================================================
function KioskTab({
  settings,
  saving,
  onSave,
  onRegenerate,
}: TabProps & { onRegenerate: () => void }) {
  const [enabled, setEnabled] = useState(settings.kiosk_mode_enabled);
  const [shiftReminder, setShiftReminder] = useState(settings.shift_reminder_minutes);
  const [missedShift, setMissedShift] = useState(settings.missed_shift_threshold_minutes);
  const [errors, setErrors] = useState<{ shiftReminder?: string; missedShift?: string }>({});

  useEffect(() => {
    setEnabled(settings.kiosk_mode_enabled);
    setShiftReminder(settings.shift_reminder_minutes);
    setMissedShift(settings.missed_shift_threshold_minutes);
    setErrors({});
  }, [settings]);

  const hasToken = !!settings.kiosk_token_hash;

  const validate = (): boolean => {
    const e: { shiftReminder?: string; missedShift?: string } = {};
    if (shiftReminder < 5 || shiftReminder > 120) {
      e.shiftReminder = 'Must be between 5 and 120 minutes';
    }
    if (missedShift < 5 || missedShift > 120) {
      e.missedShift = 'Must be between 5 and 120 minutes';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    void onSave({
      kiosk_mode_enabled: enabled,
      shift_reminder_minutes: shiftReminder,
      missed_shift_threshold_minutes: missedShift,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Kiosk & Shift Notifications</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage shared-device kiosk access and shift notification timing.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
        <ToggleSwitch
          enabled={enabled}
          onChange={setEnabled}
          label="Kiosk Mode Enabled"
          description="Allow PIN-based clock-in from a shared device."
        />
      </div>

      {/* Token section */}
      <div
        className={`rounded-lg border border-gray-200 dark:border-gray-700 p-4 sm:p-5 ${
          enabled ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900/40 opacity-60'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
            <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kiosk Token</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {hasToken
                ? 'A kiosk token is configured. The plaintext is only shown once at generation time.'
                : 'No kiosk token has been generated yet.'}
            </p>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 px-3 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-mono text-sm text-gray-900 dark:text-gray-100 min-h-[48px] flex items-center">
                {hasToken ? '•••••••••••••••• Token configured' : 'Not generated'}
              </div>
              <Button
                type="button"
                variant={hasToken ? 'secondary' : 'primary'}
                onClick={onRegenerate}
                disabled={!enabled}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4" />
                {hasToken ? 'Regenerate' : 'Generate Token'}
              </Button>
            </div>

            {!enabled && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Enable Kiosk Mode to generate or regenerate a token.
              </p>
            )}

            {hasToken && enabled && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                Open the kiosk at <span className="font-mono">/kiosk?token=…</span> on your shared device.
                Regenerate above to reveal a fresh token and URL.
              </p>
            )}
          </div>
        </div>
      </div>

      {!enabled && (
        <Alert variant="default">
          <AlertDescription>
            Kiosk mode is disabled. Enable it to allow PIN-based clock-in from shared devices.
          </AlertDescription>
        </Alert>
      )}

      {/* Shift settings */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Shift Notifications</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Timing for shift reminder and missed-shift detection.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Shift Reminder (minutes)"
            type="number"
            inputMode="numeric"
            min={5}
            max={120}
            value={Number.isFinite(shiftReminder) ? shiftReminder : ''}
            onChange={(e) => setShiftReminder(parseInt(e.target.value, 10))}
            error={errors.shiftReminder}
            helperText="Minutes before shift start to send a reminder."
          />
          <Input
            label="Missed Shift Threshold (minutes)"
            type="number"
            inputMode="numeric"
            min={5}
            max={120}
            value={Number.isFinite(missedShift) ? missedShift : ''}
            onChange={(e) => setMissedShift(parseInt(e.target.value, 10))}
            error={errors.missedShift}
            helperText="Minutes after shift start before marking as missed."
          />
        </div>
      </div>

      <SectionFooter saving={saving} onSave={handleSave} />
    </div>
  );
}

