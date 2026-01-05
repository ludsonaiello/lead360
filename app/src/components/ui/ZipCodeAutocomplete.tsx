/**
 * ZipCodeAutocomplete Component
 * ZIP code input with Google Geocoding API for automatic location lookup
 * Returns city, state, zipcode, and coordinates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useLoadScript } from '@react-google-maps/api';
import { Hash, Loader2, AlertCircle } from 'lucide-react';

interface ZipCodeData {
  city: string;
  state: string;
  zipcode: string;
  lat: number;
  lng: number;
}

interface ZipCodeAutocompleteProps {
  label?: string;
  error?: string;
  helperText?: string;
  onSelect: (data: ZipCodeData) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  defaultValue?: string;
}

export function ZipCodeAutocomplete({
  label = 'ZIP Code',
  error,
  helperText,
  onSelect,
  required = false,
  disabled = false,
  className = '',
  defaultValue = '',
}: ZipCodeAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const geocodeZipCode = async (zipcode: string) => {
    if (zipcode.length !== 5) return;

    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const geocoder = new google.maps.Geocoder();

      geocoder.geocode(
        {
          address: zipcode,
          componentRestrictions: { country: 'US' },
        },
        (results, status) => {
          setIsGeocoding(false);

          if (status === 'OK' && results && results[0]) {
            const result = results[0];
            const components = result.address_components || [];

            let city = '';
            let state = '';
            let zip = zipcode;

            components.forEach((component) => {
              const types = component.types;

              if (types.includes('locality')) {
                city = component.long_name;
              }
              if (types.includes('administrative_area_level_1')) {
                state = component.short_name;
              }
              if (types.includes('postal_code')) {
                zip = component.long_name;
              }
            });

            const lat = result.geometry.location.lat();
            const lng = result.geometry.location.lng();

            if (city && state) {
              onSelect({
                city,
                state,
                zipcode: zip,
                lat,
                lng,
              });
            } else {
              setGeocodeError('Could not find city/state for this ZIP code');
            }
          } else {
            setGeocodeError('Invalid ZIP code or location not found');
          }
        }
      );
    } catch (err) {
      setIsGeocoding(false);
      setGeocodeError('Failed to geocode ZIP code');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    setInputValue(value);
    setGeocodeError(null);

    // Auto-geocode when 5 digits entered
    if (value.length === 5) {
      geocodeZipCode(value);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {label}
          {required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
          {isGeocoding ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Hash className="w-5 h-5" />
          )}
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled || isGeocoding}
          maxLength={5}
          className={`
            w-full pl-11 pr-4 py-3 border-2 rounded-lg
            text-gray-900 dark:text-gray-100 font-medium
            bg-white dark:bg-gray-700
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
            transition-all duration-200
            ${error || geocodeError
              ? 'border-red-400 dark:border-red-500 focus:ring-red-500 focus:border-red-500'
              : 'border-gray-300 dark:border-gray-600'}
          `}
          placeholder="Enter 5-digit ZIP code"
        />
      </div>

      {(error || geocodeError) && (
        <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
          {error || geocodeError}
        </p>
      )}
      {helperText && !error && !geocodeError && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
}

export default ZipCodeAutocomplete;
