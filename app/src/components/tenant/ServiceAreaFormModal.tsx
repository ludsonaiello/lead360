/**
 * ServiceAreaFormModal Component
 * Modal form for creating/editing service areas with Google Maps integration
 * Supports city, zipcode, and radius-based service areas with automatic geocoding
 * All fields (city, state, zipcode, coordinates, radius) are populated for all types
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Map as MapIcon, AlertCircle, X } from 'lucide-react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { serviceAreaSchema, type ServiceAreaFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { ServiceArea, CreateServiceAreaData, UpdateServiceAreaData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import CityAutocomplete from '@/components/ui/CityAutocomplete';
import ZipCodeAutocomplete from '@/components/ui/ZipCodeAutocomplete';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface ServiceAreaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  serviceArea?: ServiceArea | null;
}

const areaTypeOptions: SelectOption[] = [
  { value: 'city', label: 'City' },
  { value: 'zipcode', label: 'ZIP Code' },
  { value: 'radius', label: 'Radius (miles from city)' },
  { value: 'state', label: 'Entire State' },
];

// US States list with geographic centers
const US_STATES = [
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

// Geographic centers of US states
const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  AL: { lat: 32.8067, lng: -86.7911 },
  AK: { lat: 61.3707, lng: -152.4044 },
  AZ: { lat: 33.7298, lng: -111.4312 },
  AR: { lat: 34.9697, lng: -92.3731 },
  CA: { lat: 36.1162, lng: -119.6816 },
  CO: { lat: 39.0598, lng: -105.3111 },
  CT: { lat: 41.5978, lng: -72.7554 },
  DE: { lat: 39.3185, lng: -75.5071 },
  FL: { lat: 27.7663, lng: -81.6868 },
  GA: { lat: 33.0406, lng: -83.6431 },
  HI: { lat: 21.0943, lng: -157.4983 },
  ID: { lat: 44.2405, lng: -114.4788 },
  IL: { lat: 40.3495, lng: -88.9861 },
  IN: { lat: 39.8494, lng: -86.2583 },
  IA: { lat: 42.0115, lng: -93.2105 },
  KS: { lat: 38.5266, lng: -96.7265 },
  KY: { lat: 37.6681, lng: -84.6701 },
  LA: { lat: 31.1695, lng: -91.8678 },
  ME: { lat: 44.6939, lng: -69.3819 },
  MD: { lat: 39.0639, lng: -76.8021 },
  MA: { lat: 42.2302, lng: -71.5301 },
  MI: { lat: 43.3266, lng: -84.5361 },
  MN: { lat: 45.6945, lng: -93.9002 },
  MS: { lat: 32.7416, lng: -89.6787 },
  MO: { lat: 38.4561, lng: -92.2884 },
  MT: { lat: 46.9219, lng: -110.4544 },
  NE: { lat: 41.1254, lng: -98.2681 },
  NV: { lat: 38.3135, lng: -117.0554 },
  NH: { lat: 43.4525, lng: -71.5639 },
  NJ: { lat: 40.2989, lng: -74.5210 },
  NM: { lat: 34.8405, lng: -106.2485 },
  NY: { lat: 42.1657, lng: -74.9481 },
  NC: { lat: 35.6301, lng: -79.8064 },
  ND: { lat: 47.5289, lng: -99.7840 },
  OH: { lat: 40.3888, lng: -82.7649 },
  OK: { lat: 35.5653, lng: -96.9289 },
  OR: { lat: 44.5720, lng: -122.0709 },
  PA: { lat: 40.5908, lng: -77.2098 },
  RI: { lat: 41.6809, lng: -71.5118 },
  SC: { lat: 33.8569, lng: -80.9450 },
  SD: { lat: 44.2998, lng: -99.4388 },
  TN: { lat: 35.7478, lng: -86.6923 },
  TX: { lat: 31.0545, lng: -97.5635 },
  UT: { lat: 40.1500, lng: -111.8624 },
  VT: { lat: 44.0459, lng: -72.7107 },
  VA: { lat: 37.7693, lng: -78.1700 },
  WA: { lat: 47.4009, lng: -121.4905 },
  WV: { lat: 38.4912, lng: -80.9545 },
  WI: { lat: 44.2685, lng: -89.6165 },
  WY: { lat: 42.7559, lng: -107.3025 },
};

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
};

const defaultCenter = {
  lat: 39.8283, // Center of USA
  lng: -98.5795,
};

export function ServiceAreaFormModal({
  isOpen,
  onClose,
  onSuccess,
  serviceArea,
}: ServiceAreaFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(4);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const circleRef = React.useRef<google.maps.Circle | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

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
      area_type: 'city',
      city: '',
      state: '',
      zipcode: '',
      center_lat: undefined,
      center_long: undefined,
      radius_miles: 10,
    },
  });

  // Reset form when serviceArea changes
  // NOTE: API returns { type, value, latitude, longitude } but form uses { area_type, city/zipcode, center_lat, center_long }
  useEffect(() => {
    setApiError(null);

    if (serviceArea) {
      // Transform API response format to form format
      const formData: any = {
        area_type: serviceArea.type as any, // API returns 'type', form expects 'area_type'
        city: '',
        state: serviceArea.state || '',
        zipcode: '',
        center_lat: serviceArea.latitude ? parseFloat(serviceArea.latitude) : undefined,
        center_long: serviceArea.longitude ? parseFloat(serviceArea.longitude) : undefined,
        radius_miles: serviceArea.radius_miles ? parseFloat(serviceArea.radius_miles) : 10,
      };

      // Parse 'value' field based on type
      if (serviceArea.type === 'city') {
        formData.city = serviceArea.value;
      } else if (serviceArea.type === 'zipcode') {
        formData.zipcode = serviceArea.value;
      } else if (serviceArea.type === 'radius') {
        // For radius: value = "City, State (X mile radius)"
        // Extract city from value field
        const match = serviceArea.value.match(/^(.+?),\s*([A-Z]{2})\s*\(/);
        if (match) {
          formData.city = match[1].trim();
          formData.state = match[2];
        }
      }

      reset(formData);

      // Update map center if coordinates exist
      if (serviceArea.latitude && serviceArea.longitude) {
        setMapCenter({
          lat: parseFloat(serviceArea.latitude),
          lng: parseFloat(serviceArea.longitude),
        });
        setMapZoom(10);
      }
    } else {
      reset({
        area_type: 'city',
        city: '',
        state: '',
        zipcode: '',
        center_lat: undefined,
        center_long: undefined,
        radius_miles: 10,
      });
      setMapCenter(defaultCenter);
      setMapZoom(4);
    }
  }, [serviceArea, reset]);

  // Watch form values
  const areaType = watch('area_type');
  const centerLat = watch('center_lat');
  const centerLng = watch('center_long');
  const radiusMiles = watch('radius_miles') || 10;

  // Convert miles to meters for Google Maps Circle
  const radiusMeters = radiusMiles * 1609.34;

  // Update map when coordinates change
  useEffect(() => {
    if (centerLat && centerLng) {
      setMapCenter({ lat: centerLat, lng: centerLng });
      setMapZoom(10);
    }
  }, [centerLat, centerLng]);

  // Manage radius circle imperatively to avoid multiple circles
  useEffect(() => {
    if (!mapInstance) return;

    // Clean up existing circle
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    // Only create circle for radius area type
    if (areaType === 'radius' && centerLat && centerLng) {
      const circle = new google.maps.Circle({
        map: mapInstance,
        center: { lat: centerLat, lng: centerLng },
        radius: radiusMeters,
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });

      circleRef.current = circle;
    }

    // Cleanup on unmount or area type change
    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [mapInstance, areaType, centerLat, centerLng, radiusMeters]);

  const handleCitySelect = async (locationData: any) => {
    setValue('city', locationData.city);
    setValue('state', locationData.state);
    setValue('center_lat', locationData.lat);
    setValue('center_long', locationData.lng);

    setMapCenter({ lat: locationData.lat, lng: locationData.lng });
    setMapZoom(12);

    // If zipcode is not provided, do a reverse geocode to get it
    if (!locationData.zipcode) {
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({
          location: { lat: locationData.lat, lng: locationData.lng },
        });

        if (result.results && result.results.length > 0) {
          // Find the postal code from the first result
          const postalCodeComponent = result.results[0].address_components?.find((component) =>
            component.types.includes('postal_code')
          );

          if (postalCodeComponent) {
            setValue('zipcode', postalCodeComponent.long_name);
          } else {
            console.warn('No ZIP code found for selected city');
            setValue('zipcode', '');
          }
        }
      } catch (error) {
        console.error('Failed to reverse geocode for ZIP code:', error);
        setValue('zipcode', '');
      }
    } else {
      setValue('zipcode', locationData.zipcode);
    }
  };

  const handleZipCodeSelect = (locationData: any) => {
    setValue('city', locationData.city);
    setValue('state', locationData.state);
    setValue('zipcode', locationData.zipcode);
    setValue('center_lat', locationData.lat);
    setValue('center_long', locationData.lng);

    setMapCenter({ lat: locationData.lat, lng: locationData.lng });
    setMapZoom(13);
  };

  const onSubmit = async (data: ServiceAreaFormData) => {
    console.log('Form submitted with data:', data);

    try {
      setIsSubmitting(true);
      setApiError(null);

      // Build data to send to backend
      // Backend DTO only accepts: area_type, city, state, zipcode, center_lat, center_long, radius_miles
      // Backend automatically calculates: city_name, entire_state, zipcode (database fields)
      const commonData = {
        area_type: data.area_type,
        city: data.city || null,
        state: data.state || null,
        zipcode: data.zipcode || null,
        center_lat: data.center_lat,
        center_long: data.center_long,
        radius_miles: data.radius_miles,
      };

      if (serviceArea) {
        // Update existing service area
        await tenantApi.updateServiceArea(serviceArea.id, commonData as UpdateServiceAreaData);
        toast.success('Service area updated successfully');
      } else {
        // Create new service area
        await tenantApi.createServiceArea(commonData as CreateServiceAreaData);
        toast.success('Service area created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Service area save error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save service area';
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Error" size="xl">
        <ModalContent>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">
                Failed to load Google Maps. Please check your API key.
              </p>
            </div>
          </div>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <>
          <MapIcon className="w-5 h-5" />
          {serviceArea ? 'Edit Service Area' : 'Add Service Area'}
        </>
      }
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            {/* Validation Errors Display */}
            {Object.keys(errors).length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                      Please fix the following errors:
                    </p>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside space-y-1">
                      {Object.entries(errors).map(([field, error]) => (
                        <li key={field}>
                          <strong className="capitalize">{field.replace(/_/g, ' ')}:</strong> {error?.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Help Text */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-300">
                <strong>How to add a service area:</strong>
                <br />
                1. Choose your service area type below
                <br />
                2. Use the autocomplete to select a {areaType === 'zipcode' ? 'ZIP code' : 'city'} - this will auto-fill all location details
                <br />
                {areaType === 'radius' && '3. Adjust the radius slider to set your coverage area'}
                {areaType !== 'radius' && '3. Review the map preview and click "Add Service Area"'}
              </p>
            </div>

            {/* Area Type */}
            <Select
              label="Service Area Type"
              options={areaTypeOptions}
              value={areaType}
              onChange={(value) => setValue('area_type', value as any)}
              error={errors.area_type?.message}
              required
              helperText="Choose how you define your service coverage"
            />

            {/* City Type - Autocomplete with Google Places */}
            {areaType === 'city' && (
              <div className="space-y-4">
                {isLoaded ? (
                  <CityAutocomplete
                    label="Search City"
                    onSelect={handleCitySelect}
                    helperText="Start typing a city name to search"
                    required
                    defaultValue={watch('city') && watch('state') ? `${watch('city')}, ${watch('state')}` : ''}
                  />
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading map...</div>
                )}
              </div>
            )}

            {/* ZIP Code Type - Autocomplete with Google Geocoding */}
            {areaType === 'zipcode' && (
              <div className="space-y-4">
                {isLoaded ? (
                  <ZipCodeAutocomplete
                    label="ZIP Code"
                    onSelect={handleZipCodeSelect}
                    helperText="Enter a 5-digit ZIP code"
                    required
                    defaultValue={watch('zipcode') || ''}
                  />
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading map...</div>
                )}
              </div>
            )}

            {/* Radius Type - City + Radius Slider */}
            {areaType === 'radius' && (
              <div className="space-y-4">
                {isLoaded ? (
                  <>
                    <CityAutocomplete
                      label="Center City"
                      onSelect={handleCitySelect}
                      helperText="Select the center point for your service radius"
                      required
                      defaultValue={watch('city') && watch('state') ? `${watch('city')}, ${watch('state')}` : ''}
                    />

                    {/* Radius Slider */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Service Radius: {radiusMiles} miles
                        <span className="text-red-500 dark:text-red-400 ml-1">*</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        step="1"
                        value={radiusMiles}
                        onChange={(e) => setValue('radius_miles', parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>1 mile</span>
                        <span>100 miles</span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Service area covers {radiusMiles} miles from {watch('city') || 'selected city'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">Loading map...</div>
                )}
              </div>
            )}

            {/* State Type - Entire State Selector */}
            {areaType === 'state' && (
              <div className="space-y-4">
                <Select
                  label="Select State"
                  options={US_STATES}
                  value={watch('state') || ''}
                  onChange={(value) => {
                    setValue('state', value);
                    // For state type, we don't need city or zipcode
                    setValue('city', '');
                    setValue('zipcode', '');

                    // Get the state's geographic center coordinates
                    const stateCoords = STATE_COORDINATES[value];
                    if (stateCoords) {
                      setValue('center_lat', stateCoords.lat);
                      setValue('center_long', stateCoords.lng);
                      setMapCenter(stateCoords);
                      setMapZoom(6); // Zoom to show the state
                    }

                    setValue('radius_miles', 1);
                  }}
                  error={errors.state?.message}
                  required
                  searchable={true}
                  helperText="Select the entire state you serve"
                />
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Entire State Coverage:</strong> This means you provide services anywhere in the selected state.
                  </p>
                </div>
              </div>
            )}

            {/* Google Map Preview */}
            {isLoaded && centerLat && centerLng && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Map Preview
                </label>
                <GoogleMap
                  mapContainerStyle={mapContainerStyle}
                  center={mapCenter}
                  zoom={mapZoom}
                  onLoad={(map) => setMapInstance(map)}
                  options={{
                    streetViewControl: false,
                    mapTypeControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                  }}
                >
                  {/* Pin marker */}
                  <Marker position={{ lat: centerLat, lng: centerLng }} />

                  {/* Radius circle is managed imperatively via useEffect (see line 145-177) */}
                  {/* This prevents multiple circles from being created on slider changes */}
                </GoogleMap>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Coordinates: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
                </p>
              </div>
            )}

            {/* Location Details (Auto-populated, read-only display) */}
            {(watch('city') || watch('state') || watch('zipcode')) && (
              <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  Location Details (Auto-filled)
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {watch('city') && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">City:</span>{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{watch('city')}</span>
                    </div>
                  )}
                  {watch('state') && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">State:</span>{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{watch('state')}</span>
                    </div>
                  )}
                  {watch('zipcode') && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">ZIP Code:</span>{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{watch('zipcode')}</span>
                    </div>
                  )}
                  {watch('radius_miles') && areaType === 'radius' && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Radius:</span>{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">{watch('radius_miles')} miles</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ModalContent>

        {/* API Error Display */}
        {apiError && (
          <div className="mx-6 mt-6 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

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
