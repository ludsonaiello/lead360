/**
 * Currency Formatting Utility
 * Sprint 3: Usage Tracking & Billing
 */

/**
 * Format a number or string as USD currency
 * @param amount - The amount to format (number or string)
 * @returns Formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Parse a formatted currency string back to a number
 * @param formatted - Formatted currency string (e.g., "$1,234.56")
 * @returns Numeric value
 */
export function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/[^0-9.-]+/g, ''));
}
