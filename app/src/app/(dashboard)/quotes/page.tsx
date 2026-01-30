/**
 * Quote List Page
 * Main quotes listing with filters, search, stats, and CRUD actions
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { QuoteStatsWidget } from '@/components/quotes/QuoteStatsWidget';
import { QuoteFilters } from '@/components/quotes/QuoteFilters';
import {
  getQuotes,
  getQuoteStatistics,
  deleteQuote,
  cloneQuote,
  formatMoney,
  getCustomerName,
  getLocation,
  isQuoteEditable,
} from '@/lib/api/quotes';
import {
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type {
  QuoteSummary,
  QuoteFilters as QuoteFiltersType,
  QuoteStatistics,
} from '@/lib/types/quotes';

const PER_PAGE_OPTIONS = [20, 40, 60, 80, 100];

export default function QuotesPage() {
  const router = useRouter();

  // State
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [stats, setStats] = useState<QuoteStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [filters, setFilters] = useState<QuoteFiltersType>({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc',
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalQuotes, setTotalQuotes] = useState(0);

  // Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [messageModalOpen, setMessageModalOpen] = useState(false);

  // Load quotes and stats
  useEffect(() => {
    loadQuotes();
    loadStats();
  }, [filters]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== filters.search) {
        setFilters({ ...filters, search: searchQuery, page: 1 });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const response = await getQuotes(filters);
      setQuotes(response?.data || []);
      const total = response?.meta?.total || 0;
      setTotalQuotes(total);
      // Calculate total pages based on total quotes and items per page
      const calculatedPages = total > 0 ? Math.ceil(total / itemsPerPage) : 1;
      setTotalPages(calculatedPages);
    } catch (err: any) {
      showError(err.message || 'Failed to load quotes');
      setQuotes([]);
      setTotalPages(1);
      setTotalQuotes(0);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      // Pass filter parameters to stats API
      const statsFilters = {
        status: filters.status,
        vendor_id: filters.vendor_id,
        lead_id: filters.lead_id,
        created_from: filters.created_from,
        created_to: filters.created_to,
      };
      const statistics = await getQuoteStatistics(statsFilters);
      setStats(statistics);
    } catch (err: any) {
      console.error('Failed to load statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAction = useCallback(
    (action: 'view' | 'edit' | 'clone' | 'delete', quoteId: string) => {
      switch (action) {
        case 'view':
          router.push(`/quotes/${quoteId}`);
          break;
        case 'edit':
          router.push(`/quotes/${quoteId}/edit`);
          break;
        case 'clone':
          handleClone(quoteId);
          break;
        case 'delete':
          setQuoteToDelete(quoteId);
          setDeleteModalOpen(true);
          break;
      }
    },
    [router]
  );

  const handleClone = async (quoteId: string) => {
    try {
      const clonedQuote = await cloneQuote(quoteId);
      showSuccess('Quote cloned successfully');
      await loadQuotes();
      router.push(`/quotes/${clonedQuote.id}`);
    } catch (err: any) {
      showError(err.message || 'Failed to clone quote');
    }
  };

  const handleDelete = async () => {
    if (!quoteToDelete) return;

    try {
      setDeleteLoading(true);
      await deleteQuote(quoteToDelete);
      showSuccess('Quote deleted successfully');
      setDeleteModalOpen(false);
      setQuoteToDelete(null);
      await loadQuotes();
      await loadStats();
    } catch (err: any) {
      showError(err.message || 'Failed to delete quote');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSort = (column: 'created_at' | 'updated_at' | 'quote_number' | 'total') => {
    const newOrder =
      filters.sort_by === column && filters.sort_order === 'asc' ? 'desc' : 'asc';
    setFilters({ ...filters, sort_by: column, sort_order: newOrder });
  };

  const handlePageChange = (page: number) => {
    setFilters({ ...filters, page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setFilters({ ...filters, page: 1, limit: newLimit });
  };

  const handleResetFilters = () => {
    setItemsPerPage(20);
    setFilters({
      page: 1,
      limit: 20,
      sort_by: 'created_at',
      sort_order: 'desc',
    });
    setSearchQuery('');
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Quotes
        </h1>
        <Link href="/quotes/new">
          <Button>
            <Plus className="w-5 h-5" />
            Create Quote
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <Input
          placeholder="Search quotes by number, title, or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />
      </div>

      {/* Filters */}
      <QuoteFilters
        filters={filters}
        onChange={setFilters}
        onReset={handleResetFilters}
        className="mb-6"
      />

      {/* Stats Widget - Updates based on filters */}
      <QuoteStatsWidget stats={stats} loading={statsLoading} className="mb-6" />

      {/* Top Pagination Controls */}
      {quotes.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Items per page selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show:
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          </div>

          {/* Pagination Controls - Only show if multiple pages */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(filters.page! - 1)}
                disabled={filters.page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let page: number;

                  // Smart pagination: show first page, last page, and pages around current
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (filters.page! <= 4) {
                    page = i + 1;
                  } else if (filters.page! >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = filters.page! - 3 + i;
                  }

                  return (
                    <Button
                      key={page}
                      variant={filters.page === page ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(filters.page! + 1)}
                disabled={filters.page === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Pagination Info */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {totalPages > 1 ? (
              <span>Page {filters.page} of {totalPages}</span>
            ) : (
              <span>{totalQuotes} {totalQuotes === 1 ? 'quote' : 'quotes'}</span>
            )}
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Showing {quotes.length} of {totalQuotes} quotes
        {filters.page && totalPages > 1 && (
          <span> (Page {filters.page} of {totalPages})</span>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('quote_number')}
                >
                  Quote #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Location
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('total')}
                >
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleSort('created_at')}
                >
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center">
                    <div className="animate-pulse">Loading quotes...</div>
                  </td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No quotes found
                  </td>
                </tr>
              ) : (
                quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {quote.quote_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {quote.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {getCustomerName(quote)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {getLocation(quote)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900 dark:text-gray-100">
                      {formatMoney(quote.total)}
                    </td>
                    <td className="px-4 py-3">
                      <QuoteStatusBadge status={quote.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(quote.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction('view', quote.id)}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isQuoteEditable(quote.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAction('edit', quote.id)}
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction('clone', quote.id)}
                          title="Clone"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction('delete', quote.id)}
                          title="Delete"
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden grid grid-cols-1 gap-4 mb-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-pulse">Loading quotes...</div>
          </div>
        ) : quotes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No quotes found
          </div>
        ) : (
          quotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onAction={handleAction}
              canEdit={isQuoteEditable(quote.status)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {quotes.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Items per page selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Show:
            </span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} per page
                </option>
              ))}
            </select>
          </div>

          {/* Pagination Controls - Only show if multiple pages */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(filters.page! - 1)}
                disabled={filters.page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let page: number;

                  // Smart pagination: show first page, last page, and pages around current
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (filters.page! <= 4) {
                    page = i + 1;
                  } else if (filters.page! >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = filters.page! - 3 + i;
                  }

                  return (
                    <Button
                      key={page}
                      variant={filters.page === page ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handlePageChange(filters.page! + 1)}
                disabled={filters.page === totalPages}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Pagination Info */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {totalPages > 1 ? (
              <span>Page {filters.page} of {totalPages}</span>
            ) : (
              <span>{totalQuotes} {totalQuotes === 1 ? 'quote' : 'quotes'}</span>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Confirm Delete"
        size="md"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">
                Are you sure you want to delete this quote?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This action cannot be undone. The quote will be permanently deleted.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="ghost"
            onClick={() => setDeleteModalOpen(false)}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteLoading}
          >
            Delete Quote
          </Button>
        </ModalActions>
      </Modal>

      {/* Success/Error Message Modal */}
      <Modal
        isOpen={messageModalOpen}
        onClose={() => setMessageModalOpen(false)}
        title={successMessage ? 'Success' : 'Error'}
        size="sm"
        showCloseButton={!!errorMessage}
      >
        <ModalContent>
          <p className={successMessage ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {successMessage || errorMessage}
          </p>
        </ModalContent>
        {errorMessage && (
          <ModalActions>
            <Button onClick={() => setMessageModalOpen(false)}>
              Close
            </Button>
          </ModalActions>
        )}
      </Modal>
    </div>
  );
}
