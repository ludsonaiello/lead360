/**
 * Quote Settings Page
 * Configure quote defaults, numbering, terms, and approval thresholds
 * Matches actual API structure with 20 fields
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import {
  Save,
  RotateCcw,
  Percent,
  Calendar,
  Hash,
  Shield,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  DollarSign,
  Settings,
} from 'lucide-react';
import {
  getQuoteSettings as fetchQuoteSettings,
  updateQuoteSettings as saveQuoteSettings,
  resetQuoteSettings as resetToDefaults,
} from '@/lib/api/quote-settings';
import type { QuoteSettings } from '@/lib/types/quotes';

export default function QuoteSettingsPage() {
  const router = useRouter();

  // State with all 20 fields
  const [settings, setSettings] = useState<QuoteSettings>({
    // Financial defaults
    default_profit_margin: 20,
    default_overhead_rate: 10,
    default_contingency_rate: 5,
    sales_tax_rate: 6.5,
    profitability_thresholds: null,

    // Quote numbering
    quote_prefix: 'Q-',
    next_quote_number: 1,

    // Invoice numbering
    invoice_prefix: 'INV-',
    next_invoice_number: 1,

    // Terms & text
    default_quote_terms: null,
    default_payment_instructions: null,
    default_quote_validity_days: 30,
    default_quote_footer: null,
    default_invoice_footer: null,

    // Display preferences
    show_line_items_by_default: true,
    show_cost_breakdown_by_default: false,

    // Workflow configuration
    approval_thresholds: null,
    active_quote_template_id: null,

    // Meta
    is_using_system_defaults: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  // Section expansion
  const [financialExpanded, setFinancialExpanded] = useState(true);
  const [numberingExpanded, setNumberingExpanded] = useState(false);
  const [termsExpanded, setTermsExpanded] = useState(false);
  const [displayExpanded, setDisplayExpanded] = useState(false);
  const [approvalExpanded, setApprovalExpanded] = useState(false);

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await fetchQuoteSettings();
      // Merge API data with defaults to ensure all fields are defined
      setSettings({
        default_profit_margin: data.default_profit_margin ?? 20,
        default_overhead_rate: data.default_overhead_rate ?? 10,
        default_contingency_rate: data.default_contingency_rate ?? 5,
        sales_tax_rate: data.sales_tax_rate ?? null,
        profitability_thresholds: data.profitability_thresholds ?? null,
        quote_prefix: data.quote_prefix ?? 'Q-',
        next_quote_number: data.next_quote_number ?? 1,
        invoice_prefix: data.invoice_prefix ?? 'INV-',
        next_invoice_number: data.next_invoice_number ?? 1,
        default_quote_terms: data.default_quote_terms ?? null,
        default_payment_instructions: data.default_payment_instructions ?? null,
        default_quote_validity_days: data.default_quote_validity_days ?? 30,
        default_quote_footer: data.default_quote_footer ?? null,
        default_invoice_footer: data.default_invoice_footer ?? null,
        show_line_items_by_default: data.show_line_items_by_default ?? true,
        show_cost_breakdown_by_default: data.show_cost_breakdown_by_default ?? false,
        approval_thresholds: data.approval_thresholds ?? null,
        active_quote_template_id: data.active_quote_template_id ?? null,
        is_using_system_defaults: data.is_using_system_defaults ?? false,
      });
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Financial validation
    if (settings.default_profit_margin < 0 || settings.default_profit_margin > 100) {
      newErrors.profit = 'Profit margin must be between 0-100%';
    }
    if (settings.default_overhead_rate < 0 || settings.default_overhead_rate > 100) {
      newErrors.overhead = 'Overhead rate must be between 0-100%';
    }
    if (settings.default_contingency_rate < 0 || settings.default_contingency_rate > 100) {
      newErrors.contingency = 'Contingency rate must be between 0-100%';
    }
    if (settings.sales_tax_rate !== null && (settings.sales_tax_rate < 0 || settings.sales_tax_rate > 100)) {
      newErrors.tax = 'Sales tax rate must be between 0-100%';
    }

    // Numbering validation
    if (!settings.quote_prefix.trim()) {
      newErrors.quotePrefix = 'Quote prefix is required';
    }
    if (settings.next_quote_number < 1) {
      newErrors.quoteNumber = 'Quote number must be at least 1';
    }
    if (!settings.invoice_prefix.trim()) {
      newErrors.invoicePrefix = 'Invoice prefix is required';
    }
    if (settings.next_invoice_number < 1) {
      newErrors.invoiceNumber = 'Invoice number must be at least 1';
    }

    // Validity days validation
    if (settings.default_quote_validity_days < 1) {
      newErrors.validity = 'Quote validity must be at least 1 day';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const updatedSettings = await saveQuoteSettings(settings);
      setSettings({
        default_profit_margin: updatedSettings.default_profit_margin ?? settings.default_profit_margin,
        default_overhead_rate: updatedSettings.default_overhead_rate ?? settings.default_overhead_rate,
        default_contingency_rate: updatedSettings.default_contingency_rate ?? settings.default_contingency_rate,
        sales_tax_rate: updatedSettings.sales_tax_rate ?? settings.sales_tax_rate,
        profitability_thresholds: updatedSettings.profitability_thresholds ?? settings.profitability_thresholds,
        quote_prefix: updatedSettings.quote_prefix ?? settings.quote_prefix,
        next_quote_number: updatedSettings.next_quote_number ?? settings.next_quote_number,
        invoice_prefix: updatedSettings.invoice_prefix ?? settings.invoice_prefix,
        next_invoice_number: updatedSettings.next_invoice_number ?? settings.next_invoice_number,
        default_quote_terms: updatedSettings.default_quote_terms ?? settings.default_quote_terms,
        default_payment_instructions: updatedSettings.default_payment_instructions ?? settings.default_payment_instructions,
        default_quote_validity_days: updatedSettings.default_quote_validity_days ?? settings.default_quote_validity_days,
        default_quote_footer: updatedSettings.default_quote_footer ?? settings.default_quote_footer,
        default_invoice_footer: updatedSettings.default_invoice_footer ?? settings.default_invoice_footer,
        show_line_items_by_default: updatedSettings.show_line_items_by_default ?? settings.show_line_items_by_default,
        show_cost_breakdown_by_default: updatedSettings.show_cost_breakdown_by_default ?? settings.show_cost_breakdown_by_default,
        approval_thresholds: updatedSettings.approval_thresholds ?? settings.approval_thresholds,
        active_quote_template_id: updatedSettings.active_quote_template_id ?? settings.active_quote_template_id,
        is_using_system_defaults: updatedSettings.is_using_system_defaults ?? settings.is_using_system_defaults,
      });
      showSuccess('Settings saved successfully');
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const response = await resetToDefaults();
      setSettings(response.settings);
      setResetModalOpen(false);
      showSuccess('Settings reset to defaults');
    } catch (err: any) {
      showError(err.response?.data?.message || err.message || 'Failed to reset settings');
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setErrorMessage('');
    setMessageModalOpen(true);
    setTimeout(() => setMessageModalOpen(false), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setSuccessMessage('');
    setMessageModalOpen(true);
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Quote Settings</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Configure default values and preferences for quotes and invoices
            </p>
          </div>
          {settings.is_using_system_defaults && (
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-sm font-medium rounded-full">
              Using System Defaults
            </span>
          )}
        </div>
      </div>

      {/* Info Notice */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-semibold mb-1">About These Settings</p>
            <p>
              These settings apply to all new quotes and invoices. Existing documents will not be
              affected.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Financial Defaults Section */}
        <Card>
          <button
            onClick={() => setFinancialExpanded(!financialExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Financial Defaults
            </h2>
            {financialExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {financialExpanded && (
            <div className="px-6 pb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Default Profit Margin %"
                  type="number"
                  step="0.1"
                  placeholder="20.0"
                  value={settings.default_profit_margin}
                  onChange={(e) =>
                    setSettings({ ...settings, default_profit_margin: parseFloat(e.target.value) || 0 })
                  }
                  error={errors.profit}
                  rightIcon={<Percent className="w-4 h-4" />}
                  helperText="Default profit margin for new quotes"
                  required
                />

                <Input
                  label="Default Overhead Rate %"
                  type="number"
                  step="0.1"
                  placeholder="10.0"
                  value={settings.default_overhead_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, default_overhead_rate: parseFloat(e.target.value) || 0 })
                  }
                  error={errors.overhead}
                  rightIcon={<Percent className="w-4 h-4" />}
                  helperText="Default overhead percentage"
                  required
                />

                <Input
                  label="Default Contingency Rate %"
                  type="number"
                  step="0.1"
                  placeholder="5.0"
                  value={settings.default_contingency_rate}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_contingency_rate: parseFloat(e.target.value) || 0,
                    })
                  }
                  error={errors.contingency}
                  rightIcon={<Percent className="w-4 h-4" />}
                  helperText="Buffer for unexpected costs"
                  required
                />

                <Input
                  label="Sales Tax Rate %"
                  type="number"
                  step="0.01"
                  placeholder="6.5 (or leave empty)"
                  value={settings.sales_tax_rate ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings({
                      ...settings,
                      sales_tax_rate: val === '' ? null : parseFloat(val) || 0,
                    });
                  }}
                  error={errors.tax}
                  rightIcon={<Percent className="w-4 h-4" />}
                  helperText="Default sales tax rate (optional)"
                />
              </div>
            </div>
          )}
        </Card>

        {/* Quote & Invoice Numbering Section */}
        <Card>
          <button
            onClick={() => setNumberingExpanded(!numberingExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Hash className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Quote & Invoice Numbering
            </h2>
            {numberingExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {numberingExpanded && (
            <div className="px-6 pb-6 space-y-6">
              {/* Quote Numbering */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Quote Numbers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Quote Prefix"
                    placeholder="Q-"
                    value={settings.quote_prefix}
                    onChange={(e) => setSettings({ ...settings, quote_prefix: e.target.value })}
                    error={errors.quotePrefix}
                    helperText="Prefix for quote numbers"
                    required
                  />

                  <Input
                    label="Next Quote Number"
                    type="number"
                    placeholder="1"
                    value={settings.next_quote_number}
                    onChange={(e) =>
                      setSettings({ ...settings, next_quote_number: parseInt(e.target.value) || 1 })
                    }
                    error={errors.quoteNumber}
                    helperText="Next sequential number"
                    required
                  />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Next Quote Number:
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {settings.quote_prefix}
                    {settings.next_quote_number}
                  </p>
                </div>
              </div>

              {/* Invoice Numbering */}
              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Invoice Numbers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Invoice Prefix"
                    placeholder="INV-"
                    value={settings.invoice_prefix}
                    onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
                    error={errors.invoicePrefix}
                    helperText="Prefix for invoice numbers"
                    required
                  />

                  <Input
                    label="Next Invoice Number"
                    type="number"
                    placeholder="1"
                    value={settings.next_invoice_number}
                    onChange={(e) =>
                      setSettings({ ...settings, next_invoice_number: parseInt(e.target.value) || 1 })
                    }
                    error={errors.invoiceNumber}
                    helperText="Next sequential number"
                    required
                  />
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Next Invoice Number:
                  </p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {settings.invoice_prefix}
                    {settings.next_invoice_number}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Quote Terms & Text Section */}
        <Card>
          <button
            onClick={() => setTermsExpanded(!termsExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Quote Terms & Text
            </h2>
            {termsExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {termsExpanded && (
            <div className="px-6 pb-6 space-y-4">
              <Input
                label="Quote Validity Days"
                type="number"
                placeholder="30"
                value={settings.default_quote_validity_days}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    default_quote_validity_days: parseInt(e.target.value) || 0,
                  })
                }
                error={errors.validity}
                rightIcon={<Calendar className="w-4 h-4" />}
                helperText="Number of days until quotes expire"
                required
              />

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Default Quote Terms
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600"
                  placeholder="Payment due upon completion..."
                  value={settings.default_quote_terms || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, default_quote_terms: e.target.value || null })
                  }
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Standard terms and conditions for quotes
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Default Payment Instructions
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600"
                  placeholder="Check or cash accepted..."
                  value={settings.default_payment_instructions || ''}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      default_payment_instructions: e.target.value || null,
                    })
                  }
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Instructions for how customers can pay
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Default Quote Footer
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600"
                  placeholder="Thank you for your business!"
                  value={settings.default_quote_footer || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, default_quote_footer: e.target.value || null })
                  }
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Custom footer text for quote PDFs
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Default Invoice Footer
                </label>
                <textarea
                  rows={3}
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600"
                  placeholder="Payment due within 30 days..."
                  value={settings.default_invoice_footer || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, default_invoice_footer: e.target.value || null })
                  }
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Custom footer text for invoice PDFs
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Display Options Section */}
        <Card>
          <button
            onClick={() => setDisplayExpanded(!displayExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Display Options
            </h2>
            {displayExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {displayExpanded && (
            <div className="px-6 pb-6 space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.show_line_items_by_default}
                  onChange={(e) =>
                    setSettings({ ...settings, show_line_items_by_default: e.target.checked })
                  }
                  className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Show Line Items by Default
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display individual line items in quote PDFs and public views
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.show_cost_breakdown_by_default}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      show_cost_breakdown_by_default: e.target.checked,
                    })
                  }
                  className="w-5 h-5 text-blue-600 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Show Cost Breakdown by Default
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display detailed cost breakdown (materials, labor, etc.) in PDFs
                  </p>
                </div>
              </label>
            </div>
          )}
        </Card>

        {/* Approval Thresholds Section */}
        <Card>
          <button
            onClick={() => setApprovalExpanded(!approvalExpanded)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Approval Thresholds
            </h2>
            {approvalExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {approvalExpanded && (
            <div className="px-6 pb-6 space-y-4">
              {settings.approval_thresholds && settings.approval_thresholds.length > 0 ? (
                <div className="space-y-3">
                  {settings.approval_thresholds.map((threshold, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            Level {threshold.level}: {threshold.approver_role}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Quotes over ${threshold.amount.toLocaleString()} require{' '}
                            {threshold.approver_role} approval
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800 text-center">
                  <p className="text-sm text-green-900 dark:text-green-100 font-medium">
                    Approval Workflow Disabled
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    All quotes are automatically approved when submitted.
                  </p>
                </div>
              )}

              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {settings.approval_thresholds && settings.approval_thresholds.length > 0
                        ? 'Approval thresholds determine which quotes require approval before sending. Configure multi-level workflows based on quote amounts.'
                        : 'Approval workflow is currently disabled. Enable it by adding approval thresholds to require manager/admin approval for quotes above certain amounts.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={settings.approval_thresholds && settings.approval_thresholds.length > 0 ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={() => router.push('/settings/quotes/approvals')}
                    className="flex-shrink-0 whitespace-nowrap"
                  >
                    <Settings className="w-4 h-4" />
                    {settings.approval_thresholds && settings.approval_thresholds.length > 0
                      ? 'Manage Thresholds'
                      : 'Enable Approvals'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-8">
        <Button variant="ghost" onClick={() => setResetModalOpen(true)} disabled={saving}>
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </Button>

        <Button onClick={handleSave} loading={saving}>
          <Save className="w-4 h-4" />
          Save Settings
        </Button>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        title="Reset to Defaults"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to reset all settings to defaults?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will overwrite your current settings. This action cannot be undone.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="ghost" onClick={() => setResetModalOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleReset}>
            Reset Settings
          </Button>
        </ModalActions>
      </Modal>

      {/* Success/Error Message Modal */}
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
