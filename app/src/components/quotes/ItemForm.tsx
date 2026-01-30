/**
 * ItemForm Component
 * Full-page form for creating/editing quote items
 * Handles all 10+ fields with validation
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
import { getWarrantyTiers } from '@/lib/api/warranty-tiers';
import { getQuoteGroups } from '@/lib/api/quote-groups';
import { getQuoteSettings } from '@/lib/api/quote-settings';
import { formatMoney } from '@/lib/api/quotes';
import type {
  QuoteItem,
  UnitMeasurement,
  WarrantyTier,
  QuoteGroup,
  QuoteSettings,
  CreateQuoteItemDto,
  UpdateQuoteItemDto,
} from '@/lib/types/quotes';

interface ItemFormProps {
  quoteId: string;
  item?: QuoteItem; // undefined = create, defined = edit
  onSubmit: (data: CreateQuoteItemDto | UpdateQuoteItemDto, saveToLibrary?: boolean) => Promise<void>;
  loading?: boolean;
}

export function ItemForm({ quoteId, item, onSubmit, loading = false }: ItemFormProps) {
  const router = useRouter();
  const isEdit = !!item;

  // Form state
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || '1');
  const [unitMeasurementId, setUnitMeasurementId] = useState(item?.unit_measurement_id || '');
  const [materialCost, setMaterialCost] = useState(item?.material_cost_per_unit || 0);
  const [laborCost, setLaborCost] = useState(item?.labor_cost_per_unit || 0);
  const [equipmentCost, setEquipmentCost] = useState(item?.equipment_cost_per_unit || 0);
  const [subcontractCost, setSubcontractCost] = useState(item?.subcontract_cost_per_unit || 0);
  const [otherCost, setOtherCost] = useState(item?.other_cost_per_unit || 0);
  const [warrantyTierId, setWarrantyTierId] = useState(item?.warranty_tier_id || '');
  const [groupId, setGroupId] = useState(item?.quote_group_id || '');
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  // Custom markup percentages (optional - override quote-level defaults)
  const [customProfitPercent, setCustomProfitPercent] = useState(
    item?.custom_profit_percent !== null && item?.custom_profit_percent !== undefined
      ? item.custom_profit_percent.toString()
      : ''
  );
  const [customOverheadPercent, setCustomOverheadPercent] = useState(
    item?.custom_overhead_percent !== null && item?.custom_overhead_percent !== undefined
      ? item.custom_overhead_percent.toString()
      : ''
  );
  const [customContingencyPercent, setCustomContingencyPercent] = useState(
    item?.custom_contingency_percent !== null && item?.custom_contingency_percent !== undefined
      ? item.custom_contingency_percent.toString()
      : ''
  );

  // Determine initial discount type based on which field has a value
  const getInitialDiscountType = (): 'percentage' | 'amount' | 'none' => {
    if (item?.custom_discount_percentage !== null && item?.custom_discount_percentage !== undefined) {
      return 'percentage';
    }
    if (item?.custom_discount_amount !== null && item?.custom_discount_amount !== undefined) {
      return 'amount';
    }
    return 'none';
  };

  const [discountType, setDiscountType] = useState<'percentage' | 'amount' | 'none'>(getInitialDiscountType());
  const [customDiscountPercentage, setCustomDiscountPercentage] = useState(
    item?.custom_discount_percentage !== null && item?.custom_discount_percentage !== undefined
      ? item.custom_discount_percentage.toString()
      : ''
  );
  const [customDiscountAmount, setCustomDiscountAmount] = useState(
    item?.custom_discount_amount !== null && item?.custom_discount_amount !== undefined
      ? item.custom_discount_amount
      : 0
  );

  // Dropdown data
  const [units, setUnits] = useState<UnitMeasurement[]>([]);
  const [warrantyTiers, setWarrantyTiers] = useState<WarrantyTier[]>([]);
  const [groups, setGroups] = useState<QuoteGroup[]>([]);

  // Quote settings (for default placeholders)
  const [quoteSettings, setQuoteSettings] = useState<QuoteSettings | null>(null);

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading states
  const [loadingData, setLoadingData] = useState(true);

  // Load dropdown data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);

        // Use Promise.allSettled to load all data independently
        // This way, if one fails, others can still succeed
        const results = await Promise.allSettled([
          getUnitMeasurements(),
          getWarrantyTiers({ is_active: true }),
          getQuoteGroups(quoteId),
          getQuoteSettings(),
        ]);

        // Process units
        if (results[0].status === 'fulfilled') {
          const allUnits = results[0].value?.data || [];
          setUnits(allUnits);
        } else {
          console.error('Failed to load units:', results[0].reason);
          setUnits([]);
        }

        // Process warranty tiers
        if (results[1].status === 'fulfilled') {
          setWarrantyTiers(results[1].value || []);
        } else {
          console.error('Failed to load warranty tiers:', results[1].reason);
          setWarrantyTiers([]);
        }

        // Process groups
        if (results[2].status === 'fulfilled') {
          setGroups(results[2].value || []);
        } else {
          console.error('Failed to load groups:', results[2].reason);
          setGroups([]);
        }

        // Process settings
        if (results[3].status === 'fulfilled') {
          setQuoteSettings(results[3].value || null);
        } else {
          console.error('Failed to load quote settings:', results[3].reason);
          setQuoteSettings(null);
        }
      } catch (err: any) {
        console.error('Critical error loading form data:', err);
        setUnits([]);
        setWarrantyTiers([]);
        setGroups([]);
        setQuoteSettings(null);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [quoteId]);

  // Calculate totals
  const totalCostPerUnit =
    materialCost + laborCost + equipmentCost + subcontractCost + otherCost;
  const totalCost = totalCostPerUnit * parseFloat(quantity || '0');

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

    const qtyNum = parseFloat(quantity);
    if (!quantity || isNaN(qtyNum) || qtyNum <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
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
      quantity: parseFloat(quantity),
      unit_measurement_id: unitMeasurementId,
      material_cost_per_unit: materialCost,
      labor_cost_per_unit: laborCost,
      equipment_cost_per_unit: equipmentCost,
      subcontract_cost_per_unit: subcontractCost,
      other_cost_per_unit: otherCost,
      quote_group_id: groupId || undefined,
      warranty_tier_id: warrantyTierId || undefined,
      custom_profit_percent: customProfitPercent ? parseFloat(customProfitPercent) : null,
      custom_overhead_percent: customOverheadPercent ? parseFloat(customOverheadPercent) : null,
      custom_contingency_percent: customContingencyPercent ? parseFloat(customContingencyPercent) : null,
      // Discount: only one type (percentage OR amount) based on discountType
      custom_discount_percentage: discountType === 'percentage' && customDiscountPercentage ? parseFloat(customDiscountPercentage) : null,
      custom_discount_amount: discountType === 'amount' && customDiscountAmount ? customDiscountAmount : null,
    };

    try {
      await onSubmit(formData, isEdit ? undefined : saveToLibrary);
    } catch (err) {
      // Error handled by parent
    }
  };

  // Unit options
  const unitOptions = units.map((u) => ({
    value: u.id,
    label: `${u.name} (${u.abbreviation})`,
  }));

  // Warranty options
  const warrantyOptions = [
    { value: '', label: 'No Warranty' },
    ...warrantyTiers.map((w) => ({
      value: w.id,
      label: `${w.tier_name} (${w.duration_months} months) - ${w.price_type === 'percentage' ? `${w.price_value}%` : formatMoney(w.price_value)}`,
    })),
  ];

  // Group options
  const groupOptions = [
    { value: '', label: 'Ungrouped' },
    ...groups.map((g) => ({ value: g.id, label: g.name })),
  ];

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
            {isEdit ? 'Edit Item' : 'Add Item'}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              error={errors.quantity}
              placeholder="1"
              required
              disabled={loading || loadingData}
            />

            <Select
              label="Unit of Measurement"
              value={unitMeasurementId}
              onChange={setUnitMeasurementId}
              options={unitOptions}
              error={errors.unit_measurement_id}
              required
              disabled={loading || loadingData}
            />
          </div>
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

          {/* Calculated Totals */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Cost Per Unit
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatMoney(totalCostPerUnit)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Total Cost (Quantity × Cost Per Unit)
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatMoney(totalCost)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Additional Options */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Additional Options
        </h2>
        <div className="space-y-4">
          <Select
            label="Warranty Tier (Optional)"
            value={warrantyTierId}
            onChange={setWarrantyTierId}
            options={warrantyOptions}
            disabled={loading || loadingData}
          />

          <Select
            label="Group (Optional)"
            value={groupId}
            onChange={setGroupId}
            options={groupOptions}
            helperText="Assign this item to a group to organize your quote"
            disabled={loading || loadingData}
          />
        </div>
      </Card>

      {/* Custom Markup Percentages */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          Custom Markup Percentages (Optional)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Override the quote-level profit, overhead, and contingency percentages for this specific item. Leave blank to use quote defaults.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Custom Profit %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={customProfitPercent}
              onChange={(e) => setCustomProfitPercent(e.target.value)}
              placeholder={quoteSettings?.default_profit_margin?.toString() || 'Use quote default'}
              disabled={loading || loadingData}
              helperText="Leave empty to use default settings"
            />

            <Input
              label="Custom Overhead %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={customOverheadPercent}
              onChange={(e) => setCustomOverheadPercent(e.target.value)}
              placeholder={quoteSettings?.default_overhead_rate?.toString() || 'Use quote default'}
              disabled={loading || loadingData}
              helperText="Leave empty to use default settings"
            />

            <Input
              label="Custom Contingency %"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={customContingencyPercent}
              onChange={(e) => setCustomContingencyPercent(e.target.value)}
              placeholder={quoteSettings?.default_contingency_rate?.toString() || 'Use quote default'}
              disabled={loading || loadingData}
              helperText="Leave empty to use default settings"
            />
          </div>
        </div>
      </Card>

      {/* Item Discount */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
          Item Discount (Optional)
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Apply a custom discount to this specific item. Discount can be either a percentage OR a fixed amount (not both).
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Discount Type Selector */}
            <Select
              label="Discount Type"
              value={discountType}
              onChange={(value) => {
                const newType = value as 'percentage' | 'amount' | 'none';
                setDiscountType(newType);
                // Reset values when switching types
                if (newType === 'percentage') {
                  setCustomDiscountAmount(0); // Reset amount
                } else if (newType === 'amount') {
                  setCustomDiscountPercentage(''); // Reset percentage
                } else {
                  // none - reset both
                  setCustomDiscountPercentage('');
                  setCustomDiscountAmount(0);
                }
              }}
              options={[
                { value: 'none', label: 'No Discount' },
                { value: 'percentage', label: 'Percentage (%)' },
                { value: 'amount', label: 'Fixed Amount ($)' },
              ]}
              disabled={loading || loadingData}
              helperText="Choose discount type"
            />

            {/* Conditional Discount Input */}
            {discountType === 'percentage' && (
              <Input
                label="Discount %"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={customDiscountPercentage}
                onChange={(e) => setCustomDiscountPercentage(e.target.value)}
                placeholder="0"
                disabled={loading || loadingData}
                helperText="Discount percentage"
              />
            )}

            {discountType === 'amount' && (
              <MoneyInput
                label="Discount Amount"
                value={customDiscountAmount}
                onChange={setCustomDiscountAmount}
                placeholder="$0.00"
                disabled={loading || loadingData}
                helperText="Fixed discount amount"
              />
            )}
          </div>
        </div>
      </Card>

      {/* Save to Library */}
      {!isEdit && (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Save to Library
          </h2>
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <input
              type="checkbox"
              id="saveToLibrary"
              checked={saveToLibrary}
              onChange={(e) => setSaveToLibrary(e.target.checked)}
              disabled={loading || loadingData}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label
              htmlFor="saveToLibrary"
              className="text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              Save this item to my library for future quotes
            </label>
          </div>
        </Card>
      )}
    </form>
  );
}
