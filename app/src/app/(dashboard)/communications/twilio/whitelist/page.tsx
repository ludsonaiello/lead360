/**
 * Office Bypass Whitelist Management Page (Sprint 8)
 * Manage phone numbers that bypass IVR and can make outbound calls using company's number
 *
 * Features:
 * - List all whitelisted phone numbers (active + inactive)
 * - Search by phone number or label
 * - Filter by status (All, Active, Inactive)
 * - Add new phone number to whitelist
 * - Edit label for existing entry
 * - Remove phone number from whitelist (soft delete)
 * - Security notice about whitelist implications
 * - Mobile responsive (table converts to cards on <768px)
 * - RBAC enforcement (Owner/Admin can edit, Manager read-only)
 * - Dark mode support
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import {
  Shield,
  Search,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  PhoneCall,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { AddPhoneWhitelistModal } from '@/components/twilio/modals/AddPhoneWhitelistModal';
import { EditWhitelistLabelModal } from '@/components/twilio/modals/EditWhitelistLabelModal';
import { RemoveWhitelistModal } from '@/components/twilio/modals/RemoveWhitelistModal';

import { getOfficeWhitelist, updateWhitelistLabel } from '@/lib/api/twilio-tenant';
import type { OfficeWhitelistEntry } from '@/lib/types/twilio-tenant';
import { useAuth } from '@/contexts/AuthContext';

// Format phone number for display (from +19781234567 to +1 (978) 123-4567)
function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  // Remove + prefix
  const cleaned = phone.replace('+', '');

  // US/Canada format: +1 (XXX) XXX-XXXX
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  // Default: just add + back
  return `+${cleaned}`;
}

export default function OfficeBypassWhitelistPage() {
  const { user } = useAuth();

  // State
  const [entries, setEntries] = useState<OfficeWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<OfficeWhitelistEntry | null>(null);

  // RBAC: Check if user can edit (Owner or Admin)
  const canEdit = user?.roles?.includes('Owner') || user?.roles?.includes('Admin');

  // Fetch whitelist entries
  const fetchWhitelist = async () => {
    try {
      setLoading(true);
      const data = await getOfficeWhitelist();
      setEntries(data);
    } catch (error: any) {
      console.error('Error fetching office whitelist:', error);

      // Handle 404 gracefully (no entries yet)
      if (error.response?.status === 404) {
        setEntries([]);
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to load office whitelist');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhitelist();
  }, []);

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    let result = entries;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((entry) => entry.status === statusFilter);
    }

    // Search by phone number or label
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.phone_number.toLowerCase().includes(query) ||
          entry.label.toLowerCase().includes(query)
      );
    }

    return result;
  }, [entries, statusFilter, searchQuery]);

  // Handlers
  const handleAddSuccess = () => {
    fetchWhitelist();
  };

  const handleEditClick = (entry: OfficeWhitelistEntry) => {
    setSelectedEntry(entry);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchWhitelist();
  };

  const handleToggleStatus = async (entry: OfficeWhitelistEntry) => {
    try {
      const newStatus = entry.status === 'active' ? 'inactive' : 'active';

      await updateWhitelistLabel(entry.id, { status: newStatus });

      toast.success(
        newStatus === 'active'
          ? 'Phone number activated'
          : 'Phone number deactivated'
      );

      fetchWhitelist();
    } catch (error: any) {
      console.error('Error toggling status:', error);

      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update status');
      }
    }
  };

  const handleRemoveClick = (entry: OfficeWhitelistEntry) => {
    setSelectedEntry(entry);
    setRemoveModalOpen(true);
  };

  const handleRemoveSuccess = () => {
    fetchWhitelist();
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Render empty state
  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Office Bypass Whitelist
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Whitelisted phone numbers bypass IVR and can make outbound calls
            </p>
          </div>
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Phone Number
            </Button>
          )}
        </div>

        {/* Security Notice */}
        <Card>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p className="font-semibold">Office bypass allows whitelisted phone numbers to:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Skip IVR menu when calling in</li>
                  <li>Make outbound calls using company&apos;s Twilio number</li>
                </ul>
                <p className="font-medium text-xs mt-3">
                  ⚠️ Verify phone number ownership before adding to whitelist. Regularly audit entries.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Empty State */}
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <PhoneCall className="w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Whitelisted Numbers
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md">
              Add phone numbers to bypass IVR and enable office outbound calling
            </p>
            {canEdit && (
              <Button
                variant="primary"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Phone Number
              </Button>
            )}
          </div>
        </Card>

        {/* Modals */}
        <AddPhoneWhitelistModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSuccess={handleAddSuccess}
        />
      </div>
    );
  }

  // Render main content with table
  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio', href: '/communications/twilio' },
          { label: 'Office Bypass' }, // Current page
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Office Bypass Whitelist
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Whitelisted phone numbers bypass IVR and can make outbound calls
          </p>
        </div>
        {canEdit && (
          <Button
            variant="primary"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Phone Number
          </Button>
        )}
      </div>

      {/* Security Notice */}
      <Card>
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p className="font-semibold">Office bypass allows whitelisted phone numbers to:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Skip IVR menu when calling in</li>
                <li>Make outbound calls using company&apos;s Twilio number</li>
              </ul>
              <p className="font-medium text-xs mt-3">
                ⚠️ Verify phone number ownership before adding to whitelist. Regularly audit entries.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters and Search */}
      <Card>
        <div className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Search by phone number or label..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-5 w-5" />}
              />
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredEntries.length} of {entries.length} entries
          </div>
        </div>
      </Card>

      {/* Table (Desktop) / Cards (Mobile) */}
      <Card>
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Label
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                {canEdit && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPhoneNumber(entry.phone_number)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {entry.label}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      variant={entry.status === 'active' ? 'success' : 'gray'}
                    >
                      {entry.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {format(new Date(entry.created_at), 'MMM d, yyyy')}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleEditClick(entry)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant={entry.status === 'active' ? 'ghost' : 'primary'}
                          size="sm"
                          onClick={() => handleToggleStatus(entry)}
                        >
                          {entry.status === 'active' ? (
                            <>
                              <XCircle className="h-4 w-4 mr-2" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleRemoveClick(entry)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="p-4 space-y-3">
              {/* Phone Number */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Phone Number
                  </p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatPhoneNumber(entry.phone_number)}
                  </p>
                </div>
                <Badge
                  variant={entry.status === 'active' ? 'success' : 'gray'}
                >
                  {entry.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              {/* Label */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Label
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {entry.label}
                </p>
              </div>

              {/* Created */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Created
                </p>
                <p className="text-sm text-gray-900 dark:text-white">
                  {format(new Date(entry.created_at), 'MMM d, yyyy')}
                </p>
              </div>

              {/* Actions */}
              {canEdit && (
                <div className="space-y-2 pt-2">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEditClick(entry)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant={entry.status === 'active' ? 'ghost' : 'primary'}
                      size="sm"
                      onClick={() => handleToggleStatus(entry)}
                      className="flex-1"
                    >
                      {entry.status === 'active' ? (
                        <>
                          <XCircle className="h-4 w-4 mr-2" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Activate
                        </>
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleRemoveClick(entry)}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Permanently
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* No results message */}
      {filteredEntries.length === 0 && (
        <Card>
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No entries match your filters. Try adjusting your search or filter criteria.
            </p>
          </div>
        </Card>
      )}

      {/* Modals */}
      <AddPhoneWhitelistModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
      />

      <EditWhitelistLabelModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        entry={selectedEntry}
      />

      <RemoveWhitelistModal
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        onSuccess={handleRemoveSuccess}
        entry={selectedEntry}
      />
    </div>
  );
}
