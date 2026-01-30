/**
 * Unit Management Page
 * Manage global (platform-wide) and custom (tenant-specific) unit measurements
 * Global units are read-only, custom units are editable
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import {
  Plus,
  Edit,
  Trash2,
  Ruler,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
} from 'lucide-react';
import {
  getUnitMeasurements,
  createCustomUnit,
  updateCustomUnit,
  deleteCustomUnit,
  getCustomUnitUsage,
} from '@/lib/api/units';
import type { UnitMeasurement, CreateCustomUnitDto } from '@/lib/types/quotes';

export default function UnitManagementPage() {
  // Data
  const [globalUnits, setGlobalUnits] = useState<UnitMeasurement[]>([]);
  const [customUnits, setCustomUnits] = useState<UnitMeasurement[]>([]);

  // Loading & Modals
  const [loading, setLoading] = useState(true);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitMeasurement | undefined>();
  const [formLoading, setFormLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingUnit, setDeletingUnit] = useState<UnitMeasurement | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formAbbreviation, setFormAbbreviation] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await getUnitMeasurements();
      const allUnits = response?.data || [];

      // Separate units by is_global flag
      const globals = allUnits.filter(unit => unit.is_global);
      const customs = allUnits.filter(unit => !unit.is_global);

      setGlobalUnits(globals);
      setCustomUnits(customs);
    } catch (err: any) {
      console.error('Failed to load units:', err);
      showError(err.message || 'Failed to load unit measurements');
      // Set empty arrays on error
      setGlobalUnits([]);
      setCustomUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccessModalOpen(true);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalOpen(true);
  };

  const handleCreateClick = () => {
    setEditingUnit(undefined);
    setFormName('');
    setFormAbbreviation('');
    setFormErrors({});
    setFormModalOpen(true);
  };

  const handleEditClick = (unit: UnitMeasurement) => {
    setEditingUnit(unit);
    setFormName(unit.name);
    setFormAbbreviation(unit.abbreviation);
    setFormErrors({});
    setFormModalOpen(true);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formName.trim()) {
      errors.name = 'Unit name is required';
    } else if (formName.length > 100) {
      errors.name = 'Unit name must be 100 characters or less';
    }

    if (!formAbbreviation.trim()) {
      errors.abbreviation = 'Abbreviation is required';
    } else if (formAbbreviation.length > 20) {
      errors.abbreviation = 'Abbreviation must be 20 characters or less';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data: CreateCustomUnitDto = {
      name: formName.trim(),
      abbreviation: formAbbreviation.trim(),
    };

    try {
      setFormLoading(true);

      if (editingUnit) {
        await updateCustomUnit(editingUnit.id, data);
        showSuccess('Custom unit updated successfully');
      } else {
        await createCustomUnit(data);
        showSuccess('Custom unit created successfully');
      }

      setFormModalOpen(false);
      await loadData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to save custom unit');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteClick = (unit: UnitMeasurement) => {
    setDeletingUnit(unit);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUnit) return;

    try {
      setDeleteLoading(true);

      // Check if unit is in use
      const usage = await getCustomUnitUsage(deletingUnit.id);
      if (usage.is_in_use) {
        const quoteItemsCount = usage.usage_locations.filter(loc => loc.type === 'quote_item').length;
        const libraryItemsCount = usage.usage_locations.filter(loc => loc.type === 'library_item').length;
        showError(
          `Cannot delete this unit. It is being used in ${quoteItemsCount} quote items and ${libraryItemsCount} library items.`
        );
        setDeleteModalOpen(false);
        setDeleteLoading(false);
        return;
      }

      await deleteCustomUnit(deletingUnit.id);
      setDeleteModalOpen(false);
      showSuccess('Custom unit deleted successfully');
      await loadData();
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to delete custom unit');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Unit Measurements
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage units of measurement for quote items
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          {/* Global Units Section */}
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Global Units (Platform-Wide)
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  These units are available to all tenants and cannot be modified
                </p>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Abbreviation
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Usage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {globalUnits && globalUnits.length > 0 ? (
                    globalUnits.map((unit) => (
                      <tr
                        key={unit.id}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100 font-medium">
                          {unit.name}
                        </td>
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          {unit.abbreviation}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                          {unit.usage_count}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500 dark:text-gray-400">
                        No global units available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden p-4 space-y-3">
              {globalUnits && globalUnits.length > 0 ? (
                globalUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                        {unit.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Abbr: {unit.abbreviation}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {unit.usage_count} uses
                    </p>
                  </div>
                </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No global units available
                </div>
              )}
            </div>
          </Card>

          {/* Custom Units Section */}
          <Card>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Custom Units
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Units specific to your company
                  </p>
                </div>
              </div>
              <Button onClick={handleCreateClick}>
                <Plus className="w-4 h-4" />
                Add Custom Unit
              </Button>
            </div>

            {customUnits.length === 0 ? (
              <div className="text-center py-12">
                <Ruler className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  No Custom Units
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create custom units specific to your business needs
                </p>
                <Button onClick={handleCreateClick}>
                  <Plus className="w-4 h-4" />
                  Add First Custom Unit
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b-2 border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Name
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Abbreviation
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Usage
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {customUnits.map((unit) => (
                        <tr
                          key={unit.id}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <td className="py-3 px-4 text-gray-900 dark:text-gray-100 font-medium">
                            {unit.name}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                            {unit.abbreviation}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                            {unit.usage_count}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditClick(unit)}
                                title="Edit unit"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(unit)}
                                title="Delete unit"
                              >
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-3">
                  {customUnits.map((unit) => (
                    <div
                      key={unit.id}
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {unit.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Abbr: {unit.abbreviation}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {unit.usage_count} uses
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditClick(unit)}
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteClick(unit)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Form Modal */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => !formLoading && setFormModalOpen(false)}
        title={editingUnit ? 'Edit Custom Unit' : 'Add Custom Unit'}
        size="md"
      >
        <form onSubmit={handleFormSubmit}>
          <ModalContent>
            <div className="space-y-4">
              <Input
                label="Unit Name"
                placeholder="e.g., Square Yard, Linear Meter"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                error={formErrors.name}
                required
                disabled={formLoading}
                autoFocus
              />

              <Input
                label="Abbreviation"
                placeholder="e.g., sq yd, lm"
                value={formAbbreviation}
                onChange={(e) => setFormAbbreviation(e.target.value)}
                error={formErrors.abbreviation}
                required
                disabled={formLoading}
              />
            </div>
          </ModalContent>

          <ModalActions>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFormModalOpen(false)}
              disabled={formLoading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingUnit ? 'Save Changes' : 'Create Unit'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Delete Custom Unit"
        size="sm"
      >
        <ModalContent>
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete "{deletingUnit?.name}"?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone. This unit will be deleted only if it's not being
                used in any quote items or library items.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={deleteLoading}>
            Delete Unit
          </Button>
        </ModalActions>
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Success"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {successMessage}
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setSuccessModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <XCircle className="w-16 h-16 text-red-500 dark:text-red-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Operation Failed
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setErrorModalOpen(false)}>
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
