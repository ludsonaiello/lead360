/**
 * Employee Profiles Tab
 * Full CRUD + PIN management for time-clock employee profiles.
 * Roles: Owner, Admin.
 *
 * Live API contract notes (verified 2026-04-14):
 * - GET /time-clock/employees returns `{data, meta}` with `meta.totalPages`
 * - `hourly_rate` / overtime threshold columns are Prisma Decimal strings (may be `null`)
 * - Every profile response carries backend-computed `has_pin` and `is_locked`
 *   booleans; `kiosk_pin_hash` is stripped. Use those directly — do not
 *   derive PIN state from any other field.
 */

'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  Plus,
  Search,
  Pencil,
  KeyRound,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Info,
  Loader2,
  CircleDollarSign,
  Link2,
  UserCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { HoursInput } from '@/components/ui/HoursInput';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  listEmployeeProfiles,
  createEmployeeProfile,
  updateEmployeeProfile,
  setEmployeePin,
  removeEmployeePin,
} from '@/lib/api/time-clock';
import { listUsers } from '@/lib/api/users';
import { getCrewMembers } from '@/lib/api/crew';
import type {
  EmployeeProfile,
  CreateEmployeeProfileRequest,
  UpdateEmployeeProfileRequest,
} from '@/lib/types/time-clock';
import type { MembershipItem } from '@/lib/types/users';
import type { CrewMember } from '@/lib/types/crew';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as {
    response?: { status?: number; data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e?.message || fallback;
};

const parseDecimal = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const formatMoney = (v: number | null): string =>
  v === null
    ? '—'
    : `$${v.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/hr`;

const fullName = (first?: string | null, last?: string | null): string =>
  `${first || ''} ${last || ''}`.trim() || 'Unnamed';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
// Threshold validation: backend accepts null OR 0..24 / 0..168 even when the
// override flag is on. Null thresholds mean "fall back to tenant default",
// so the frontend must NOT require them just because the override flag is on.
const createEmployeeSchema = z.object({
  user_id: z.string().uuid('Please select a user'),
  crew_member_id: z.string().optional().nullable(),
  hourly_rate: z.number().min(0, 'Rate must be at least 0').nullable().optional(),
  overtime_rule_override: z.boolean(),
  overtime_daily_threshold_hours: z
    .number()
    .min(0, 'Must be at least 0')
    .max(24, 'Must be 24 or less')
    .nullable()
    .optional(),
  overtime_weekly_threshold_hours: z
    .number()
    .min(0, 'Must be at least 0')
    .max(168, 'Must be 168 or less')
    .nullable()
    .optional(),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

const updateEmployeeSchema = z.object({
  crew_member_id: z.string().optional().nullable(),
  hourly_rate: z.number().min(0, 'Rate must be at least 0').nullable().optional(),
  overtime_rule_override: z.boolean(),
  overtime_daily_threshold_hours: z
    .number()
    .min(0, 'Must be at least 0')
    .max(24, 'Must be 24 or less')
    .nullable()
    .optional(),
  overtime_weekly_threshold_hours: z
    .number()
    .min(0, 'Must be at least 0')
    .max(168, 'Must be 168 or less')
    .nullable()
    .optional(),
  is_active: z.boolean(),
});

type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>;

const pinSchema = z
  .object({
    pin: z
      .string()
      .min(4, 'PIN must be 4–6 digits')
      .max(6, 'PIN must be 4–6 digits')
      .regex(/^\d+$/, 'PIN must contain only digits'),
    confirmPin: z.string(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: 'PINs do not match',
    path: ['confirmPin'],
  });

type PinFormData = z.infer<typeof pinSchema>;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function EmployeeProfilesTab() {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 350);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [pinTarget, setPinTarget] = useState<EmployeeProfile | null>(null);
  const [removePinTarget, setRemovePinTarget] = useState<EmployeeProfile | null>(null);
  const [removingPin, setRemovingPin] = useState(false);
  // Synchronous gate for the destructive-confirm modal: ConfirmModal's
  // handleConfirm calls onConfirm() then immediately onClose() and reads the
  // `loading` prop too early to see our setState. A ref catches the in-flight
  // state synchronously so the modal doesn't dismiss while the request runs.
  const removingPinRef = useRef(false);

  // Set of ALL user_ids that already have a profile — used by the Create
  // modal to filter the user dropdown. Must NOT be derived from the current
  // page, which would leak users from other pages into the dropdown.
  const [assignedUserIds, setAssignedUserIds] = useState<Set<string>>(new Set());

  const refreshAssignedUserIds = useCallback(async () => {
    try {
      const ids = new Set<string>();
      // Walk every page once so the filter is correct regardless of how many
      // employee profiles the tenant has.
      let nextPage = 1;
      let lastPage = 1;
      do {
        const res = await listEmployeeProfiles({ page: nextPage, limit: 100 });
        res.data.forEach((e) => ids.add(e.user_id));
        lastPage = res.meta.totalPages || 1;
        nextPage += 1;
      } while (nextPage <= lastPage);
      setAssignedUserIds(ids);
    } catch {
      // Soft-fail: the backend 409 will still catch a duplicate. No toast to
      // avoid doubling up with the list-load error.
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listEmployeeProfiles({
        page,
        limit: PAGE_SIZE,
        ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      });
      setEmployees(res.data);
      setTotalPages(res.meta.totalPages || 1);
      setTotal(res.meta.total || 0);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to load employee profiles'));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void refreshAssignedUserIds();
  }, [refreshAssignedUserIds]);

  // Reset page when the user starts typing a new search. Doing this in the
  // input handler (rather than a useEffect on debouncedSearch) avoids the
  // two-render race that would otherwise fire one stale-page fetch and one
  // correct-page fetch back to back.
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (page !== 1) setPage(1);
  };

  const handleRemovePinConfirmed = async () => {
    if (!removePinTarget || removingPinRef.current) return;
    removingPinRef.current = true;
    setRemovingPin(true);
    try {
      await removeEmployeePin(removePinTarget.id);
      toast.success('Kiosk PIN removed');
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to remove PIN'));
    } finally {
      removingPinRef.current = false;
      setRemovingPin(false);
      setRemovePinTarget(null);
      void load();
    }
  };

  // -------------------------------------------------------------------------
  // Render — initial skeleton
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Employee Profiles</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Bridge user accounts to time-clock records. Set hourly rates, overtime rules, and kiosk PINs.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="w-full sm:w-auto min-h-[48px]"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </Button>
      </div>

      {/* Search */}
      <Input
        id="employee-profiles-search"
        label="Search"
        placeholder="Search by name or email"
        value={searchText}
        onChange={handleSearchChange}
        leftIcon={<Search className="w-5 h-5" />}
      />

      {/* Body */}
      {loading ? (
        <LoadingGrid />
      ) : employees.length === 0 ? (
        <EmptyState onAdd={() => setCreateOpen(true)} searchActive={!!debouncedSearch.trim()} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <Th>Employee</Th>
                  <Th>Crew Link</Th>
                  <Th>Rate</Th>
                  <Th>Kiosk PIN</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {employees.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    profile={emp}
                    onEdit={() => setEditing(emp)}
                    onSetPin={() => setPinTarget(emp)}
                    onRemovePin={() => setRemovePinTarget(emp)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {employees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                profile={emp}
                onEdit={() => setEditing(emp)}
                onSetPin={() => setPinTarget(emp)}
                onRemovePin={() => setRemovePinTarget(emp)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-2">
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onGoToPage={(p) => setPage(p)}
              />
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {total} {total === 1 ? 'employee profile' : 'employee profiles'}
          </p>
        </>
      )}

      {/* Create modal */}
      {createOpen && (
        <CreateEmployeeModal
          isOpen={createOpen}
          existingUserIds={assignedUserIds}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void load();
            void refreshAssignedUserIds();
          }}
        />
      )}

      {/* Edit modal — keyed on profile id so rapid row-to-row clicks force a
          fresh form instance instead of reusing stale RHF state */}
      {editing && (
        <EditEmployeeModal
          key={editing.id}
          isOpen={!!editing}
          profile={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => {
            setEditing(null);
            void load();
          }}
        />
      )}

      {/* Set / change PIN modal */}
      {pinTarget && (
        <SetPinModal
          key={pinTarget.id}
          isOpen={!!pinTarget}
          profile={pinTarget}
          onClose={() => setPinTarget(null)}
          onSaved={() => {
            setPinTarget(null);
            void load();
          }}
        />
      )}

      {/* Remove PIN confirmation */}
      <ConfirmModal
        isOpen={!!removePinTarget}
        onClose={() => {
          if (removingPinRef.current) return;
          setRemovePinTarget(null);
        }}
        onConfirm={handleRemovePinConfirmed}
        title="Remove Kiosk PIN"
        message={
          removePinTarget
            ? `Remove the kiosk PIN for ${fullName(
                removePinTarget.user?.first_name,
                removePinTarget.user?.last_name,
              )}? They will no longer be able to use the kiosk to clock in until a new PIN is set.`
            : 'Remove the kiosk PIN?'
        }
        confirmText="Remove PIN"
        cancelText="Cancel"
        variant="danger"
        loading={removingPin}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row
// ---------------------------------------------------------------------------
function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400 ${className}`}
    >
      {children}
    </th>
  );
}

interface RowProps {
  profile: EmployeeProfile;
  onEdit: () => void;
  onSetPin: () => void;
  onRemovePin: () => void;
}

function EmployeeRow({ profile, onEdit, onSetPin, onRemovePin }: RowProps) {
  const name = fullName(profile.user?.first_name, profile.user?.last_name);
  const email = profile.user?.email ?? '—';
  const rate = parseDecimal(profile.hourly_rate);

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 dark:text-white truncate">{name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        {profile.crew_member_id ? (
          <Badge variant="success" icon={Link2}>
            {profile.crew_member
              ? fullName(profile.crew_member.first_name, profile.crew_member.last_name)
              : 'Linked'}
          </Badge>
        ) : (
          <Badge variant="neutral">Not Linked</Badge>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
        {formatMoney(rate)}
      </td>
      <td className="px-4 py-3">
        <PinBadge profile={profile} />
      </td>
      <td className="px-4 py-3">
        {profile.is_active ? (
          <Badge variant="success" icon={ShieldCheck}>
            Active
          </Badge>
        ) : (
          <Badge variant="neutral" icon={ShieldAlert}>
            Inactive
          </Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <IconButton onClick={onEdit} label="Edit employee">
            <Pencil className="w-4 h-4" />
          </IconButton>
          <IconButton
            onClick={onSetPin}
            label={profile.has_pin ? 'Change PIN' : 'Set PIN'}
            tone="primary"
          >
            <KeyRound className="w-4 h-4" />
          </IconButton>
          {profile.has_pin && (
            <IconButton onClick={onRemovePin} label="Remove PIN" tone="danger">
              <Trash2 className="w-4 h-4" />
            </IconButton>
          )}
        </div>
      </td>
    </tr>
  );
}

function PinBadge({ profile }: { profile: EmployeeProfile }) {
  if (profile.is_locked) {
    return (
      <Badge variant="danger" icon={Lock}>
        Locked
      </Badge>
    );
  }
  if (profile.has_pin) {
    return (
      <Badge variant="success" icon={KeyRound}>
        PIN Set
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" icon={KeyRound}>
      No PIN
    </Badge>
  );
}

function EmployeeCard({ profile, onEdit, onSetPin, onRemovePin }: RowProps) {
  const name = fullName(profile.user?.first_name, profile.user?.last_name);
  const email = profile.user?.email ?? '—';
  const rate = parseDecimal(profile.hourly_rate);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
          <UserCircle className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white truncate">{name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{email}</div>
            </div>
            {profile.is_active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="neutral">Inactive</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <Link2 className="w-3.5 h-3.5" />
          {profile.crew_member_id ? 'Linked to crew' : 'Not linked'}
        </div>
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
          <CircleDollarSign className="w-3.5 h-3.5" />
          {formatMoney(rate)}
        </div>
        <div className="flex items-center gap-1.5 col-span-2">
          <PinBadge profile={profile} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          onClick={onEdit}
          className="flex-1 min-w-[44%] min-h-[48px]"
        >
          <Pencil className="w-4 h-4" />
          Edit
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSetPin}
          className="flex-1 min-w-[44%] min-h-[48px]"
        >
          <KeyRound className="w-4 h-4" />
          {profile.has_pin ? 'Change PIN' : 'Set PIN'}
        </Button>
        {profile.has_pin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemovePin}
            className="flex-1 min-w-[44%] min-h-[48px] text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
            Remove PIN
          </Button>
        )}
      </div>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  tone?: 'neutral' | 'primary' | 'danger';
}) {
  const toneClasses = {
    neutral:
      'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800',
    primary:
      'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30',
    danger:
      'text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`
        inline-flex items-center justify-center w-12 h-12 rounded-lg
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
        transition-colors
        ${toneClasses[tone]}
      `}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
function LoadingGrid() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton variant="circular" width={44} height={44} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="40%" height={16} />
              <Skeleton variant="text" width="60%" height={12} />
            </div>
            <Skeleton variant="rectangular" width={80} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onAdd, searchActive }: { onAdd: () => void; searchActive: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
        <Users className="w-7 h-7" />
      </div>
      <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">
        {searchActive ? 'No matches' : 'No Employee Profiles'}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-sm">
        {searchActive
          ? 'No employees match your search. Try a different name or email.'
          : 'Create employee profiles to enable time tracking, payroll, and kiosk clock-in for your team.'}
      </p>
      {!searchActive && (
        <Button onClick={onAdd} className="mt-6">
          <Plus className="w-4 h-4" />
          Add Employee Profile
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create modal
// ---------------------------------------------------------------------------
interface CreateModalProps {
  isOpen: boolean;
  existingUserIds: Set<string>;
  onClose: () => void;
  onCreated: () => void;
}

function CreateEmployeeModal({
  isOpen,
  existingUserIds,
  onClose,
  onCreated,
}: CreateModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [usersLoading, setUsersLoading] = useState(true);
  const [crewLoading, setCrewLoading] = useState(true);
  const [users, setUsers] = useState<MembershipItem[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateEmployeeFormData>({
    resolver: zodResolver(createEmployeeSchema),
    mode: 'onBlur',
    defaultValues: {
      user_id: '',
      crew_member_id: null,
      hourly_rate: null,
      overtime_rule_override: false,
      overtime_daily_threshold_hours: null,
      overtime_weekly_threshold_hours: null,
    },
  });

  const overtimeOverride = watch('overtime_rule_override');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setUsersLoading(true);
        const res = await listUsers({ page: 1, limit: 100, status: 'ACTIVE' });
        if (cancelled) return;
        setUsers(res.data);
      } catch (err) {
        if (cancelled) return;
        setLookupError(extractErrorMessage(err, 'Failed to load users'));
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();

    (async () => {
      try {
        setCrewLoading(true);
        const res = await getCrewMembers({ page: 1, limit: 100, is_active: true });
        if (cancelled) return;
        setCrew(res.data);
      } catch (err) {
        if (cancelled) return;
        setLookupError(extractErrorMessage(err, 'Failed to load crew members'));
      } finally {
        if (!cancelled) setCrewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const userOptions: SelectOption[] = useMemo(() => {
    return users
      .filter((u) => !existingUserIds.has(u.user_id))
      .map((u) => ({
        value: u.user_id,
        label: `${fullName(u.first_name, u.last_name)} (${u.email})`,
      }));
  }, [users, existingUserIds]);

  const crewOptions: SelectOption[] = useMemo(() => {
    return [
      { value: '', label: '— No Crew Member —' },
      ...crew.map((c) => ({
        value: c.id,
        label: fullName(c.first_name, c.last_name),
      })),
    ];
  }, [crew]);

  const onSubmit = async (data: CreateEmployeeFormData) => {
    try {
      setSubmitting(true);
      const payload: CreateEmployeeProfileRequest = {
        user_id: data.user_id,
        ...(data.crew_member_id ? { crew_member_id: data.crew_member_id } : {}),
        ...(data.hourly_rate !== null && data.hourly_rate !== undefined
          ? { hourly_rate: data.hourly_rate }
          : {}),
        overtime_rule_override: data.overtime_rule_override,
        ...(data.overtime_rule_override && data.overtime_daily_threshold_hours !== null
          ? { overtime_daily_threshold_hours: data.overtime_daily_threshold_hours ?? undefined }
          : {}),
        ...(data.overtime_rule_override && data.overtime_weekly_threshold_hours !== null
          ? { overtime_weekly_threshold_hours: data.overtime_weekly_threshold_hours ?? undefined }
          : {}),
      };
      await createEmployeeProfile(payload);
      toast.success('Employee profile created');
      onCreated();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        toast.error('An employee profile already exists for this user');
      } else {
        toast.error(extractErrorMessage(err, 'Failed to create employee profile'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Add Employee Profile
        </span>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {lookupError && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-800 dark:text-red-300">
            {lookupError}
          </div>
        )}

        <Controller
          name="user_id"
          control={control}
          render={({ field }) => (
            <Select
              label="User"
              required
              searchable
              options={userOptions}
              value={field.value}
              onChange={field.onChange}
              placeholder={
                usersLoading
                  ? 'Loading users…'
                  : userOptions.length === 0
                    ? 'All users already have profiles'
                    : 'Select a user'
              }
              disabled={usersLoading || userOptions.length === 0}
              error={errors.user_id?.message}
              helperText="Only users without an existing employee profile are shown."
            />
          )}
        />

        <Controller
          name="crew_member_id"
          control={control}
          render={({ field }) => (
            <Select
              label="Crew Member"
              searchable
              options={crewOptions}
              value={field.value ?? ''}
              onChange={(v) => field.onChange(v || null)}
              placeholder={crewLoading ? 'Loading crew members…' : '— No Crew Member —'}
              disabled={crewLoading}
              helperText="Link to a crew member for automatic labor cost tracking. If a crew member exists with the same user account, it will be linked automatically."
            />
          )}
        />

        <Controller
          name="hourly_rate"
          control={control}
          render={({ field }) => (
            <MoneyInput
              label="Hourly Rate Override"
              value={field.value ?? 0}
              onChange={(v) => field.onChange(v === 0 ? null : v)}
              error={errors.hourly_rate?.message}
              helperText="Overrides the crew member's default rate. Leave blank to use the crew member's rate."
            />
          )}
        />

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40 space-y-4">
          <Controller
            name="overtime_rule_override"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                enabled={field.value}
                onChange={field.onChange}
                label="Overtime Rule Override"
                description="Use custom overtime thresholds for this employee instead of the tenant default."
              />
            )}
          />

          {overtimeOverride && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Controller
                name="overtime_daily_threshold_hours"
                control={control}
                render={({ field }) => (
                  <HoursInput
                    label="Daily Threshold"
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(v === 0 ? null : v)}
                    helperText="Leave blank to use the tenant default."
                    error={errors.overtime_daily_threshold_hours?.message}
                  />
                )}
              />
              <Controller
                name="overtime_weekly_threshold_hours"
                control={control}
                render={({ field }) => (
                  <HoursInput
                    label="Weekly Threshold"
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(v === 0 ? null : v)}
                    helperText="Leave blank to use the tenant default."
                    error={errors.overtime_weekly_threshold_hours?.message}
                  />
                )}
              />
            </div>
          )}
        </div>

        <ModalActions>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || usersLoading || userOptions.length === 0}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Profile
              </>
            )}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Edit modal
// ---------------------------------------------------------------------------
interface EditModalProps {
  isOpen: boolean;
  profile: EmployeeProfile;
  onClose: () => void;
  onUpdated: () => void;
}

function EditEmployeeModal({ isOpen, profile, onClose, onUpdated }: EditModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateEmployeeFormData>({
    resolver: zodResolver(updateEmployeeSchema),
    mode: 'onBlur',
    defaultValues: {
      crew_member_id: profile.crew_member_id,
      hourly_rate: parseDecimal(profile.hourly_rate),
      overtime_rule_override: profile.overtime_rule_override,
      overtime_daily_threshold_hours: parseDecimal(profile.overtime_daily_threshold_hours),
      overtime_weekly_threshold_hours: parseDecimal(profile.overtime_weekly_threshold_hours),
      is_active: profile.is_active,
    },
  });

  const overtimeOverride = watch('overtime_rule_override');

  useEffect(() => {
    if (!isOpen) return;
    reset({
      crew_member_id: profile.crew_member_id,
      hourly_rate: parseDecimal(profile.hourly_rate),
      overtime_rule_override: profile.overtime_rule_override,
      overtime_daily_threshold_hours: parseDecimal(profile.overtime_daily_threshold_hours),
      overtime_weekly_threshold_hours: parseDecimal(profile.overtime_weekly_threshold_hours),
      is_active: profile.is_active,
    });
  }, [isOpen, profile, reset]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        setCrewLoading(true);
        const res = await getCrewMembers({ page: 1, limit: 100, is_active: true });
        if (cancelled) return;
        setCrew(res.data);
      } catch (err) {
        if (cancelled) return;
        toast.error(extractErrorMessage(err, 'Failed to load crew members'));
      } finally {
        if (!cancelled) setCrewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const crewOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: '', label: '— No Crew Member —' }];
    const existing = new Map<string, SelectOption>();
    crew.forEach((c) =>
      existing.set(c.id, { value: c.id, label: fullName(c.first_name, c.last_name) }),
    );
    // Ensure the currently-linked crew member is always in the list, even if
    // it was deactivated after being linked.
    if (
      profile.crew_member_id &&
      !existing.has(profile.crew_member_id) &&
      profile.crew_member
    ) {
      existing.set(profile.crew_member_id, {
        value: profile.crew_member_id,
        label: `${fullName(profile.crew_member.first_name, profile.crew_member.last_name)} (inactive)`,
      });
    }
    return base.concat(Array.from(existing.values()));
  }, [crew, profile]);

  const onSubmit = async (data: UpdateEmployeeFormData) => {
    try {
      setSubmitting(true);
      const payload: UpdateEmployeeProfileRequest = {
        crew_member_id: data.crew_member_id || null,
        hourly_rate: data.hourly_rate ?? null,
        overtime_rule_override: data.overtime_rule_override,
        overtime_daily_threshold_hours: data.overtime_rule_override
          ? (data.overtime_daily_threshold_hours ?? null)
          : null,
        overtime_weekly_threshold_hours: data.overtime_rule_override
          ? (data.overtime_weekly_threshold_hours ?? null)
          : null,
        is_active: data.is_active,
      };
      await updateEmployeeProfile(profile.id, payload);
      toast.success('Employee profile updated');
      onUpdated();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to update employee profile'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2">
          <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Edit Employee Profile
        </span>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Read-only user */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {fullName(profile.user?.first_name, profile.user?.last_name)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {profile.user?.email ?? '—'}
            </div>
          </div>
        </div>

        {/* Active toggle */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40">
          <Controller
            name="is_active"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                enabled={field.value}
                onChange={field.onChange}
                label="Active"
                description="Inactive employees cannot clock in via JWT or kiosk."
              />
            )}
          />
        </div>

        <Controller
          name="crew_member_id"
          control={control}
          render={({ field }) => (
            <Select
              label="Crew Member"
              searchable
              options={crewOptions}
              value={field.value ?? ''}
              onChange={(v) => field.onChange(v || null)}
              placeholder={crewLoading ? 'Loading crew members…' : '— No Crew Member —'}
              disabled={crewLoading}
              helperText="Link to a crew member for labor-cost attribution on payroll exports."
            />
          )}
        />

        <Controller
          name="hourly_rate"
          control={control}
          render={({ field }) => (
            <MoneyInput
              label="Hourly Rate Override"
              value={field.value ?? 0}
              onChange={(v) => field.onChange(v === 0 ? null : v)}
              error={errors.hourly_rate?.message}
              helperText="Leave blank to fall back to the linked crew member's default rate."
            />
          )}
        />

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/40 space-y-4">
          <Controller
            name="overtime_rule_override"
            control={control}
            render={({ field }) => (
              <ToggleSwitch
                enabled={field.value}
                onChange={field.onChange}
                label="Overtime Rule Override"
                description="Use custom overtime thresholds for this employee instead of the tenant default."
              />
            )}
          />

          {overtimeOverride && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <Controller
                name="overtime_daily_threshold_hours"
                control={control}
                render={({ field }) => (
                  <HoursInput
                    label="Daily Threshold"
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(v === 0 ? null : v)}
                    helperText="Leave blank to use the tenant default."
                    error={errors.overtime_daily_threshold_hours?.message}
                  />
                )}
              />
              <Controller
                name="overtime_weekly_threshold_hours"
                control={control}
                render={({ field }) => (
                  <HoursInput
                    label="Weekly Threshold"
                    value={field.value ?? 0}
                    onChange={(v) => field.onChange(v === 0 ? null : v)}
                    helperText="Leave blank to use the tenant default."
                    error={errors.overtime_weekly_threshold_hours?.message}
                  />
                )}
              />
            </div>
          )}
        </div>

        <ModalActions>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>Save Changes</>
            )}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Set PIN modal
// ---------------------------------------------------------------------------
interface SetPinModalProps {
  isOpen: boolean;
  profile: EmployeeProfile;
  onClose: () => void;
  onSaved: () => void;
}

function SetPinModal({ isOpen, profile, onClose, onSaved }: SetPinModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const pinFieldId = useId();
  const confirmPinFieldId = useId();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PinFormData>({
    resolver: zodResolver(pinSchema),
    mode: 'onBlur',
    defaultValues: { pin: '', confirmPin: '' },
  });

  const onSubmit = async (data: PinFormData) => {
    try {
      setSubmitting(true);
      await setEmployeePin(profile.id, { pin: data.pin });
      toast.success('Kiosk PIN saved');
      onSaved();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to set PIN'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={submitting ? () => undefined : onClose}
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          {profile.has_pin ? 'Change Kiosk PIN' : 'Set Kiosk PIN'}
        </span>
      }
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {fullName(profile.user?.first_name, profile.user?.last_name)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {profile.user?.email ?? '—'}
            </div>
          </div>
        </div>

        <Input
          id={pinFieldId}
          label="PIN"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="4–6 digits"
          required
          error={errors.pin?.message}
          leftIcon={<KeyRound className="w-5 h-5" />}
          {...register('pin')}
        />

        <Input
          id={confirmPinFieldId}
          label="Confirm PIN"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={6}
          placeholder="Re-enter PIN"
          required
          error={errors.confirmPin?.message}
          leftIcon={<KeyRound className="w-5 h-5" />}
          {...register('confirmPin')}
        />

        <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-300">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Setting a new PIN replaces any existing PIN and clears lockouts. The employee&apos;s
            current PIN will stop working immediately.
          </span>
        </div>

        <ModalActions>
          <Button variant="ghost" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Save PIN
              </>
            )}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default EmployeeProfilesTab;
