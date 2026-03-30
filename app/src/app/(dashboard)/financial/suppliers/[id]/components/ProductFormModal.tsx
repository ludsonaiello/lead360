/**
 * ProductFormModal — Create / Edit Supplier Product
 * Sprint 7 — Financial Frontend
 *
 * Fields: Name, Description, Unit of Measure (combobox), Unit Price (4 decimals), SKU
 * Validation: name required (1-200), unit_of_measure required (1-50), sku max 100
 * Price change note shown in edit mode.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Combobox, ComboboxInput, ComboboxButton, ComboboxOptions, ComboboxOption } from '@headlessui/react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { DollarSign, Info, ChevronDown, Check, Ruler } from 'lucide-react';
import toast from 'react-hot-toast';
import { createSupplierProduct, updateSupplierProduct } from '@/lib/api/financial';
import type { SupplierProduct, CreateSupplierProductDto, UpdateSupplierProductDto } from '@/lib/types/financial';

// ========== UNIT OF MEASURE — Grouped Suggestions ==========

interface UnitGroup {
  label: string;
  units: string[];
}

const UNIT_GROUPS: UnitGroup[] = [
  {
    label: 'Count',
    units: ['each', 'pair', 'set', 'dozen', 'pack', 'case'],
  },
  {
    label: 'Weight',
    units: ['lb', 'oz', 'ton', 'kg'],
  },
  {
    label: 'Length',
    units: ['linear ft', 'inch', 'yard', 'meter'],
  },
  {
    label: 'Area',
    units: ['sq ft', 'sq yd', 'sq meter'],
  },
  {
    label: 'Volume',
    units: ['gallon', 'quart', 'liter', 'cu ft', 'cu yd'],
  },
  {
    label: 'Packaging',
    units: ['bag', 'box', 'roll', 'bundle', 'pallet', 'sack', 'tube', 'bucket', 'drum'],
  },
  {
    label: 'Other',
    units: ['sheet', 'panel', 'board', 'piece', 'slab', 'hour', 'day', 'load'],
  },
];

const ALL_UNITS = UNIT_GROUPS.flatMap((g) => g.units);

// ========== TYPES ==========

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplierId: string;
  product: SupplierProduct | null; // null = create mode
  existingNames: string[]; // for uniqueness check (lowercase)
}

interface FormErrors {
  name?: string;
  unit_of_measure?: string;
  unit_price?: string;
  sku?: string;
  general?: string;
}

// ========== API ERROR HELPER ==========
// The axios interceptor rejects with { status, message, error, data } — not an Error instance

function extractApiError(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; response?: { data?: { message?: string } } };
    // Structured error from our axios interceptor
    if (err.message && typeof err.message === 'string') return err.message;
    // Raw axios error (shouldn't happen, but defensive)
    if (err.response?.data?.message) return err.response.data.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

// ========== PRICE INPUT (4 decimal places) ==========

interface PriceInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

function PriceInput({
  label,
  value,
  onChange,
  error,
  helperText,
  disabled = false,
  required = false,
  id,
}: PriceInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    let formatted = parts[0];
    if (parts.length > 1) {
      formatted += '.' + parts.slice(1).join('').substring(0, 4);
    }
    onChange(formatted);
  };

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
        >
          {label}
          {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
          <DollarSign className="w-5 h-5" />
        </div>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          placeholder="0.0000"
          disabled={disabled}
          className={`
            w-full pl-11 pr-4 py-3 border-2 rounded-lg
            text-gray-900 dark:text-gray-100 font-medium
            bg-white dark:bg-gray-700
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            transition-all duration-200
            ${
              error
                ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            }
          `}
        />
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}

// ========== UNIT OF MEASURE COMBOBOX ==========

interface UnitComboboxProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function UnitCombobox({ value, onChange, error }: UnitComboboxProps) {
  const [query, setQuery] = useState('');

  // Filter suggestions based on typed query
  const filteredGroups = useMemo(() => {
    if (!query.trim()) return UNIT_GROUPS;
    const q = query.toLowerCase();
    return UNIT_GROUPS.map((group) => ({
      ...group,
      units: group.units.filter((u) => u.toLowerCase().includes(q)),
    })).filter((group) => group.units.length > 0);
  }, [query]);

  const showCustomOption =
    query.trim() !== '' && !ALL_UNITS.some((u) => u.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="w-full">
      <label htmlFor="product-uom" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Unit of Measure
        <span className="text-red-500 dark:text-red-400 ml-1">*</span>
      </label>

      <Combobox value={value} onChange={onChange} immediate>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none z-10">
            <Ruler className="w-4 h-4" />
          </div>
          <ComboboxInput
            id="product-uom"
            className={`
              w-full pl-10 pr-10 py-3 border-2 rounded-lg
              text-gray-900 dark:text-gray-100 font-medium
              bg-white dark:bg-gray-700
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              transition-all duration-200
              ${
                error
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }
            `}
            displayValue={(val: string) => val}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="Type or select a unit..."
          />
          <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3">
            <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
          </ComboboxButton>

          <ComboboxOptions
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
          >
            {/* Custom entry option when user types something not in the list */}
            {showCustomOption && (
              <ComboboxOption
                value={query.trim()}
                className={({ focus }) =>
                  `relative cursor-pointer select-none py-2.5 pl-10 pr-4 text-sm ${
                    focus
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-gray-100'
                  }`
                }
              >
                {({ selected }) => (
                  <>
                    <span className="block truncate font-medium">
                      Use &ldquo;{query.trim()}&rdquo;
                    </span>
                    {selected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </span>
                    )}
                  </>
                )}
              </ComboboxOption>
            )}

            {/* Grouped suggestions */}
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 sticky top-0">
                  {group.label}
                </div>
                {group.units.map((unit) => (
                  <ComboboxOption
                    key={unit}
                    value={unit}
                    className={({ focus }) =>
                      `relative cursor-pointer select-none py-2.5 pl-10 pr-4 text-sm ${
                        focus
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-gray-100'
                      }`
                    }
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-semibold' : 'font-medium'}`}>
                          {unit}
                        </span>
                        {selected && (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600 dark:text-blue-400">
                            <Check className="h-4 w-4" aria-hidden="true" />
                          </span>
                        )}
                      </>
                    )}
                  </ComboboxOption>
                ))}
              </div>
            ))}

            {filteredGroups.length === 0 && !showCustomOption && (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                No matching units
              </div>
            )}
          </ComboboxOptions>
        </div>
      </Combobox>

      {error && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

// ========== MAIN MODAL ==========

export default function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  supplierId,
  product,
  existingNames,
}: ProductFormModalProps) {
  const isEdit = product !== null;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [sku, setSku] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Track if price changed (for edit mode note)
  const originalPrice = product?.unit_price ?? '';

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (product) {
        setName(product.name);
        setDescription(product.description ?? '');
        setUnitOfMeasure(product.unit_of_measure);
        const price = parseFloat(product.unit_price);
        setUnitPrice(isNaN(price) ? '' : price.toString());
        setSku(product.sku ?? '');
        setIsActive(product.is_active);
      } else {
        setName('');
        setDescription('');
        setUnitOfMeasure('');
        setUnitPrice('');
        setSku('');
        setIsActive(true);
      }
      setErrors({});
    }
  }, [isOpen, product]);

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = 'Product name is required';
    } else if (trimmedName.length > 200) {
      newErrors.name = 'Product name must be 200 characters or less';
    } else {
      const lowerName = trimmedName.toLowerCase();
      const isDuplicate = existingNames.some(
        (existing) =>
          existing === lowerName &&
          (!isEdit || product!.name.toLowerCase() !== lowerName)
      );
      if (isDuplicate) {
        newErrors.name = 'A product with this name already exists for this supplier';
      }
    }

    const trimmedUnit = unitOfMeasure.trim();
    if (!trimmedUnit) {
      newErrors.unit_of_measure = 'Unit of measure is required';
    } else if (trimmedUnit.length > 50) {
      newErrors.unit_of_measure = 'Unit of measure must be 50 characters or less';
    }

    if (unitPrice) {
      const priceNum = parseFloat(unitPrice);
      if (isNaN(priceNum) || priceNum < 0) {
        newErrors.unit_price = 'Price must be 0 or greater';
      }
    }

    if (sku.trim().length > 100) {
      newErrors.sku = 'SKU must be 100 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, unitOfMeasure, unitPrice, sku, existingNames, isEdit, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setErrors((prev) => ({ ...prev, general: undefined }));

    try {
      if (isEdit) {
        const dto: UpdateSupplierProductDto = {};
        if (name.trim() !== product!.name) dto.name = name.trim();
        if (description.trim() !== (product!.description ?? '')) dto.description = description.trim();
        if (unitOfMeasure.trim() !== product!.unit_of_measure) dto.unit_of_measure = unitOfMeasure.trim();
        if (sku.trim() !== (product!.sku ?? '')) dto.sku = sku.trim();

        const newPriceNum = unitPrice ? parseFloat(unitPrice) : undefined;
        const oldPriceNum = parseFloat(product!.unit_price);
        if (newPriceNum !== undefined && newPriceNum !== oldPriceNum) {
          dto.unit_price = newPriceNum;
        }

        // Active status toggle
        if (isActive !== product!.is_active) {
          dto.is_active = isActive;
        }

        if (Object.keys(dto).length === 0) {
          toast('No changes detected', { icon: '\u2139\uFE0F' });
          setSaving(false);
          return;
        }

        await updateSupplierProduct(supplierId, product!.id, dto);
        toast.success('Product updated');
      } else {
        const dto: CreateSupplierProductDto = {
          name: name.trim(),
          unit_of_measure: unitOfMeasure.trim(),
        };
        if (description.trim()) dto.description = description.trim();
        if (unitPrice) dto.unit_price = parseFloat(unitPrice);
        if (sku.trim()) dto.sku = sku.trim();

        await createSupplierProduct(supplierId, dto);
        toast.success('Product created');
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const message = extractApiError(error, `Failed to ${isEdit ? 'update' : 'create'} product`);

      // Route specific errors to their fields, everything else to general error
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('name') && (lowerMessage.includes('already exists') || lowerMessage.includes('duplicate') || lowerMessage.includes('unique'))) {
        setErrors((prev) => ({ ...prev, name: message }));
      } else if (lowerMessage.includes('already exists') || lowerMessage.includes('conflict')) {
        // Product exists but might be deactivated — show in general error area
        setErrors((prev) => ({ ...prev, general: message }));
      } else {
        setErrors((prev) => ({ ...prev, general: message }));
      }
    } finally {
      setSaving(false);
    }
  };

  // Detect if price is being changed in edit mode
  const priceChanged =
    isEdit &&
    unitPrice !== '' &&
    parseFloat(unitPrice) !== parseFloat(originalPrice) &&
    !isNaN(parseFloat(unitPrice));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Product' : 'Add Product'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* General error banner */}
        {errors.general && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <Info className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300">{errors.general}</p>
          </div>
        )}

        {/* Name */}
        <Input
          id="product-name"
          label="Product Name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            if (errors.general) setErrors((prev) => ({ ...prev, general: undefined }));
          }}
          error={errors.name}
          required
          placeholder="e.g., 2x4 Lumber 8ft"
          maxLength={200}
        />

        {/* Description */}
        <Textarea
          id="product-description"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description of this product"
          rows={3}
          resize="vertical"
        />

        {/* Unit of Measure — Combobox with grouped suggestions */}
        <UnitCombobox
          value={unitOfMeasure}
          onChange={(val) => {
            setUnitOfMeasure(val);
            if (errors.unit_of_measure)
              setErrors((prev) => ({ ...prev, unit_of_measure: undefined }));
          }}
          error={errors.unit_of_measure}
        />

        {/* Unit Price (4 decimal places) */}
        <PriceInput
          id="product-price"
          label="Unit Price"
          value={unitPrice}
          onChange={(val) => {
            setUnitPrice(val);
            if (errors.unit_price) setErrors((prev) => ({ ...prev, unit_price: undefined }));
          }}
          error={errors.unit_price}
          helperText="Supports up to 4 decimal places"
        />

        {/* Price change note in edit mode */}
        {priceChanged && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Changing the price will create a price history record.
            </p>
          </div>
        )}

        {/* SKU */}
        <Input
          id="product-sku"
          label="SKU"
          value={sku}
          onChange={(e) => {
            setSku(e.target.value);
            if (errors.sku) setErrors((prev) => ({ ...prev, sku: undefined }));
          }}
          error={errors.sku}
          placeholder="e.g., LBR-2x4-8"
          maxLength={100}
          helperText="Optional part number or SKU"
        />

        {/* Active status toggle — edit mode only */}
        {isEdit && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <ToggleSwitch
              enabled={isActive}
              onChange={setIsActive}
              label="Active"
              description={isActive ? 'Product is visible in active lists' : 'Product is hidden from active lists'}
            />
          </div>
        )}

        <ModalActions>
          <Button variant="ghost" onClick={onClose} type="button" disabled={saving} size="sm">
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving} size="sm">
            {isEdit ? 'Update Product' : 'Add Product'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
