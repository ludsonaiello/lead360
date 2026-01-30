// Lead360 - Quote Email Delivery API Client
// Sprint 5: Email Delivery (1 endpoint)
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type { SendQuoteDto, SendQuoteResponse } from '@/lib/types/quotes';

// ========== EMAIL DELIVERY (1 endpoint) ==========

/**
 * Send quote via email to customer
 * @endpoint POST /quotes/:id/send
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Email options (recipient, CC, custom message)
 * @returns Send status with public URL and PDF file ID
 * @throws 400 - Quote status not "ready" or validation errors
 * @throws 404 - Quote not found
 * @throws 500 - Email sending failed
 *
 * @note Pre-conditions:
 * - Quote status must be "ready"
 * - Quote must have linked lead with email OR recipient_email provided
 *
 * @note Side effects:
 * - Generates PDF automatically (attached to email)
 * - Generates public URL automatically (30-day expiration)
 * - Creates communication event (logged in Communication module)
 * - Updates quote status: ready → sent
 *
 * @note Email template: "send-quote"
 * Includes: Quote number, title, total, public URL, PDF attachment, custom message
 */
export const sendQuote = async (
  quoteId: string,
  dto?: SendQuoteDto
): Promise<SendQuoteResponse> => {
  const { data } = await apiClient.post<SendQuoteResponse>(
    `/quotes/${quoteId}/send`,
    dto || {}
  );
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Validate email address format
 * @param email Email address string
 * @returns boolean
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate multiple email addresses (comma-separated)
 * @param emails Comma-separated email string
 * @returns Array of valid emails
 * @throws Error if any email is invalid
 */
export const parseEmailList = (emails: string): string[] => {
  const emailList = emails
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const invalidEmails = emailList.filter((e) => !isValidEmail(e));
  if (invalidEmails.length > 0) {
    throw new Error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
  }

  return emailList;
};

/**
 * Validate custom message length
 * @param message Custom message string
 * @param maxLength Maximum length (default: 1000)
 * @returns boolean
 */
export const isValidMessageLength = (
  message: string,
  maxLength: number = 1000
): boolean => {
  return message.length <= maxLength;
};

/**
 * Get remaining character count for custom message
 * @param message Current message string
 * @param maxLength Maximum length (default: 1000)
 * @returns Remaining characters
 */
export const getRemainingChars = (
  message: string,
  maxLength: number = 1000
): number => {
  return Math.max(0, maxLength - message.length);
};

/**
 * Format email preview text
 * @param dto SendQuoteDto object
 * @param quoteNumber Quote number
 * @param customerName Customer full name
 * @returns Preview text for confirmation modal
 */
export const getEmailPreview = (
  dto: SendQuoteDto,
  quoteNumber: string,
  customerName: string
): string => {
  const recipient = dto.recipient_email || customerName;
  const cc = dto.cc_emails && dto.cc_emails.length > 0
    ? `\nCC: ${dto.cc_emails.join(', ')}`
    : '';
  const message = dto.custom_message
    ? `\n\nCustom Message:\n"${dto.custom_message}"`
    : '';

  return `Sending quote ${quoteNumber} to ${recipient}${cc}${message}`;
};

/**
 * Copy public URL to clipboard
 * @param publicUrl Public URL string
 * @returns Promise<boolean> - true if copied successfully
 */
export const copyPublicUrl = async (publicUrl: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(publicUrl);
    return true;
  } catch (error) {
    console.error('Failed to copy URL:', error);
    return false;
  }
};
