/**
 * AddServiceRequestModal Component
 * Modal form to create a new service request with address selection/creation
 */

'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { Loader2, Plus, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface Address {
  id: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: string;
  longitude: string;
  address_type: string;
  is_primary: boolean;
}

interface AddServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ServiceRequestFormData) => Promise<void>;
  addresses: Address[];
}

export interface ServiceRequestFormData {
  addressId?: string; // Existing address
  newAddress?: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
    latitude: number;
    longitude: number;
    address_type: 'service' | 'billing' | 'mailing' | 'other';
  };
  service_name: string;
  service_type: string;
  service_description: string;
  requested_date?: string;
  urgency: 'low' | 'medium' | 'high' | 'emergency';
  estimated_value?: number;
  notes?: string;
}

export function AddServiceRequestModal({
  isOpen,
  onClose,
  onSubmit,
  addresses,
}: AddServiceRequestModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useNewAddress, setUseNewAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(addresses[0]?.id || '');
  const [newAddress, setNewAddress] = useState<any>(null);
  const [newAddressType, setNewAddressType] = useState<'service' | 'billing' | 'mailing' | 'other'>('service');

  // Form fields
  const [serviceName, setServiceName] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high' | 'emergency'>('medium');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!serviceName.trim()) {
      toast.error('Service name is required');
      return;
    }
    if (!serviceDescription.trim()) {
      toast.error('Service description is required');
      return;
    }
    if (!useNewAddress && !selectedAddressId) {
      toast.error('Please select an address');
      return;
    }
    if (useNewAddress && !newAddress) {
      toast.error('Please select an address from Google Maps');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: ServiceRequestFormData = {
        service_name: serviceName.trim(),
        service_type: serviceType.trim(),
        service_description: serviceDescription.trim(),
        urgency,
      };

      if (useNewAddress && newAddress) {
        data.newAddress = {
          address_line1: newAddress.line1,
          address_line2: newAddress.line2,
          city: newAddress.city,
          state: newAddress.state,
          zip_code: newAddress.zip_code,
          latitude: typeof newAddress.lat === 'string' ? parseFloat(newAddress.lat) : newAddress.lat,
          longitude: typeof newAddress.long === 'string' ? parseFloat(newAddress.long) : newAddress.long,
          address_type: newAddressType,
        };
      } else {
        data.addressId = selectedAddressId;
      }

      if (requestedDate) {
        data.requested_date = requestedDate;
      }
      if (estimatedValue) {
        data.estimated_value = parseFloat(estimatedValue);
      }
      if (notes.trim()) {
        data.notes = notes.trim();
      }

      await onSubmit(data);
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create service request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      // Reset form
      setServiceName('');
      setServiceType('');
      setServiceDescription('');
      setRequestedDate('');
      setUrgency('medium');
      setEstimatedValue('');
      setNotes('');
      setUseNewAddress(false);
      setNewAddress(null);
      setSelectedAddressId(addresses[0]?.id || '');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Service Request">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Service Address <span className="text-red-500">*</span>
          </label>

          {addresses.length > 0 && (
            <div className="mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!useNewAddress}
                  onChange={() => setUseNewAddress(false)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Use existing address</span>
              </label>
            </div>
          )}

          {!useNewAddress && addresses.length > 0 ? (
            <select
              value={selectedAddressId}
              onChange={(e) => setSelectedAddressId(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {addresses.map((addr) => (
                <option key={addr.id} value={addr.id}>
                  {addr.address_line1}, {addr.city}, {addr.state} {addr.zip_code}
                  {addr.is_primary ? ' (Primary)' : ''}
                </option>
              ))}
            </select>
          ) : null}

          <div className="mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={useNewAddress}
                onChange={() => setUseNewAddress(true)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Add new address</span>
            </label>
          </div>

          {useNewAddress && (
            <div className="mt-3 space-y-3">
              <AddressAutocomplete
                onSelect={(address) => setNewAddress(address)}
              />
              <select
                value={newAddressType}
                onChange={(e) => setNewAddressType(e.target.value as any)}
                className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="service">Service Address</option>
                <option value="billing">Billing Address</option>
                <option value="mailing">Mailing Address</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}
        </div>

        {/* Service Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Service Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            placeholder="e.g., Roof Repair"
            maxLength={100}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Service Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Service Type
          </label>
          <input
            type="text"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            placeholder="e.g., Roofing, HVAC, Plumbing"
            maxLength={100}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Service Description */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Service Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
            placeholder="Detailed description of the service needed..."
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Urgency and Requested Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Urgency
            </label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Requested Date
            </label>
            <input
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Estimated Value */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Estimated Value ($)
          </label>
          <input
            type="number"
            value={estimatedValue}
            onChange={(e) => setEstimatedValue(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            max="9999999.99"
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes or special instructions..."
            rows={2}
            maxLength={2000}
            className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Service Request
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
