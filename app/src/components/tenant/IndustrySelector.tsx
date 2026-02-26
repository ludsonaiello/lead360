/**
 * IndustrySelector Component
 * Multi-select for assigning industries to tenant
 * Fetches available industries from API
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { tenantApi } from '@/lib/api/tenant';
import { Industry } from '@/lib/types/tenant';
import { MultiSelect, MultiSelectOption } from '@/components/ui/MultiSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface IndustrySelectorProps {
  value: string[]; // Array of industry IDs
  onChange: (industryIds: string[]) => void;
  error?: string;
  required?: boolean;
}

export function IndustrySelector({ value, onChange, error, required }: IndustrySelectorProps) {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAvailableIndustries(true); // Only active
      setIndustries(data);
    } catch (error: any) {
      console.error('Failed to load industries:', error);
      toast.error(error?.response?.data?.message || 'Failed to load industries');
    } finally {
      setIsLoading(false);
    }
  };

  const industryOptions: MultiSelectOption[] = industries.map((industry) => ({
    value: industry.id,
    label: industry.name,
    disabled: !industry.is_active,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading industries...</span>
      </div>
    );
  }

  return (
    <MultiSelect
      label="Industries"
      options={industryOptions}
      value={value}
      onChange={onChange}
      placeholder="Select industries your business operates in"
      searchable
      required={required}
      error={error}
      helperText="Select the industries your business operates in (e.g., General Contracting, Roofing, HVAC)"
    />
  );
}

export default IndustrySelector;
