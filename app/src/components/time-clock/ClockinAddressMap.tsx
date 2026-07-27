/**
 * Clock-In Address Map
 * Live map preview for a clock-in geofence address. Renders a Google Map
 * centered on the given coordinates with a pin and a circle showing the
 * configured geofence radius.
 *
 * - Dedupes the Google Maps script load with AddressAutocomplete (same
 *   libraries array so useLoadScript short-circuits).
 * - Gracefully degrades to a "no coordinates yet" placeholder when the
 *   coords are null (e.g. create mode before the user picks an address).
 * - Shows an API-key-missing banner so broken configs don't render a
 *   blank grey rectangle.
 */

'use client';

import React, { useMemo } from 'react';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { MapPin, AlertCircle } from 'lucide-react';

const libraries: ('places')[] = ['places'];

interface ClockinAddressMapProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  /** ARIA label for the figure wrapper */
  ariaLabel?: string;
}

const containerStyle = {
  width: '100%',
  height: '220px',
  borderRadius: '0.5rem',
};

const circleOptions: google.maps.CircleOptions = {
  fillColor: '#2563eb',
  fillOpacity: 0.15,
  strokeColor: '#2563eb',
  strokeOpacity: 0.9,
  strokeWeight: 2,
  clickable: false,
  draggable: false,
  editable: false,
  visible: true,
  zIndex: 1,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  zoomControl: true,
  gestureHandling: 'cooperative',
  clickableIcons: false,
};

/**
 * Pick a zoom level that roughly matches the geofence radius so the circle
 * fills a sensible portion of the map. Hand-tuned, not a formula — the
 * relationship between meters and zoom is non-linear on Mercator anyway.
 */
function zoomForRadius(meters: number): number {
  if (meters <= 50) return 18;
  if (meters <= 100) return 17;
  if (meters <= 200) return 16;
  if (meters <= 500) return 15;
  if (meters <= 1000) return 14;
  if (meters <= 2500) return 13;
  return 12;
}

export function ClockinAddressMap({
  latitude,
  longitude,
  radiusMeters,
  ariaLabel = 'Clock-in address geofence preview',
}: ClockinAddressMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries,
  });

  const hasCoords =
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude);

  const center = useMemo(
    () => (hasCoords ? { lat: latitude as number, lng: longitude as number } : null),
    [hasCoords, latitude, longitude],
  );

  const zoom = useMemo(() => zoomForRadius(radiusMeters), [radiusMeters]);

  if (!apiKey) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2.5 text-sm text-yellow-800 dark:text-yellow-300"
        aria-label={ariaLabel}
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>
          Map preview unavailable — set{' '}
          <code className="font-mono text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>.
        </span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-800 dark:text-red-300"
        aria-label={ariaLabel}
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>Could not load the map preview.</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-500 dark:text-gray-400 animate-pulse"
        style={{ height: '220px' }}
        aria-label={ariaLabel}
      >
        Loading map…
      </div>
    );
  }

  if (!center) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-center"
        style={{ height: '220px' }}
        aria-label={ariaLabel}
      >
        <MapPin className="w-6 h-6 text-gray-400 dark:text-gray-500" />
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Pick an address to see the pin
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-500">
          Use the search field above to auto-fill and preview the geofence.
        </div>
      </div>
    );
  }

  return (
    <figure className="space-y-2" aria-label={ariaLabel}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        options={mapOptions}
      >
        <MarkerF position={center} />
        <CircleF center={center} radius={radiusMeters} options={circleOptions} />
      </GoogleMap>
      <figcaption className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-blue-500 dark:text-blue-400" />
        Blue circle shows the {radiusMeters}m geofence employees must be within to clock in.
      </figcaption>
    </figure>
  );
}

export default ClockinAddressMap;
