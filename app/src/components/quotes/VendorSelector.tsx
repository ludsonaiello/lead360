/**
 * VendorSelector Component
 * Searchable dropdown to select vendor with default badge and quick actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectOption } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { getVendors } from '@/lib/api/vendors';
import type { VendorSummary } from '@/lib/types/quotes';

interface VendorSelectorProps {
  value?: string; // Vendor ID
  onChange: (vendorId: string | null, vendorData: VendorSummary | null) => void;
  error?: string;
  required?: boolean;
  className?: string;
  showDetails?: boolean; // Show vendor details below dropdown
}

export function VendorSelector({
  value,
  onChange,
  error,
  required = false,
  className = '',
  showDetails = false,
}: VendorSelectorProps) {
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<VendorSummary | null>(null);

  // Load vendors on mount
  useEffect(() => {
    loadVendors();
  }, []);

  // Load selected vendor data when value changes
  useEffect(() => {
    if (value) {
      const vendor = vendors.find((v) => v.id === value);
      if (vendor) {
        setSelectedVendor(vendor);
      }
    } else {
      setSelectedVendor(null);
    }
  }, [value, vendors]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await getVendors({ limit: 100 });
      setVendors(response.data);

      // Auto-select default vendor if no value set
      if (!value) {
        const defaultVendor = response.data.find((v) => v.is_default);
        if (defaultVendor) {
          handleVendorSelect(defaultVendor.id);
        }
      }
    } catch (err: any) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  const vendorOptions: SelectOption[] = vendors.map((vendor) => ({
    value: vendor.id,
    label: `${vendor.name}${vendor.is_default ? ' (Default)' : ''}`,
  }));

  const handleVendorSelect = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    if (vendor) {
      setSelectedVendor(vendor);
      onChange(vendorId, vendor);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="space-y-3">
        <Select
          label="Vendor"
          options={vendorOptions}
          value={value}
          onChange={handleVendorSelect}
          placeholder={loading ? 'Loading vendors...' : 'Select a vendor'}
          searchable
          required={required}
          error={error}
          disabled={loading}
        />

        {/* Selected Vendor Details */}
        {showDetails && selectedVendor && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {selectedVendor.name}
              </p>
              {selectedVendor.is_default && (
                <Badge variant="blue">Default</Badge>
              )}
            </div>
            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              <p className="flex items-center gap-2">
                <span className="font-medium">Email:</span>
                <span>{selectedVendor.email}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Phone:</span>
                <span>{selectedVendor.phone}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="font-medium">Quotes:</span>
                <span>{selectedVendor.quote_count}</span>
              </p>
            </div>
          </div>
        )}

        {/* No vendors available */}
        {!loading && vendors.length === 0 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              No vendors found. Please create a vendor first.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default VendorSelector;
