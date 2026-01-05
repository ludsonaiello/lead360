/**
 * CityAutocomplete Component
 * Google Places autocomplete specifically for cities
 * Returns city, state, zipcode, and coordinates
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { MapPin, AlertCircle } from 'lucide-react';

interface CityData {
  city: string;
  state: string;
  zipcode?: string;
  lat: number;
  lng: number;
}

interface CityAutocompleteProps {
  label?: string;
  error?: string;
  helperText?: string;
  onSelect: (city: CityData) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  defaultValue?: string;
}

export function CityAutocomplete({
  label = 'City',
  error,
  helperText,
  onSelect,
  required = false,
  disabled = false,
  className = '',
  defaultValue = '',
}: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(defaultValue);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  const parseGooglePlaceResult = (place: google.maps.places.PlaceResult): CityData | null => {
    const components = place.address_components || [];

    let city = '';
    let state = '';
    let zipcode = '';

    components.forEach((component) => {
      const types = component.types;

      if (types.includes('locality')) {
        city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        state = component.short_name;
      }
      if (types.includes('postal_code')) {
        zipcode = component.long_name;
      }
    });

    const lat = place.geometry?.location?.lat();
    const lng = place.geometry?.location?.lng();

    if (!city || !state || lat === undefined || lng === undefined) {
      return null;
    }

    return {
      city,
      state,
      zipcode: zipcode || undefined,
      lat,
      lng,
    };
  };

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  };

  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();

      if (place && place.geometry) {
        const cityData = parseGooglePlaceResult(place);

        if (cityData) {
          setInputValue(`${cityData.city}, ${cityData.state}`);
          onSelect(cityData);
        } else {
          console.error('Could not parse city data from place result');
        }
      }
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
          <MapPin className="w-5 h-5" />
        </div>

        <Autocomplete
          onLoad={onLoad}
          onPlaceChanged={onPlaceChanged}
          options={{
            types: ['(cities)'],
            componentRestrictions: { country: 'us' },
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={disabled}
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
            placeholder="Start typing a city name..."
          />
        </Autocomplete>
      </div>

      {error && <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

export default CityAutocomplete;
