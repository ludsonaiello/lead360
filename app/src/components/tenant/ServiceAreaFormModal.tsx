/**
 * ServiceAreaFormModal Component
 * Modal form for creating/editing service areas with dynamic fields based on type
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { serviceAreaSchema, type ServiceAreaFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { ServiceArea, CreateServiceAreaData, UpdateServiceAreaData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { MaskedInput } from '@/components/ui/MaskedInput';

interface ServiceAreaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  serviceArea?: ServiceArea | null;
}

const areaTypeOptions: SelectOption[] = [
  { value: 'city', label: 'City' },
  { value: 'zipcode', label: 'ZIP Code' },
  { value: 'radius', label: 'Radius (miles)' },
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

export function ServiceAreaFormModal({
  isOpen,
  onClose,
  onSuccess,
  serviceArea,
}: ServiceAreaFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ServiceAreaFormData>({
    resolver: zodResolver(serviceAreaSchema),
    defaultValues: {
      area_type: serviceArea?.area_type || 'city',
      city: serviceArea?.city || '',
      state: serviceArea?.state || '',
      zipcode: serviceArea?.zipcode || '',
      center_lat: serviceArea?.center_lat || null,
      center_long: serviceArea?.center_long || null,
      radius_miles: serviceArea?.radius_miles || null,
    },
  });

  // Reset form when serviceArea changes
  useEffect(() => {
    if (serviceArea) {
      reset({
        area_type: serviceArea.area_type,
        city: serviceArea.city || '',
        state: serviceArea.state || '',
        zipcode: serviceArea.zipcode || '',
        center_lat: serviceArea.center_lat,
        center_long: serviceArea.center_long,
        radius_miles: serviceArea.radius_miles,
      });
    } else {
      reset({
        area_type: 'city',
        city: '',
        state: '',
        zipcode: '',
        center_lat: null,
        center_long: null,
        radius_miles: null,
      });
    }
  }, [serviceArea, reset]);

  const onSubmit = async (data: ServiceAreaFormData) => {
    try {
      setIsSubmitting(true);

      if (serviceArea) {
        // Update existing service area
        const updateData: UpdateServiceAreaData = {
          area_type: data.area_type,
          city: data.area_type === 'city' ? data.city || null : null,
          state: data.area_type === 'city' ? data.state || null : null,
          zipcode: data.area_type === 'zipcode' ? data.zipcode || null : null,
          center_lat: data.area_type === 'radius' ? data.center_lat : null,
          center_long: data.area_type === 'radius' ? data.center_long : null,
          radius_miles: data.area_type === 'radius' ? data.radius_miles : null,
        };
        await tenantApi.updateServiceArea(serviceArea.id, updateData);
        toast.success('Service area updated successfully');
      } else {
        // Create new service area
        const createData: CreateServiceAreaData = {
          area_type: data.area_type,
          city: data.area_type === 'city' ? data.city || undefined : undefined,
          state: data.area_type === 'city' ? data.state || undefined : undefined,
          zipcode: data.area_type === 'zipcode' ? data.zipcode || undefined : undefined,
          center_lat: data.area_type === 'radius' ? data.center_lat || undefined : undefined,
          center_long: data.area_type === 'radius' ? data.center_long || undefined : undefined,
          radius_miles: data.area_type === 'radius' ? data.radius_miles || undefined : undefined,
        };
        await tenantApi.createServiceArea(createData);
        toast.success('Service area created successfully');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save service area');
    } finally {
      setIsSubmitting(false);
    }
  };

  const areaType = watch('area_type');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={serviceArea ? 'Edit Service Area' : 'Add Service Area'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            {/* Area Type */}
            <Select
              label="Area Type"
              options={areaTypeOptions}
              value={areaType}
              onChange={(value) => setValue('area_type', value as any)}
              error={errors.area_type?.message}
              required
            />

            {/* City Fields */}
            {areaType === 'city' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  {...register('city')}
                  label="City"
                  error={errors.city?.message}
                  placeholder="e.g., Los Angeles"
                  required
                />

                <Select
                  label="State"
                  options={US_STATES}
                  value={watch('state') || ''}
                  onChange={(value) => setValue('state', value)}
                  error={errors.state?.message}
                  searchable
                  required
                />
              </div>
            )}

            {/* ZIP Code Field */}
            {areaType === 'zipcode' && (
              <MaskedInput
                {...register('zipcode')}
                label="ZIP Code"
                mask="99999"
                maskChar={null}
                placeholder="XXXXX"
                error={errors.zipcode?.message}
                required
              />
            )}

            {/* Radius Fields */}
            {areaType === 'radius' && (
              <div className="space-y-6">
                <Input
                  {...register('radius_miles', { valueAsNumber: true })}
                  type="number"
                  label="Radius (miles)"
                  error={errors.radius_miles?.message}
                  placeholder="e.g., 25"
                  min={1}
                  max={500}
                  required
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    {...register('center_lat', { valueAsNumber: true })}
                    type="number"
                    label="Center Latitude"
                    error={errors.center_lat?.message}
                    placeholder="e.g., 34.0522"
                    step="any"
                    required
                  />

                  <Input
                    {...register('center_long', { valueAsNumber: true })}
                    type="number"
                    label="Center Longitude"
                    error={errors.center_long?.message}
                    placeholder="e.g., -118.2437"
                    step="any"
                    required
                  />
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Tip: Use Google Maps to find latitude and longitude coordinates. Right-click on
                    a location and select &quot;What&apos;s here?&quot; to see coordinates.
                  </p>
                </div>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : serviceArea
              ? 'Update Service Area'
              : 'Add Service Area'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default ServiceAreaFormModal;
