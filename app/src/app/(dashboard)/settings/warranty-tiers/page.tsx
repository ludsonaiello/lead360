'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Search, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import ErrorModal from '@/components/ui/ErrorModal';
import WarrantyTierFormModal from '@/components/quotes/warranty/WarrantyTierFormModal';
import { getWarrantyTiers, deleteWarrantyTier } from '@/lib/api/warranty-tiers';
import { formatMoney } from '@/lib/api/quotes-dashboard';
import type { WarrantyTier } from '@/lib/types/quotes';

export default function WarrantyTiersPage() {
  const [tiers, setTiers] = useState<WarrantyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<WarrantyTier | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tierToDelete, setTierToDelete] = useState<WarrantyTier | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadTiers();
  }, []);

  const loadTiers = async () => {
    setLoading(true);
    try {
      const response = await getWarrantyTiers();
      setTiers(response);
    } catch (error) {
      console.error('Failed to load warranty tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTier(null);
    setFormModalOpen(true);
  };

  const handleEdit = (tier: WarrantyTier) => {
    setEditingTier(tier);
    setFormModalOpen(true);
  };

  const handleDelete = (tier: WarrantyTier) => {
    setTierToDelete(tier);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tierToDelete) return;

    try {
      await deleteWarrantyTier(tierToDelete.id);
      setTiers(tiers.filter((t) => t.id !== tierToDelete.id));
      setDeleteModalOpen(false);
      setTierToDelete(null);
    } catch (error: any) {
      console.error('Delete tier error:', error);
      const message = error.response?.data?.message || 'Failed to delete warranty tier';

      if (message.includes('usage_count') || message.includes('in use')) {
        setErrorMessage(
          `Cannot delete warranty tier "${tierToDelete.tier_name}" because it is currently in use on ${tierToDelete.usage_count} item(s). Mark it as inactive instead.`
        );
      } else {
        setErrorMessage(message);
      }
      setDeleteModalOpen(false);
      setTierToDelete(null);
      setErrorModalOpen(true);
    }
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingTier(null);
    loadTiers();
  };

  const formatDuration = (months: number): string => {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
      return `${months} ${months === 1 ? 'month' : 'months'}`;
    } else if (remainingMonths === 0) {
      return `${years} ${years === 1 ? 'year' : 'years'}`;
    } else {
      return `${years}y ${remainingMonths}m`;
    }
  };

  const formatPrice = (tier: WarrantyTier): string => {
    if (tier.price_type === 'fixed') {
      return formatMoney(tier.price_value);
    } else {
      return `${tier.price_value}%`;
    }
  };

  const filteredTiers = tiers.filter((tier) =>
    tier.tier_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Warranty Tiers
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Manage warranty options for quote items
            </p>
          </div>
          <Button variant="primary" onClick={handleCreate}>
            <Plus className="w-4 h-4" />
            Create Warranty Tier
          </Button>
        </div>

        {/* Search */}
        <Card className="p-4">
          <Input
            type="text"
            placeholder="Search warranty tiers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-5 h-5" />}
          />
        </Card>

        {/* Tiers Grid */}
        {filteredTiers.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery ? 'No warranty tiers found' : 'No warranty tiers yet'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Create your first warranty tier to offer warranty options on quote items'}
              </p>
              {!searchQuery && (
                <Button variant="primary" onClick={handleCreate}>
                  <Plus className="w-4 h-4" />
                  Create Warranty Tier
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTiers.map((tier) => (
              <Card key={tier.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {tier.tier_name}
                    </h3>
                  </div>
                </div>

                {tier.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {tier.description}
                  </p>
                )}

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Price:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatPrice(tier)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <Badge variant={tier.price_type === 'fixed' ? 'neutral' : 'info'}>
                      {tier.price_type === 'fixed' ? 'Fixed' : 'Percentage'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatDuration(tier.duration_months)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <Badge variant={tier.is_active ? 'success' : 'neutral'}>
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Usage:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {tier.usage_count} {tier.usage_count === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleEdit(tier)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(tier)}
                    disabled={tier.usage_count > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Warranty Tier Form Modal */}
      <WarrantyTierFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingTier(null);
        }}
        onSuccess={handleFormSuccess}
        tier={editingTier}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Warranty Tier"
        message={`Are you sure you want to delete the warranty tier "${tierToDelete?.tier_name}"? This action cannot be undone.`}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Error"
        message={errorMessage}
      />
    </>
  );
}
