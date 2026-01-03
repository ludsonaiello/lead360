/**
 * Google Maps Utilities
 * Helper functions for Google Maps API integration
 */

import { useLoadScript } from '@react-google-maps/api';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

/**
 * Hook to load Google Maps API
 * @returns isLoaded, loadError, isLoading status
 */
export function useGoogleMaps() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  return { isLoaded, loadError };
}

/**
 * Parse Google Places autocomplete result into address components
 * @param place - Google Places PlaceResult object
 * @returns Parsed address object
 */
export function parseGooglePlaceResult(place: google.maps.places.PlaceResult) {
  const addressComponents = place.address_components || [];

  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let zipCode = '';
  let country = '';

  addressComponents.forEach((component) => {
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
      state = component.short_name; // 2-letter state code
    }
    if (types.includes('postal_code')) {
      zipCode = component.long_name;
    }
    if (types.includes('country')) {
      country = component.long_name;
    }
  });

  const line1 = `${streetNumber} ${route}`.trim();
  const lat = place.geometry?.location?.lat();
  const long = place.geometry?.location?.lng();

  return {
    line1,
    line2: '',
    city,
    state,
    zip_code: zipCode,
    country: country || 'USA',
    lat,
    long,
  };
}

/**
 * Geocode an address string to get lat/long coordinates
 * @param address - Full address string
 * @returns Promise with lat/long coordinates
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; long: number } | null> {
  if (!window.google) {
    console.error('Google Maps not loaded');
    return null;
  }

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode({ address }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location = results[0].geometry.location;
        resolve({
          lat: location.lat(),
          long: location.lng(),
        });
      } else {
        console.error('Geocoding failed:', status);
        resolve(null);
      }
    });
  });
}

/**
 * Calculate distance between two coordinates (in miles)
 * @param lat1 - Latitude of first point
 * @param long1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param long2 - Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistance(
  lat1: number,
  long1: number,
  lat2: number,
  long2: number
): number {
  if (!window.google) {
    console.error('Google Maps not loaded');
    return 0;
  }

  const from = new google.maps.LatLng(lat1, long1);
  const to = new google.maps.LatLng(lat2, long2);

  // Distance in meters
  const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(from, to);

  // Convert to miles (1 mile = 1609.34 meters)
  return distanceMeters / 1609.34;
}

/**
 * Check if a point is within a radius
 * @param centerLat - Center latitude
 * @param centerLong - Center longitude
 * @param pointLat - Point latitude
 * @param pointLong - Point longitude
 * @param radiusMiles - Radius in miles
 * @returns True if point is within radius
 */
export function isWithinRadius(
  centerLat: number,
  centerLong: number,
  pointLat: number,
  pointLong: number,
  radiusMiles: number
): boolean {
  const distance = calculateDistance(centerLat, centerLong, pointLat, pointLong);
  return distance <= radiusMiles;
}

/**
 * Format coordinates for display
 * @param lat - Latitude
 * @param long - Longitude
 * @returns Formatted string
 */
export function formatCoordinates(lat: number, long: number): string {
  return `${lat.toFixed(6)}, ${long.toFixed(6)}`;
}

export default {
  useGoogleMaps,
  parseGooglePlaceResult,
  geocodeAddress,
  calculateDistance,
  isWithinRadius,
  formatCoordinates,
};
