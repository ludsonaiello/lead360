import { Transform, TransformFnParams } from 'class-transformer';

/**
 * Sanitization utilities for formatted input fields
 *
 * These decorators clean and normalize user input BEFORE validation,
 * allowing users to submit data in various formats while ensuring
 * consistent storage format in the database.
 */

/**
 * Sanitize phone number: remove all non-digits and strip US country code (+1)
 *
 * Accepts any of these formats:
 * - "+1 (555) 123-4567" → "5551234567"
 * - "+1 555 123 4567" → "5551234567"
 * - "+15551234567" → "5551234567"
 * - "(555) 123-4567" → "5551234567"
 * - "555-123-4567" → "5551234567"
 * - "5551234567" → "5551234567"
 *
 * Returns: "5551234567" (10 digits only, US country code stripped)
 *
 * @example
 * @SanitizePhone()
 * @Matches(/^\d{10}$/, { message: 'Phone must be 10 digits' })
 * phone: string;
 */
export function SanitizePhone() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;

    // Remove all non-digits
    let digitsOnly = String(value).replace(/\D/g, '');

    // If starts with '1' and has 11 digits, strip the leading '1' (US country code)
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      digitsOnly = digitsOnly.substring(1);
    }

    return digitsOnly;
  });
}

/**
 * Sanitize and format EIN: XX-XXXXXXX
 *
 * Accepts any of these formats:
 * - "123456789"
 * - "12-3456789"
 * - "12 3456789"
 *
 * Returns: "12-3456789" (formatted with hyphen)
 *
 * @example
 * @SanitizeEIN()
 * @Matches(/^\d{2}-\d{7}$/, { message: 'Invalid EIN format' })
 * ein: string;
 */
export function SanitizeEIN() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;
    const digits = String(value).replace(/\D/g, '');

    // Only format if exactly 9 digits
    if (digits.length === 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    // Return as-is if invalid length (will fail validation)
    return value;
  });
}

/**
 * Sanitize ZIP code: XXXXX or XXXXX-XXXX
 *
 * Accepts any of these formats:
 * - "12345"
 * - "12345-6789"
 * - "12345 6789"
 * - "123456789"
 *
 * Returns: "12345" or "12345-6789" (normalized)
 *
 * @example
 * @SanitizeZipCode()
 * @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code' })
 * zip_code: string;
 */
export function SanitizeZipCode() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;

    // Remove everything except digits and hyphens
    const cleaned = String(value).replace(/[^\d-]/g, '');

    // Handle "123456789" → "12345-6789"
    const digitsOnly = cleaned.replace(/-/g, '');
    if (digitsOnly.length === 9) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
    }

    return cleaned;
  });
}

/**
 * Sanitize routing number: 9 digits only
 *
 * Accepts any of these formats:
 * - "123456789"
 * - "123-456-789"
 * - "123 456 789"
 *
 * Returns: "123456789" (digits only)
 *
 * @example
 * @SanitizeRoutingNumber()
 * @Matches(/^\d{9}$/, { message: 'Routing number must be 9 digits' })
 * routing_number: string;
 */
export function SanitizeRoutingNumber() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;
    return String(value).replace(/\D/g, '');
  });
}

/**
 * Sanitize account number: remove spaces
 *
 * Accepts any of these formats:
 * - "123456789012"
 * - "1234 5678 9012"
 *
 * Returns: "123456789012" (no spaces)
 *
 * @example
 * @SanitizeAccountNumber()
 * @Length(1, 17, { message: 'Account number must be 1-17 characters' })
 * account_number: string;
 */
export function SanitizeAccountNumber() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;
    return String(value).replace(/\s/g, '');
  });
}

/**
 * Force uppercase transformation
 *
 * Useful for state codes, country codes, etc.
 *
 * @example
 * @ToUpperCase()
 * @Matches(/^[A-Z]{2}$/, { message: 'State must be 2-letter code' })
 * state: string;
 */
export function ToUpperCase() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;
    return String(value).toUpperCase();
  });
}

/**
 * Force lowercase transformation
 *
 * Useful for subdomains, email addresses, etc.
 *
 * @example
 * @ToLowerCase()
 * @Matches(/^[a-z0-9-]+$/, { message: 'Invalid subdomain format' })
 * subdomain: string;
 */
export function ToLowerCase() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;
    return String(value).toLowerCase();
  });
}

/**
 * Sanitize date to ISO-8601 DateTime format
 *
 * Converts various date formats to full ISO-8601 DateTime:
 * - "2025-12-30" → "2025-12-30T12:00:00.000Z" (noon UTC to avoid timezone shifts)
 * - "2025-12-30T15:30:00" → "2025-12-30T15:30:00.000Z"
 * - Already ISO-8601 → unchanged
 *
 * Uses noon (12:00) UTC for date-only values to minimize timezone display issues.
 * This ensures the date stays correct in most timezones (UTC-12 to UTC+12).
 *
 * Returns: ISO-8601 DateTime string for Prisma DateTime fields
 *
 * @example
 * @SanitizeDate()
 * @IsDateString()
 * date_of_incorporation?: string;
 */
export function SanitizeDate() {
  
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;

    const dateStr = String(value);

    // If already has time component, add .000Z if missing
    if (dateStr.includes('T')) {
      if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
        return `${dateStr}.000Z`;
      }
      return dateStr;
    }

    // Date only (YYYY-MM-DD) → add noon UTC time to avoid timezone shifts
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return `${dateStr}T12:00:00.000Z`;
    }

    // Return as-is if unrecognized format (will fail validation)
    return value;
  });
}

/**
 * Transform comma-separated string into array
 *
 * Useful for query parameters that accept multiple values:
 * - "lead,prospect,customer" → ["lead", "prospect", "customer"]
 * - "lead" → ["lead"]
 * - ["lead", "prospect"] → ["lead", "prospect"] (already array, no change)
 *
 * @example
 * @ToArray()
 * @IsEnum(LeadStatus, { each: true })
 * @IsOptional()
 * status?: LeadStatus[];
 */
export function ToArray() {
  return Transform(({ value }: TransformFnParams) => {
    if (!value) return value;

    // Already an array
    if (Array.isArray(value)) return value;

    // Split comma-separated string
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim()).filter(Boolean);
    }

    // Single value → wrap in array
    return [value];
  });
}
