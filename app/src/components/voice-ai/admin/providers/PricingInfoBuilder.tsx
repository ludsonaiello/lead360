'use client';

// ============================================================================
// PricingInfoBuilder Component
// ============================================================================
// Structured form for pricing information
// Outputs JSON object as string
// ============================================================================

import React, { useState, useEffect } from 'react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

interface PricingInfoBuilderProps {
  value: string; // JSON object as string
  onChange: (value: string) => void;
  error?: string;
}

interface PricingData {
  per_minute?: number;
  per_request?: number;
  per_character?: number;
  currency?: string;
  free_tier?: number;
  notes?: string;
}

/**
 * PricingInfoBuilder - Visual builder for pricing info
 */
export default function PricingInfoBuilder({
  value,
  onChange,
  error,
}: PricingInfoBuilderProps) {
  const [pricing, setPricing] = useState<PricingData>({
    currency: 'USD',
  });

  // Parse value on mount
  useEffect(() => {
    if (value && value.trim() !== '') {
      try {
        const parsed = JSON.parse(value);
        setPricing({ currency: 'USD', ...parsed });
      } catch {
        // Invalid JSON, keep default
      }
    }
  }, []);

  // Update parent when pricing changes
  const updateValue = (newPricing: PricingData) => {
    setPricing(newPricing);

    // Remove empty fields
    const cleaned = Object.fromEntries(
      Object.entries(newPricing).filter(([_, v]) => v !== '' && v !== undefined && v !== null)
    );

    if (Object.keys(cleaned).length === 0 || (Object.keys(cleaned).length === 1 && cleaned.currency === 'USD')) {
      onChange('');
    } else {
      onChange(JSON.stringify(cleaned));
    }
  };

  const handleFieldChange = (field: keyof PricingData, value: any) => {
    updateValue({ ...pricing, [field]: value });
  };

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Pricing Information
      </label>

      <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-4">
        {/* Currency */}
        <div className="w-32">
          <Select
            label="Currency"
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
              { value: 'GBP', label: 'GBP' },
              { value: 'BRL', label: 'BRL' },
            ]}
            value={pricing.currency || 'USD'}
            onChange={(val) => handleFieldChange('currency', val)}
          />
        </div>

        {/* Per Minute */}
        <Input
          type="number"
          step="0.0001"
          label="Per Minute"
          placeholder="0.0043"
          value={pricing.per_minute || ''}
          onChange={(e) =>
            handleFieldChange('per_minute', e.target.value ? parseFloat(e.target.value) : undefined)
          }
          helperText="Cost per minute of usage"
        />

        {/* Per Request */}
        <Input
          type="number"
          step="0.0001"
          label="Per Request"
          placeholder="0.002"
          value={pricing.per_request || ''}
          onChange={(e) =>
            handleFieldChange('per_request', e.target.value ? parseFloat(e.target.value) : undefined)
          }
          helperText="Cost per API request"
        />

        {/* Per Character */}
        <Input
          type="number"
          step="0.0000001"
          label="Per Character"
          placeholder="0.000015"
          value={pricing.per_character || ''}
          onChange={(e) =>
            handleFieldChange('per_character', e.target.value ? parseFloat(e.target.value) : undefined)
          }
          helperText="Cost per character processed"
        />

        {/* Free Tier */}
        <Input
          type="number"
          step="1"
          label="Free Tier (minutes/requests)"
          placeholder="60"
          value={pricing.free_tier || ''}
          onChange={(e) =>
            handleFieldChange('free_tier', e.target.value ? parseInt(e.target.value) : undefined)
          }
          helperText="Free tier limit (if applicable)"
        />

        {/* Notes */}
        <Input
          label="Notes"
          placeholder="Volume discounts available"
          value={pricing.notes || ''}
          onChange={(e) => handleFieldChange('notes', e.target.value || undefined)}
          helperText="Additional pricing notes"
        />
      </div>

      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Preview */}
      {value && (
        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
          {value}
        </div>
      )}
    </div>
  );
}
