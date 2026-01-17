/**
 * Leads List Page
 * Display leads with search, filters, and pagination
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Loader2, Eye, Edit2, Trash2, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { LeadSourceBadge } from '@/components/leads/LeadSourceBadge';
import { LeadFilters } from '@/components/leads/LeadFilters';
import { LeadStatsWidget } from '@/components/leads/LeadStatsWidget';
import { getLeads, getLeadStats, deleteLead } from '@/lib/api/leads';
import type { ListLeadsResponse, LeadStatsResponse, LeadFilters as Filters } from '@/lib/types/leads';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

export default function LeadsPage() {
  const { canPerform } = useRBAC();

  const [leads, setLeads] = useState<ListLeadsResponse['data']>([]);
  const [stats, setStats] = useState<LeadStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>({ page: 1, limit: 50 });
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showFiltersSection, setShowFiltersSection] = useState(false);

  // Debounce search
  const debouncedSearch = useDebounce(search, 300);

  // Load stats
  useEffect(() => {
    loadStats();
  }, []);

  // Load leads when filters or search change
  useEffect(() => {
    loadLeads();
  }, [filters, debouncedSearch]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const response = await getLeads({
        ...filters,
        search: debouncedSearch || undefined,
      });
      setLeads(response.data);
      setMeta(response.meta);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getLeadStats();
      setStats(response);
    } catch (error: any) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleResetFilters = () => {
    setFilters({ page: 1, limit: 50 });
    setSearch('');
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSort = (field: 'name' | 'city' | 'state' | 'status' | 'source' | 'created_at') => {
    const newOrder =
      filters.sort_by === field && filters.sort_order === 'asc' ? 'desc' : 'asc';
    setFilters({ ...filters, sort_by: field, sort_order: newOrder, page: 1 });
  };

  const getSortIcon = (field: 'name' | 'city' | 'state' | 'status' | 'source' | 'created_at') => {
    if (filters.sort_by !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-30" />;
    }
    return filters.sort_order === 'asc' ? (
      <ArrowUp className="w-4 h-4 ml-1" />
    ) : (
      <ArrowDown className="w-4 h-4 ml-1" />
    );
  };

  const handleDeleteClick = (leadId: string) => {
    setDeleteLeadId(leadId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteLeadId) return;

    setIsDeleting(true);
    try {
      await deleteLead(deleteLeadId);
      toast.success('Lead deleted successfully');
      setShowDeleteModal(false);
      setDeleteLeadId(null);
      loadLeads(); // Refresh list
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to delete lead';
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          maxWidth: '500px',
        },
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Check permissions
  const canCreate = canPerform('leads', 'create');
  const canView = canPerform('leads', 'view');
  const canEdit = canPerform('leads', 'edit');
  const canDelete = canPerform('leads', 'delete');

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to view leads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Leads</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and track your leads through the sales pipeline
          </p>
        </div>
        {canCreate && (
          <Link href="/leads/new">
            <Button>
              <Plus className="w-5 h-5" />
              Create Lead
            </Button>
          </Link>
        )}
      </div>

      {/* Collapsible Stats Section */}
      <div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lead Statistics</h2>
            {showStats ? (
              <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            )}
          </button>
        </div>
        {showStats && stats && (
          <div className="mt-4">
            <LeadStatsWidget stats={stats} loading={statsLoading} />
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or phone..."
            className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              placeholder:text-gray-400 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Collapsible Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        <button
          onClick={() => setShowFiltersSection(!showFiltersSection)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
          {showFiltersSection ? (
            <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {showFiltersSection && (
          <div className="border-t-2 border-gray-200 dark:border-gray-700 p-4">
            <LeadFilters filters={filters} onChange={setFilters} onReset={handleResetFilters} />
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Showing {leads.length} of {meta.total} leads
        </span>
        <span>
          Page {meta.page} of {meta.totalPages}
        </span>
      </div>

      {/* Leads Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">No leads found</p>
            {canCreate && (
              <Link href="/leads/new">
                <Button variant="ghost" className="mt-4">
                  <Plus className="w-5 h-5" />
                  Create First Lead
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Name
                      {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('city')}
                      className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Location
                      {getSortIcon('city')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('status')}
                      className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Status
                      {getSortIcon('status')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('source')}
                      className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Source
                      {getSortIcon('source')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    >
                      Created
                      {getSortIcon('created_at')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {leads.map((lead) => {
                  const primaryEmail = lead.emails.find((e) => e.is_primary);
                  const primaryPhone = lead.phones.find((p) => p.is_primary);
                  const primaryAddress = lead.addresses.find((a) => a.is_primary) || lead.addresses[0];

                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                          {lead.first_name} {lead.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {primaryAddress?.city && primaryAddress?.state
                            ? `${primaryAddress.city}, ${primaryAddress.state}`
                            : primaryAddress?.city || primaryAddress?.state || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <LeadStatusBadge status={lead.status as any} />
                      </td>
                      <td className="px-4 py-3">
                        <LeadSourceBadge source={lead.source as any} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {lead.service_requests.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {format(new Date(lead.created_at), 'MMM d, yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/leads/${lead.id}`}>
                            <button
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                              title="View Lead"
                            >
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                          </Link>
                          {canEdit && (
                            <Link href={`/leads/${lead.id}/edit`}>
                              <button
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                                title="Edit Lead"
                              >
                                <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </button>
                            </Link>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteClick(lead.id)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                              title="Delete Lead"
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Leads Cards (Mobile) */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">No leads found</p>
          </div>
        ) : (
          leads.map((lead) => {
            const primaryAddress = lead.addresses.find((a) => a.is_primary) || lead.addresses[0];

            return (
              <div
                key={lead.id}
                className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">
                      {lead.first_name} {lead.last_name}
                    </h3>
                    {(primaryAddress?.city || primaryAddress?.state) && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                        {primaryAddress?.city && primaryAddress?.state
                          ? `${primaryAddress.city}, ${primaryAddress.state}`
                          : primaryAddress?.city || primaryAddress?.state}
                      </p>
                    )}
                  </div>
                  <LeadStatusBadge status={lead.status as any} />
                </div>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <LeadSourceBadge source={lead.source as any} />
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {lead.service_requests.length} requests
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Action Icons */}
                <div className="flex items-center gap-3">
                  <Link href={`/leads/${lead.id}`}>
                    <button
                      className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      title="View Lead"
                    >
                      <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </button>
                  </Link>
                  {canEdit && (
                    <Link href={`/leads/${lead.id}/edit`}>
                      <button
                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title="Edit Lead"
                      >
                        <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </button>
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteClick(lead.id)}
                      className="p-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                      title="Delete Lead"
                    >
                      <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            onClick={() => handlePageChange(meta.page - 1)}
            disabled={meta.page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="ghost"
            onClick={() => handlePageChange(meta.page + 1)}
            disabled={meta.page === meta.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Lead"
        message="Are you sure you want to delete this lead? This action cannot be undone and will permanently remove all associated data including emails, phones, addresses, service requests, notes, and activities."
        confirmText="Delete Lead"
        cancelText="Cancel"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
