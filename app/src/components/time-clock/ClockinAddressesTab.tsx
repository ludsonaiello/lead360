/**
 * Clock-In Addresses Tab
 * Settings > Time Clock > Addresses
 *
 * Full CRUD management for geofence clock-in addresses. Owners and Admins
 * maintain the set of tenant locations employees must be within (radius based)
 * when the clock-in mode is "Specific Addresses" or "Active Job Sites".
 *
 * Live API contract (verified 2026-04-14):
 * - GET  /time-clock/addresses → PaginatedResponse<ClockinAddress>
 *        meta.totalPages, data[].project may be null
 * - PATCH /time-clock/addresses/:id supports is_active → true (reactivation)
 * - DELETE /time-clock/addresses/:id performs soft delete (sets is_active=false)
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Plus,
  Search,
  MapPin,
  Pencil,
  Power,
  PowerOff,
  FileText,
  Users,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  Ruler,
  Filter,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Skeleton } from '@/components/ui/Skeleton';

import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  listClockinAddresses,
  deleteClockinAddress,
  updateClockinAddress,
} from '@/lib/api/time-clock';
import type { ClockinAddress } from '@/lib/types/time-clock';

import { ClockinAddressForm } from './ClockinAddressForm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PAGE_SIZE = 20;
// Per-fetch page from the server. The list endpoint hard-caps at 100.
const FETCH_PAGE_SIZE = 100;
// Safety stop. If a tenant somehow has >2,000 clock-in addresses we'll fall
// back to the first 2,000 (twenty round-trips) and warn — far beyond any
// realistic use case for this resource.
const MAX_FETCH_PAGES = 20;

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as {
    response?: { data?: { message?: string | string[] } };
    message?: string;
  };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  if (typeof msg === 'string') return msg;
  return e?.message || fallback;
};

const formatFullAddress = (a: ClockinAddress): string =>
  [a.address_line1, a.city, [a.state, a.zip_code].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

const sourceLabel = (
  source: ClockinAddress['source'],
): { label: string; icon: typeof Pencil; variant: 'neutral' | 'info' } => {
  switch (source) {
    case 'imported_from_quote':
      return { label: 'From Quote', icon: FileText, variant: 'info' };
    case 'imported_from_lead':
      return { label: 'From Lead', icon: Users, variant: 'info' };
    default:
      return { label: 'Manual', icon: Pencil, variant: 'neutral' };
  }
};

// Filter / sort enums — all client-side because the API only accepts
// `is_active` / `project_id` / `search` (label-only) and rejects sort or
// source filters with a 400.
type StatusFilter = 'all' | 'active' | 'inactive';
type SourceFilter = 'all' | 'manual' | 'imported_from_quote' | 'imported_from_lead';
type ProjectFilter = 'all' | 'none' | string; // 'all' | 'none' | <project uuid>
type SortBy =
  | 'label_asc'
  | 'label_desc'
  | 'newest'
  | 'oldest'
  | 'radius_asc'
  | 'radius_desc';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'imported_from_quote', label: 'From Quote' },
  { value: 'imported_from_lead', label: 'From Lead' },
];

const SORT_OPTIONS = [
  { value: 'label_asc', label: 'Label · A → Z' },
  { value: 'label_desc', label: 'Label · Z → A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'radius_desc', label: 'Largest radius first' },
  { value: 'radius_asc', label: 'Smallest radius first' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ClockinAddressesTab() {
  // Source of truth: the FULL set of addresses for this tenant, fetched once
  // (paginated under the hood) and refetched only on mutations. All filtering,
  // searching, sorting and pagination are derived client-side. The list API
  // doesn't accept `source`, `sort_*` or address-text search, so doing this
  // client-side is the only way to deliver the UX without backend changes.
  const [allAddresses, setAllAddresses] = useState<ClockinAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncatedAt, setTruncatedAt] = useState<number | null>(null);

  // Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [projectFilter, setProjectFilter] = useState<ProjectFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('label_asc');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(searchText, 200);

  // Modal / action state
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClockinAddress | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<ClockinAddress | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  // Guard destructive-confirm reentry — ConfirmModal fires both onConfirm
  // and onClose in the same tick and reads `loading` too early.
  const deactivatingRef = useRef(false);
  // Monotonic fetch id — discards stale multi-page fetches if a refetch lands
  // on top of an earlier in-flight one.
  const fetchIdRef = useRef(0);

  // -------------------------------------------------------------------------
  // Multi-page fetch — pulls every address for this tenant (capped).
  // -------------------------------------------------------------------------
  const loadAll = useCallback(async () => {
    const fetchId = ++fetchIdRef.current;
    try {
      setLoading(true);
      const first = await listClockinAddresses({
        page: 1,
        limit: FETCH_PAGE_SIZE,
      });
      if (fetchId !== fetchIdRef.current) return;
      const totalPages = Math.min(first.meta.totalPages || 1, MAX_FETCH_PAGES);
      let combined: ClockinAddress[] = first.data;
      if (totalPages > 1) {
        const restPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, i) =>
            listClockinAddresses({ page: i + 2, limit: FETCH_PAGE_SIZE }),
          ),
        );
        if (fetchId !== fetchIdRef.current) return;
        combined = combined.concat(...restPages.map((r) => r.data));
      }
      setAllAddresses(combined);
      setTruncatedAt(
        first.meta.totalPages > MAX_FETCH_PAGES
          ? MAX_FETCH_PAGES * FETCH_PAGE_SIZE
          : null,
      );
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      toast.error(extractErrorMessage(err, 'Failed to load clock-in addresses'));
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // -------------------------------------------------------------------------
  // Derived: list of unique projects present in the data, for the project
  // filter dropdown. Sorted alphabetically. "Any project (global)" is the
  // null bucket.
  // -------------------------------------------------------------------------
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    let hasGlobal = false;
    allAddresses.forEach((a) => {
      if (a.project_id && a.project) {
        map.set(a.project.id, a.project.name);
      } else {
        hasGlobal = true;
      }
    });
    const named = Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
      );
    return [
      { value: 'all', label: 'All projects' },
      ...(hasGlobal ? [{ value: 'none', label: 'Any project (global)' }] : []),
      ...named,
    ];
  }, [allAddresses]);

  // -------------------------------------------------------------------------
  // Derived: filtered + sorted view of allAddresses.
  // -------------------------------------------------------------------------
  const filteredSorted = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const filtered = allAddresses.filter((a) => {
      // Status
      if (statusFilter === 'active' && !a.is_active) return false;
      if (statusFilter === 'inactive' && a.is_active) return false;
      // Source
      if (sourceFilter !== 'all' && a.source !== sourceFilter) return false;
      // Project
      if (projectFilter === 'none' && a.project_id !== null) return false;
      if (
        projectFilter !== 'all' &&
        projectFilter !== 'none' &&
        a.project_id !== projectFilter
      ) {
        return false;
      }
      // Free-text search across label + full address
      if (q) {
        const haystack = [
          a.label,
          a.address_line1,
          a.address_line2 ?? '',
          a.city,
          a.state,
          a.zip_code,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case 'label_asc':
        sorted.sort((a, b) =>
          a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
        );
        break;
      case 'label_desc':
        sorted.sort((a, b) =>
          b.label.localeCompare(a.label, undefined, { sensitivity: 'base' }),
        );
        break;
      case 'newest':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'oldest':
        sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
        break;
      case 'radius_desc':
        sorted.sort((a, b) => b.radius_meters - a.radius_meters);
        break;
      case 'radius_asc':
        sorted.sort((a, b) => a.radius_meters - b.radius_meters);
        break;
    }
    return sorted;
  }, [allAddresses, debouncedSearch, statusFilter, sourceFilter, projectFilter, sortBy]);

  // -------------------------------------------------------------------------
  // Derived: client-side pagination.
  // -------------------------------------------------------------------------
  const totalFiltered = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleAddresses = useMemo(
    () =>
      filteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredSorted, safePage],
  );

  // Snap page back into range whenever filters/sort shrink the result set.
  // setState-in-effect is fine here because the effect only fires when the
  // current page is invalid — it converges in one render.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    else if (page < 1) setPage(1);
  }, [page, totalPages]);

  const filtersActive =
    !!debouncedSearch.trim() ||
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    projectFilter !== 'all';

  const handleResetFilters = () => {
    setSearchText('');
    setStatusFilter('all');
    setSourceFilter('all');
    setProjectFilter('all');
    setSortBy('label_asc');
    setPage(1);
  };

  // -------------------------------------------------------------------------
  // Mutations — refetch the full set on success.
  // -------------------------------------------------------------------------
  const handleDeactivateConfirmed = async () => {
    if (!deactivateTarget || deactivatingRef.current) return;
    deactivatingRef.current = true;
    setDeactivating(true);
    try {
      await deleteClockinAddress(deactivateTarget.id);
      toast.success('Address deactivated');
      void loadAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to deactivate address'));
    } finally {
      deactivatingRef.current = false;
      setDeactivating(false);
      setDeactivateTarget(null);
    }
  };

  const handleReactivate = async (addr: ClockinAddress) => {
    setRowBusyId(addr.id);
    try {
      await updateClockinAddress(addr.id, { is_active: true });
      toast.success('Address reactivated');
      void loadAll();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to reactivate address'));
    } finally {
      setRowBusyId(null);
    }
  };

  const handleSaved = () => {
    setCreateOpen(false);
    setEditing(null);
    void loadAll();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Clock-In Addresses
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Geofence locations employees must be within to clock in. Add manually
            or import from a quote jobsite or lead address.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          className="w-full sm:w-auto min-h-[48px]"
        >
          <Plus className="w-4 h-4" />
          Add Address
        </Button>
      </div>

      {/* Truncation warning */}
      {truncatedAt !== null && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-300">
          <Filter className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Showing the first {truncatedAt.toLocaleString('en-US')} addresses.
            Tighten your filters to find specific entries beyond this set.
          </span>
        </div>
      )}

      {/* Search */}
      <Input
        id="clockin-addresses-search"
        label="Search"
        placeholder="Search by label, street, city, state or ZIP"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        leftIcon={<Search className="w-5 h-5" />}
        helperText="Searches across label and the full address — instant, case-insensitive."
      />

      {/* Filter row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as StatusFilter);
            setPage(1);
          }}
        />
        <Select
          label="Source"
          options={SOURCE_OPTIONS}
          value={sourceFilter}
          onChange={(v) => {
            setSourceFilter(v as SourceFilter);
            setPage(1);
          }}
        />
        <Select
          label="Project"
          options={projectOptions}
          value={projectFilter}
          onChange={(v) => {
            setProjectFilter(v as ProjectFilter);
            setPage(1);
          }}
          searchable={projectOptions.length > 6}
          disabled={projectOptions.length <= 1}
        />
        <Select
          label="Sort by"
          options={SORT_OPTIONS}
          value={sortBy}
          onChange={(v) => setSortBy(v as SortBy)}
        />
      </div>

      {/* Active filter summary + reset */}
      {filtersActive && (
        <div className="flex items-center justify-between gap-3 -mt-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Showing <span className="font-semibold">{totalFiltered}</span> of{' '}
            <span className="font-semibold">{allAddresses.length}</span>{' '}
            addresses
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <LoadingGrid />
      ) : visibleAddresses.length === 0 ? (
        <EmptyState
          onAdd={() => setCreateOpen(true)}
          hasFilters={filtersActive}
          onReset={handleResetFilters}
        />
      ) : (
        <>
          <ul className="space-y-3" role="list">
            {visibleAddresses.map((addr) => (
              <li key={addr.id}>
                <AddressCard
                  address={addr}
                  busy={rowBusyId === addr.id}
                  onEdit={() => setEditing(addr)}
                  onDeactivate={() => setDeactivateTarget(addr)}
                  onReactivate={() => handleReactivate(addr)}
                />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="pt-2">
              <PaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onGoToPage={(p) => setPage(p)}
              />
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            {totalFiltered} {totalFiltered === 1 ? 'address' : 'addresses'}
            {filtersActive && allAddresses.length !== totalFiltered && (
              <> · filtered from {allAddresses.length}</>
            )}
          </p>
        </>
      )}

      {/* Create modal */}
      {createOpen && (
        <ClockinAddressForm
          mode="create"
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Edit modal — keyed on id to force a fresh RHF instance per target */}
      {editing && (
        <ClockinAddressForm
          key={editing.id}
          mode="edit"
          address={editing}
          isOpen={!!editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Deactivate confirmation */}
      <ConfirmModal
        isOpen={!!deactivateTarget}
        onClose={() => {
          if (deactivatingRef.current) return;
          setDeactivateTarget(null);
        }}
        onConfirm={handleDeactivateConfirmed}
        title="Deactivate address?"
        message={
          deactivateTarget
            ? `Deactivate “${deactivateTarget.label}”? This address will no longer be used for geofence enforcement. You can reactivate it later from this page.`
            : 'Deactivate this address?'
        }
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        loading={deactivating}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address Card — unified layout for every viewport
// ---------------------------------------------------------------------------
// Design goals:
// - Never truncate critical content (label, address). Long strings wrap.
// - Mobile: stacked layout. Icon + title row, full address, badges row,
//   actions row. Nothing fights for space.
// - Desktop (md+): horizontal layout. Icon | title block | actions rail.
//   Badges become a row under the address but still inside the content
//   block so they don't compete with the action rail for width.
// - The card, not the row, is the unit of UX. Hover lifts, focus rings.
// ---------------------------------------------------------------------------
interface RowProps {
  address: ClockinAddress;
  busy: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

function AddressCard({
  address,
  busy,
  onEdit,
  onDeactivate,
  onReactivate,
}: RowProps) {
  const src = sourceLabel(address.source);
  const projectName = address.project?.name ?? null;
  const fullAddress = formatFullAddress(address);

  return (
    <article
      className="group rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 md:p-5 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all"
      aria-label={`Clock-in address ${address.label}`}
    >
      <div className="flex flex-col md:flex-row md:items-start md:gap-5">
        {/* Left rail: icon + content block */}
        <div className="flex items-start gap-3 md:gap-4 min-w-0 flex-1">
          <div className="flex-shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
            <MapPin className="w-5 h-5 md:w-6 md:h-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Title row — label + status badge stacked on mobile,
                inline on md+. Label wraps rather than truncates. */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white break-words">
                  {address.label}
                </h3>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400 break-words">
                  {fullAddress}
                </p>
              </div>
              <div className="flex-shrink-0">
                {address.is_active ? (
                  <Badge variant="success" icon={ShieldCheck}>
                    Active
                  </Badge>
                ) : (
                  <Badge variant="neutral" icon={ShieldAlert}>
                    Inactive
                  </Badge>
                )}
              </div>
            </div>

            {/* Metadata row — radius chip + source badge + project badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Ruler className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                {address.radius_meters}m geofence
              </span>
              <Badge variant={src.variant} icon={src.icon}>
                {src.label}
              </Badge>
              {projectName ? (
                <Badge variant="purple" icon={Briefcase}>
                  {projectName}
                </Badge>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 italic">
                  <Briefcase className="w-3.5 h-3.5" />
                  Any project
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right rail: actions. Full-width row on mobile (pushed below
            content), vertical stack on md+ (right of content). */}
        <div
          className="
            mt-4 md:mt-0
            flex items-stretch gap-2
            md:flex-col md:flex-shrink-0 md:w-36
            md:border-l md:border-gray-200 md:dark:border-gray-700
            md:pl-5
          "
        >
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onEdit}
            disabled={busy}
            className="flex-1 md:flex-none min-h-[48px] justify-center"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>
          {address.is_active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDeactivate}
              disabled={busy}
              className="flex-1 md:flex-none min-h-[48px] justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              <PowerOff className="w-4 h-4" />
              Deactivate
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReactivate}
              disabled={busy}
              className="flex-1 md:flex-none min-h-[48px] justify-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
            >
              <Power className="w-4 h-4" />
              Reactivate
            </Button>
          )}
        </div>
      </div>
    </article>
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
              <Skeleton variant="text" width="35%" height={16} />
              <Skeleton variant="text" width="65%" height={12} />
            </div>
            <Skeleton variant="rectangular" width={72} height={24} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onAdd,
  hasFilters,
  onReset,
}: {
  onAdd: () => void;
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-10 text-center">
      <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
        <MapPin className="w-7 h-7" />
      </div>
      <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">
        {hasFilters ? 'No addresses match your filters' : 'No Clock-In Addresses'}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-sm">
        {hasFilters
          ? 'Adjust the search or filters to find what you’re looking for.'
          : 'Add addresses to enforce geofence-based clock-in for your team. You can add them manually, import from a quote, or import from a lead.'}
      </p>
      {hasFilters ? (
        <div className="mt-6 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onReset}>
            <X className="w-4 h-4" />
            Clear filters
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4" />
            Add Address
          </Button>
        </div>
      ) : (
        <Button onClick={onAdd} className="mt-6">
          <Plus className="w-4 h-4" />
          Add Address
        </Button>
      )}
    </div>
  );
}

export default ClockinAddressesTab;
