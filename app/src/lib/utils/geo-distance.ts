/**
 * Geographic distance utilities
 * Haversine math + US-locale formatting for service-business SaaS.
 */

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine great-circle distance in meters between two WGS-84 points.
 * Returns NaN if any coordinate is non-finite.
 */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2)
  ) {
    return Number.NaN;
  }
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format a meter distance in human-readable US units.
 * < 528 ft (0.1 mi): "X ft"
 * < 10 mi: "X.X mi"
 * else: "X mi"
 */
export function formatDistanceUS(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 161) {
    // Under ~528 ft — show in feet, rounded to nearest 10
    const feet = Math.round(meters / METERS_PER_FOOT);
    const rounded = feet < 30 ? feet : Math.round(feet / 10) * 10;
    return `${rounded} ft`;
  }
  const miles = meters / METERS_PER_MILE;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Parse a Prisma Decimal-as-string coordinate safely.
 * Returns null for null/empty/non-numeric input.
 */
export function parseCoord(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}
