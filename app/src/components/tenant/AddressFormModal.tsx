/**
 * AddressFormModal Component
 * Modal form for creating/editing addresses with Google Maps autocomplete
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { MapPin } from 'lucide-react';
import { addressSchema, type AddressFormData } from '@/lib/utils/validation';
import { sanitizeZipCode, sanitizeString } from '@/lib/utils/sanitize';
import { tenantApi } from '@/lib/api/tenant';
import { Address, CreateAddressData, UpdateAddressData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { MaskedInput } from '@/components/ui/MaskedInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';

interface AddressFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  address?: Address | null;
}

const addressTypeOptions: SelectOption[] = [
  { value: 'legal', label: 'Legal' },
  { value: 'billing', label: 'Billing' },
  { value: 'service', label: 'Service' },
  { value: 'mailing', label: 'Mailing' },
  { value: 'office', label: 'Office' },
];

const US_STATES: SelectOption[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export function AddressFormModal({ isOpen, onClose, onSuccess, address }: AddressFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [useManualEntry, setUseManualEntry] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address_type: address?.address_type || 'legal',
      line1: address?.line1 || '',
      line2: address?.line2 || '',
      city: address?.city || '',
      state: address?.state || '',
      zip_code: address?.zip_code || '',
      country: address?.country || 'USA',
      lat: address?.lat || null,
      long: address?.long || null,
      is_po_box: address?.is_po_box || false,
      is_default: address?.is_default || false,
    },
  });

  // Reset form when address changes
  useEffect(() => {
    if (address) {
      reset({
        address_type: address.address_type,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        country: address.country,
        lat: address.lat,
        long: address.long,
        is_po_box: address.is_po_box,
        is_default: address.is_default,
      });
    } else {
      reset({
        address_type: 'legal',
        line1: '',
        line2: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'USA',
        lat: null,
        long: null,
        is_po_box: false,
        is_default: false,
      });
    }
  }, [address, reset]);

  const handleAddressSelect = (addressData: any) => {
    setValue('line1', addressData.line1);
    setValue('city', addressData.city);
    setValue('state', addressData.state);
    setValue('zip_code', addressData.zip_code);
    if (addressData.lat) setValue('lat', addressData.lat);
    if (addressData.long) setValue('long', addressData.long);
  };

  const onSubmit = async (data: AddressFormData) => {
    try {
      setIsSubmitting(true);

      console.log('📤 Address Form - Submitting data:', data);

      if (address) {
        // Update existing address
        const updateData: UpdateAddressData = {
          address_type: data.address_type,
          line1: sanitizeString(data.line1)!,
          line2: sanitizeString(data.line2) || null,
          city: sanitizeString(data.city)!,
          state: data.state,
          zip_code: sanitizeZipCode(data.zip_code)!,
          lat: data.lat || null,
          long: data.long || null,
          is_po_box: data.is_po_box,
          is_default: data.is_default,
        };
        console.log('📤 Address Form - Update payload:', updateData);
        await tenantApi.updateAddress(address.id, updateData);
        toast.success('Address updated successfully');
      } else {
        // Create new address
        const createData: CreateAddressData = {
          address_type: data.address_type,
          line1: sanitizeString(data.line1)!,
          line2: sanitizeString(data.line2) || undefined,
          city: sanitizeString(data.city)!,
          state: data.state,
          zip_code: sanitizeZipCode(data.zip_code)!,
          country: data.country,
          lat: data.lat || undefined,
          long: data.long || undefined,
          is_po_box: data.is_po_box,
          is_default: data.is_default,
        };
        console.log('📤 Address Form - Create payload:', createData);
        await tenantApi.createAddress(createData);
        toast.success('Address created successfully');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addressType = watch('address_type');
  const isPOBox = watch('is_po_box') ?? false;
  const isDefault = watch('is_default') ?? false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <MapPin className="w-5 h-5" />
          {address ? 'Edit Address' : 'Add Address'}
        </>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            {/* Address Type */}
            <Select
              label="Address Type"
              options={addressTypeOptions}
              value={addressType}
              onChange={(value) => setValue('address_type', value as any)}
              error={errors.address_type?.message}
              required
            />

            {/* Google Maps Autocomplete or Manual Entry */}
            {!useManualEntry ? (
              <div>
                <AddressAutocomplete
                  label="Search Address"
                  onSelect={handleAddressSelect}
                  helperText="Start typing to search for an address"
                  defaultValue={address ? `${address.line1}, ${address.city}, ${address.state} ${address.zip_code}` : ''}
                />
                <button
                  type="button"
                  onClick={() => setUseManualEntry(true)}
                  className="mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Enter address manually instead
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setUseManualEntry(false)}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ← Use address autocomplete instead
                </button>
                {/* Manual entry fields */}
                <Input
                  {...register('line1')}
                  label="Address Line 1"
                  error={errors.line1?.message}
                  placeholder="Street address"
                  required
                />

                <Input
                  {...register('line2')}
                  label="Address Line 2"
                  error={errors.line2?.message}
                  placeholder="Apt, Suite, Unit, etc. (optional)"
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('city')}
                    label="City"
                    error={errors.city?.message}
                    required
                  />

                  <Select
                    label="State"
                    options={US_STATES}
                    value={watch('state')}
                    onChange={(value) => setValue('state', value)}
                    error={errors.state?.message}
                    searchable
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <MaskedInput
                    {...register('zip_code')}
                    label="ZIP Code"
                    mask="99999-9999"
                    maskChar={null}
                    placeholder="XXXXX or XXXXX-XXXX"
                    error={errors.zip_code?.message}
                    required
                  />

                  <Input
                    {...register('country')}
                    label="Country"
                    error={errors.country?.message}
                    disabled
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    {...register('lat', { valueAsNumber: true })}
                    type="number"
                    label="Latitude"
                    error={errors.lat?.message}
                    step="any"
                    placeholder="Optional"
                  />

                  <Input
                    {...register('long', { valueAsNumber: true })}
                    type="number"
                    label="Longitude"
                    error={errors.long?.message}
                    step="any"
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {/* Toggle Switches */}
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <ToggleSwitch
                label="This is a PO Box"
                enabled={isPOBox}
                onChange={(enabled) => setValue('is_po_box', enabled)}
              />

              {addressType === 'legal' && isPOBox && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  Legal addresses cannot be PO Boxes
                </p>
              )}

              <ToggleSwitch
                label="Set as default address for this type"
                enabled={isDefault}
                onChange={(enabled) => setValue('is_default', enabled, { shouldValidate: true })}
              />
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : address ? 'Update Address' : 'Add Address'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default AddressFormModal;
