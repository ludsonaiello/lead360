/**
 * Subcontractor List Page
 * List with search, compliance status filter, compliance badges, pagination
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Loader2,
  Eye,
  Trash2,
  Building2,
  Mail,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { SubcontractorForm } from '@/components/subcontractors/SubcontractorForm';
import {
  getSubcontractors,
  createSubcontractor,
  deactivateSubcontractor,
  getDaysUntilExpiry,
} from '@/lib/api/subcontractors';
import type {
  Subcontractor,
  SubcontractorFilters,
  ComplianceStatus,
  CreateSubcontractorDto,
  UpdateSubcontractorDto,
} from '@/lib/types/subcontractor';
import { COMPLIANCE_STATUS_CONFIG } from '@/lib/types/subcontractor';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

type ActiveFilter = 'all' | 'active' | 'inactive';

const COMPLIANCE_FILTERS: { value: ComplianceStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'valid', label: 'Valid' },
  { value: 'expiring_soon', label: 'Expiring' },
  { value: 'expired', label: 'Expired' },
  { value: 'unknown', label: 'Unknown' },
];

export default function SubcontractorListPage() {
  const { canPerform } = useRBAC();

  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [complianceFilter, setComplianceFilter] = useState<ComplianceStatus | 'all'>('all');
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);

  // Modals
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    loadSubcontractors();
  }, [page, activeFilter, complianceFilter, debouncedSearch]);

  const loadSubcontractors = async () => {
    try {
      setLoading(true);
      const filters: SubcontractorFilters = {
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      };
      if (activeFilter === 'active') filters.is_active = true;
      if (activeFilter === 'inactive') filters.is_active = false;
      if (complianceFilter !== 'all') filters.compliance_status = complianceFilter;

      const response = await getSubcontractors(filters);
      setSubcontractors(response.data);
      setMeta(response.meta);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load subcontractors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (dto: CreateSubcontractorDto | UpdateSubcontractorDto) => {
    await createSubcontractor(dto as CreateSubcontractorDto);
    toast.success('Subcontractor created successfully');
    setShowCreateForm(false);
    loadSubcontractors();
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setIsDeactivating(true);
    try {
      await deactivateSubcontractor(deactivateId);
      toast.success('Subcontractor deactivated');
      setShowDeactivateModal(false);
      setDeactivateId(null);
      loadSubcontractors();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canCreate = canPerform('projects', 'create');
  const canDelete = canPerform('projects', 'create');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Subcontractors</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage subcontractors, compliance, and documents
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-5 h-5" />
            Add Subcontractor
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by business name, trade, or email..."
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Filter Row */}
          <div className="flex flex-col md:flex-row gap-3">
            {/* Active Filter */}
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 self-center">Status:</span>
              {(['all', 'active', 'inactive'] as ActiveFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => { setActiveFilter(filter); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize
                    ${activeFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            {/* Compliance Filter */}
            <div className="flex gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 self-center">Compliance:</span>
              {COMPLIANCE_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => { setComplianceFilter(filter.value); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
                    ${complianceFilter === filter.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Showing {subcontractors.length} of {meta.total} subcontractors</span>
        {meta.totalPages > 1 && <span>Page {meta.page} of {meta.totalPages}</span>}
      </div>

      {/* Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} columns={6} />
        ) : subcontractors.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No subcontractors found</p>
            {canCreate && (
              <Button variant="ghost" className="mt-4" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-5 h-5" /> Add First Subcontractor
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Business</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Trade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Compliance</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subcontractors.map(sub => {
                  const complianceConfig = COMPLIANCE_STATUS_CONFIG[sub.compliance_status];
                  const daysUntil = getDaysUntilExpiry(sub.insurance_expiry_date);
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {sub.business_name}
                            </div>
                            {sub.insurance_provider && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Ins: {sub.insurance_provider}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {sub.trade_specialty || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {sub.email && (
                          <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            {sub.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={complianceConfig.variant}>
                            {complianceConfig.label}
                          </Badge>
                          {daysUntil !== null && daysUntil > 0 && daysUntil <= 30 && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {daysUntil}d
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sub.is_active ? 'success' : 'neutral'}>
                          {sub.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/subcontractors/${sub.id}`}>
                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors" title="View Details">
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                          </Link>
                          {canDelete && sub.is_active && (
                            <button
                              onClick={() => { setDeactivateId(sub.id); setShowDeactivateModal(true); }}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                              title="Deactivate"
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

      {/* Cards (Mobile) */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : subcontractors.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">No subcontractors found</p>
          </div>
        ) : (
          subcontractors.map(sub => {
            const complianceConfig = COMPLIANCE_STATUS_CONFIG[sub.compliance_status];
            return (
              <Link key={sub.id} href={`/subcontractors/${sub.id}`}>
                <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">{sub.business_name}</h3>
                    </div>
                    <Badge variant={complianceConfig.variant} className="flex-shrink-0">
                      {complianceConfig.label}
                    </Badge>
                  </div>
                  <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
                    {sub.trade_specialty && <span>{sub.trade_specialty}</span>}
                    <Badge variant={sub.is_active ? 'success' : 'neutral'}>
                      {sub.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" onClick={() => handlePageChange(meta.page - 1)} disabled={meta.page === 1}>
            Previous
          </Button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button variant="ghost" onClick={() => handlePageChange(meta.page + 1)} disabled={meta.page === meta.totalPages}>
            Next
          </Button>
        </div>
      )}

      {/* Create Modal */}
      {showCreateForm && (
        <SubcontractorForm
          isOpen={showCreateForm}
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreate}
          mode="create"
        />
      )}

      {/* Deactivate Confirmation */}
      <ConfirmModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
        onConfirm={handleDeactivate}
        title="Deactivate Subcontractor"
        message="Are you sure you want to deactivate this subcontractor? Their records will be preserved but they will no longer appear in active lists."
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        loading={isDeactivating}
      />
    </div>
  );
}
