/**
 * Admin Files Page
 * Platform Admin file gallery - view all files across all tenants
 */

'use client';

import React, { useState } from 'react';
import { FileGallery } from '@/components/files/FileGallery';
import { Select } from '@/components/ui/Select';
import type { FileFilters } from '@/lib/types/files';

export default function AdminFilesPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Build filters including tenant if admin
  const filters: Partial<FileFilters> = {
    ...(selectedTenantId && { entity_id: selectedTenantId }),
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Files</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View and manage files across all tenants
            </p>
          </div>

          {/* Tenant Filter */}
          <div className="w-64">
            <Select
              label=""
              value={selectedTenantId}
              onChange={(value) => setSelectedTenantId(value)}
              options={[
                { value: '', label: 'All Tenants' },
                // TODO: Load tenants dynamically from API
                // This is a placeholder - in production, fetch from /admin/tenants
              ]}
            />
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-hidden">
        <FileGallery
          initialFilters={filters}
          showFilters={true}
          showBulkActions={true}
          showUploadButton={false}
        />
      </div>
    </div>
  );
}
