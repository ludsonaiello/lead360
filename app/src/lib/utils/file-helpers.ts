/**
 * File Helper Utilities
 * Utilities for file validation, formatting, and display
 */

import type { FileCategory, FileCategoryConfig, File } from '@/lib/types/files';
import { FILE_CATEGORY_CONFIG } from '@/lib/types/files';

/**
 * Format file size in bytes to human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "1.76 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get file category configuration
 *
 * @param category - File category (can be null/undefined)
 * @returns Category configuration
 */
export function getCategoryConfig(category: FileCategory | null | undefined): FileCategoryConfig {
  // Fallback to 'misc' category if category is null/undefined or not found
  if (!category || !FILE_CATEGORY_CONFIG[category]) {
    return FILE_CATEGORY_CONFIG['misc'];
  }
  return FILE_CATEGORY_CONFIG[category];
}

/**
 * Format file category enum to display name
 *
 * @param category - File category enum (can be null/undefined)
 * @returns Display name (e.g., "Project Photo")
 */
export function formatFileCategory(category: FileCategory | null | undefined): string {
  // Fallback to 'misc' category if category is null/undefined or not found
  if (!category || !FILE_CATEGORY_CONFIG[category]) {
    return FILE_CATEGORY_CONFIG['misc'].label;
  }
  return FILE_CATEGORY_CONFIG[category].label;
}

/**
 * Get Tailwind color class for file category badge
 *
 * @param category - File category (can be null/undefined)
 * @returns Tailwind color name (e.g., "blue", "green")
 */
export function getFileCategoryColor(category: FileCategory | null | undefined): string {
  // Fallback to 'misc' category if category is null/undefined or not found
  if (!category || !FILE_CATEGORY_CONFIG[category]) {
    return FILE_CATEGORY_CONFIG['misc'].color;
  }
  return FILE_CATEGORY_CONFIG[category].color;
}

/**
 * Validate file before upload (client-side)
 *
 * @param file - File to validate
 * @param category - File category
 * @returns Validation result { valid: boolean, error?: string }
 */
export function validateFile(
  file: globalThis.File,
  category: FileCategory
): { valid: boolean; error?: string } {
  const config = getCategoryConfig(category);

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > config.maxSize) {
    return {
      valid: false,
      error: `File size exceeds ${config.maxSize}MB limit`,
    };
  }

  // Check file type
  if (!config.accept.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Accepted types: ${config.accept.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get icon name for file category
 *
 * @param category - File category (can be null/undefined)
 * @returns Icon name from lucide-react
 */
export function getFileCategoryIcon(category: FileCategory | null | undefined): string {
  // Fallback to 'misc' category if category is null/undefined or not found
  if (!category || !FILE_CATEGORY_CONFIG[category]) {
    return FILE_CATEGORY_CONFIG['misc'].icon;
  }
  return FILE_CATEGORY_CONFIG[category].icon;
}

/**
 * Get file type from MIME type
 *
 * @param mimeType - MIME type (e.g., "image/png")
 * @returns File type ("image", "pdf", "document")
 */
export function getFileType(mimeType: string): 'image' | 'pdf' | 'document' | 'unknown' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/plain' ||
    mimeType === 'text/csv'
  ) {
    return 'document';
  }
  return 'unknown';
}

/**
 * Check if file is an image
 *
 * @param mimeType - MIME type
 * @returns True if image
 */
export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if file is a PDF
 *
 * @param mimeType - MIME type
 * @returns True if PDF
 */
export function isPDF(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

/**
 * Calculate compression ratio
 *
 * @param originalSize - Original file size in bytes
 * @param optimizedSize - Optimized file size in bytes
 * @returns Percentage saved (e.g., "35%")
 */
export function calculateCompressionRatio(originalSize: number, optimizedSize: number): string {
  if (!originalSize || originalSize === optimizedSize) return '0%';

  const saved = ((originalSize - optimizedSize) / originalSize) * 100;
  return `${Math.round(saved)}%`;
}

/**
 * Get file extension from filename
 *
 * @param filename - Filename with extension
 * @returns Extension (e.g., ".pdf", ".jpg")
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

/**
 * Get filename without extension
 *
 * @param filename - Filename with extension
 * @returns Filename without extension
 */
export function getFilenameWithoutExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    parts.pop();
  }
  return parts.join('.');
}

/**
 * Truncate filename for display
 *
 * @param filename - Full filename
 * @param maxLength - Maximum length (default: 30)
 * @returns Truncated filename with extension preserved
 */
export function truncateFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;

  const extension = getFileExtension(filename);
  const nameWithoutExt = getFilenameWithoutExtension(filename);

  const availableLength = maxLength - extension.length - 3; // 3 for "..."

  if (availableLength <= 0) return filename.slice(0, maxLength);

  return `${nameWithoutExt.slice(0, availableLength)}...${extension}`;
}

/**
 * Check if file has a thumbnail
 *
 * @param file - File object
 * @returns True if file has a thumbnail
 */
export function hasThumbnail(file: File): boolean {
  return file.has_thumbnail && !!file.thumbnail_url;
}

/**
 * Get display URL for file (thumbnail if available, otherwise original)
 *
 * @param file - File object
 * @param useThumbnail - Whether to use thumbnail if available (default: true)
 * @returns URL to display
 */
export function getDisplayUrl(file: File, useThumbnail: boolean = true): string {
  if (useThumbnail && hasThumbnail(file)) {
    return file.thumbnail_url!;
  }
  return file.url;
}

/**
 * Parse date string to formatted date
 *
 * @param dateString - ISO date string
 * @returns Formatted date (e.g., "Jan 5, 2026")
 */
export function formatFileDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Parse date string to formatted date and time
 *
 * @param dateString - ISO date string
 * @returns Formatted date and time (e.g., "Jan 5, 2026 at 10:30 AM")
 */
export function formatFileDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Check if share link is expired
 *
 * @param expiresAt - Expiration date string (ISO 8601)
 * @returns True if expired
 */
export function isShareLinkExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Check if share link has reached max downloads
 *
 * @param downloadCount - Current download count
 * @param maxDownloads - Maximum allowed downloads
 * @returns True if max downloads reached
 */
export function isMaxDownloadsReached(downloadCount: number, maxDownloads?: number): boolean {
  if (!maxDownloads) return false;
  return downloadCount >= maxDownloads;
}

/**
 * Copy text to clipboard
 *
 * @param text - Text to copy
 * @returns Promise<boolean> - True if successful
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
