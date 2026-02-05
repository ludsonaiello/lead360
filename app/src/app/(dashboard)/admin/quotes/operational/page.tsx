/**
 * Quote Admin Operational Tools Page
 * Cross-tenant search, bulk operations, and diagnostics
 */

'use client';

import React, { useState } from 'react';
import { Search, AlertCircle, Settings, FileWarning } from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';
import {
  searchQuotes,
  runQuoteDiagnostics,
  recalculateQuote,
  getOrphanedQuotes,
} from '@/lib/api/quote-admin-operations';
import type {
  AdminQuote,
  QuoteDiagnosticsResponse,
  RecalculateQuoteResponse,
} from '@/lib/types/quote-admin';

export default function OperationalToolsPage() {
  const [activeTab, setActiveTab] = useState('search');
  const [loading, setLoading] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AdminQuote[]>([]);

  // Diagnostics
  const [diagnosticQuoteId, setDiagnosticQuoteId] = useState('');
  const [diagnosticResults, setDiagnosticResults] = useState<QuoteDiagnosticsResponse | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  // Recalculate
  const [recalcResults, setRecalcResults] = useState<RecalculateQuoteResponse | null>(null);
  const [recalcModalOpen, setRecalcModalOpen] = useState(false);

  // Orphaned
  const [orphanedCount, setOrphanedCount] = useState(0);

  const handleSearch = async () => {
    try {
      setLoading(true);
      const results = await searchQuotes({
        quote_number: searchQuery || undefined,
        limit: 20,
      });
      setSearchResults(results.quotes);
    } catch (error: any) {
      toast.error(error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnostics = async () => {
    if (!diagnosticQuoteId.trim()) {
      toast.error('Please enter a quote ID');
      return;
    }

    try {
      setDiagnosticLoading(true);
      const results = await runQuoteDiagnostics(diagnosticQuoteId);
      setDiagnosticResults(results);
    } catch (error: any) {
      toast.error(error.message || 'Diagnostics failed');
    } finally {
      setDiagnosticLoading(false);
    }
  };

  const handleRecalculate = async () => {
    if (!diagnosticQuoteId.trim()) {
      toast.error('Please enter a quote ID');
      return;
    }

    try {
      setLoading(true);
      const results = await recalculateQuote(diagnosticQuoteId);
      setRecalcResults(results);
      setRecalcModalOpen(true);
    } catch (error: any) {
      toast.error(error.message || 'Recalculation failed');
    } finally {
      setLoading(false);
    }
  };

  const loadOrphanedQuotes = async () => {
    try {
      setLoading(true);
      const results = await getOrphanedQuotes();
      setOrphanedCount(results.total_count);
      if (results.total_count > 0) {
        toast.success(`Found ${results.total_count} orphaned quotes`);
      } else {
        toast.success('No orphaned quotes found');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load orphaned quotes');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'search', label: 'Quote Search', icon: Search },
    { id: 'diagnostics', label: 'Diagnostics', icon: Settings },
    { id: 'orphaned', label: 'Orphaned Quotes', icon: FileWarning },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Operational Tools</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Cross-tenant search, diagnostics, and maintenance tools
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Search Tab */}
      {activeTab === 'search' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cross-Tenant Quote Search
          </h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Enter quote number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} loading={loading}>
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Quote #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Tenant
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {searchResults.map((quote) => (
                      <tr key={quote.id}>
                        <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                          {quote.quote_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {quote.tenant.company_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {quote.customer_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">
                            {quote.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                          ${quote.total_price.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quote Diagnostics
            </h3>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Enter quote ID..."
                  value={diagnosticQuoteId}
                  onChange={(e) => setDiagnosticQuoteId(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleDiagnostics} loading={diagnosticLoading}>
                  Run Diagnostics
                </Button>
                <Button onClick={handleRecalculate} loading={loading} variant="secondary">
                  Recalculate
                </Button>
              </div>

              {diagnosticResults && (
                <div className="space-y-4 mt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DiagnosticCard
                      title="Schema Validation"
                      isValid={diagnosticResults.diagnostics.schema_validation.is_valid}
                      errors={diagnosticResults.diagnostics.schema_validation.errors}
                    />
                    <DiagnosticCard
                      title="Pricing Validation"
                      isValid={diagnosticResults.diagnostics.pricing_validation.is_valid}
                      errors={[
                        diagnosticResults.diagnostics.pricing_validation.is_valid
                          ? 'All pricing calculations are correct'
                          : `Discrepancy: $${diagnosticResults.diagnostics.pricing_validation.discrepancy}`,
                      ]}
                    />
                    <DiagnosticCard
                      title="Reference Validation"
                      isValid={diagnosticResults.diagnostics.references_validation.all_items_exist}
                      errors={diagnosticResults.diagnostics.references_validation.missing_references}
                    />
                    <DiagnosticCard
                      title="PDF Generation"
                      isValid={diagnosticResults.diagnostics.pdf_generation.can_generate}
                      errors={diagnosticResults.diagnostics.pdf_generation.errors}
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Orphaned Tab */}
      {activeTab === 'orphaned' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Orphaned Quotes Check
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check for quotes with missing references to customers, vendors, or items.
            </p>
            <Button onClick={loadOrphanedQuotes} loading={loading}>
              <FileWarning className="w-4 h-4" />
              Check for Orphaned Quotes
            </Button>
            {orphanedCount > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                  Found {orphanedCount} orphaned quotes that need attention
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Recalculate Results Modal */}
      <Modal
        isOpen={recalcModalOpen}
        onClose={() => setRecalcModalOpen(false)}
        title="Recalculation Complete"
      >
        <ModalContent>
          {recalcResults && (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Old Total:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${recalcResults.old_total.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">New Total:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  ${recalcResults.new_total.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Difference:</span>
                <span className={`font-bold ${
                  recalcResults.difference > 0
                    ? 'text-green-600 dark:text-green-400'
                    : recalcResults.difference < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  ${Math.abs(recalcResults.difference).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setRecalcModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}

function DiagnosticCard({
  title,
  isValid,
  errors,
}: {
  title: string;
  isValid: boolean;
  errors: string[];
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
          isValid
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
        }`}>
          {isValid ? (
            <AlertCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
          <p className={`text-sm mt-1 ${
            isValid
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {isValid ? 'Valid' : 'Issues Found'}
          </p>
          {errors.length > 0 && !isValid && (
            <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
              {errors.map((error, idx) => (
                <li key={idx}>• {error}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
