'use client';

import { useState, useEffect } from 'react';
import { Search, Save, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import MoneyInput from '@/components/ui/MoneyInput';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import SuccessModal from '@/components/ui/SuccessModal';
import { advancedSearch, saveSearch } from '@/lib/api/quote-search';
import { getVendors } from '@/lib/api/vendors';
import { getTags } from '@/lib/api/quote-tags';
import type { QuoteSearchFilters, QuoteSearchResponse } from '@/lib/types/quotes';
import { format } from 'date-fns';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import { useRouter } from 'next/navigation';
import { Eye } from 'lucide-react';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResults?: (results: QuoteSearchResponse) => void;
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'ready', label: 'Ready' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'read', label: 'Read' },
  { value: 'opened', label: 'Opened' },
  { value: 'downloaded', label: 'Downloaded' },
  { value: 'denied', label: 'Denied' },
  { value: 'lost', label: 'Lost' },
  { value: 'started', label: 'Started' },
  { value: 'concluded', label: 'Concluded' },
];

export default function AdvancedSearchModal({
  isOpen,
  onClose,
  onResults,
}: AdvancedSearchModalProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<QuoteSearchFilters>({
    page: 1,
    limit: 20,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<QuoteSearchResponse | null>(null);

  // For vendor and tag options
  const [vendors, setVendors] = useState<Array<{ value: string; label: string }>>([]);
  const [tags, setTags] = useState<Array<{ value: string; label: string }>>([]);

  // Load vendors and tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadVendors();
      loadTags();
    }
  }, [isOpen]);

  const loadVendors = async () => {
    try {
      const response = await getVendors({ limit: 100, is_active: true });
      setVendors(
        response.data.map((v) => ({ value: v.id, label: v.name }))
      );
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const loadTags = async () => {
    try {
      const response = await getTags({ include_inactive: false });
      setTags(response.map((t) => ({ value: t.id, label: t.name })));
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await advancedSearch(filters);
      setSearchResults(results);
      if (onResults) {
        onResults(results);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.response?.data?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSearch = async () => {
    if (!searchName.trim()) {
      setError('Please enter a name for this search');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await saveSearch({
        name: searchName,
        criteria: filters,
      });
      setShowSaveDialog(false);
      setSearchName('');
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Save search error:', err);
      setError(err.response?.data?.message || 'Failed to save search');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFilters({ page: 1, limit: 20 });
    setError(null);
    setSearchResults(null);
  };

  const handleClose = () => {
    setSearchResults(null);
    setError(null);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Advanced Search"
        size="lg"
      >
        <ModalContent>
          <div className="space-y-4">
            {/* Quote Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Quote Number
              </label>
              <Input
                type="text"
                placeholder="Q-2026-1234"
                value={filters.quote_number || ''}
                onChange={(e) =>
                  setFilters({ ...filters, quote_number: e.target.value })
                }
              />
            </div>

            {/* Customer Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Customer Name
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={filters.customer_name || ''}
                onChange={(e) =>
                  setFilters({ ...filters, customer_name: e.target.value })
                }
              />
            </div>

            {/* Status (Multi-select) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <MultiSelect
                options={statusOptions}
                value={filters.status || []}
                onChange={(values) => setFilters({ ...filters, status: values })}
                placeholder="Select statuses"
              />
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vendor
              </label>
              <Select
                options={vendors}
                value={filters.vendor_id || ''}
                onChange={(value) => setFilters({ ...filters, vendor_id: value })}
                placeholder="Select vendor"
              />
            </div>

            {/* Amount Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Min Amount
                </label>
                <MoneyInput
                  value={filters.min_amount || 0}
                  onChange={(value) =>
                    setFilters({ ...filters, min_amount: value })
                  }
                  placeholder="$0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Amount
                </label>
                <MoneyInput
                  value={filters.max_amount || 0}
                  onChange={(value) =>
                    setFilters({ ...filters, max_amount: value })
                  }
                  placeholder="$0"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  From Date
                </label>
                <DatePicker
                  selected={filters.date_from ? new Date(filters.date_from) : null}
                  onChange={(date: Date | null) =>
                    setFilters({
                      ...filters,
                      date_from: date ? format(date, 'yyyy-MM-dd') : undefined,
                    })
                  }
                  placeholderText="Select date"
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  dateFormat="MMM d, yyyy"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  To Date
                </label>
                <DatePicker
                  selected={filters.date_to ? new Date(filters.date_to) : null}
                  onChange={(date: Date | null) =>
                    setFilters({
                      ...filters,
                      date_to: date ? format(date, 'yyyy-MM-dd') : undefined,
                    })
                  }
                  placeholderText="Select date"
                  className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  dateFormat="MMM d, yyyy"
                  minDate={filters.date_from ? new Date(filters.date_from) : undefined}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Search Results */}
            {searchResults && searchResults.results.length > 0 && (
              <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Search Results ({searchResults.pagination.total} quotes found)
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.results.map((quote) => (
                    <div
                      key={quote.id}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {quote.quote_number}
                            </span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {quote.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                            <span>{quote.customer_name}</span>
                            <span>•</span>
                            <span>{quote.city}</span>
                            <span>•</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              {formatMoney(quote.total)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            router.push(`/quotes/${quote.id}`);
                            handleClose();
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {searchResults.pagination.total > searchResults.results.length && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Showing {searchResults.results.length} of {searchResults.pagination.total} results
                  </p>
                )}
              </div>
            )}

            {searchResults && searchResults.results.length === 0 && (
              <div className="mt-6 p-4 text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
                No quotes found matching your search criteria.
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button variant="secondary" onClick={handleClear} disabled={loading}>
            Clear Filters
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(true)}
              disabled={loading}
            >
              <Save className="w-4 h-4" />
              Save Search
            </Button>
            <Button
              variant="primary"
              onClick={handleSearch}
              loading={loading}
            >
              {!loading && <Search className="w-4 h-4" />}
              Search
            </Button>
          </div>
        </ModalActions>
      </Modal>

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <Modal
          isOpen={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          title="Save Search"
        >
          <ModalContent>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search Name
              </label>
              <Input
                type="text"
                placeholder="e.g., High Value Approved Quotes"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                autoFocus
              />
            </div>
          </ModalContent>
          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => setShowSaveDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveSearch}
              loading={loading}
            >
              Save
            </Button>
          </ModalActions>
        </Modal>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Search Saved"
        message="Your search has been saved successfully and is now available in your saved searches."
      />
    </>
  );
}
