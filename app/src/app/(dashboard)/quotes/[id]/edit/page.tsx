/**
 * Quote Edit Page
 * Single-page form for editing quote basic information
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { VendorSelector } from '@/components/quotes/VendorSelector';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { getQuoteById, updateQuote, isQuoteEditable } from '@/lib/api/quotes';
import { getQuoteSettings } from '@/lib/api/quote-settings';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  Info,
  Percent,
  CheckSquare,
} from 'lucide-react';
import type { Quote, VendorSummary, UpdateQuoteDto, QuoteSettings } from '@/lib/types/quotes';

export default function QuoteEditPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;

  // State
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  // Form data
  const [formData, setFormData] = useState<UpdateQuoteDto>({});
  const [vendorId, setVendorId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Quote settings (for default placeholders)
  const [quoteSettings, setQuoteSettings] = useState<QuoteSettings | null>(null);

  useEffect(() => {
    loadQuote();
    loadQuoteSettings();
  }, [quoteId]);

  const loadQuote = async () => {
    try {
      setLoading(true);
      const data = await getQuoteById(quoteId);
      setQuote(data);

      // Pre-fill form
      setFormData({
        title: data.title,
        vendor_id: data.vendor_id,
        po_number: data.po_number || '',
        expiration_date: data.expires_at ? data.expires_at.split('T')[0] : '',
        custom_profit_percent: data.custom_profit_percent ?? undefined,
        custom_overhead_percent: data.custom_overhead_percent ?? undefined,
        custom_contingency_percent: data.custom_contingency_percent ?? undefined,
        custom_tax_rate: data.custom_tax_rate ?? undefined,
        private_notes: data.private_notes || '',
        custom_terms: data.custom_terms || '',
        custom_payment_instructions: data.custom_payment_instructions || '',
      });
      setVendorId(data.vendor_id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load quote');
      setMessageModalOpen(true);
      setTimeout(() => router.push('/quotes'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const loadQuoteSettings = async () => {
    try {
      const settings = await getQuoteSettings();
      setQuoteSettings(settings);
    } catch (err: any) {
      console.error('Failed to load quote settings:', err);
      // Don't show error - settings are optional for placeholders
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!vendorId) {
      newErrors.vendor = 'Vendor is required';
    }

    if (
      formData.custom_profit_percent !== undefined &&
      formData.custom_profit_percent !== null &&
      (formData.custom_profit_percent < 0 || formData.custom_profit_percent > 100)
    ) {
      newErrors.profit = 'Profit must be between 0-100%';
    }

    if (
      formData.custom_overhead_percent !== undefined &&
      formData.custom_overhead_percent !== null &&
      (formData.custom_overhead_percent < 0 || formData.custom_overhead_percent > 100)
    ) {
      newErrors.overhead = 'Overhead must be between 0-100%';
    }

    if (
      formData.custom_contingency_percent !== undefined &&
      formData.custom_contingency_percent !== null &&
      (formData.custom_contingency_percent < 0 || formData.custom_contingency_percent > 100)
    ) {
      newErrors.contingency = 'Contingency must be between 0-100%';
    }

    if (
      formData.custom_tax_rate !== undefined &&
      formData.custom_tax_rate !== null &&
      (formData.custom_tax_rate < 0 || formData.custom_tax_rate > 100)
    ) {
      newErrors.tax_rate = 'Tax rate must be between 0-100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const dto: UpdateQuoteDto = {
        ...formData,
        vendor_id: vendorId,
      };

      await updateQuote(quoteId, dto);
      setSuccessMessage('Quote updated successfully');
      setMessageModalOpen(true);
      setTimeout(() => router.push(`/quotes/${quoteId}`), 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update quote');
      setMessageModalOpen(true);
      setSaving(false);
    }
  };

  const handleVendorChange = (id: string | null, data: VendorSummary | null) => {
    if (id) {
      setVendorId(id);
      setFormData({ ...formData, vendor_id: id });
      setErrors({ ...errors, vendor: '' });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!quote) {
    return null;
  }

  const editable = isQuoteEditable(quote.status);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href={`/quotes/${quoteId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Quote
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Edit Quote
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">
              {quote.quote_number}
            </p>
          </div>
          <QuoteStatusBadge status={quote.status} className="self-start md:self-center" />
        </div>
      </div>

      {/* Info Notice */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-1">Editing Basic Information</p>
            <p>
              You can only edit basic quote information here. To edit items, groups, or other
              details, go to the quote detail page.
            </p>
          </div>
        </div>
      </div>

      {/* Status Warning */}
      {!editable && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-900 dark:text-red-100">
              <p className="font-semibold mb-1">Quote Cannot Be Edited</p>
              <p>
                Quotes with status "{quote.status}" cannot be edited. Only draft, pending, ready,
                sent, and viewed quotes can be modified.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit Form */}
      <Card className="p-6 space-y-6">
        {/* Basic Information */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <Input
              label="Title"
              placeholder="Quote title"
              value={formData.title || ''}
              onChange={(e) => {
                setFormData({ ...formData, title: e.target.value });
                setErrors({ ...errors, title: '' });
              }}
              error={errors.title}
              required
              disabled={!editable}
            />

            <VendorSelector
              value={vendorId}
              onChange={handleVendorChange}
              error={errors.vendor}
              required
              showDetails
            />

            <Input
              label="PO Number"
              placeholder="PO-12345"
              value={formData.po_number || ''}
              onChange={(e) =>
                setFormData({ ...formData, po_number: e.target.value })
              }
              disabled={!editable}
            />

            <DatePicker
              label="Expiration Date"
              value={formData.expiration_date || ''}
              onChange={(e) =>
                setFormData({ ...formData, expiration_date: e.target.value })
              }
              disabled={!editable}
              required
            />
          </div>
        </div>

        {/* Custom Percentages */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Pricing Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Custom Profit %"
              type="number"
              placeholder={quoteSettings?.default_profit_margin?.toString() || '25'}
              value={formData.custom_profit_percent ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_profit_percent: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                })
              }
              error={errors.profit}
              rightIcon={<Percent className="w-4 h-4" />}
              disabled={!editable}
              helperText="Leave empty to use default settings"
            />

            <Input
              label="Custom Overhead %"
              type="number"
              placeholder={quoteSettings?.default_overhead_rate?.toString() || '15'}
              value={formData.custom_overhead_percent ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_overhead_percent: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                })
              }
              error={errors.overhead}
              rightIcon={<Percent className="w-4 h-4" />}
              disabled={!editable}
              helperText="Leave empty to use default settings"
            />

            <Input
              label="Custom Contingency %"
              type="number"
              placeholder={quoteSettings?.default_contingency_rate?.toString() || '10'}
              value={formData.custom_contingency_percent ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_contingency_percent: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                })
              }
              error={errors.contingency}
              rightIcon={<Percent className="w-4 h-4" />}
              disabled={!editable}
              helperText="Leave empty to use default settings"
            />

            <Input
              label="Custom Tax Rate %"
              type="number"
              placeholder={quoteSettings?.sales_tax_rate?.toString() || '0'}
              value={formData.custom_tax_rate ?? ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  custom_tax_rate: e.target.value
                    ? parseFloat(e.target.value)
                    : null,
                })
              }
              error={errors.tax_rate}
              rightIcon={<Percent className="w-4 h-4" />}
              disabled={!editable}
              helperText="Leave empty to use default settings"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Notes & Terms
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Private Notes
              </label>
              <textarea
                rows={4}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                placeholder="Internal notes (not visible to customer)"
                value={formData.private_notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, private_notes: e.target.value })
                }
                disabled={!editable}
              />
            </div>

            <Input
              label="Custom Terms"
              placeholder="e.g., Net 30, Due on receipt"
              value={formData.custom_terms || ''}
              onChange={(e) =>
                setFormData({ ...formData, custom_terms: e.target.value })
              }
              disabled={!editable}
            />

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Custom Payment Instructions
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
                placeholder="e.g., 50% deposit, 50% on completion"
                value={formData.custom_payment_instructions || ''}
                onChange={(e) =>
                  setFormData({ ...formData, custom_payment_instructions: e.target.value })
                }
                disabled={!editable}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 mt-6">
        <Link href={`/quotes/${quoteId}`}>
          <Button variant="ghost" disabled={saving}>
            Cancel
          </Button>
        </Link>
        <Button onClick={handleSubmit} loading={saving} disabled={!editable}>
          <Save className="w-4 h-4" />
          Save Changes
        </Button>
      </div>

      {/* Message Modal */}
      <Modal
        isOpen={messageModalOpen}
        onClose={() => !successMessage && setMessageModalOpen(false)}
        title={successMessage ? 'Success' : 'Error'}
        size="sm"
        showCloseButton={!!errorMessage}
      >
        <ModalContent>
          <p
            className={
              successMessage
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }
          >
            {successMessage || errorMessage}
          </p>
        </ModalContent>
        {errorMessage && (
          <ModalActions>
            <Button onClick={() => setMessageModalOpen(false)}>Close</Button>
          </ModalActions>
        )}
      </Modal>
    </div>
  );
}
