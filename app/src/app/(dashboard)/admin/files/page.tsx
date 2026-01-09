/**
 * Admin Files Page
 * Platform Admin file gallery - view all files across all tenants
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Search } from 'lucide-react';
import { FileGallery, FileGalleryRef } from '@/components/files/FileGallery';
import {
  getAllTenants,
  TenantListItem,
  getAdminFiles,
  deleteAdminFile,
} from '@/lib/api/admin';
import { transformAdminFileToGalleryFile } from '@/lib/utils/file-transformers';
import type { FileFilters } from '@/lib/types/files';
import toast from 'react-hot-toast';

export default function AdminFilesPage() {
  const galleryRef = useRef<FileGalleryRef>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch tenants on mount
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      setIsLoadingTenants(true);
      const response = await getAllTenants({ limit: 1000 });
      setTenants(response.data);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
      toast.error(err.message || 'Failed to load tenants');
    } finally {
      setIsLoadingTenants(false);
    }
  };

  // Custom fetch function for FileGallery that calls admin endpoint
  const fetchAdminFiles = useCallback(
    async (filters: FileFilters) => {
      const response = await getAdminFiles({
        ...filters,
        tenant_id: selectedTenantId || undefined,
      });

      // Transform admin response to FileGallery format
      return {
        data: response.data.map(transformAdminFileToGalleryFile),
        pagination: {
          total: response.pagination.total,
          page: response.pagination.page,
          limit: response.pagination.limit,
          totalPages: response.pagination.total_pages, // Convert snake_case to camelCase
        },
      };
    },
    [selectedTenantId]
  );

  // Custom delete function for FileGallery that calls admin endpoint
  const deleteAdminFileWrapper = useCallback(async (fileId: string): Promise<void> => {
    await deleteAdminFile(fileId);
  }, []);

  // Filter tenants by search term
  const filteredTenants = tenants.filter((tenant) => {
    const search = searchTerm.toLowerCase();
    return (
      tenant.company_name.toLowerCase().includes(search) ||
      tenant.subdomain.toLowerCase().includes(search) ||
      (tenant.legal_business_name && tenant.legal_business_name.toLowerCase().includes(search))
    );
  });

  // Get selected tenant display name
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const selectedTenantDisplay = selectedTenant
    ? `${selectedTenant.company_name} (${selectedTenant.subdomain})`
    : 'All Tenants';

  const handleSelectTenant = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    setShowDropdown(false);
    setSearchTerm('');
    // Trigger FileGallery refresh
    if (galleryRef.current) {
      galleryRef.current.refresh();
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header with Tenant Filter */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Files</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              View and manage files across all tenants
            </p>
          </div>

          {/* Tenant Filter with Search */}
          <div className="w-80 relative">
            {isLoadingTenants ? (
              <div className="flex items-center justify-center py-2">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading tenants...</span>
              </div>
            ) : (
              <>
                {/* Search Input */}
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search tenants..."
                    value={showDropdown ? searchTerm : selectedTenantDisplay}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />

                  {/* Dropdown Results */}
                  {showDropdown && (
                    <>
                      {/* Backdrop to close dropdown */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => {
                          setShowDropdown(false);
                          setSearchTerm('');
                        }}
                      />

                      {/* Dropdown List */}
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-80 overflow-y-auto z-20">
                        {/* All Tenants Option */}
                        <button
                          type="button"
                          onClick={() => handleSelectTenant('')}
                          className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            selectedTenantId === ''
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <div className="font-medium">All Tenants</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            View files from all tenants
                          </div>
                        </button>

                        {/* Filtered Tenants */}
                        {filteredTenants.length > 0 ? (
                          filteredTenants.map((tenant) => (
                            <button
                              key={tenant.id}
                              type="button"
                              onClick={() => handleSelectTenant(tenant.id)}
                              className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                selectedTenantId === tenant.id
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                  : 'text-gray-900 dark:text-gray-100'
                              }`}
                            >
                              <div className="font-medium">{tenant.company_name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {tenant.subdomain}.lead360.app
                                {tenant.is_active ? (
                                  <span className="ml-2 text-green-600 dark:text-green-400">• Active</span>
                                ) : (
                                  <span className="ml-2 text-red-600 dark:text-red-400">• Inactive</span>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                            No tenants found matching &quot;{searchTerm}&quot;
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FileGallery Component */}
      <div className="flex-1 overflow-hidden">
        <FileGallery
          ref={galleryRef}
          showFilters={true}
          showBulkActions={false}
          showUploadButton={false}
          customFetchFiles={fetchAdminFiles}
          customDeleteFile={deleteAdminFileWrapper}
        />
      </div>
    </div>
  );
}
