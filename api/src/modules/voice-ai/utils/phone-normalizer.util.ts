/**
 * Phone Number Normalization Utility
 *
 * Provides functions to normalize phone numbers and generate variations for lookup.
 * Designed to handle US phone numbers in various formats (E.164, 10-digit, 11-digit, formatted).
 */

/**
 * Normalize phone number and generate all possible variations for lookup
 *
 * @param phoneNumber - Raw phone number in any format (+19788968047, 9788968047, (978) 896-8047, etc.)
 * @returns Array of phone variations to check (prioritized: 10-digit, 11-digit, E.164)
 *
 * @example
 * generatePhoneVariations('+19788968047')
 * // Returns: ['9788968047', '19788968047', '+19788968047']
 *
 * @example
 * generatePhoneVariations('(978) 896-8047')
 * // Returns: ['9788968047', '19788968047', '+19788968047']
 */
export function generatePhoneVariations(phoneNumber: string): string[] {
  // 1. Remove all non-digits to get base number
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // 2. Normalize to 10 digits (US standard)
  let normalized10Digit: string;

  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // Remove country code: 19788968047 → 9788968047
    normalized10Digit = digitsOnly.substring(1);
  } else if (digitsOnly.length === 10) {
    // Already 10 digits - use as-is
    normalized10Digit = digitsOnly;
  } else if (digitsOnly.length > 11 && digitsOnly.startsWith('1')) {
    // Handle edge case: extra digits after country code (take first 10 after '1')
    normalized10Digit = digitsOnly.substring(1, 11);
  } else if (digitsOnly.length > 10) {
    // Handle edge case: extra digits without country code (take first 10)
    normalized10Digit = digitsOnly.substring(0, 10);
  } else {
    // Invalid length (less than 10) - return as-is for error handling downstream
    normalized10Digit = digitsOnly;
  }

  // 3. Generate variations (prioritize most common format first)
  const variations = [
    normalized10Digit, // Primary: 9788968047 (DB standard - most common)
    `1${normalized10Digit}`, // With country code: 19788968047 (common alternative)
    `+1${normalized10Digit}`, // E.164 format: +19788968047 (Twilio/SIP format)
  ];

  // 4. Remove duplicates (in case input was already in one of these formats)
  return [...new Set(variations)];
}

/**
 * Normalize phone number to 10-digit US format for storage/validation
 *
 * This function is stricter than generatePhoneVariations and throws errors for invalid formats.
 * Use this when storing or validating phone numbers.
 *
 * @param phoneNumber - Phone number to normalize
 * @returns 10-digit phone number string
 * @throws Error if phone number is not 10 or 11 digits
 *
 * @example
 * normalizeToTenDigit('+19788968047')  // Returns: '9788968047'
 * normalizeToTenDigit('9788968047')    // Returns: '9788968047'
 * normalizeToTenDigit('123')           // Throws: Invalid phone number
 */
export function normalizeToTenDigit(phoneNumber: string): string {
  // Remove all non-digits
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Handle 11-digit with country code
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly.substring(1); // Remove country code
  }

  // Handle 10-digit (already normalized)
  if (digitsOnly.length === 10) {
    return digitsOnly;
  }

  // Invalid format - throw error
  throw new Error(
    `Invalid phone number: ${phoneNumber}. Must be 10 or 11 digits (got ${digitsOnly.length}).`,
  );
}

/**
 * Format 10-digit phone number for display
 *
 * @param phone - 10-digit phone number
 * @returns Formatted phone number (XXX) XXX-XXXX
 *
 * @example
 * formatPhoneForDisplay('9788968047')  // Returns: '(978) 896-8047'
 */
export function formatPhoneForDisplay(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, '');

  if (digitsOnly.length !== 10) {
    return phone; // Return as-is if not 10 digits
  }

  return `(${digitsOnly.substring(0, 3)}) ${digitsOnly.substring(3, 6)}-${digitsOnly.substring(6)}`;
}
