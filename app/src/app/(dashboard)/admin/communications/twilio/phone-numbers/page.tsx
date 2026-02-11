/**
 * Phone Number Management Page
 * Complete phone number inventory and operations management
 */

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Phone, Search, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PhoneNumberCard } from '@/components/admin/twilio/PhoneNumberCard';
import { PurchasePhoneNumberModal } from '@/components/admin/twilio/PurchasePhoneNumberModal';
import { AllocatePhoneNumberModal } from '@/components/admin/twilio/AllocatePhoneNumberModal';
import { DeallocatePhoneNumberModal } from '@/components/admin/twilio/DeallocatePhoneNumberModal';
import {
  getOwnedPhoneNumbersDetailed,
  purchasePhoneNumber,
  allocatePhoneNumber,
  deallocatePhoneNumber,
  releasePhoneNumber
} from '@/lib/api/twilio-admin';
import { getAllTenants } from '@/lib/api/admin';
import type {
  PhoneNumber,
  PurchasePhoneNumberDto,
  AllocatePhoneNumberDto,
  DeallocatePhoneNumberDto,
  Tenant
} from '@/lib/types/twilio-admin';

export default function PhoneNumberManagementPage() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [filteredNumbers, setFilteredNumbers] = useState<PhoneNumber[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [allocatedCount, setAllocatedCount] = useState(0);
  const [availableCount, setAvailableCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [tenantFilter, setTenantFilter] = useState<string>('');

  // Modals
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [deallocateModalOpen, setDeallocateModalOpen] = useState(false);
  const [releaseConfirmOpen, setReleaseConfirmOpen] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<PhoneNumber | null>(null);

  // Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, tenantFilter, phoneNumbers]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [numbersData, tenantsData] = await Promise.all([
        getOwnedPhoneNumbersDetailed(),
        getAllTenants({ limit: 1000 }) // Get all tenants for the dropdown
      ]);

      setPhoneNumbers(numbersData.phone_numbers);
      setTotalCount(numbersData.total_count);
      setAllocatedCount(numbersData.allocated_count);
      setAvailableCount(numbersData.available_count);

      // Map tenant data to the format expected by the component
      const tenantsList: Tenant[] = tenantsData.data.map(tenant => ({
        id: tenant.id,
        company_name: tenant.company_name,
        subdomain: tenant.subdomain
      }));
      setTenants(tenantsList);
    } catch (error: any) {
      console.error('[PhoneNumbers] Error loading data:', error);
      setErrorMessage(error?.message || 'Failed to load phone numbers');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...phoneNumbers];

    // Search filter (phone number or friendly name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (num) =>
          num.phone_number.toLowerCase().includes(query) ||
          num.friendly_name.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((num) => num.status === statusFilter);
    }

    // Tenant filter
    if (tenantFilter) {
      filtered = filtered.filter((num) => num.allocated_to_tenant?.id === tenantFilter);
    }

    setFilteredNumbers(filtered);
  };

  const handlePurchase = async (dto: PurchasePhoneNumberDto) => {
    try {
      const result = await purchasePhoneNumber(dto);
      setSuccessMessage(result.message || 'Phone number purchased successfully');
      await loadData();
    } catch (error: any) {
      throw error;
    }
  };

  const handleAllocate = async (sid: string, dto: AllocatePhoneNumberDto) => {
    try {
      const result = await allocatePhoneNumber(sid, dto);
      setSuccessMessage(result.message || 'Phone number allocated successfully');
      await loadData();
    } catch (error: any) {
      throw error;
    }
  };

  const handleDeallocate = async (sid: string, dto: DeallocatePhoneNumberDto) => {
    try {
      const result = await deallocatePhoneNumber(sid, dto);
      setSuccessMessage(result.message || 'Phone number deallocated successfully');
      await loadData();
    } catch (error: any) {
      throw error;
    }
  };

  const handleRelease = async () => {
    if (!selectedNumber) return;

    try {
      const result = await releasePhoneNumber(selectedNumber.sid);
      setSuccessMessage(result.message || 'Phone number released successfully');
      setReleaseConfirmOpen(false);
      setSelectedNumber(null);
      await loadData();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to release phone number');
      setReleaseConfirmOpen(false);
    }
  };

  const handleOpenAllocateModal = (sid: string) => {
    const number = phoneNumbers.find((n) => n.sid === sid);
    if (number) {
      setSelectedNumber(number);
      setAllocateModalOpen(true);
    }
  };

  const handleOpenDeallocateModal = (sid: string) => {
    const number = phoneNumbers.find((n) => n.sid === sid);
    if (number) {
      setSelectedNumber(number);
      setDeallocateModalOpen(true);
    }
  };

  const handleOpenReleaseConfirm = (sid: string) => {
    const number = phoneNumbers.find((n) => n.sid === sid);
    if (number) {
      setSelectedNumber(number);
      setReleaseConfirmOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
          <Link href="/admin/communications/twilio" className="hover:text-gray-700 dark:hover:text-gray-300">
            Twilio Admin
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100">Phone Numbers</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Phone Number Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage phone number inventory and tenant allocations
              </p>
            </div>
          </div>
          <Button onClick={() => setPurchaseModalOpen(true)} variant="primary">
            <Plus className="h-4 w-4 mr-2" />
            Purchase Number
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Total Numbers
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
            {totalCount}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Allocated
          </p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
            {allocatedCount}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Available
          </p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
            {availableCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by number..."
                className="pl-10"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <Select
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'allocated', label: 'Allocated' },
                { value: 'available', label: 'Available' }
              ]}
              className="w-full"
            />
          </div>

          {/* Tenant Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tenant
            </label>
            <Select
              value={tenantFilter}
              onChange={(value) => setTenantFilter(value)}
              options={[
                { value: '', label: 'All Tenants' },
                ...tenants.map((tenant) => ({
                  value: tenant.id,
                  label: tenant.company_name
                }))
              ]}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Phone Numbers Grid */}
      <div>
        {filteredNumbers.length === 0 ? (
          <div className="text-center p-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400">
              No phone numbers found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredNumbers.map((number) => (
              <PhoneNumberCard
                key={number.sid}
                number={number}
                onAllocate={handleOpenAllocateModal}
                onDeallocate={handleOpenDeallocateModal}
                onRelease={handleOpenReleaseConfirm}
              />
            ))}
          </div>
        )}
      </div>

      {/* Purchase Modal */}
      <PurchasePhoneNumberModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        onPurchase={handlePurchase}
        tenants={tenants}
      />

      {/* Allocate Modal */}
      <AllocatePhoneNumberModal
        open={allocateModalOpen}
        onClose={() => {
          setAllocateModalOpen(false);
          setSelectedNumber(null);
        }}
        phoneNumber={selectedNumber}
        tenants={tenants}
        onAllocate={handleAllocate}
      />

      {/* Deallocate Modal */}
      <DeallocatePhoneNumberModal
        open={deallocateModalOpen}
        onClose={() => {
          setDeallocateModalOpen(false);
          setSelectedNumber(null);
        }}
        phoneNumber={selectedNumber}
        onDeallocate={handleDeallocate}
      />

      {/* Release Confirm Modal */}
      <ConfirmModal
        isOpen={releaseConfirmOpen}
        onClose={() => {
          setReleaseConfirmOpen(false);
          setSelectedNumber(null);
        }}
        onConfirm={handleRelease}
        title="Release Phone Number"
        message={`Are you sure you want to release ${selectedNumber?.friendly_name}? This action cannot be undone and the number will be returned to Twilio.`}
        confirmText="Release Number"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Success"
        message={successMessage || ''}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </div>
  );
}
