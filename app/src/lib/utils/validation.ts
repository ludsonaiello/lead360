/**
 * Validation Schemas using Zod
 * Matches backend validation rules exactly
 */

import { z } from 'zod';

/**
 * Password validation regex
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 special character
 */
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]).{8,}$/;

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email must be less than 255 characters')
  .transform((val) => val.toLowerCase());

/**
 * Password validation schema
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be less than 72 characters')
  .regex(
    passwordRegex,
    'Password must include uppercase, lowercase, and special character'
  );

/**
 * Name validation schema (first/last name)
 */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .trim();

/**
 * Phone validation schema (E.164 format)
 */
export const phoneSchema = z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      // Remove all non-digit characters
      const digits = val.replace(/\D/g, '');
      // Check if between 10-15 digits (E.164 format)
      return digits.length >= 10 && digits.length <= 15;
    },
    { message: 'Invalid phone number' }
  );

/**
 * Subdomain validation schema
 */
export const subdomainSchema = z
  .string()
  .min(3, 'Subdomain must be at least 3 characters')
  .max(63, 'Subdomain must be less than 63 characters')
  .regex(
    /^[a-z0-9-]+$/,
    'Subdomain can only contain lowercase letters, numbers, and hyphens'
  )
  .refine(
    (val) => !val.startsWith('-') && !val.endsWith('-'),
    { message: 'Subdomain cannot start or end with a hyphen' }
  );

/**
 * Company name validation schema
 */
export const companyNameSchema = z
  .string()
  .min(2, 'Company name must be at least 2 characters')
  .max(200, 'Company name must be less than 200 characters')
  .trim();

/**
 * Registration form validation schema
 */
export const registerSchema = z
  .object({
    // User fields
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string(),
    first_name: nameSchema,
    last_name: nameSchema,
    phone: phoneSchema,
    // Tenant fields - basic
    tenant_subdomain: subdomainSchema,
    company_name: companyNameSchema,
    // Tenant fields - required at registration
    legal_business_name: z
      .string()
      .min(2, 'Legal business name must be at least 2 characters')
      .max(200, 'Legal business name must be less than 200 characters')
      .trim(),
    business_entity_type: z.enum([
      'sole_proprietorship',
      'llc',
      'corporation',
      's-corporation',
      'partnership',
      'dba',
    ]),
    state_of_registration: z
      .string()
      .length(2, 'State must be 2-letter code')
      .regex(/^[A-Z]{2}$/, 'State must be uppercase letters')
      .transform((val) => val.toUpperCase()),
    ein: z
      .string()
      .regex(/^\d{2}-\d{7}$/, 'EIN must be in format XX-XXXXXXX'),
    primary_contact_phone: phoneSchema.refine((val) => !!val && val.trim() !== '', {
      message: 'Primary contact phone is required',
    }),
    primary_contact_email: emailSchema,
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  remember_me: z.boolean().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * Forgot password form validation schema
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password form validation schema
 */
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Change password form validation schema
 */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ['confirm_password'],
  })
  .refine((data) => data.current_password !== data.new_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

/**
 * Update profile form validation schema
 */
export const updateProfileSchema = z.object({
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  phone: phoneSchema,
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Password strength calculator
 * Returns: 'weak', 'medium', or 'strong'
 */
export function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) {
    return 'weak';
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;':",./<>?]/.test(password);

  const requirementsMet = [hasUppercase, hasLowercase, hasSpecial].filter(Boolean).length;

  if (requirementsMet === 3) {
    return 'strong';
  } else if (requirementsMet >= 2) {
    return 'medium';
  } else {
    return 'weak';
  }
}

// ==========================================
// TENANT VALIDATION SCHEMAS
// ==========================================

/**
 * EIN validation schema (XX-XXXXXXX format)
 */
export const einSchema = z
  .string()
  .regex(/^\d{2}-\d{7}$/, 'EIN must be in format XX-XXXXXXX')
  .optional()
  .or(z.literal(''));

/**
 * ZIP code validation schema (XXXXX or XXXXX-XXXX)
 */
export const zipCodeSchema = z
  .string()
  .regex(/^\d{5}(-\d{4})?$/, 'ZIP code must be XXXXX or XXXXX-XXXX format');

/**
 * State code validation schema (2-letter uppercase)
 */
export const stateCodeSchema = z
  .string()
  .length(2, 'State must be 2-letter code')
  .regex(/^[A-Z]{2}$/, 'State must be uppercase letters');

/**
 * Hex color validation schema (#RRGGBB)
 */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color (e.g., #007BFF)')
  .optional()
  .or(z.literal(''));

/**
 * Time validation schema (HH:MM format, 24-hour)
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)')
  .optional()
  .nullable();

/**
 * Business Info Step 1: Legal & Tax
 */
export const businessLegalSchema = z.object({
  legal_business_name: z.string().max(200).optional().or(z.literal('')),
  dba_name: z.string().max(200).optional().or(z.literal('')),
  business_entity_type: z.enum(['sole_proprietorship', 'llc', 'corporation', 's-corporation', 'partnership', 'dba']).optional(),
  state_of_registration: stateCodeSchema.optional().or(z.literal('')),
  date_of_incorporation: z.string().optional().or(z.literal('')), // ISO date
  ein: einSchema,
  state_tax_id: z.string().max(50).optional().or(z.literal('')),
  sales_tax_permit: z.string().max(50).optional().or(z.literal('')),
  services_offered: z.array(z.string().uuid()).min(1, 'At least one service is required').max(50, 'Maximum 50 services allowed'),
});

export type BusinessLegalFormData = z.infer<typeof businessLegalSchema>;

/**
 * Business Info Step 2: Contact
 */
export const businessContactSchema = z.object({
  primary_contact_phone: phoneSchema,
  secondary_phone: phoneSchema,
  primary_contact_email: emailSchema.optional().or(z.literal('')),
  support_email: emailSchema.optional().or(z.literal('')),
  billing_email: emailSchema.optional().or(z.literal('')),
  website_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  instagram_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  facebook_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  tiktok_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  youtube_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export type BusinessContactFormData = z.infer<typeof businessContactSchema>;

/**
 * Business Info Step 3: Financial
 */
export const businessFinancialSchema = z.object({
  bank_name: z.string().max(100).optional().or(z.literal('')),
  routing_number: z.string().regex(/^\d{9}$/, 'Routing number must be 9 digits').optional().or(z.literal('')),
  account_number: z.string().max(17).optional().or(z.literal('')),
  account_type: z.enum(['checking', 'savings']).optional(),
  venmo_username: z.string().max(50).optional().or(z.literal('')),
});

export type BusinessFinancialFormData = z.infer<typeof businessFinancialSchema>;

/**
 * Business Info Step 4: Invoice & Quote Settings
 */
export const businessInvoiceSchema = z.object({
  invoice_prefix: z.string().max(10).optional().or(z.literal('')),
  next_invoice_number: z.number().int().min(1).optional(),
  quote_prefix: z.string().max(10).optional().or(z.literal('')),
  next_quote_number: z.number().int().min(1).optional(),
  default_quote_validity_days: z.number().int().min(1).max(365).optional(),
  default_quote_terms: z.string().max(1000).optional().or(z.literal('')),
  default_quote_footer: z.string().max(500).optional().or(z.literal('')),
  default_invoice_footer: z.string().max(500).optional().or(z.literal('')),
  default_payment_instructions: z.string().max(500).optional().or(z.literal('')),
  sales_tax_rate: z.number().min(0, 'Sales tax rate must be at least 0%').max(99.999, 'Sales tax rate cannot exceed 99.999%').optional().nullable(),
  default_profit_margin: z.number().min(0, 'Profit margin must be at least 0%').max(999.99, 'Profit margin cannot exceed 999.99%').optional().nullable(),
  default_overhead_rate: z.number().min(0, 'Overhead rate must be at least 0%').max(999.99, 'Overhead rate cannot exceed 999.99%').optional().nullable(),
  default_contingency_rate: z.number().min(0, 'Contingency rate must be at least 0%').max(999.99, 'Contingency rate cannot exceed 999.99%').optional().nullable(),
});

export type BusinessInvoiceFormData = z.infer<typeof businessInvoiceSchema>;

/**
 * Address form schema
 */
export const addressSchema = z.object({
  address_type: z.enum(['legal', 'billing', 'service', 'mailing', 'office']),
  line1: z.string().min(1, 'Address line 1 is required').max(255),
  line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(100),
  state: stateCodeSchema,
  zip_code: zipCodeSchema,
  country: z.string().optional(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  long: z.number().min(-180).max(180).optional().nullable(),
  is_po_box: z.boolean().optional(),
  is_default: z.boolean().optional(),
}).refine(
  (data) => !(data.address_type === 'legal' && data.is_po_box),
  { message: 'Legal address cannot be a PO Box', path: ['is_po_box'] }
);

export type AddressFormData = z.infer<typeof addressSchema>;

/**
 * License form schema
 */
export const licenseSchema = z.object({
  license_type_id: z.string().uuid().optional(),
  custom_license_type: z.string().max(100).optional().or(z.literal('')),
  license_number: z.string().min(1, 'License number is required').max(100),
  issuing_state: stateCodeSchema,
  issue_date: z.string().min(1, 'Issue date is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  document_file_id: z.string().uuid().optional().nullable(),
}).refine(
  (data) => data.license_type_id || data.custom_license_type,
  { message: 'Either select a license type or enter a custom type', path: ['license_type_id'] }
);

export type LicenseFormData = z.infer<typeof licenseSchema>;

/**
 * Insurance form schema
 */
export const insuranceSchema = z.object({
  gl_insurance_provider: z.string().max(100).optional().or(z.literal('')),
  gl_policy_number: z.string().max(100).optional().or(z.literal('')),
  gl_coverage_amount: z.number().min(0).optional().nullable(),
  gl_effective_date: z.string().optional().or(z.literal('')),
  gl_expiry_date: z.string().optional().or(z.literal('')),
  gl_document_file_id: z.string().uuid().optional().nullable(),
  wc_insurance_provider: z.string().max(100).optional().or(z.literal('')),
  wc_policy_number: z.string().max(100).optional().or(z.literal('')),
  wc_coverage_amount: z.number().min(0).optional().nullable(),
  wc_effective_date: z.string().optional().or(z.literal('')),
  wc_expiry_date: z.string().optional().or(z.literal('')),
  wc_document_file_id: z.string().uuid().optional().nullable(),
});

export type InsuranceFormData = z.infer<typeof insuranceSchema>;

/**
 * Payment term schema
 */
export const paymentTermSchema = z.object({
  sequence: z.number().int().min(1),
  type: z.enum(['percentage', 'fixed']),
  amount: z.number().min(0),
  description: z.string().min(1, 'Description is required').max(255),
});

/**
 * Payment terms schema
 */
export const paymentTermsSchema = z.object({
  terms: z.array(paymentTermSchema).min(1, 'At least one payment term is required'),
}).refine(
  (data) => {
    // Validate sequence is sequential (1, 2, 3, ...)
    const sequences = data.terms.map(t => t.sequence).sort((a, b) => a - b);
    return sequences.every((seq, idx) => seq === idx + 1);
  },
  { message: 'Sequence numbers must be sequential (1, 2, 3, ...)', path: ['terms'] }
);

export type PaymentTermsFormData = z.infer<typeof paymentTermsSchema>;

/**
 * Business hours schema (for one day)
 */
const dayHoursSchema = z.object({
  closed: z.boolean(),
  open1: timeSchema,
  close1: timeSchema,
  open2: timeSchema,
  close2: timeSchema,
}).refine(
  (data) => {
    if (data.closed) return true;
    // If not closed, must have open1 and close1
    return data.open1 !== null && data.close1 !== null;
  },
  { message: 'Opening and closing times are required when not closed' }
);

/**
 * Custom hours schema
 */
export const customHoursSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: z.string().min(1, 'Reason is required').max(255),
  closed: z.boolean(),
  open_time1: timeSchema,
  close_time1: timeSchema,
  open_time2: timeSchema,
  close_time2: timeSchema,
})
  .refine(
    (data) => {
      // Only validate times if not closed
      if (!data.closed) {
        // Check if open_time1 and close_time1 are provided (not null, not empty)
        return !!(data.open_time1 && data.close_time1);
      }
      // If closed, no time validation needed
      return true;
    },
    { message: 'Opening and closing times are required when not closed', path: ['open_time1'] }
  )
  .refine(
    (data) => {
      // Validate date is today or in the future
      if (!data.date) return true; // Already handled by min(1) check

      // Parse the date string (YYYY-MM-DD format)
      const selectedDate = new Date(data.date + 'T00:00:00');

      // Get today's date at midnight (local time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Date must be >= today
      return selectedDate >= today;
    },
    { message: 'Date cannot be in the past', path: ['date'] }
  );

export type CustomHoursFormData = z.infer<typeof customHoursSchema>;

/**
 * Service area schema
 * Frontend form only sends: area_type, city, state, zipcode, center_lat, center_long, radius_miles
 * Backend automatically calculates: city_name, entire_state, zipcode (as database fields)
 */
export const serviceAreaSchema = z.object({
  area_type: z.enum(['city', 'zipcode', 'radius', 'state']),
  city: z.string().max(100).optional().or(z.literal('')),
  state: stateCodeSchema,
  zipcode: z.string().optional().or(z.literal('')),
  center_lat: z.number().min(-90).max(90),
  center_long: z.number().min(-180).max(180),
  radius_miles: z.number().min(1).max(500),
}).refine(
  (data) => {
    // For non-state types, city and zipcode are required
    if (data.area_type !== 'state') {
      if (!data.city || data.city.trim() === '') {
        return false;
      }
      if (!data.zipcode || data.zipcode.trim() === '') {
        return false;
      }
    }
    return true;
  },
  {
    message: 'City and ZIP code are required for this service area type',
    path: ['city'],
  }
);

export type ServiceAreaFormData = z.infer<typeof serviceAreaSchema>;

/**
 * Branding schema
 */
export const brandingSchema = z.object({
  primary_brand_color: hexColorSchema,
  secondary_brand_color: hexColorSchema,
  accent_color: hexColorSchema,
  logo_file_id: z.string().uuid().optional(),
});

export type BrandingFormData = z.infer<typeof brandingSchema>;

// ==========================================
// LEADS MODULE VALIDATION SCHEMAS
// ==========================================

/**
 * Lead phone validation schema
 * CRITICAL: API expects 10 digits only (no +1 prefix)
 * But PhoneInput component stores in E.164 format (+15551234567)
 * This schema converts from E.164 to 10 digits
 */
export const leadPhoneSchema = z
  .string()
  .min(1, 'Phone is required')
  .transform((val) => {
    // Remove +1 prefix if present
    const cleaned = val.replace(/^\+1/, '').replace(/\D/g, '');
    return cleaned;
  })
  .refine((val) => val.length === 10, {
    message: 'Phone must be 10 digits',
  });

/**
 * Optional lead phone validation
 */
export const leadPhoneOptionalSchema = z
  .string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    // Remove +1 prefix if present
    const cleaned = val.replace(/^\+1/, '').replace(/\D/g, '');
    return cleaned.length === 10 ? cleaned : undefined;
  });

/**
 * Lead email validation
 */
export const leadEmailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255);

/**
 * Optional lead email validation
 */
export const leadEmailOptionalSchema = z
  .string()
  .optional()
  .refine((val) => !val || z.string().email().safeParse(val).success, {
    message: 'Invalid email format',
  });

/**
 * Lead address validation (Google Maps autocomplete)
 */
export const leadAddressSchema = z.object({
  address_line1: z.string().min(1, 'Address line 1 is required').max(255),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(100),
  state: stateCodeSchema,
  zip_code: zipCodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address_type: z.enum(['service', 'billing', 'mailing', 'other']).optional(),
  is_primary: z.boolean().optional(),
});

export type LeadAddressFormData = z.infer<typeof leadAddressSchema>;

/**
 * Lead creation validation schema
 * CRITICAL: At least ONE email OR phone required
 */
export const createLeadSchema = z
  .object({
    first_name: nameSchema,
    last_name: nameSchema,
    language_spoken: z.string().optional(),
    accept_sms: z.boolean().optional(),
    preferred_communication: z.enum(['email', 'phone', 'sms']).optional(),
    source: z
      .enum(['manual', 'website', 'referral', 'phone_call', 'walk_in', 'social_media', 'email', 'webhook', 'other'])
      .optional(),
    external_source_id: z.string().max(255).optional(),
    // Contact methods (arrays)
    emails: z
      .array(
        z.object({
          email: leadEmailSchema,
          is_primary: z.boolean().optional(),
        })
      )
      .optional(),
    phones: z
      .array(
        z.object({
          phone: leadPhoneSchema,
          phone_type: z.enum(['mobile', 'home', 'work', 'other']).optional(),
          is_primary: z.boolean().optional(),
        })
      )
      .optional(),
    addresses: z.array(leadAddressSchema).optional(),
    // Service request (optional)
    service_request: z
      .object({
        service_name: z.string().min(1).max(100).optional(),
        service_type: z.string().max(100).optional(),
        service_description: z.string().max(2000).optional(),
        urgency: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
        requested_date: z.string().optional(),
        estimated_value: z.number().min(0).optional(),
        notes: z.string().max(2000).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // At least ONE email OR phone required
      const hasEmail = data.emails && data.emails.length > 0;
      const hasPhone = data.phones && data.phones.length > 0;
      return hasEmail || hasPhone;
    },
    {
      message: 'At least one email or phone number is required',
      path: ['emails'],
    }
  );

export type CreateLeadFormData = z.infer<typeof createLeadSchema>;

/**
 * Update lead validation schema
 */
export const updateLeadSchema = z.object({
  first_name: nameSchema.optional(),
  last_name: nameSchema.optional(),
  language_spoken: z.string().optional(),
  accept_sms: z.boolean().optional(),
  preferred_communication: z.enum(['email', 'phone', 'sms']).optional(),
});

export type UpdateLeadFormData = z.infer<typeof updateLeadSchema>;

/**
 * Update lead status validation
 */
export const updateLeadStatusSchema = z
  .object({
    status: z.enum(['lead', 'prospect', 'customer', 'lost']),
    lost_reason: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      // If status is 'lost', lost_reason is required
      if (data.status === 'lost') {
        return !!data.lost_reason && data.lost_reason.trim() !== '';
      }
      return true;
    },
    {
      message: 'Lost reason is required when marking lead as lost',
      path: ['lost_reason'],
    }
  );

export type UpdateLeadStatusFormData = z.infer<typeof updateLeadStatusSchema>;

/**
 * Add email validation
 */
export const addEmailSchema = z.object({
  email: leadEmailSchema,
  is_primary: z.boolean().optional(),
});

export type AddEmailFormData = z.infer<typeof addEmailSchema>;

/**
 * Add phone validation
 */
export const addPhoneSchema = z.object({
  phone: leadPhoneSchema,
  phone_type: z.enum(['mobile', 'home', 'work', 'other']).optional(),
  is_primary: z.boolean().optional(),
});

export type AddPhoneFormData = z.infer<typeof addPhoneSchema>;

/**
 * Add note validation
 */
export const addNoteSchema = z.object({
  note_text: z.string().min(1, 'Note text is required').max(5000),
  is_pinned: z.boolean().optional(),
});

export type AddNoteFormData = z.infer<typeof addNoteSchema>;

/**
 * Service request validation
 */
export const createServiceRequestSchema = z.object({
  service_name: z.string().min(1, 'Service name is required').max(100),
  service_type: z.string().max(100).optional(),
  service_description: z.string().min(1, 'Description is required').max(2000),
  urgency: z.enum(['low', 'medium', 'high', 'emergency']).optional(),
  requested_date: z.string().optional(),
  estimated_value: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateServiceRequestFormData = z.infer<typeof createServiceRequestSchema>;

/**
 * Webhook API key creation validation
 */
export const createWebhookKeySchema = z.object({
  key_name: z.string().min(3, 'Key name must be at least 3 characters').max(100),
});

export type CreateWebhookKeyFormData = z.infer<typeof createWebhookKeySchema>;

// ==========================================
// QUOTES MODULE VALIDATION SCHEMAS
// ==========================================

/**
 * Quote address validation
 */
export const quoteAddressSchema = z.object({
  address_line1: z.string().min(1, 'Address is required').max(255),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: stateCodeSchema.optional().or(z.literal('')),
  zip_code: zipCodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type QuoteAddressFormData = z.infer<typeof quoteAddressSchema>;

/**
 * Create quote validation
 */
export const createQuoteSchema = z.object({
  lead_id: z.string().uuid('Invalid lead ID'),
  vendor_id: z.string().uuid('Invalid vendor ID'),
  title: z.string().min(1, 'Title is required').max(200),
  jobsite_address: quoteAddressSchema,
  po_number: z.string().max(100).optional().or(z.literal('')),
  expiration_days: z.number().int().min(1).optional(),
  use_default_settings: z.boolean().optional(),
  custom_profit_percent: z.number().min(0).max(100).optional(),
  custom_overhead_percent: z.number().min(0).max(100).optional(),
  private_notes: z.string().max(5000).optional().or(z.literal('')),
});

export type CreateQuoteFormData = z.infer<typeof createQuoteSchema>;

/**
 * Create quote with new customer validation
 */
export const createQuoteWithCustomerSchema = z.object({
  customer: z.object({
    first_name: nameSchema,
    last_name: nameSchema,
    email: emailSchema,
    phone: leadPhoneSchema,
    company_name: z.string().max(200).optional().or(z.literal('')),
  }),
  vendor_id: z.string().uuid('Invalid vendor ID'),
  title: z.string().min(1, 'Title is required').max(200),
  jobsite_address: quoteAddressSchema,
  po_number: z.string().max(100).optional().or(z.literal('')),
  expiration_days: z.number().int().min(1).optional(),
});

export type CreateQuoteWithCustomerFormData = z.infer<typeof createQuoteWithCustomerSchema>;

/**
 * Update quote validation
 */
export const updateQuoteSchema = z.object({
  vendor_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  po_number: z.string().max(100).optional().or(z.literal('')),
  expiration_date: z.string().optional(),
  custom_profit_percent: z.number().min(0).max(100).optional(),
  custom_overhead_percent: z.number().min(0).max(100).optional(),
  show_line_items: z.boolean().optional(),
  show_cost_breakdown: z.boolean().optional(),
  internal_notes: z.string().max(5000).optional().or(z.literal('')),
  customer_notes: z.string().max(5000).optional().or(z.literal('')),
  payment_terms: z.string().max(500).optional().or(z.literal('')),
  payment_schedule: z.string().max(1000).optional().or(z.literal('')),
});

export type UpdateQuoteFormData = z.infer<typeof updateQuoteSchema>;

/**
 * Create vendor validation
 */
export const createVendorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: emailSchema,
  phone: leadPhoneSchema,
  address_line1: z.string().min(1, 'Address is required').max(255),
  address_line2: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: stateCodeSchema.optional().or(z.literal('')),
  zip_code: zipCodeSchema,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  signature_file_id: z.string().uuid('Invalid file ID'),
  is_default: z.boolean().optional(),
});

export type CreateVendorFormData = z.infer<typeof createVendorSchema>;

/**
 * Quote settings validation
 */
export const quoteSettingsSchema = z.object({
  default_profit_percent: z.number().min(0, 'Profit must be at least 0%').max(100, 'Profit cannot exceed 100%'),
  default_overhead_percent: z.number().min(0, 'Overhead must be at least 0%').max(100, 'Overhead cannot exceed 100%'),
  default_tax_percent: z.number().min(0, 'Tax must be at least 0%').max(100, 'Tax cannot exceed 100%'),
  default_expiration_days: z.number().int().min(1, 'Expiration days must be at least 1'),
  quote_number_format: z.string().min(1, 'Quote number format is required'),
  require_approval: z.boolean(),
  approval_thresholds: z.array(
    z.object({
      level: z.number().int().min(1),
      min_amount: z.number().min(0),
      max_amount: z.number().min(0).nullable(),
      approver_user_id: z.string().uuid(),
      profitability_threshold_percent: z.number().min(0).max(100),
    })
  ).optional(),
});

export type QuoteSettingsFormData = z.infer<typeof quoteSettingsSchema>;

// ==========================================
// QUOTE ITEMS VALIDATION SCHEMAS
// ==========================================

/**
 * Create quote item validation
 */
export const createQuoteItemSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().or(z.literal('')),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  unit_measurement_id: z.string().uuid('Invalid unit measurement'),
  material_cost_per_unit: z.number().min(0),
  labor_cost_per_unit: z.number().min(0),
  equipment_cost_per_unit: z.number().min(0),
  subcontract_cost_per_unit: z.number().min(0),
  other_cost_per_unit: z.number().min(0),
  quote_group_id: z.string().uuid().optional(),
  warranty_tier_id: z.string().uuid().optional(),
});

export type CreateQuoteItemFormData = z.infer<typeof createQuoteItemSchema>;

/**
 * Update quote item validation
 */
export const updateQuoteItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  quantity: z.number().min(0.01).optional(),
  unit_measurement_id: z.string().uuid().optional(),
  material_cost_per_unit: z.number().min(0).optional(),
  labor_cost_per_unit: z.number().min(0).optional(),
  equipment_cost_per_unit: z.number().min(0).optional(),
  subcontract_cost_per_unit: z.number().min(0).optional(),
  other_cost_per_unit: z.number().min(0).optional(),
  warranty_tier_id: z.string().uuid().optional(),
});

export type UpdateQuoteItemFormData = z.infer<typeof updateQuoteItemSchema>;
