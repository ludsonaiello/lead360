/**
 * Sanitization Utilities
 * Clean and normalize form data before sending to API
 *
 * Note: These functions provide client-side sanitization for data consistency.
 * Backend also has sanitization (@SanitizePhone, etc.) as defense-in-depth.
 */

/**
 * Sanitizes phone number to 10-digit format
 * Removes all non-digits and strips leading '1' if 11 digits (US country code)
 *
 * @param phone - Phone number in any format (E.164, formatted, raw digits, etc.)
 * @returns 10-digit phone number or undefined if empty
 *
 * @example
 * sanitizePhone('+1 (555) 123-4567') // '5551234567'
 * sanitizePhone('(555) 123-4567')    // '5551234567'
 * sanitizePhone('+15551234567')      // '5551234567'
 * sanitizePhone('555-123-4567')      // '5551234567'
 * sanitizePhone('')                  // undefined
 */
export function sanitizePhone(phone: string | undefined): string | undefined {
  if (!phone || phone.trim() === '') return undefined;

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Strip leading '1' if 11 digits (US country code from E.164 format)
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.substring(1);
  }

  // Return cleaned 10-digit format, or original if not 10 digits (let validation catch it)
  return digits.length === 10 ? digits : phone;
}

/**
 * Sanitizes EIN (Employer Identification Number) to XX-XXXXXXX format
 * Removes all non-digits and reformats to match backend expectation
 *
 * @param ein - EIN in any format (formatted, raw digits, etc.)
 * @returns EIN in XX-XXXXXXX format or undefined if empty
 *
 * @example
 * sanitizeEIN('12-3456789')  // '12-3456789'
 * sanitizeEIN('123456789')   // '12-3456789'
 * sanitizeEIN('12 3456789')  // '12-3456789'
 * sanitizeEIN('')            // undefined
 */
export function sanitizeEIN(ein: string | undefined): string | undefined {
  if (!ein || ein.trim() === '') return undefined;

  const digits = ein.replace(/\D/g, '');

  // If not 9 digits, return original (let validation catch the error)
  if (digits.length !== 9) return ein;

  // Format as XX-XXXXXXX
  return `${digits.substring(0, 2)}-${digits.substring(2)}`;
}

/**
 * Sanitizes ZIP code to XXXXX or XXXXX-XXXX format
 * Removes all non-digits and reformats
 *
 * @param zip - ZIP code in any format
 * @returns ZIP in XXXXX or XXXXX-XXXX format or undefined if empty
 *
 * @example
 * sanitizeZipCode('12345')      // '12345'
 * sanitizeZipCode('12345-6789') // '12345-6789'
 * sanitizeZipCode('123456789')  // '12345-6789'
 * sanitizeZipCode('')           // undefined
 */
export function sanitizeZipCode(zip: string | undefined): string | undefined {
  if (!zip || zip.trim() === '') return undefined;

  const digits = zip.replace(/\D/g, '');

  if (digits.length === 5) {
    return digits;
  } else if (digits.length === 9) {
    return `${digits.substring(0, 5)}-${digits.substring(5)}`;
  }

  // Return original if invalid format (let validation catch it)
  return zip;
}

/**
 * Generic string sanitizer - trims whitespace and converts empty strings to undefined
 *
 * @param value - String value to sanitize
 * @returns Trimmed string or undefined if empty
 *
 * @example
 * sanitizeString('  hello  ')  // 'hello'
 * sanitizeString('   ')        // undefined
 * sanitizeString('')           // undefined
 * sanitizeString(undefined)    // undefined
 */
export function sanitizeString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
