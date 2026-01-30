// Lead360 - Quote PDF Generation API Client
// Sprint 5: PDF Generation (3 endpoints with smart caching)
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import { buildFileUrl } from './files';
import type { GeneratePdfDto, PdfResponse } from '@/lib/types/quotes';

// ========== PDF GENERATION (3 endpoints) ==========

/**
 * Generate PDF for quote (with smart caching)
 * @endpoint POST /quotes/:id/generate-pdf
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param dto Generation options
 * @returns PDF file metadata with download URL
 * @throws 400 - Quote not ready (missing required data)
 * @throws 404 - Quote not found
 * @throws 500 - PDF generation failed
 *
 * @note Smart Caching:
 * - Returns cached PDF if quote unchanged and params match
 * - Regenerates only if quote modified or force_regenerate=true
 * - Old PDFs automatically deleted when regenerating
 * - Response includes regenerated: boolean flag
 *
 * @note PDF includes:
 * - Company branding
 * - Quote details and line items
 * - Attachments (photos, QR codes)
 * - Terms and conditions
 * - Cost breakdown (if include_cost_breakdown = true)
 *
 * @note Cost breakdown shows:
 * - Material, labor, equipment, subcontract, other costs per item
 * - Profit, overhead, contingency percentages
 * - Internal use only (not shown to customers)
 */
export const generatePdf = async (
  quoteId: string,
  dto?: GeneratePdfDto
): Promise<PdfResponse> => {
  const { data } = await apiClient.post<PdfResponse>(
    `/quotes/${quoteId}/generate-pdf`,
    dto || {}
  );
  return data;
};

/**
 * Preview PDF (optimized for speed)
 * @endpoint GET /quotes/:id/preview-pdf
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param includeCostBreakdown Include cost breakdown (default: false)
 * @returns PDF file metadata with download URL
 * @throws 404 - Quote not found
 * @throws 500 - PDF generation failed
 *
 * @note Performance Optimized:
 * - ALWAYS returns cached PDF if available (<100ms)
 * - Generates only if cache missing or stale
 * - NEVER forces regeneration
 * - Use this for preview actions
 *
 * @note First preview: 2-5 seconds (generates)
 * @note Subsequent previews: <100ms (cached)
 */
export const previewPdf = async (
  quoteId: string,
  includeCostBreakdown: boolean = false
): Promise<PdfResponse> => {
  const { data } = await apiClient.get<PdfResponse>(
    `/quotes/${quoteId}/preview-pdf`,
    {
      params: { include_cost_breakdown: includeCostBreakdown },
    }
  );
  return data;
};

/**
 * Get PDF download URL (with smart caching)
 * @endpoint GET /quotes/:id/download-pdf
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns PDF file metadata with download URL
 * @throws 404 - Quote not found
 * @throws 500 - PDF generation failed
 *
 * @note Smart Caching:
 * - Returns cached PDF if available and up-to-date
 * - Regenerates only if cache missing or quote modified
 * - Fast response time for cached PDFs
 */
export const downloadPdf = async (quoteId: string): Promise<PdfResponse> => {
  const { data } = await apiClient.get<PdfResponse>(`/quotes/${quoteId}/download-pdf`);
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Get full PDF download URL
 * @param pdfResponse PdfResponse object from API
 * @param baseUrl Optional base URL (defaults to current origin)
 * @returns Full URL to PDF file
 *
 * @note Uses buildFileUrl to ensure proper /uploads/ prefix
 * @note Backend returns paths like /public/{tenant}/files/{id}.pdf
 * @note Transformed to /uploads/public/{tenant}/files/{id}.pdf
 */
export const getPdfUrl = (pdfResponse: PdfResponse | null | undefined, baseUrl?: string): string => {
  // Defensive check for missing data
  if (!pdfResponse?.download_url) {
    console.warn('⚠️ getPdfUrl: pdfResponse or download_url is missing', {
      pdfResponse,
      hasDownloadUrl: !!pdfResponse?.download_url,
    });
    return '';
  }

  // Use the centralized buildFileUrl function
  return buildFileUrl(pdfResponse.download_url);
};

/**
 * Download PDF file to user's device
 * @param pdfResponse PdfResponse object from API
 * @param customFilename Optional custom filename (defaults to API filename)
 */
export const downloadPdfFile = (
  pdfResponse: PdfResponse,
  customFilename?: string
): void => {
  const link = document.createElement('a');
  link.href = getPdfUrl(pdfResponse);
  link.download = customFilename || pdfResponse.filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Open PDF in new tab
 * @param pdfResponse PdfResponse object from API
 */
export const openPdfInNewTab = (pdfResponse: PdfResponse): void => {
  window.open(getPdfUrl(pdfResponse), '_blank');
};

/**
 * Format PDF generation timestamp
 * @param generatedAt ISO timestamp string
 * @returns Formatted date string
 */
export const formatGeneratedAt = (generatedAt: string): string => {
  const date = new Date(generatedAt);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};
