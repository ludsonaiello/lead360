/**
 * AddressAutocomplete Component
 * Google Places autocomplete with manual fallback
 */

'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { MapPin, AlertCircle } from 'lucide-react';
import { Input } from './Input';

const libraries: ('places')[] = ['places'];

interface AddressData {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip_code: string;
  lat?: number;
  long?: number;
}

interface AddressAutocompleteProps {
  label?: string;
  error?: string;
  helperText?: string;
  onSelect: (address: AddressData) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  defaultValue?: string;
}

export interface AddressAutocompleteRef {
  reset: () => void;
}

export const AddressAutocomplete = forwardRef<AddressAutocompleteRef, AddressAutocompleteProps>(
  (
    {
      label = 'Address',
      error,
      helperText,
      onSelect,
      required = false,
      disabled = false,
      className = '',
      defaultValue = '',
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState(defaultValue);
    const [manualMode, setManualMode] = useState(false);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    // Update input value when defaultValue changes (e.g., when editing an address)
    useEffect(() => {
      setInputValue(defaultValue);
    }, [defaultValue]);

    const { isLoaded, loadError } = useLoadScript({
      googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      libraries,
    });

    useImperativeHandle(ref, () => ({
      reset: () => {
        setInputValue('');
        setManualMode(false);
      },
    }));

    const parseGooglePlaceResult = (place: google.maps.places.PlaceResult): AddressData | null => {
      const components = place.address_components || [];

      let streetNumber = '';
      let route = '';
      let city = '';
      let state = '';
      let zipCode = '';

      components.forEach((component) => {
        const types = component.types;

        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        }
        if (types.includes('route')) {
          route = component.long_name;
        }
        if (types.includes('locality')) {
          city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = component.short_name;
        }
        if (types.includes('postal_code')) {
          zipCode = component.long_name;
        }
      });

      const line1 = `${streetNumber} ${route}`.trim();
      const lat = place.geometry?.location?.lat();
      const long = place.geometry?.location?.lng();

      if (!line1 || !city || !state || !zipCode) {
        return null;
      }

      return {
        line1,
        city,
        state,
        zip_code: zipCode,
        lat,
        long,
      };
    };

    const handlePlaceChanged = () => {
      if (autocompleteRef.current) {
        const place = autocompleteRef.current.getPlace();

        if (place && place.address_components) {
          const addressData = parseGooglePlaceResult(place);

          if (addressData) {
            onSelect(addressData);
            setInputValue(place.formatted_address || '');
          }
        }
      }
    };

    const handleLoad = (autocomplete: google.maps.places.Autocomplete) => {
      autocompleteRef.current = autocomplete;
    };

    // If Google Maps fails to load or manual mode is enabled
    if (loadError || manualMode || !isLoaded) {
      return (
        <div className={`w-full ${className}`}>
          {!manualMode && loadError && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">Address autocomplete unavailable. Please enter manually.</p>
            </div>
          )}

          {!manualMode && (
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
            >
              Enter address manually
            </button>
          )}

          {/* Manual mode is handled by parent component */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manual address entry fields should be displayed by parent component.
          </p>
        </div>
      );
    }

    return (
      <div className={`w-full ${className}`}>
        {label && (
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {label}
            {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
          </label>
        )}

        <Autocomplete onLoad={handleLoad} onPlaceChanged={handlePlaceChanged}>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
              <MapPin className="w-5 h-5" />
            </div>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={disabled}
              placeholder="Start typing an address..."
              className={`
                w-full pl-11 pr-4 py-3 border-2 rounded-lg
                text-gray-900 dark:text-gray-100 font-medium
                bg-white dark:bg-gray-700
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                transition-all duration-200
                ${error
                  ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'}
              `}
            />
          </div>
        </Autocomplete>

        {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

AddressAutocomplete.displayName = 'AddressAutocomplete';

export default AddressAutocomplete;
