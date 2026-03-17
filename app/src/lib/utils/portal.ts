/**
 * Portal Utilities
 * Shared helpers for customer portal pages.
 */

/**
 * Extract tenant subdomain slug from the current hostname.
 * Production: {tenant}.lead360.app → "tenant"
 * Development: falls back to NEXT_PUBLIC_PORTAL_TENANT_SLUG env var.
 */
export function extractTenantSlug(): string {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname;

  // Production: {tenant}.lead360.app → extract "tenant"
  // Skip "www" and "app" subdomains
  if (hostname.endsWith('.lead360.app')) {
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'app') {
      return parts[0];
    }
  }

  // Development fallback: use env var
  return process.env.NEXT_PUBLIC_PORTAL_TENANT_SLUG || '';
}

/**
 * Sanitize a hex color value to prevent CSS injection.
 * Only allows valid hex colors (#RGB, #RRGGBB, #RRGGBBAA).
 * Returns the fallback if the input is invalid.
 */
export function sanitizeHexColor(color: string | null | undefined, fallback: string): string {
  if (!color) return fallback;
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
}
