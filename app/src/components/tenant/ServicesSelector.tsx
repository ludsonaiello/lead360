/**
 * ServicesSelector Component
 * Multi-select for assigning services to tenant
 * Fetches available services from API
 */

'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { tenantApi } from '@/lib/api/tenant';
import { Service } from '@/lib/types/tenant';
import { MultiSelect, MultiSelectOption } from '@/components/ui/MultiSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface ServicesSelectorProps {
  value: string[]; // Array of service IDs
  onChange: (serviceIds: string[]) => void;
  error?: string;
  required?: boolean;
}

export function ServicesSelector({ value, onChange, error, required }: ServicesSelectorProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getAllServices();
      setServices(data);
    } catch (error: any) {
      console.error('Failed to load services:', error);
      toast.error(error?.response?.data?.message || 'Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  const serviceOptions: MultiSelectOption[] = services.map((service) => ({
    value: service.id,
    label: service.name,
    disabled: !service.is_active,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size="sm" />
        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading services...</span>
      </div>
    );
  }

  return (
    <MultiSelect
      label="Services Offered"
      options={serviceOptions}
      value={value}
      onChange={onChange}
      placeholder="Select services your business offers"
      searchable
      required={required}
      error={error}
      helperText="Select all types of services your business provides (e.g., Roofing, Gutter, Plumbing)"
    />
  );
}

export default ServicesSelector;
