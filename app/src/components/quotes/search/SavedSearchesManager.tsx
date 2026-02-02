'use client';

import { useState, useEffect } from 'react';
import { Play, Edit, Trash2, Search } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import ErrorModal from '@/components/ui/ErrorModal';
import SuccessModal from '@/components/ui/SuccessModal';
import { getSavedSearches, deleteSavedSearch, advancedSearch } from '@/lib/api/quote-search';
import type { SavedSearch, QuoteSearchResponse } from '@/lib/types/quotes';
import { format } from 'date-fns';

interface SavedSearchesManagerProps {
  onExecuteSearch?: (results: QuoteSearchResponse) => void;
  onEditSearch?: (search: SavedSearch) => void;
}

export default function SavedSearchesManager({
  onExecuteSearch,
  onEditSearch,
}: SavedSearchesManagerProps) {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [searchToDelete, setSearchToDelete] = useState<SavedSearch | null>(null);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadSearches();
  }, []);

  const loadSearches = async () => {
    setLoading(true);
    try {
      const response = await getSavedSearches();
      setSearches(response.saved_searches);
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (search: SavedSearch) => {
    setExecutingId(search.id);
    try {
      const results = await advancedSearch(search.criteria);
      if (onExecuteSearch) {
        onExecuteSearch(results);
      } else {
        // Show results in success modal if no callback provided
        setSuccessMessage(`Found ${results.pagination.total} quotes matching your search criteria.`);
        setSuccessModalOpen(true);
      }
    } catch (error: any) {
      console.error('Execute search error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to execute search');
      setErrorModalOpen(true);
    } finally {
      setExecutingId(null);
    }
  };

  const handleDelete = (search: SavedSearch) => {
    setSearchToDelete(search);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!searchToDelete) return;

    try {
      await deleteSavedSearch(searchToDelete.id);
      setSearches(searches.filter((s) => s.id !== searchToDelete.id));
      setDeleteModalOpen(false);
      setSearchToDelete(null);
    } catch (error: any) {
      console.error('Delete search error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to delete search');
      setDeleteModalOpen(false);
      setSearchToDelete(null);
      setErrorModalOpen(true);
    }
  };

  const filteredSearches = searches.filter((search) =>
    search.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFilterSummary = (search: SavedSearch): string => {
    const parts: string[] = [];

    if (search.criteria.customer_name) {
      parts.push(`Customer: ${search.criteria.customer_name}`);
    }
    if (search.criteria.quote_number) {
      parts.push(`Quote #: ${search.criteria.quote_number}`);
    }
    if (search.criteria.status && search.criteria.status.length > 0) {
      parts.push(`Status: ${search.criteria.status.join(', ')}`);
    }
    if (search.criteria.min_amount) {
      parts.push(`Min: $${search.criteria.min_amount}`);
    }
    if (search.criteria.max_amount) {
      parts.push(`Max: $${search.criteria.max_amount}`);
    }
    if (search.criteria.date_from) {
      parts.push(`From: ${search.criteria.date_from}`);
    }
    if (search.criteria.date_to) {
      parts.push(`To: ${search.criteria.date_to}`);
    }

    return parts.length > 0 ? parts.join(' • ') : 'No filters set';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Saved Searches
          </h2>
          <div className="w-64">
            <Input
              type="text"
              placeholder="Search saved searches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-5 h-5" />}
            />
          </div>
        </div>

        {filteredSearches.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">
              {searchQuery ? 'No matching searches found' : 'No saved searches yet'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {searchQuery
                ? 'Try a different search term'
                : 'Use Advanced Search and click "Save Search" to save your filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSearches.map((search) => (
              <div
                key={search.id}
                className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                      {search.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {getFilterSummary(search)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      Created {format(new Date(search.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleExecute(search)}
                      loading={executingId === search.id}
                      disabled={executingId !== null}
                    >
                      {executingId !== search.id && <Play className="w-4 h-4" />}
                      Execute
                    </Button>
                    {onEditSearch && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEditSearch(search)}
                        disabled={executingId !== null}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(search)}
                      disabled={executingId !== null}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Saved Search"
        message={`Are you sure you want to delete "${searchToDelete?.name}"? This action cannot be undone.`}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Search Results"
        message={successMessage}
      />
    </>
  );
}
