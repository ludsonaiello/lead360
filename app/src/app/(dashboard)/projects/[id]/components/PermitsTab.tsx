'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Calendar,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectPermits,
  createProjectPermit,
  updateProjectPermit,
  deleteProjectPermit,
  createPermitInspection,
  updatePermitInspection,
  deletePermitInspection,
  formatDate,
} from '@/lib/api/projects';
import type {
  Permit,
  PermitStatus,
  CreatePermitDto,
  UpdatePermitDto,
  Inspection,
  InspectionResult,
  CreateInspectionDto,
  UpdateInspectionDto,
} from '@/lib/types/projects';
import toast from 'react-hot-toast';

interface PermitsTabProps {
  projectId: string;
}

// ── Display config ──

const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  not_required: 'Not Required',
  pending_application: 'Pending Application',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  failed: 'Failed',
  closed: 'Closed',
};

const PERMIT_STATUS_BADGE_VARIANT: Record<
  PermitStatus,
  'neutral' | 'warning' | 'info' | 'success' | 'blue' | 'danger'
> = {
  not_required: 'neutral',
  pending_application: 'warning',
  submitted: 'info',
  approved: 'success',
  active: 'blue',
  failed: 'danger',
  closed: 'neutral',
};

const PERMIT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(PERMIT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const PERMIT_STATUS_FORM_OPTIONS = Object.entries(PERMIT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  pass: 'Pass',
  fail: 'Fail',
  conditional: 'Conditional',
  pending: 'Pending',
};

const INSPECTION_RESULT_BADGE_VARIANT: Record<
  InspectionResult,
  'success' | 'danger' | 'warning' | 'info'
> = {
  pass: 'success',
  fail: 'danger',
  conditional: 'warning',
  pending: 'info',
};

const INSPECTION_RESULT_OPTIONS = [
  { value: '', label: 'Not Set' },
  ...Object.entries(INSPECTION_RESULT_LABELS).map(([value, label]) => ({ value, label })),
];

// ── Component ──

export default function PermitsTab({ projectId }: PermitsTabProps) {
  const { hasRole } = useRBAC();
  const canManage = hasRole(['Owner', 'Admin', 'Manager']);
  const canDelete = hasRole(['Owner', 'Admin']);

  // Data
  const [permits, setPermits] = useState<Permit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<PermitStatus | ''>('');

  // Permit modal
  const [showPermitModal, setShowPermitModal] = useState(false);
  const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
  const [permitForm, setPermitForm] = useState<CreatePermitDto>({ permit_type: '' });
  const [savingPermit, setSavingPermit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Permit | null>(null);
  const [deletingPermit, setDeletingPermit] = useState(false);

  // Expanded permit (inspections)
  const [expandedPermitId, setExpandedPermitId] = useState<string | null>(null);

  // Inspection modal
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspectionPermitId, setInspectionPermitId] = useState<string | null>(null);
  const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
  const [inspectionForm, setInspectionForm] = useState<CreateInspectionDto>({
    inspection_type: '',
  });
  const [savingInspection, setSavingInspection] = useState(false);
  const [deleteInspectionTarget, setDeleteInspectionTarget] = useState<{
    permitId: string;
    inspection: Inspection;
  } | null>(null);
  const [deletingInspection, setDeletingInspection] = useState(false);

  // ── Data fetching ──

  const loadPermits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { status?: PermitStatus } = {};
      if (statusFilter) params.status = statusFilter;
      const result = await getProjectPermits(projectId, params);
      setPermits(result);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load permits');
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

  useEffect(() => {
    loadPermits();
  }, [loadPermits]);

  // ── Permit handlers ──

  const openCreatePermit = () => {
    setEditingPermit(null);
    setPermitForm({ permit_type: '' });
    setShowPermitModal(true);
  };

  const openEditPermit = (permit: Permit) => {
    setEditingPermit(permit);
    setPermitForm({
      permit_type: permit.permit_type,
      permit_number: permit.permit_number || undefined,
      status: permit.status,
      submitted_date: permit.submitted_date || undefined,
      approved_date: permit.approved_date || undefined,
      expiry_date: permit.expiry_date || undefined,
      issuing_authority: permit.issuing_authority || undefined,
      notes: permit.notes || undefined,
    });
    setShowPermitModal(true);
  };

  const handlePermitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permitForm.permit_type?.trim()) {
      toast.error('Permit type is required');
      return;
    }
    setSavingPermit(true);
    try {
      if (editingPermit) {
        await updateProjectPermit(projectId, editingPermit.id, permitForm as UpdatePermitDto);
        toast.success('Permit updated');
      } else {
        await createProjectPermit(projectId, permitForm);
        toast.success('Permit created');
      }
      setShowPermitModal(false);
      setEditingPermit(null);
      setPermitForm({ permit_type: '' });
      loadPermits();
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      toast.error(error.message || 'Failed to save permit');
    } finally {
      setSavingPermit(false);
    }
  };

  const handleDeletePermit = async () => {
    if (!deleteTarget) return;
    setDeletingPermit(true);
    try {
      await deleteProjectPermit(projectId, deleteTarget.id);
      toast.success('Permit deleted');
      setDeleteTarget(null);
      if (expandedPermitId === deleteTarget.id) setExpandedPermitId(null);
      loadPermits();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete permit');
    } finally {
      setDeletingPermit(false);
    }
  };

  // ── Inspection handlers ──

  const openCreateInspection = (permitId: string) => {
    setInspectionPermitId(permitId);
    setEditingInspection(null);
    setInspectionForm({ inspection_type: '' });
    setShowInspectionModal(true);
  };

  const openEditInspection = (permitId: string, inspection: Inspection) => {
    setInspectionPermitId(permitId);
    setEditingInspection(inspection);
    setInspectionForm({
      inspection_type: inspection.inspection_type,
      scheduled_date: inspection.scheduled_date || undefined,
      inspector_name: inspection.inspector_name || undefined,
      result: inspection.result || undefined,
      reinspection_required: inspection.reinspection_required,
      reinspection_date: inspection.reinspection_date || undefined,
      notes: inspection.notes || undefined,
      inspected_by_user_id: inspection.inspected_by_user_id || undefined,
    });
    setShowInspectionModal(true);
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionPermitId) return;
    if (!inspectionForm.inspection_type?.trim()) {
      toast.error('Inspection type is required');
      return;
    }
    setSavingInspection(true);
    try {
      if (editingInspection) {
        await updatePermitInspection(
          projectId,
          inspectionPermitId,
          editingInspection.id,
          inspectionForm as UpdateInspectionDto,
        );
        toast.success('Inspection updated');
      } else {
        await createPermitInspection(projectId, inspectionPermitId, inspectionForm);
        toast.success('Inspection created');
      }
      setShowInspectionModal(false);
      setEditingInspection(null);
      setInspectionPermitId(null);
      setInspectionForm({ inspection_type: '' });
      loadPermits();
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      toast.error(error.message || 'Failed to save inspection');
    } finally {
      setSavingInspection(false);
    }
  };

  const handleDeleteInspection = async () => {
    if (!deleteInspectionTarget) return;
    setDeletingInspection(true);
    try {
      await deletePermitInspection(
        projectId,
        deleteInspectionTarget.permitId,
        deleteInspectionTarget.inspection.id,
      );
      toast.success('Inspection deleted');
      setDeleteInspectionTarget(null);
      loadPermits();
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e.message || 'Failed to delete inspection');
    } finally {
      setDeletingInspection(false);
    }
  };

  // ── Helpers ──

  const hasActiveFilter = statusFilter !== '';

  const toggleExpand = (permitId: string) => {
    setExpandedPermitId((prev) => (prev === permitId ? null : permitId));
  };

  // ── Loading state ──

  if (loading && permits.length === 0) {
    return (
      <Card className="p-12 mt-6">
        <LoadingSpinner size="lg" centered />
      </Card>
    );
  }

  // ── Error state ──

  if (error && permits.length === 0) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700 dark:text-gray-300">{error}</p>
        <Button variant="secondary" size="sm" onClick={loadPermits} className="mt-4">
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-gray-400" />
          <div className="w-52">
            <Select
              options={PERMIT_STATUS_OPTIONS}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val as PermitStatus | '')}
              placeholder="All Statuses"
            />
          </div>
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('')}>
              <span className="flex items-center gap-1 text-xs">Clear</span>
            </Button>
          )}
        </div>
        {canManage && (
          <Button variant="primary" size="sm" onClick={openCreatePermit}>
            <Plus className="w-4 h-4" />
            Add Permit
          </Button>
        )}
      </div>

      {/* Permit list */}
      {permits.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            No Permits
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilter
              ? 'No permits match your filter.'
              : 'Add your first permit to track regulatory approvals.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {permits.map((permit) => {
            const isExpanded = expandedPermitId === permit.id;
            return (
              <Card key={permit.id} className="overflow-hidden">
                {/* Permit row */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {permit.permit_type}
                        </h4>
                        <Badge
                          variant={PERMIT_STATUS_BADGE_VARIANT[permit.status]}
                          label={PERMIT_STATUS_LABELS[permit.status]}
                        />
                      </div>

                      {permit.permit_number && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          #{permit.permit_number}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {permit.issuing_authority && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {permit.issuing_authority}
                          </span>
                        )}
                        {permit.submitted_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Submitted: {formatDate(permit.submitted_date)}
                          </span>
                        )}
                        {permit.approved_date && (
                          <span>Approved: {formatDate(permit.approved_date)}</span>
                        )}
                        {permit.expiry_date && (
                          <span>Expires: {formatDate(permit.expiry_date)}</span>
                        )}
                      </div>

                      {permit.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                          {permit.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canManage && (
                        <button
                          onClick={() => openEditPermit(permit)}
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteTarget(permit)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleExpand(permit.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inspection count hint */}
                  <button
                    onClick={() => toggleExpand(permit.id)}
                    className="flex items-center gap-1.5 mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    {permit.inspections.length} inspection
                    {permit.inspections.length !== 1 ? 's' : ''}
                  </button>
                </div>

                {/* Expanded inspections section */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Inspections
                      </h5>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCreateInspection(permit.id)}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add Inspection
                        </Button>
                      )}
                    </div>

                    {permit.inspections.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No inspections recorded for this permit.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {permit.inspections.map((inspection) => (
                          <div
                            key={inspection.id}
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {inspection.inspection_type}
                                  </span>
                                  {inspection.result && (
                                    <Badge
                                      variant={INSPECTION_RESULT_BADGE_VARIANT[inspection.result]}
                                      label={INSPECTION_RESULT_LABELS[inspection.result]}
                                    />
                                  )}
                                  {inspection.reinspection_required && (
                                    <Badge variant="warning" label="Reinspection Required" />
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                  {inspection.scheduled_date && (
                                    <span>Scheduled: {formatDate(inspection.scheduled_date)}</span>
                                  )}
                                  {inspection.inspector_name && (
                                    <span>Inspector: {inspection.inspector_name}</span>
                                  )}
                                  {inspection.reinspection_date && (
                                    <span>
                                      Reinspection: {formatDate(inspection.reinspection_date)}
                                    </span>
                                  )}
                                </div>

                                {inspection.notes && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                    {inspection.notes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {canManage && (
                                  <button
                                    onClick={() => openEditInspection(permit.id, inspection)}
                                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() =>
                                      setDeleteInspectionTarget({
                                        permitId: permit.id,
                                        inspection,
                                      })
                                    }
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Permit Create/Edit Modal ── */}
      <Modal
        isOpen={showPermitModal}
        onClose={() => {
          if (!savingPermit) {
            setShowPermitModal(false);
            setEditingPermit(null);
            setPermitForm({ permit_type: '' });
          }
        }}
        title={editingPermit ? 'Edit Permit' : 'Add Permit'}
        size="lg"
      >
        <form onSubmit={handlePermitSubmit}>
          <div className="space-y-4">
            <Input
              label="Permit Type"
              required
              value={permitForm.permit_type}
              onChange={(e) =>
                setPermitForm((prev) => ({ ...prev, permit_type: e.target.value }))
              }
              placeholder="e.g., Building, Electrical, Plumbing"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Permit Number"
                value={permitForm.permit_number || ''}
                onChange={(e) =>
                  setPermitForm((prev) => ({
                    ...prev,
                    permit_number: e.target.value || undefined,
                  }))
                }
                placeholder="e.g., BP-2026-0001"
              />
              <Select
                label="Status"
                options={PERMIT_STATUS_FORM_OPTIONS}
                value={permitForm.status || 'pending_application'}
                onChange={(val) =>
                  setPermitForm((prev) => ({
                    ...prev,
                    status: val as PermitStatus,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DatePicker
                label="Submitted Date"
                value={permitForm.submitted_date || ''}
                onChange={(e) =>
                  setPermitForm((prev) => ({
                    ...prev,
                    submitted_date: e.target.value || undefined,
                  }))
                }
              />
              <DatePicker
                label="Approved Date"
                value={permitForm.approved_date || ''}
                onChange={(e) =>
                  setPermitForm((prev) => ({
                    ...prev,
                    approved_date: e.target.value || undefined,
                  }))
                }
              />
              <DatePicker
                label="Expiry Date"
                value={permitForm.expiry_date || ''}
                onChange={(e) =>
                  setPermitForm((prev) => ({
                    ...prev,
                    expiry_date: e.target.value || undefined,
                  }))
                }
              />
            </div>

            <Input
              label="Issuing Authority"
              value={permitForm.issuing_authority || ''}
              onChange={(e) =>
                setPermitForm((prev) => ({
                  ...prev,
                  issuing_authority: e.target.value || undefined,
                }))
              }
              placeholder="e.g., City of Boston"
            />

            <Textarea
              label="Notes"
              value={permitForm.notes || ''}
              onChange={(e) =>
                setPermitForm((prev) => ({ ...prev, notes: e.target.value || undefined }))
              }
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <ModalActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowPermitModal(false);
                setEditingPermit(null);
                setPermitForm({ permit_type: '' });
              }}
              disabled={savingPermit}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingPermit}>
              {editingPermit ? 'Save Changes' : 'Create Permit'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ── Inspection Create/Edit Modal ── */}
      <Modal
        isOpen={showInspectionModal}
        onClose={() => {
          if (!savingInspection) {
            setShowInspectionModal(false);
            setEditingInspection(null);
            setInspectionPermitId(null);
            setInspectionForm({ inspection_type: '' });
          }
        }}
        title={editingInspection ? 'Edit Inspection' : 'Add Inspection'}
        size="lg"
      >
        <form onSubmit={handleInspectionSubmit}>
          <div className="space-y-4">
            <Input
              label="Inspection Type"
              required
              value={inspectionForm.inspection_type}
              onChange={(e) =>
                setInspectionForm((prev) => ({ ...prev, inspection_type: e.target.value }))
              }
              placeholder="e.g., Framing, Electrical Rough-In, Final"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Scheduled Date"
                value={inspectionForm.scheduled_date || ''}
                onChange={(e) =>
                  setInspectionForm((prev) => ({
                    ...prev,
                    scheduled_date: e.target.value || undefined,
                  }))
                }
              />
              <Input
                label="Inspector Name"
                value={inspectionForm.inspector_name || ''}
                onChange={(e) =>
                  setInspectionForm((prev) => ({
                    ...prev,
                    inspector_name: e.target.value || undefined,
                  }))
                }
                placeholder="Inspector name"
              />
            </div>

            <Select
              label="Result"
              options={INSPECTION_RESULT_OPTIONS}
              value={inspectionForm.result || ''}
              onChange={(val) =>
                setInspectionForm((prev) => ({
                  ...prev,
                  result: (val || undefined) as InspectionResult | undefined,
                }))
              }
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <ToggleSwitch
                enabled={inspectionForm.reinspection_required || false}
                onChange={(val) =>
                  setInspectionForm((prev) => ({ ...prev, reinspection_required: val }))
                }
                label="Reinspection Required"
              />
              {inspectionForm.reinspection_required && (
                <div className="flex-1">
                  <DatePicker
                    label="Reinspection Date"
                    value={inspectionForm.reinspection_date || ''}
                    onChange={(e) =>
                      setInspectionForm((prev) => ({
                        ...prev,
                        reinspection_date: e.target.value || undefined,
                      }))
                    }
                  />
                </div>
              )}
            </div>

            <Textarea
              label="Notes"
              value={inspectionForm.notes || ''}
              onChange={(e) =>
                setInspectionForm((prev) => ({ ...prev, notes: e.target.value || undefined }))
              }
              placeholder="Optional notes..."
              rows={3}
            />
          </div>

          <ModalActions>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowInspectionModal(false);
                setEditingInspection(null);
                setInspectionPermitId(null);
                setInspectionForm({ inspection_type: '' });
              }}
              disabled={savingInspection}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingInspection}>
              {editingInspection ? 'Save Changes' : 'Create Inspection'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* ── Delete Permit Confirmation ── */}
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePermit}
        title="Delete Permit"
        message={`Are you sure you want to delete the "${deleteTarget?.permit_type}" permit${deleteTarget?.permit_number ? ` (#${deleteTarget.permit_number})` : ''}? This action cannot be undone.`}
        isDeleting={deletingPermit}
      />

      {/* ── Delete Inspection Confirmation ── */}
      <DeleteConfirmationModal
        isOpen={!!deleteInspectionTarget}
        onClose={() => setDeleteInspectionTarget(null)}
        onConfirm={handleDeleteInspection}
        title="Delete Inspection"
        message={`Are you sure you want to delete the "${deleteInspectionTarget?.inspection.inspection_type}" inspection? This action cannot be undone.`}
        isDeleting={deletingInspection}
      />
    </div>
  );
}
