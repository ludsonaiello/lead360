/**
 * Industry Management Page
 * Platform admin page for managing industries (CRUD)
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit, Trash2, Check, X, Search, Filter } from 'lucide-react';
import { listIndustries, createIndustry, updateIndustry, deleteIndustry } from '@/lib/api/admin-industries';
import type { Industry } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

type ModalMode = 'create' | 'edit' | null;
type StatusFilter = 'all' | 'active' | 'inactive';

export default function IndustriesPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [industryToDelete, setIndustryToDelete] = useState<Industry | null>(null);

  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadIndustries();
  }, []);

  // Client-side filtering and search
  const filteredIndustries = useMemo(() => {
    let result = industries;

    // Apply status filter
    if (statusFilter === 'active') {
      result = result.filter((industry) => industry.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter((industry) => !industry.is_active);
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (industry) =>
          industry.name.toLowerCase().includes(searchLower) ||
          industry.description?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [industries, statusFilter, searchTerm]);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      const data = await listIndustries(false); // Load all industries (active + inactive)
      setIndustries(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load industries');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setSelectedIndustry(null);
    setFormData({ name: '', description: '', is_active: true });
    setModalOpen(true);
  };

  const handleEdit = (industry: Industry) => {
    setModalMode('edit');
    setSelectedIndustry(industry);
    setFormData({
      name: industry.name,
      description: industry.description || '',
      is_active: industry.is_active,
    });
    setModalOpen(true);
  };

  const handleDeleteClick = (industry: Industry) => {
    setIndustryToDelete(industry);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!industryToDelete) return;

    try {
      setActionLoading(true);
      await deleteIndustry(industryToDelete.id);
      toast.success(`Industry "${industryToDelete.name}" deleted successfully`);
      setShowDeleteModal(false);
      setIndustryToDelete(null);
      loadIndustries();
    } catch (error: any) {
      // Check if it's a 409 conflict error (industry in use)
      if (error.status === 409 || error.statusCode === 409) {
        toast.error(error.message || 'Cannot delete industry - it is currently in use by tenants');
      } else {
        toast.error(error.message || 'Failed to delete industry');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Industry name is required');
      return;
    }

    try {
      setActionLoading(true);

      if (modalMode === 'create') {
        await createIndustry({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          is_active: formData.is_active,
        });
        toast.success('Industry created successfully');
      } else if (modalMode === 'edit' && selectedIndustry) {
        await updateIndustry(selectedIndustry.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          is_active: formData.is_active,
        });
        toast.success('Industry updated successfully');
      }

      setModalOpen(false);
      loadIndustries();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${modalMode} industry`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleActive = async (industry: Industry) => {
    try {
      await updateIndustry(industry.id, {
        is_active: !industry.is_active,
      });
      toast.success(`Industry ${!industry.is_active ? 'activated' : 'deactivated'}`);
      loadIndustries();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update industry');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Industry Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage industries available for tenant classification
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Industry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Industries</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{industries.length}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active</h3>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
            {industries.filter((i) => i.is_active).length}
          </p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Inactive</h3>
          <p className="text-3xl font-bold text-gray-600 dark:text-gray-400 mt-2">
            {industries.filter((i) => !i.is_active).length}
          </p>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search industries by name or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Results Count */}
          {(searchTerm || statusFilter !== 'all') && (
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredIndustries.length} of {industries.length} industries
            </div>
          )}
        </div>
      </Card>

      {/* Industries List */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredIndustries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No industries match your search criteria.'
                      : 'No industries found. Click "Add Industry" to create one.'}
                  </td>
                </tr>
              ) : (
                filteredIndustries.map((industry) => (
                  <tr key={industry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{industry.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">
                        {industry.description || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleActive(industry)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          industry.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {industry.is_active ? (
                          <>
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(industry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(industry)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit industry"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(industry)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete industry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Create Industry' : 'Edit Industry'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <ModalContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Roofing"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Residential and commercial roofing services"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active (available for tenant selection)
                </label>
              </div>
            </div>
          </ModalContent>
          <ModalActions>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={actionLoading}>
              {modalMode === 'create' ? 'Create Industry' : 'Save Changes'}
            </Button>
          </ModalActions>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Industry"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{industryToDelete?.name}</strong>?
            </p>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> This industry cannot be deleted if any tenants are currently using it.
              </p>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm} loading={actionLoading}>
            Delete Industry
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
