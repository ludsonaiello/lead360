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
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string(),
    first_name: nameSchema,
    last_name: nameSchema,
    phone: phoneSchema,
    tenant_subdomain: subdomainSchema,
    company_name: companyNameSchema,
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
