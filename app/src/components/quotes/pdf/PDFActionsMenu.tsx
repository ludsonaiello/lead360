/**
 * PDF Actions Menu Component
 * Button group for PDF operations (Generate, Preview, Download)
 * Includes settings dropdown for cost breakdown option
 */

'use client';

import React, { useState } from 'react';
import { FileText, Eye, Download, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { PdfResponse } from '@/lib/types/quotes';
import { generatePdf, previewPdf, downloadPdf, downloadPdfFile } from '@/lib/api/quote-pdf';
import { PDFPreviewModal } from './PDFPreviewModal';
import { PDFSettingsForm } from './PDFSettingsForm';

interface PDFActionsMenuProps {
  quoteId: string;
  quoteNumber: string;
  className?: string;
}

export function PDFActionsMenu({ quoteId, quoteNumber, className = '' }: PDFActionsMenuProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [includeCostBreakdown, setIncludeCostBreakdown] = useState(false);
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [currentPdf, setCurrentPdf] = useState<PdfResponse | null>(null);

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      const pdf = await generatePdf(quoteId, {
        include_cost_breakdown: includeCostBreakdown,
        force_regenerate: forceRegenerate,
      });
      setCurrentPdf(pdf);

      // Show appropriate success message
      if (pdf.regenerated) {
        toast.success('PDF generated successfully');
      } else {
        toast.success('PDF returned from cache (no changes detected)');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    setIsGenerating(true);
    try {
      // Use optimized preview endpoint (never forces regeneration)
      const pdf = await previewPdf(quoteId, includeCostBreakdown);
      setCurrentPdf(pdf);
      setShowPreview(true);

      // Show performance feedback
      if (pdf.regenerated) {
        toast.success('PDF preview generated');
      } else {
        toast.success('PDF preview loaded from cache (instant)');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load PDF preview');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const pdf = await downloadPdf(quoteId);
      downloadPdfFile(pdf, `${quoteNumber}.pdf`);

      // Show appropriate success message
      if (pdf.regenerated) {
        toast.success('PDF downloaded (newly generated)');
      } else {
        toast.success('PDF downloaded from cache');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to download PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Generate PDF Button */}
        <Button
          variant="primary"
          onClick={handleGeneratePdf}
          loading={isGenerating}
          disabled={isGenerating || isDownloading}
        >
          <FileText className="w-4 h-4 mr-2" />
          Generate PDF
        </Button>

        {/* Preview PDF Button */}
        <Button
          variant="secondary"
          onClick={handlePreviewPdf}
          loading={isGenerating}
          disabled={isGenerating || isDownloading}
        >
          <Eye className="w-4 h-4 mr-2" />
          Preview
        </Button>

        {/* Download PDF Button */}
        <Button
          variant="secondary"
          onClick={handleDownloadPdf}
          loading={isDownloading}
          disabled={isGenerating || isDownloading}
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>

        {/* Settings Button */}
        <Button
          variant="ghost"
          onClick={() => setShowSettings(!showSettings)}
          disabled={isGenerating || isDownloading}
          className="p-2"
        >
          <Settings
            className={`w-5 h-5 transition-transform ${
              showSettings ? 'rotate-90' : ''
            }`}
          />
        </Button>
      </div>

      {/* Settings Dropdown */}
      {showSettings && (
        <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-lg">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
            PDF Generation Settings
          </h3>
          <PDFSettingsForm
            includeCostBreakdown={includeCostBreakdown}
            onToggleCostBreakdown={setIncludeCostBreakdown}
            forceRegenerate={forceRegenerate}
            onToggleForceRegenerate={setForceRegenerate}
            disabled={isGenerating || isDownloading}
          />
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && currentPdf && (
        <PDFPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          pdfResponse={currentPdf}
        />
      )}
    </>
  );
}

export default PDFActionsMenu;
