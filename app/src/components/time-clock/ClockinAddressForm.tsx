/**
 * Clock-In Address Form
 * Reusable modal form for creating and editing clock-in geofence addresses.
 *
 * Create mode: three tabs — Manual entry, Import from Quote, Import from Lead.
 * Edit mode: single Manual tab pre-filled with existing address, source badge,
 *            is_active toggle, and read-only latitude / longitude.
 *
 * Live API contract (verified 2026-04-14):
 * - POST /time-clock/addresses:
 *     label, address_line1 required. City/state will be normalized by Google.
 *     Response lat/lng are Decimal strings.
 * - POST /time-clock/addresses/import-from-quote:
 *     { quote_id, label, radius_meters?, project_id? } — label required.
 * - POST /time-clock/addresses/import-from-lead:
 *     { lead_address_id, label, radius_meters?, project_id? } — label required.
 *     A lead can have multiple addresses; we resolve them from the lead list
 *     response (leads list embeds `addresses`) rather than a separate endpoint.
 */

'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  MapPin,
  Pencil,
  FileText,
  Users,
  Ruler,
  Navigation,
  Building2,
  Hash,
  Info,
  Link2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  AddressAutocomplete,
  AddressAutocompleteRef,
} from '@/components/ui/AddressAutocomplete';
import { ClockinAddressMap } from './ClockinAddressMap';

import {
  createClockinAddress,
  updateClockinAddress,
  importAddressFromQuote,
  importAddressFromLead,
} from '@/lib/api/time-clock';
import { getQuotes } from '@/lib/api/quotes';
import { getLeads } from '@/lib/api/leads';
import { getProjects } from '@/lib/api/projects';
import type {
  ClockinAddress,
  CreateClockinAddressRequest,
  UpdateClockinAddressRequest,
  ImportAddressFromQuoteRequest,
  ImportAddressFromLeadRequest,
} from '@/lib/types/time-clock';
import type { LeadListItem, LeadAddress } from '@/lib/types/leads';
import type { QuoteSummary } from '@/lib/types/quotes';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const RADIUS_MIN = 25;
const RADIUS_MAX = 5000;
const RADIUS_DEFAULT = 100;
const LABEL_MAX = 100;

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

const METERS_PER_FOOT = 3.2808399;

/**
 * Human-friendly description of a radius value, for non-technical admins.
 * Converts meters to feet and adds a practical size comparison.
 */
function getRadiusDescription(meters: number): {
  feet: string;
  comparison: string;
} {
  const safeMeters = Number.isFinite(meters) && meters > 0 ? meters : 0;
  const feet = Math.round(safeMeters * METERS_PER_FOOT);
  let comparison: string;

  if (safeMeters <= 30) {
    comparison = 'about the size of a small building';
  } else if (safeMeters <= 75) {
    comparison = 'about half a city block';
  } else if (safeMeters <= 150) {
    comparison = 'roughly the length of a football field';
  } else if (safeMeters <= 300) {
    comparison = 'about two city blocks';
  } else if (safeMeters <= 600) {
    comparison = 'about a quarter mile';
  } else {
    const miles = (feet / 5280).toFixed(2);
    comparison = `approximately ${miles} miles`;
  }

  return {
    feet: feet.toLocaleString('en-US'),
    comparison,
  };
}

/** Shape for a simple project option used across all tabs. */
interface ProjectOption {
  id: string;
  name: string;
  project_number: string | null;
}

/**
 * Shared project loader used by every tab. Loads up to 200 active / in-progress
 * projects. "Any project" is always prepended to keep RBAC-gated linking optional.
 */
function useProjectOptions(isOpen: boolean): {
  options: SelectOption[];
  loading: boolean;
} {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        // Fetch a large page of in-progress projects. The project dropdown is
        // optional so we silently ignore failures rather than blocking the
        // form — the user can still save without linking to a project.
        // Every list endpoint in this API caps `limit` at 100 (quotes/leads
        // hard-reject > 100 with a 400; projects silently caps). Use 100.
        const res = await getProjects({ limit: 100, status: 'in_progress' });
        if (cancelled) return;
        setProjects(
          res.data.map((p) => ({
            id: p.id,
            name: p.name,
            project_number: p.project_number,
          })),
        );
      } catch {
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const options = useMemo<SelectOption[]>(() => {
    return [
      { value: '', label: '— Any project (global) —' },
      ...projects.map((p) => ({
        value: p.id,
        label: p.project_number ? `${p.project_number} · ${p.name}` : p.name,
      })),
    ];
  }, [projects]);

  return { options, loading };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const manualAddressSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .max(LABEL_MAX, `Max ${LABEL_MAX} characters`),
  address_line1: z
    .string()
    .min(1, 'Street address is required')
    .max(255, 'Max 255 characters'),
  address_line2: z.string().max(255, 'Max 255 characters').optional().nullable(),
  city: z.string().min(1, 'City is required').max(100, 'Max 100 characters'),
  state: z
    .string()
    .length(2, 'State must be the 2-letter abbreviation')
    .transform((v) => v.toUpperCase()),
  zip_code: z.string().min(1, 'ZIP code is required').max(10, 'Max 10 characters'),
  radius_meters: z
    .number({ error: 'Radius is required' })
    .int('Whole meters only')
    .min(RADIUS_MIN, `Minimum ${RADIUS_MIN} meters`)
    .max(RADIUS_MAX, `Maximum ${RADIUS_MAX} meters`),
  project_id: z.string().optional().nullable(),
});

const editAddressSchema = manualAddressSchema.extend({
  is_active: z.boolean(),
});
type EditAddressFormData = z.infer<typeof editAddressSchema>;

const importFromQuoteSchema = z.object({
  quote_id: z.string().min(1, 'Select a quote'),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(LABEL_MAX, `Max ${LABEL_MAX} characters`),
  radius_meters: z
    .number({ error: 'Radius is required' })
    .int('Whole meters only')
    .min(RADIUS_MIN, `Minimum ${RADIUS_MIN} meters`)
    .max(RADIUS_MAX, `Maximum ${RADIUS_MAX} meters`),
  project_id: z.string().optional().nullable(),
});
type ImportFromQuoteFormData = z.infer<typeof importFromQuoteSchema>;

const importFromLeadSchema = z.object({
  lead_id: z.string().min(1, 'Select a lead'),
  lead_address_id: z.string().min(1, 'Select a lead address'),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(LABEL_MAX, `Max ${LABEL_MAX} characters`),
  radius_meters: z
    .number({ error: 'Radius is required' })
    .int('Whole meters only')
    .min(RADIUS_MIN, `Minimum ${RADIUS_MIN} meters`)
    .max(RADIUS_MAX, `Maximum ${RADIUS_MAX} meters`),
  project_id: z.string().optional().nullable(),
});
type ImportFromLeadFormData = z.infer<typeof importFromLeadSchema>;

// ---------------------------------------------------------------------------
// Radius helper display
// ---------------------------------------------------------------------------
function RadiusHelper({ meters }: { meters: number }) {
  const { feet, comparison } = getRadiusDescription(meters);
  return (
    <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
      <Info className="w-3.5 h-3.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
      <span>
        ≈ <span className="font-semibold text-gray-700 dark:text-gray-300">{feet} ft</span>{' '}
        — {comparison}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Top-level Modal
// ---------------------------------------------------------------------------
export type ClockinAddressFormMode = 'create' | 'edit';
type CreateTabId = 'manual' | 'quote' | 'lead';

interface ClockinAddressFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode: ClockinAddressFormMode;
  address?: ClockinAddress | null;
}

export function ClockinAddressForm({
  isOpen,
  onClose,
  onSaved,
  mode,
  address,
}: ClockinAddressFormProps) {
  const [activeTab, setActiveTab] = useState<CreateTabId>('manual');
  const [submitting, setSubmitting] = useState(false);

  // NB: the form is conditionally mounted by its parent (`{open && <Form />}`),
  // so activeTab / submitting reset on every reopen without any useEffect.
  const projectsQuery = useProjectOptions(isOpen);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const title =
    mode === 'edit' ? (
      <span className="flex items-center gap-2">
        <Pencil className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Edit Clock-In Address
      </span>
    ) : (
      <span className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        Add Clock-In Address
      </span>
    );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="xl">
      {mode === 'edit' && address ? (
        <ManualAddressFormSection
          mode="edit"
          address={address}
          projectOptions={projectsQuery.options}
          projectsLoading={projectsQuery.loading}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onCancel={handleClose}
          onSaved={onSaved}
        />
      ) : (
        <>
          {/* Tab switcher — pill style, optimized for touch */}
          <div
            role="tablist"
            aria-label="Address creation method"
            className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-gray-900 p-1"
          >
            <TabButton
              id="manual"
              label="Manual"
              icon={Pencil}
              activeTab={activeTab}
              onSelect={setActiveTab}
              disabled={submitting}
            />
            <TabButton
              id="quote"
              label="From Quote"
              icon={FileText}
              activeTab={activeTab}
              onSelect={setActiveTab}
              disabled={submitting}
            />
            <TabButton
              id="lead"
              label="From Lead"
              icon={Users}
              activeTab={activeTab}
              onSelect={setActiveTab}
              disabled={submitting}
            />
          </div>

          {activeTab === 'manual' && (
            <ManualAddressFormSection
              mode="create"
              address={null}
              projectOptions={projectsQuery.options}
              projectsLoading={projectsQuery.loading}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onCancel={handleClose}
              onSaved={onSaved}
            />
          )}

          {activeTab === 'quote' && (
            <ImportFromQuoteSection
              isOpen={isOpen && activeTab === 'quote'}
              projectOptions={projectsQuery.options}
              projectsLoading={projectsQuery.loading}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onCancel={handleClose}
              onSaved={onSaved}
            />
          )}

          {activeTab === 'lead' && (
            <ImportFromLeadSection
              isOpen={isOpen && activeTab === 'lead'}
              projectOptions={projectsQuery.options}
              projectsLoading={projectsQuery.loading}
              submitting={submitting}
              setSubmitting={setSubmitting}
              onCancel={handleClose}
              onSaved={onSaved}
            />
          )}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
interface TabButtonProps {
  id: CreateTabId;
  label: string;
  icon: typeof Pencil;
  activeTab: CreateTabId;
  onSelect: (id: CreateTabId) => void;
  disabled: boolean;
}

function TabButton({
  id,
  label,
  icon: Icon,
  activeTab,
  onSelect,
  disabled,
}: TabButtonProps) {
  const active = activeTab === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`clockin-address-tab-${id}`}
      onClick={() => onSelect(id)}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 min-h-[48px]
        text-sm font-semibold transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          active
            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-300 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Manual address form (used for both CREATE and EDIT)
// ---------------------------------------------------------------------------
interface ManualAddressFormSectionProps {
  mode: ClockinAddressFormMode;
  address: ClockinAddress | null;
  projectOptions: SelectOption[];
  projectsLoading: boolean;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}

function ManualAddressFormSection({
  mode,
  address,
  projectOptions,
  projectsLoading,
  submitting,
  setSubmitting,
  onCancel,
  onSaved,
}: ManualAddressFormSectionProps) {
  const autocompleteRef = useRef<AddressAutocompleteRef>(null);
  const isEdit = mode === 'edit' && !!address;

  // Preview coordinates — what the map + the read-only coords card show.
  // In edit mode we seed them from the existing address so the pin is
  // visible the moment the modal opens. When the user picks a new address
  // from the autocomplete we overwrite these with Google's result so the
  // map moves live. On submit we don't send lat/long to the backend — the
  // API re-geocodes (and actively rejects latitude/longitude in the PATCH
  // body with a 400), so these values are client-side only.
  const initialLat =
    isEdit && address!.latitude ? parseFloat(address!.latitude) : null;
  const initialLong =
    isEdit && address!.longitude ? parseFloat(address!.longitude) : null;
  const [previewLat, setPreviewLat] = useState<number | null>(
    Number.isFinite(initialLat as number) ? (initialLat as number) : null,
  );
  const [previewLong, setPreviewLong] = useState<number | null>(
    Number.isFinite(initialLong as number) ? (initialLong as number) : null,
  );

  // A single unified schema + form type covers both create and edit. The
  // is_active field is only *shown* in edit mode, but defaulting it to true
  // in create mode (matching the backend default) lets us drop the union type
  // and the resolver cast.
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EditAddressFormData>({
    resolver: zodResolver(editAddressSchema),
    mode: 'onBlur',
    defaultValues: isEdit
      ? {
          label: address!.label,
          address_line1: address!.address_line1,
          address_line2: address!.address_line2 ?? '',
          city: address!.city,
          state: address!.state,
          zip_code: address!.zip_code,
          radius_meters: address!.radius_meters,
          project_id: address!.project_id ?? '',
          is_active: address!.is_active,
        }
      : {
          label: '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          zip_code: '',
          radius_meters: RADIUS_DEFAULT,
          project_id: '',
          is_active: true,
        },
  });

  const radiusWatched = watch('radius_meters');

  const onSubmit = async (data: EditAddressFormData) => {
    try {
      setSubmitting(true);

      if (isEdit && address) {
        const payload: UpdateClockinAddressRequest = {
          label: data.label.trim(),
          address_line1: data.address_line1.trim(),
          address_line2: data.address_line2?.trim() || null,
          city: data.city.trim(),
          state: data.state.trim().toUpperCase(),
          zip_code: data.zip_code.trim(),
          radius_meters: data.radius_meters,
          project_id: data.project_id ? data.project_id : null,
          is_active: data.is_active,
        };
        await updateClockinAddress(address.id, payload);
        toast.success('Address updated');
      } else {
        // We intentionally never send latitude/longitude on create. The
        // backend re-geocodes the submitted street/city/state/zip via Google
        // Maps on every create; if we sent stale coords from an earlier
        // autocomplete selection (after the user edited the street), Google
        // would "normalize" against the wrong pin. Letting the backend
        // geocode guarantees the lat/long always matches the stored address.
        const payload: CreateClockinAddressRequest = {
          label: data.label.trim(),
          address_line1: data.address_line1.trim(),
          city: data.city.trim(),
          state: data.state.trim().toUpperCase(),
          zip_code: data.zip_code.trim(),
          radius_meters: data.radius_meters,
        };
        if (data.address_line2 && data.address_line2.trim()) {
          payload.address_line2 = data.address_line2.trim();
        }
        if (data.project_id) {
          payload.project_id = data.project_id;
        }
        await createClockinAddress(payload);
        toast.success('Address created');
        reset();
        autocompleteRef.current?.reset();
      }
      onSaved();
    } catch (err) {
      toast.error(
        extractErrorMessage(
          err,
          isEdit ? 'Failed to update address' : 'Failed to create address',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const sourceBadge = useMemo(() => {
    if (!isEdit || !address) return null;
    switch (address.source) {
      case 'imported_from_quote':
        return (
          <Badge variant="info" icon={FileText}>
            Imported from Quote
          </Badge>
        );
      case 'imported_from_lead':
        return (
          <Badge variant="info" icon={Users}>
            Imported from Lead
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" icon={Pencil}>
            Manual
          </Badge>
        );
    }
  }, [isEdit, address]);

  return (
    <form
      id="clockin-address-tab-manual"
      role="tabpanel"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
    >
      {/* Source badge for edit mode */}
      {isEdit && (
        <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Source
          </span>
          {sourceBadge}
        </div>
      )}

      <Input
        id="clockin-address-label"
        label="Label"
        required
        placeholder="e.g. Main Office, Home Depot Waltham"
        helperText="A short, human-readable name for this location."
        leftIcon={<Hash className="w-5 h-5" />}
        error={errors.label?.message}
        disabled={submitting}
        {...register('label')}
      />

      {/* Autocomplete is shown in BOTH create and edit modes. In edit mode
          it's pre-populated with the current formatted address so the user
          can either (a) type a completely new address and let Google fill
          every field, or (b) ignore the autocomplete and tweak individual
          fields below. Picking a result also updates the preview map +
          coordinates card via previewLat/previewLong. */}
      <AddressAutocomplete
        ref={autocompleteRef}
        label={isEdit ? 'Update address' : 'Find address'}
        helperText="Start typing — we'll auto-fill the fields below and move the map pin. The backend re-geocodes on save."
        defaultValue={
          isEdit && address
            ? [
                address.address_line1,
                address.city,
                [address.state, address.zip_code].filter(Boolean).join(' '),
              ]
                .filter(Boolean)
                .join(', ')
            : ''
        }
        onSelect={(addr) => {
          setValue('address_line1', addr.line1, { shouldValidate: true });
          setValue('city', addr.city, { shouldValidate: true });
          setValue('state', addr.state.toUpperCase(), { shouldValidate: true });
          setValue('zip_code', addr.zip_code, { shouldValidate: true });
          if (typeof addr.lat === 'number' && typeof addr.long === 'number') {
            setPreviewLat(addr.lat);
            setPreviewLong(addr.long);
          }
        }}
        disabled={submitting}
      />


      <Input
        id="clockin-address-line1"
        label="Street address"
        required
        placeholder="123 Main St"
        leftIcon={<MapPin className="w-5 h-5" />}
        error={errors.address_line1?.message}
        disabled={submitting}
        {...register('address_line1')}
      />

      <Input
        id="clockin-address-line2"
        label="Apt / Suite"
        placeholder="Suite 200 (optional)"
        leftIcon={<Building2 className="w-5 h-5" />}
        error={errors.address_line2?.message as string | undefined}
        disabled={submitting}
        {...register('address_line2')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
        <div className="sm:col-span-3">
          <Input
            id="clockin-address-city"
            label="City"
            required
            placeholder="Boston"
            error={errors.city?.message}
            disabled={submitting}
            {...register('city')}
          />
        </div>
        <div className="sm:col-span-1">
          <Input
            id="clockin-address-state"
            label="State"
            required
            placeholder="MA"
            maxLength={2}
            autoCapitalize="characters"
            error={errors.state?.message}
            disabled={submitting}
            {...register('state', {
              setValueAs: (v: string) => (v || '').toUpperCase(),
            })}
          />
        </div>
        <div className="sm:col-span-2">
          <Input
            id="clockin-address-zip"
            label="ZIP"
            required
            inputMode="numeric"
            placeholder="02101"
            maxLength={10}
            error={errors.zip_code?.message}
            disabled={submitting}
            {...register('zip_code')}
          />
        </div>
      </div>

      {/* Radius field — with visual helper */}
      <div>
        <Input
          id="clockin-address-radius"
          type="number"
          label="Geofence radius (meters)"
          required
          inputMode="numeric"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={5}
          leftIcon={<Ruler className="w-5 h-5" />}
          error={errors.radius_meters?.message}
          disabled={submitting}
          {...register('radius_meters', { valueAsNumber: true })}
        />
        <RadiusHelper meters={Number(radiusWatched) || RADIUS_DEFAULT} />
      </div>

      <Controller
        name="project_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Link to project"
            helperText={
              projectsLoading
                ? 'Loading projects…'
                : 'Optional. Leave as “Any project” to apply to all projects.'
            }
            placeholder="— Any project (global) —"
            options={projectOptions}
            value={field.value ?? ''}
            onChange={field.onChange}
            disabled={submitting || projectsLoading}
            searchable
          />
        )}
      />

      {/* Edit-only: active toggle */}
      {isEdit && (
        <Controller
          name="is_active"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Active
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  Inactive addresses are excluded from geofence checks.
                </p>
              </div>
              <ToggleSwitch
                enabled={!!field.value}
                onChange={field.onChange}
                disabled={submitting}
              />
            </div>
          )}
        />
      )}

      {/* Live coordinates card + map preview — shown in both create and
          edit modes. In create mode the pin is empty until the user picks
          an address from the autocomplete. In edit mode it starts at the
          stored coordinates and moves live as the user picks a new address. */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/60 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Navigation className="w-3.5 h-3.5" />
            Geofence preview
          </div>
          {isEdit &&
            address &&
            ((previewLat !== null && previewLat !== initialLat) ||
              (previewLong !== null && previewLong !== initialLong)) && (
              <Badge variant="info">Updated — save to apply</Badge>
            )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadOnlyField
            label="Latitude"
            value={previewLat !== null ? previewLat.toFixed(7) : '—'}
          />
          <ReadOnlyField
            label="Longitude"
            value={previewLong !== null ? previewLong.toFixed(7) : '—'}
          />
        </div>

        <ClockinAddressMap
          latitude={previewLat}
          longitude={previewLong}
          radiusMeters={
            Number.isFinite(Number(radiusWatched))
              ? Math.max(RADIUS_MIN, Math.min(RADIUS_MAX, Number(radiusWatched)))
              : RADIUS_DEFAULT
          }
        />

        {isEdit && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Picking a new address above updates the pin instantly. The backend
            re-geocodes the final address when you save.
          </p>
        )}
      </div>

      <ModalActions>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {isEdit ? 'Save changes' : 'Create address'}
        </Button>
      </ModalActions>
    </form>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 font-mono text-sm text-gray-700 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import-from-Quote section
// ---------------------------------------------------------------------------
interface ImportSectionProps {
  isOpen: boolean;
  projectOptions: SelectOption[];
  projectsLoading: boolean;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}

interface QuoteLite {
  id: string;
  quote_number: string;
  title: string;
  client_name: string;
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
}

function ImportFromQuoteSection({
  isOpen,
  projectOptions,
  projectsLoading,
  submitting,
  setSubmitting,
  onCancel,
  onSaved,
}: ImportSectionProps) {
  const [quotes, setQuotes] = useState<QuoteLite[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ImportFromQuoteFormData>({
    resolver: zodResolver(importFromQuoteSchema),
    mode: 'onBlur',
    defaultValues: {
      quote_id: '',
      label: '',
      radius_meters: RADIUS_DEFAULT,
      project_id: '',
    },
  });

  const selectedQuoteId = watch('quote_id');
  const radiusWatched = watch('radius_meters');
  // Tracks the quote id we last autofilled the label from. We autofill once
  // per selection — never again — so users can edit or clear the label freely
  // without our effect stomping their edits on the next render.
  const lastAutofilledQuoteId = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingQuotes(true);
        setLoadError(null);
        // getQuotes returns QuoteSummary[] in its declared types, but the
        // live list response also includes the richer jobsite_address fields
        // (zip_code, etc.) — we cast through unknown to read them safely
        // without polluting the shared QuoteSummary type.
        // API caps limit at 100; going higher returns a 400.
        const res = await getQuotes({ limit: 100, sort_by: 'created_at', sort_order: 'desc' });
        if (cancelled) return;
        const mapped: QuoteLite[] = res.data.map((q) => {
          const quote = q as unknown as QuoteSummary & {
            jobsite_address?: {
              address_line1?: string;
              city?: string;
              state?: string;
              zip_code?: string;
            } | null;
            lead?: { first_name?: string; last_name?: string; company_name?: string } | null;
          };
          const jobsite = quote.jobsite_address ?? null;
          const first = quote.lead?.first_name ?? '';
          const last = quote.lead?.last_name ?? '';
          const company = quote.lead?.company_name ?? '';
          const clientName =
            (company?.trim()
              ? company
              : `${first} ${last}`.trim()) || 'Unknown client';
          return {
            id: q.id,
            quote_number: q.quote_number,
            title: q.title,
            client_name: clientName,
            address_line1: jobsite?.address_line1 ?? q.jobsite_address?.address_line1 ?? '',
            city: jobsite?.city ?? q.jobsite_address?.city ?? '',
            state: jobsite?.state ?? q.jobsite_address?.state ?? '',
            zip_code: jobsite?.zip_code ?? '',
          };
        });
        setQuotes(mapped);
      } catch (err) {
        if (cancelled) return;
        setLoadError(extractErrorMessage(err, 'Failed to load quotes'));
      } finally {
        if (!cancelled) setLoadingQuotes(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const quoteOptions = useMemo<SelectOption[]>(
    () =>
      quotes.map((q) => ({
        value: q.id,
        label: `${q.quote_number} — ${q.client_name}`,
      })),
    [quotes],
  );

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) ?? null,
    [quotes, selectedQuoteId],
  );

  // Auto-suggest label once per selected quote. Re-suggesting on label edits
  // would fight the user, so we key the autofill on the quote id and never
  // touch the label again until a different quote is selected.
  useEffect(() => {
    if (!selectedQuote) return;
    if (lastAutofilledQuoteId.current === selectedQuote.id) return;
    const suggested = `${selectedQuote.quote_number} — ${selectedQuote.client_name}`;
    setValue('label', suggested.slice(0, LABEL_MAX), { shouldValidate: true });
    lastAutofilledQuoteId.current = selectedQuote.id;
  }, [selectedQuote, setValue]);

  const onSubmit = async (data: ImportFromQuoteFormData) => {
    try {
      setSubmitting(true);
      const payload: ImportAddressFromQuoteRequest = {
        quote_id: data.quote_id,
        label: data.label.trim(),
        radius_meters: data.radius_meters,
      };
      if (data.project_id) payload.project_id = data.project_id;
      await importAddressFromQuote(payload);
      toast.success('Address imported from quote');
      reset();
      onSaved();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to import address from quote'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      id="clockin-address-tab-quote"
      role="tabpanel"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
    >
      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {loadError}
        </div>
      )}

      <Controller
        name="quote_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Quote"
            required
            searchable
            options={quoteOptions}
            value={field.value}
            onChange={field.onChange}
            placeholder={
              loadingQuotes
                ? 'Loading quotes…'
                : quoteOptions.length === 0
                  ? 'No quotes available'
                  : 'Search and select a quote'
            }
            error={errors.quote_id?.message}
            disabled={submitting || loadingQuotes}
            helperText="Every quote has a jobsite address — we'll copy it here."
          />
        )}
      />

      {selectedQuote && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            <MapPin className="w-3.5 h-3.5" />
            Jobsite address preview
          </div>
          {selectedQuote.address_line1 ? (
            <div className="space-y-0.5 text-sm text-gray-800 dark:text-gray-200">
              <div className="font-semibold">{selectedQuote.address_line1}</div>
              <div>
                {[selectedQuote.city, selectedQuote.state, selectedQuote.zip_code]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Backend will resolve the jobsite address on import.
            </div>
          )}
        </div>
      )}

      <Input
        id="clockin-address-quote-label"
        label="Label for new clock-in address"
        required
        placeholder="e.g. #Q-2026-0042 — Smith Residence"
        helperText="Shown to employees when they clock in."
        leftIcon={<Hash className="w-5 h-5" />}
        error={errors.label?.message}
        disabled={submitting}
        {...register('label')}
      />

      <div>
        <Input
          id="clockin-address-quote-radius"
          type="number"
          label="Geofence radius (meters)"
          required
          inputMode="numeric"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={5}
          leftIcon={<Ruler className="w-5 h-5" />}
          error={errors.radius_meters?.message}
          disabled={submitting}
          {...register('radius_meters', { valueAsNumber: true })}
        />
        <RadiusHelper meters={Number(radiusWatched) || RADIUS_DEFAULT} />
      </div>

      <Controller
        name="project_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Link to project"
            helperText={
              projectsLoading
                ? 'Loading projects…'
                : 'Optional. Leave as “Any project” to apply to all projects.'
            }
            placeholder="— Any project (global) —"
            options={projectOptions}
            value={field.value ?? ''}
            onChange={field.onChange}
            disabled={submitting || projectsLoading}
            searchable
          />
        )}
      />

      <ModalActions>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting || !selectedQuote}>
          <Link2 className="w-4 h-4" />
          Import address
        </Button>
      </ModalActions>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Import-from-Lead section
// ---------------------------------------------------------------------------
interface LeadLite {
  id: string;
  display_name: string;
  addresses: LeadAddress[];
}

function ImportFromLeadSection({
  isOpen,
  projectOptions,
  projectsLoading,
  submitting,
  setSubmitting,
  onCancel,
  onSaved,
}: ImportSectionProps) {
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ImportFromLeadFormData>({
    resolver: zodResolver(importFromLeadSchema),
    mode: 'onBlur',
    defaultValues: {
      lead_id: '',
      lead_address_id: '',
      label: '',
      radius_meters: RADIUS_DEFAULT,
      project_id: '',
    },
  });

  const selectedLeadId = watch('lead_id');
  const selectedLeadAddressId = watch('lead_address_id');
  const radiusWatched = watch('radius_meters');
  // Tracks the address id we last autofilled the label from. One autofill per
  // selection — edits by the user are never overwritten.
  const lastAutofilledAddressId = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      try {
        setLoadingLeads(true);
        setLoadError(null);
        // API caps limit at 100; going higher returns a 400.
        const res = await getLeads({ limit: 100 });
        if (cancelled) return;
        const mapped: LeadLite[] = res.data
          // Only show leads that have at least one address — otherwise there is
          // nothing to import from.
          .filter((l: LeadListItem) => Array.isArray(l.addresses) && l.addresses.length > 0)
          .map((l: LeadListItem) => {
            const first = l.first_name ?? '';
            const last = l.last_name ?? '';
            const company = l.company_name ?? '';
            const display =
              company.trim() ||
              `${first} ${last}`.trim() ||
              'Unnamed lead';
            return {
              id: l.id,
              display_name: display,
              addresses: l.addresses,
            };
          });
        setLeads(mapped);
      } catch (err) {
        if (cancelled) return;
        setLoadError(extractErrorMessage(err, 'Failed to load leads'));
      } finally {
        if (!cancelled) setLoadingLeads(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const leadOptions = useMemo<SelectOption[]>(
    () =>
      leads.map((l) => ({
        value: l.id,
        label: l.display_name,
      })),
    [leads],
  );

  const selectedLead = useMemo(
    () => leads.find((l) => l.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  const addressOptions = useMemo<SelectOption[]>(() => {
    if (!selectedLead) return [];
    return selectedLead.addresses.map((addr) => ({
      value: addr.id,
      label: `${addr.address_line1}, ${addr.city}, ${addr.state} ${addr.zip_code}${
        addr.is_primary ? ' • Primary' : ''
      }`,
    }));
  }, [selectedLead]);

  const selectedAddress = useMemo(() => {
    if (!selectedLead || !selectedLeadAddressId) return null;
    return selectedLead.addresses.find((a) => a.id === selectedLeadAddressId) ?? null;
  }, [selectedLead, selectedLeadAddressId]);

  // Reset the address selection when the lead changes. Address list is
  // lead-scoped, so the previously chosen address id is no longer valid.
  useEffect(() => {
    setValue('lead_address_id', '', { shouldValidate: false });
  }, [selectedLeadId, setValue]);

  // Auto-suggest label once per selected lead-address. Re-running on label
  // edits would fight the user, so we key on the address id instead.
  useEffect(() => {
    if (!selectedLead || !selectedAddress) return;
    if (lastAutofilledAddressId.current === selectedAddress.id) return;
    const suggested = `${selectedLead.display_name} — ${selectedAddress.city}`;
    setValue('label', suggested.slice(0, LABEL_MAX), { shouldValidate: true });
    lastAutofilledAddressId.current = selectedAddress.id;
  }, [selectedLead, selectedAddress, setValue]);

  const onSubmit = async (data: ImportFromLeadFormData) => {
    try {
      setSubmitting(true);
      const payload: ImportAddressFromLeadRequest = {
        lead_address_id: data.lead_address_id,
        label: data.label.trim(),
        radius_meters: data.radius_meters,
      };
      if (data.project_id) payload.project_id = data.project_id;
      await importAddressFromLead(payload);
      toast.success('Address imported from lead');
      reset();
      onSaved();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Failed to import address from lead'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      id="clockin-address-tab-lead"
      role="tabpanel"
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
    >
      {loadError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {loadError}
        </div>
      )}

      <Controller
        name="lead_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Lead"
            required
            searchable
            options={leadOptions}
            value={field.value}
            onChange={field.onChange}
            placeholder={
              loadingLeads
                ? 'Loading leads…'
                : leadOptions.length === 0
                  ? 'No leads with saved addresses'
                  : 'Search and select a lead'
            }
            error={errors.lead_id?.message}
            disabled={submitting || loadingLeads}
            helperText="Only leads with at least one saved address are shown."
          />
        )}
      />

      <Controller
        name="lead_address_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Lead address"
            required
            searchable={addressOptions.length > 5}
            options={addressOptions}
            value={field.value}
            onChange={field.onChange}
            placeholder={
              !selectedLead
                ? 'Pick a lead first'
                : addressOptions.length === 0
                  ? 'No addresses on this lead'
                  : 'Select an address'
            }
            error={errors.lead_address_id?.message}
            disabled={submitting || !selectedLead}
          />
        )}
      />

      {selectedAddress && (
        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            <MapPin className="w-3.5 h-3.5" />
            Address preview
          </div>
          <div className="space-y-0.5 text-sm text-gray-800 dark:text-gray-200">
            <div className="font-semibold">{selectedAddress.address_line1}</div>
            {selectedAddress.address_line2 && <div>{selectedAddress.address_line2}</div>}
            <div>
              {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip_code}
            </div>
          </div>
        </div>
      )}

      <Input
        id="clockin-address-lead-label"
        label="Label for new clock-in address"
        required
        placeholder="e.g. John Doe — Leominster"
        helperText="Shown to employees when they clock in."
        leftIcon={<Hash className="w-5 h-5" />}
        error={errors.label?.message}
        disabled={submitting}
        {...register('label')}
      />

      <div>
        <Input
          id="clockin-address-lead-radius"
          type="number"
          label="Geofence radius (meters)"
          required
          inputMode="numeric"
          min={RADIUS_MIN}
          max={RADIUS_MAX}
          step={5}
          leftIcon={<Ruler className="w-5 h-5" />}
          error={errors.radius_meters?.message}
          disabled={submitting}
          {...register('radius_meters', { valueAsNumber: true })}
        />
        <RadiusHelper meters={Number(radiusWatched) || RADIUS_DEFAULT} />
      </div>

      <Controller
        name="project_id"
        control={control}
        render={({ field }) => (
          <Select
            label="Link to project"
            helperText={
              projectsLoading
                ? 'Loading projects…'
                : 'Optional. Leave as “Any project” to apply to all projects.'
            }
            placeholder="— Any project (global) —"
            options={projectOptions}
            value={field.value ?? ''}
            onChange={field.onChange}
            disabled={submitting || projectsLoading}
            searchable
          />
        )}
      />

      <ModalActions>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          disabled={submitting || !selectedLead || !selectedAddress}
        >
          <Link2 className="w-4 h-4" />
          Import address
        </Button>
      </ModalActions>
    </form>
  );
}

export default ClockinAddressForm;
