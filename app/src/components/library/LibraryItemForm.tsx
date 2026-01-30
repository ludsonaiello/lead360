/**
 * LibraryItemForm Component
 * Form for creating/editing library items (templates for quote items)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MoneyInput } from '@/components/ui/MoneyInput';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { ArrowLeft, Save } from 'lucide-react';
import { getUnitMeasurements } from '@/lib/api/units';
import { formatMoney } from '@/lib/api/quotes';
import type {
  LibraryItem,
  UnitMeasurement,
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
} from '@/lib/types/quotes';

interface LibraryItemFormProps {
  item?: LibraryItem; // undefined = create, defined = edit
  onSubmit: (data: CreateLibraryItemDto | UpdateLibraryItemDto) => Promise<void>;
  loading?: boolean;
}

export function LibraryItemForm({ item, onSubmit, loading = false }: LibraryItemFormProps) {
  const router = useRouter();
  const isEdit = !!item;

  // Form state
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [defaultQuantity, setDefaultQuantity] = useState(item?.default_quantity || 1);
  const [unitMeasurementId, setUnitMeasurementId] = useState(item?.unit_measurement_id || '');
  const [materialCost, setMaterialCost] = useState(item?.material_cost_per_unit || 0);
  const [laborCost, setLaborCost] = useState(item?.labor_cost_per_unit || 0);
  const [equipmentCost, setEquipmentCost] = useState(item?.equipment_cost_per_unit || 0);
  const [subcontractCost, setSubcontractCost] = useState(item?.subcontract_cost_per_unit || 0);
  const [otherCost, setOtherCost] = useState(item?.other_cost_per_unit || 0);

  // Dropdown data
  const [units, setUnits] = useState<UnitMeasurement[]>([]);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading states
  const [loadingData, setLoadingData] = useState(true);

  // Load dropdown data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const unitsData = await getUnitMeasurements();

        // Get all units from data array
        const allUnits = unitsData?.data || [];
        setUnits(allUnits);
      } catch (err: any) {
        console.error('Failed to load form data:', err);
        setUnits([]);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, []);

  // Calculate total
  const totalCostPerUnit =
    materialCost + laborCost + equipmentCost + subcontractCost + otherCost;

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length > 200) {
      newErrors.title = 'Title must be 200 characters or less';
    }

    if (description.length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less';
    }

    if (!defaultQuantity || defaultQuantity < 0.01) {
      newErrors.default_quantity = 'Default quantity must be at least 0.01';
    }

    if (!unitMeasurementId) {
      newErrors.unit_measurement_id = 'Unit is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const formData: any = {
      title: title.trim(),
      description: description.trim() || undefined,
      default_quantity: defaultQuantity,
      unit_measurement_id: unitMeasurementId,
      material_cost_per_unit: materialCost,
      labor_cost_per_unit: laborCost,
      equipment_cost_per_unit: equipmentCost,
      subcontract_cost_per_unit: subcontractCost,
      other_cost_per_unit: otherCost,
    };

    try {
      await onSubmit(formData);
    } catch (err) {
      // Error handled by parent
    }
  };

  // Unit options
  const unitOptions = units.map((u) => ({
    value: u.id,
    label: `${u.name} (${u.abbreviation})`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={loading}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {isEdit ? 'Edit Library Item' : 'Add Library Item'}
          </h1>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            <Save className="w-4 h-4" />
            {isEdit ? 'Save Changes' : 'Add Item'}
          </Button>
        </div>
      </div>

      {/* Basic Information */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Basic Information
        </h2>
        <div className="space-y-4">
          <Input
            label="Item Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            placeholder="e.g., Install kitchen cabinets"
            required
            disabled={loading || loadingData}
            autoFocus
          />

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Additional details about this item"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || loadingData}
            />
            {errors.description && (
              <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
                {errors.description}
              </p>
            )}
          </div>

          <Select
            label="Unit of Measurement"
            value={unitMeasurementId}
            onChange={setUnitMeasurementId}
            options={unitOptions}
            error={errors.unit_measurement_id}
            required
            disabled={loading || loadingData}
          />

          <Input
            label="Default Quantity"
            type="number"
            value={defaultQuantity}
            onChange={(e) => setDefaultQuantity(parseFloat(e.target.value) || 0)}
            error={errors.default_quantity}
            placeholder="1.00"
            required
            disabled={loading || loadingData}
            step="0.01"
            min="0.01"
            helperText="Default quantity when adding this item to a quote"
          />
        </div>
      </Card>

      {/* Cost Breakdown */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Cost Breakdown (Per Unit)
        </h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MoneyInput
              label="Material Cost"
              value={materialCost}
              onChange={setMaterialCost}
              placeholder="0.00"
              disabled={loading || loadingData}
            />

            <MoneyInput
              label="Labor Cost"
              value={laborCost}
              onChange={setLaborCost}
              placeholder="0.00"
              disabled={loading || loadingData}
            />

            <MoneyInput
              label="Equipment Cost"
              value={equipmentCost}
              onChange={setEquipmentCost}
              placeholder="0.00"
              disabled={loading || loadingData}
            />

            <MoneyInput
              label="Subcontract Cost"
              value={subcontractCost}
              onChange={setSubcontractCost}
              placeholder="0.00"
              disabled={loading || loadingData}
            />

            <MoneyInput
              label="Other Cost"
              value={otherCost}
              onChange={setOtherCost}
              placeholder="0.00"
              disabled={loading || loadingData}
            />
          </div>

          {/* Calculated Total */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                Total Cost Per Unit
              </p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatMoney(totalCostPerUnit)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </form>
  );
}
