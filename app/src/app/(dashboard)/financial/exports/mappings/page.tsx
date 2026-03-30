/**
 * Account Mappings Configuration Page
 * Maps Lead360 financial categories to accounting software accounts (QuickBooks/Xero)
 * Sprint 21 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Shield,
  Search,
  MapPin,
  Filter,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  getDefaultMappings,
  getAccountMappings,
  createAccountMapping,
  deleteAccountMapping,
} from '@/lib/api/financial';
import type {
  DefaultMapping,
  AccountMapping,
  CreateAccountMappingDto,
  AccountingPlatform,
  CategoryType,
  CategoryClassification,
} from '@/lib/types/financial';

// ========== CONSTANTS ==========

const PLATFORM_OPTIONS: { value: AccountingPlatform; label: string }[] = [
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'xero', label: 'Xero' },
];

type BadgeVariant = 'blue' | 'green' | 'purple' | 'orange' | 'indigo' | 'danger' | 'cyan' | 'gray' | 'pink' | 'yellow' | 'amber' | 'neutral';

const TYPE_BADGE_VARIANT: Record<CategoryType, BadgeVariant> = {
  labor: 'blue',
  material: 'green',
  subcontractor: 'purple',
  equipment: 'orange',
  insurance: 'indigo',
  fuel: 'danger',
  utilities: 'cyan',
  office: 'gray',
  marketing: 'pink',
  taxes: 'yellow',
  tools: 'amber',
  other: 'neutral',
};

const TYPE_LABELS: Record<CategoryType, string> = {
  labor: 'Labor',
  material: 'Material',
  subcontractor: 'Subcontractor',
  equipment: 'Equipment',
  insurance: 'Insurance',
  fuel: 'Fuel',
  utilities: 'Utilities',
  office: 'Office',
  marketing: 'Marketing',
  taxes: 'Taxes',
  tools: 'Tools',
  other: 'Other',
};

const CLASSIFICATION_LABELS: Record<CategoryClassification, string> = {
  cost_of_goods_sold: 'COGS',
  operating_expense: 'OpEx',
};

const ALLOWED_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const DELETE_ROLES = ['Owner', 'Admin']; // More restricted — per API Section 22.4

// ========== MAPPING FORM MODAL ==========

interface MappingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mapping: DefaultMapping | null;
  platform: AccountingPlatform;
  existingMappings: AccountMapping[];
}

function MappingFormModal({
  isOpen,
  onClose,
  onSuccess,
  mapping,
  platform,
  existingMappings,
}: MappingFormModalProps) {
  const [accountName, setAccountName] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ accountName?: string; accountCode?: string }>({});

  // Find existing custom mapping for this category+platform
  const existingMapping = useMemo(() => {
    if (!mapping) return null;
    return (
      existingMappings.find(
        (m) => m.category_id === mapping.category_id && m.platform === platform,
      ) || null
    );
  }, [mapping, existingMappings, platform]);

  const isEdit = Boolean(mapping?.has_custom_mapping && existingMapping);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && mapping) {
      if (mapping.has_custom_mapping && existingMapping) {
        setAccountName(existingMapping.account_name);
        setAccountCode(existingMapping.account_code || '');
      } else {
        setAccountName(mapping.category_name);
        setAccountCode('');
      }
      setErrors({});
    }
  }, [isOpen, mapping, existingMapping]);

  const validate = (): boolean => {
    const newErrors: { accountName?: string; accountCode?: string } = {};

    if (!accountName.trim()) {
      newErrors.accountName = 'Account name is required';
    } else if (accountName.trim().length > 200) {
      newErrors.accountName = 'Account name must be 200 characters or fewer';
    }

    if (accountCode.trim().length > 50) {
      newErrors.accountCode = 'Account code must be 50 characters or fewer';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapping || !validate()) return;

    setSaving(true);
    try {
      const dto: CreateAccountMappingDto = {
        category_id: mapping.category_id,
        platform,
        account_name: accountName.trim(),
        account_code: accountCode.trim() || undefined,
      };
      await createAccountMapping(dto);
      toast.success(`Account mapping saved for "${mapping.category_name}"`);
      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Failed to save account mapping';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Account Mapping' : 'Create Account Mapping'}
      size="md"
    >
      {mapping && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Read-only: Category */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Category
            </label>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-gray-200 dark:border-gray-600">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {mapping.category_name}
              </span>
              <Badge variant={TYPE_BADGE_VARIANT[mapping.category_type]}>
                {TYPE_LABELS[mapping.category_type]}
              </Badge>
              <Badge
                variant={
                  mapping.classification === 'cost_of_goods_sold' ? 'info' : 'warning'
                }
              >
                {CLASSIFICATION_LABELS[mapping.classification]}
              </Badge>
            </div>
          </div>

          {/* Read-only: Platform */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Platform
            </label>
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-gray-200 dark:border-gray-600">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {PLATFORM_OPTIONS.find((p) => p.value === platform)?.label}
              </span>
            </div>
          </div>

          {/* Account Name */}
          <Input
            label="Account Name"
            placeholder="e.g., Job Materials"
            value={accountName}
            onChange={(e) => {
              setAccountName(e.target.value);
              if (errors.accountName)
                setErrors((prev) => ({ ...prev, accountName: undefined }));
            }}
            error={errors.accountName}
            maxLength={200}
            required
            helperText="The account name in your accounting software"
          />

          {/* Account Code */}
          <Input
            label="Account Code"
            placeholder="e.g., 5100"
            value={accountCode}
            onChange={(e) => {
              setAccountCode(e.target.value);
              if (errors.accountCode)
                setErrors((prev) => ({ ...prev, accountCode: undefined }));
            }}
            error={errors.accountCode}
            maxLength={50}
            helperText="Optional — some accounting software uses numeric account codes"
          />

          <ModalActions>
            <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving}>
              {isEdit ? 'Save Changes' : 'Save Mapping'}
            </Button>
          </ModalActions>
        </form>
      )}
    </Modal>
  );
}

// ========== MAIN PAGE ==========

export default function AccountMappingsPage() {
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(ALLOWED_ROLES);
  const canDelete = hasRole(DELETE_ROLES);

  // Data
  const [platform, setPlatform] = useState<AccountingPlatform>('quickbooks');
  const [defaults, setDefaults] = useState<DefaultMapping[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<DefaultMapping | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mappingToDelete, setMappingToDelete] = useState<{
    id: string;
    categoryName: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load data when platform changes
  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [defaultsData, mappingsData] = await Promise.all([
        getDefaultMappings(platform),
        getAccountMappings({ platform }),
      ]);
      setDefaults(defaultsData);
      setMappings(mappingsData);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load account mappings';
      setFetchError(message);
      console.error('Failed to load account mappings:', error);
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [canView, loadData]);

  // Client-side filtering
  const filteredDefaults = useMemo(() => {
    if (!searchQuery.trim()) return defaults;
    const query = searchQuery.toLowerCase().trim();
    return defaults.filter(
      (d) =>
        d.category_name.toLowerCase().includes(query) ||
        d.category_type.toLowerCase().includes(query) ||
        d.account_name.toLowerCase().includes(query) ||
        (d.account_code && d.account_code.toLowerCase().includes(query)),
    );
  }, [defaults, searchQuery]);

  // Stats
  const customCount = defaults.filter((d) => d.has_custom_mapping).length;

  // Handlers
  const handleEdit = (mapping: DefaultMapping) => {
    setEditingMapping(mapping);
    setFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    setFormModalOpen(false);
    setEditingMapping(null);
    loadData();
  };

  const handleDeleteClick = (defaultMapping: DefaultMapping) => {
    const actualMapping = mappings.find(
      (m) => m.category_id === defaultMapping.category_id && m.platform === platform,
    );
    if (actualMapping) {
      setMappingToDelete({
        id: actualMapping.id,
        categoryName: defaultMapping.category_name,
      });
      setDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!mappingToDelete) return;
    setDeleting(true);
    try {
      await deleteAccountMapping(mappingToDelete.id);
      toast.success(
        `Custom mapping removed for "${mappingToDelete.categoryName}"`,
      );
      setDeleteModalOpen(false);
      setMappingToDelete(null);
      loadData();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data
              ?.message || 'Failed to delete mapping';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // ======= RENDER GUARDS =======

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Access Restricted
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          You don&apos;t have permission to manage account mappings.
        </p>
      </div>
    );
  }

  // ======= MAIN RENDER =======

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Financial', href: '/financial' },
            { label: 'Exports', href: '/financial/exports' },
            { label: 'Account Mappings' },
          ]}
        />

        {/* Back link */}
        <div>
          <Link
            href="/financial/exports"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Exports
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              Account Mappings
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Map your Lead360 categories to your accounting software accounts for
              cleaner exports.
            </p>
          </div>
          {!loading && !fetchError && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="info">{customCount} custom</Badge>
              <Badge variant="neutral">
                {defaults.length - customCount} default
              </Badge>
            </div>
          )}
        </div>

        {/* Platform toggle + Search */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Platform toggle */}
            <div
              className="inline-flex rounded-lg border-2 border-gray-300 dark:border-gray-600 overflow-hidden flex-shrink-0"
              role="group"
              aria-label="Select accounting platform"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlatform(opt.value)}
                  className={`
                    px-4 py-2.5 text-sm font-semibold transition-colors min-w-[120px]
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset
                    ${
                      platform === opt.value
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }
                  `}
                  aria-pressed={platform === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex-1">
              <Input
                placeholder="Search categories or accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-5 h-5" />}
              />
            </div>
          </div>
        </Card>

        {/* Content */}
        {loading ? (
          /* Skeleton loader */
          <Card className="overflow-hidden">
            <div className="animate-pulse">
              {/* Table header skeleton */}
              <div className="hidden sm:grid grid-cols-[2fr_1.5fr_0.75fr_0.75fr_auto] gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
              {/* Row skeletons */}
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                >
                  <div className="hidden sm:grid grid-cols-[2fr_1.5fr_0.75fr_0.75fr_auto] gap-4 items-center">
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="flex gap-2">
                        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      </div>
                    </div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                  {/* Mobile skeleton */}
                  <div className="sm:hidden space-y-2">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : fetchError ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Account Mappings
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">{fetchError}</p>
              <Button variant="primary" onClick={loadData} size="sm">
                Try Again
              </Button>
            </div>
          </Card>
        ) : filteredDefaults.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                {searchQuery ? (
                  <Filter className="w-8 h-8 text-gray-400" />
                ) : (
                  <BookOpen className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {searchQuery
                  ? 'No categories match your search'
                  : 'No categories found'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : 'Create financial categories first to set up account mappings.'}
              </p>
            </div>
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <Card className="hidden sm:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Lead360 Category
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Account Name
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredDefaults.map((item) => (
                      <tr
                        key={item.category_id}
                        className={`
                          hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors
                          ${item.has_custom_mapping ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}
                        `}
                      >
                        {/* Category */}
                        <td className="px-6 py-4">
                          <div className="space-y-1.5">
                            <span
                              className={`block text-sm ${
                                item.has_custom_mapping
                                  ? 'font-bold text-gray-900 dark:text-white'
                                  : 'font-medium text-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {item.category_name}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              <Badge
                                variant={TYPE_BADGE_VARIANT[item.category_type]}
                              >
                                {TYPE_LABELS[item.category_type]}
                              </Badge>
                              <Badge
                                variant={
                                  item.classification === 'cost_of_goods_sold'
                                    ? 'info'
                                    : 'warning'
                                }
                              >
                                {CLASSIFICATION_LABELS[item.classification]}
                              </Badge>
                            </div>
                          </div>
                        </td>

                        {/* Account Name */}
                        <td className="px-6 py-4">
                          <span
                            className={`text-sm ${
                              item.has_custom_mapping
                                ? 'font-semibold text-gray-900 dark:text-white'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {item.account_name}
                          </span>
                        </td>

                        {/* Account Code */}
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-600 dark:text-gray-300 font-mono">
                            {item.account_code || '\u2014'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {item.has_custom_mapping ? (
                            <Badge variant="success">Custom</Badge>
                          ) : (
                            <Badge variant="neutral">Default</Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(item)}
                              className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit mapping"
                              aria-label={`Edit mapping for ${item.category_name}`}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {item.has_custom_mapping && canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(item)}
                                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Remove custom mapping"
                                aria-label={`Remove custom mapping for ${item.category_name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Mobile Cards */}
            <div className="sm:hidden space-y-3">
              {filteredDefaults.map((item) => (
                <Card
                  key={item.category_id}
                  className={`p-4 ${
                    item.has_custom_mapping
                      ? 'ring-2 ring-blue-200 dark:ring-blue-800'
                      : ''
                  }`}
                >
                  {/* Category name + status */}
                  <div className="flex items-start justify-between mb-2">
                    <h3
                      className={`text-base leading-snug pr-2 ${
                        item.has_custom_mapping
                          ? 'font-bold text-gray-900 dark:text-white'
                          : 'font-medium text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {item.category_name}
                    </h3>
                    {item.has_custom_mapping ? (
                      <Badge variant="success">Custom</Badge>
                    ) : (
                      <Badge variant="neutral">Default</Badge>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant={TYPE_BADGE_VARIANT[item.category_type]}>
                      {TYPE_LABELS[item.category_type]}
                    </Badge>
                    <Badge
                      variant={
                        item.classification === 'cost_of_goods_sold'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {CLASSIFICATION_LABELS[item.classification]}
                    </Badge>
                  </div>

                  {/* Account info */}
                  <div className="space-y-1.5 mb-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">
                        Account Name
                      </span>
                      <span
                        className={`text-right ${
                          item.has_custom_mapping
                            ? 'font-semibold text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {item.account_name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Code</span>
                      <span className="text-gray-600 dark:text-gray-300 font-mono">
                        {item.account_code || '\u2014'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(item)}
                      className="flex-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </Button>
                    {item.has_custom_mapping && canDelete && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteClick(item)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Footer count */}
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Showing {filteredDefaults.length} of {defaults.length} categories
              {customCount > 0 &&
                ` \u00B7 ${customCount} custom mapping${customCount !== 1 ? 's' : ''}`}
            </p>

            {/* Legend */}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
              Default = category name used as account name. Custom mappings shown in
              bold.
            </p>
          </>
        )}
      </div>

      {/* Create/Edit Mapping Modal */}
      <MappingFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingMapping(null);
        }}
        onSuccess={handleFormSuccess}
        mapping={editingMapping}
        platform={platform}
        existingMappings={mappings}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setMappingToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Remove Custom Mapping"
        message={`Remove the custom mapping for "${mappingToDelete?.categoryName}"? Exports will use the category name as the account name.`}
        confirmText="Remove Mapping"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
