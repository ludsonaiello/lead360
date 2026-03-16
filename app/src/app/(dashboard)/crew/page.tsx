/**
 * Crew Member List Page
 * Display crew members with search, active/inactive filter, pagination
 * Desktop table + mobile card views
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
  User,
  DollarSign,
  Phone,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { CrewMemberForm } from '@/components/crew/CrewMemberForm';
import {
  getCrewMembers,
  createCrewMember,
  deactivateCrewMember,
  uploadCrewPhoto,
  formatCrewName,
  formatCrewPhone,
  formatHourlyRate,
  getCrewPhotoUrl,
} from '@/lib/api/crew';
import type {
  CrewMember,
  ListCrewMembersResponse,
  CrewMemberFilters,
  CreateCrewMemberDto,
  UpdateCrewMemberDto,
} from '@/lib/types/crew';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { useDebounce } from '@/lib/hooks/useDebounce';

type ActiveFilter = 'all' | 'active' | 'inactive';

export default function CrewListPage() {
  const { canPerform } = useRBAC();

  const [members, setMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [page, setPage] = useState(1);

  // Modals
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    loadMembers();
  }, [page, activeFilter, debouncedSearch]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const filters: CrewMemberFilters = {
        page,
        limit: 20,
        search: debouncedSearch || undefined,
      };
      if (activeFilter === 'active') filters.is_active = true;
      if (activeFilter === 'inactive') filters.is_active = false;

      const response = await getCrewMembers(filters);
      setMembers(response.data);
      setMeta(response.meta);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load crew members');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (dto: CreateCrewMemberDto | UpdateCrewMemberDto, photoFile?: File | null) => {
    const created = await createCrewMember(dto as CreateCrewMemberDto);
    if (photoFile) {
      await uploadCrewPhoto(created.id, photoFile);
    }
    toast.success('Crew member created successfully');
    setShowCreateForm(false);
    loadMembers();
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    setIsDeactivating(true);
    try {
      await deactivateCrewMember(deactivateId);
      toast.success('Crew member deactivated');
      setShowDeactivateModal(false);
      setDeactivateId(null);
      loadMembers();
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

  // RBAC - crew endpoints require Owner, Admin, Manager
  const canCreate = canPerform('projects', 'create');
  const canDelete = canPerform('projects', 'create'); // Owner/Admin for delete

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Crew Members</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your team of field workers and crew
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-5 h-5" />
            Add Crew Member
          </Button>
        )}
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, or phone..."
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                placeholder:text-gray-400 dark:placeholder:text-gray-500
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {/* Active Filter */}
          <div className="flex gap-2">
            {(['all', 'active', 'inactive'] as ActiveFilter[]).map(filter => (
              <button
                key={filter}
                onClick={() => { setActiveFilter(filter); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors capitalize
                  ${activeFilter === filter
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Showing {members.length} of {meta.total} crew members</span>
        {meta.totalPages > 1 && <span>Page {meta.page} of {meta.totalPages}</span>}
      </div>

      {/* Table (Desktop) */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <SkeletonTable rows={5} columns={6} />
        ) : members.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No crew members found</p>
            {canCreate && (
              <Button variant="ghost" className="mt-4" onClick={() => setShowCreateForm(true)}>
                <Plus className="w-5 h-5" /> Add First Crew Member
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Crew Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {members.map(member => {
                  const photoUrl = getCrewPhotoUrl(member.profile_photo_url);
                  return (
                    <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={formatCrewName(member)}
                              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                {member.first_name[0]}{member.last_name[0]}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {formatCrewName(member)}
                            </div>
                            {member.address_city && member.address_state && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {member.address_city}, {member.address_state}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {member.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                              <Phone className="w-3.5 h-3.5 text-gray-400" />
                              {formatCrewPhone(member.phone)}
                            </div>
                          )}
                          {member.email && (
                            <div className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                              <Mail className="w-3.5 h-3.5 text-gray-400" />
                              {member.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {formatHourlyRate(member.default_hourly_rate)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {member.default_payment_method?.replace('_', ' ') || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={member.is_active ? 'success' : 'neutral'}>
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/crew/${member.id}`}>
                            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors" title="View Details">
                              <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </button>
                          </Link>
                          {canDelete && member.is_active && (
                            <button
                              onClick={() => { setDeactivateId(member.id); setShowDeactivateModal(true); }}
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
        ) : members.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400">No crew members found</p>
          </div>
        ) : (
          members.map(member => {
            const photoUrl = getCrewPhotoUrl(member.profile_photo_url);
            return (
              <Link key={member.id} href={`/crew/${member.id}`}>
                <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                  <div className="flex items-start gap-3">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={formatCrewName(member)}
                        className="w-12 h-12 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                          {member.first_name[0]}{member.last_name[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                          {formatCrewName(member)}
                        </h3>
                        <Badge variant={member.is_active ? 'success' : 'neutral'} className="flex-shrink-0 ml-2">
                          {member.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center flex-wrap gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {member.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {formatCrewPhone(member.phone)}
                          </span>
                        )}
                        {member.default_hourly_rate && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            {formatHourlyRate(member.default_hourly_rate)}
                          </span>
                        )}
                      </div>
                    </div>
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
        <CrewMemberForm
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
        title="Deactivate Crew Member"
        message="Are you sure you want to deactivate this crew member? They will no longer appear in active lists but their records will be preserved."
        confirmText="Deactivate"
        cancelText="Cancel"
        variant="danger"
        loading={isDeactivating}
      />
    </div>
  );
}
