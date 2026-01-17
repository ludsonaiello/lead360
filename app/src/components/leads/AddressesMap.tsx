/**
 * AddressesMap Component
 * Google Maps showing all addresses with clickable markers
 */

'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Address {
  id: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  latitude: string | number; // Can be string from DB or number
  longitude: string | number; // Can be string from DB or number
  address_type: string;
  is_primary: boolean;
}

interface AddressesMapProps {
  addresses: Address[];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = {
  lat: 39.8283, // Center of USA
  lng: -98.5795,
};

export function AddressesMap({ addresses }: AddressesMapProps) {
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const onLoad = useCallback((map: google.maps.Map) => {
    // Calculate bounds to fit all markers
    if (addresses.length > 1) {
      // Multiple addresses: fit bounds to show all
      const bounds = new window.google.maps.LatLngBounds();
      addresses.forEach((address) => {
        if (address.latitude && address.longitude) {
          const lat = typeof address.latitude === 'string' ? parseFloat(address.latitude) : address.latitude;
          const lng = typeof address.longitude === 'string' ? parseFloat(address.longitude) : address.longitude;
          bounds.extend({ lat, lng });
        }
      });
      map.fitBounds(bounds);

      // Add slight padding
      const padding = { top: 50, right: 50, bottom: 50, left: 50 };
      map.fitBounds(bounds, padding);
    } else if (addresses.length === 1) {
      // Single address: use fixed zoom level
      const lat = typeof addresses[0].latitude === 'string' ? parseFloat(addresses[0].latitude) : addresses[0].latitude;
      const lng = typeof addresses[0].longitude === 'string' ? parseFloat(addresses[0].longitude) : addresses[0].longitude;
      map.setCenter({ lat, lng });
      map.setZoom(12); // City/neighborhood level zoom
    }
    setMap(map);
  }, [addresses]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center p-6">
          <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Unable to load Google Maps. Please check your API key.
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center p-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  const center =
    addresses.length > 0 && addresses[0].latitude && addresses[0].longitude
      ? {
          lat: typeof addresses[0].latitude === 'string' ? parseFloat(addresses[0].latitude) : addresses[0].latitude,
          lng: typeof addresses[0].longitude === 'string' ? parseFloat(addresses[0].longitude) : addresses[0].longitude,
        }
      : defaultCenter;

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={12}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
      }}
    >
      {addresses.map((address, index) => {
        if (!address.latitude || !address.longitude) return null;

        const lat = typeof address.latitude === 'string' ? parseFloat(address.latitude) : address.latitude;
        const lng = typeof address.longitude === 'string' ? parseFloat(address.longitude) : address.longitude;

        return (
          <Marker
            key={address.id}
            position={{ lat, lng }}
            onClick={() => setSelectedAddress(address)}
            label={{
              text: `${index + 1}`,
              color: 'white',
              fontWeight: 'bold',
            }}
            icon={{
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 20,
              fillColor: address.is_primary ? '#EF4444' : '#3B82F6', // red or blue
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 3,
            }}
          />
        );
      })}

      {selectedAddress && (
        <InfoWindow
          position={{
            lat: typeof selectedAddress.latitude === 'string' ? parseFloat(selectedAddress.latitude) : selectedAddress.latitude,
            lng: typeof selectedAddress.longitude === 'string' ? parseFloat(selectedAddress.longitude) : selectedAddress.longitude,
          }}
          onCloseClick={() => setSelectedAddress(null)}
        >
          <div className="p-2 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              {selectedAddress.is_primary && (
                <span className="text-xs font-semibold text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                  PRIMARY
                </span>
              )}
              <span className="text-xs text-gray-600 capitalize px-2 py-0.5 bg-gray-100 rounded">
                {selectedAddress.address_type}
              </span>
            </div>
            <div className="text-sm">
              <p className="font-semibold text-gray-900">
                {selectedAddress.address_line1}
                {selectedAddress.address_line2 && <>, {selectedAddress.address_line2}</>}
              </p>
              <p className="text-gray-700">
                {selectedAddress.city}, {selectedAddress.state} {selectedAddress.zip_code}
              </p>
            </div>
            <a
              href={`https://www.google.com/maps?q=${selectedAddress.latitude},${selectedAddress.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              <Navigation className="w-3 h-3" />
              Get Directions
            </a>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}
