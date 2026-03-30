/**
 * Supplier Detail Page
 * Tabbed detail view: Overview, Products, Statistics
 * Sprint 6 — Financial Frontend
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  ArrowLeft,
  Edit2,
  Shield,
  Star,
  MapPin,
  Mail,
  Phone,
  Globe,
  User,
  DollarSign,
  Hash,
  Calendar,
  CalendarCheck,
  Package,
  BarChart3,
  FileText,
  Info,
  Power,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';
import {
  getSupplier,
  getSupplierStatistics,
  updateSupplier,
} from '@/lib/api/financial';
import type {
  Supplier,
  SupplierStatistics,
} from '@/lib/types/financial';
import ProductsTab from './components/ProductsTab';

// ========== CONSTANTS ==========

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee'];
const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_DELETE_PRODUCT_ROLES = ['Owner', 'Admin', 'Bookkeeper'];
const CAN_HARD_DELETE_PRODUCT_ROLES = ['Owner', 'Admin'];

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
];

// ========== HELPERS ==========

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatPhone(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  // Remove country code if present
  const digits = cleaned.startsWith('1') && cleaned.length === 11 ? cleaned.slice(1) : cleaned;
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatFullAddress(supplier: Supplier): string | null {
  const parts = [
    supplier.address_line1,
    supplier.address_line2,
  ].filter(Boolean);

  const cityStateZip = [
    supplier.city,
    supplier.state,
  ].filter(Boolean).join(', ');

  if (supplier.zip_code) {
    if (cityStateZip) {
      parts.push(`${cityStateZip} ${supplier.zip_code}`);
    } else {
      parts.push(supplier.zip_code);
    }
  } else if (cityStateZip) {
    parts.push(cityStateZip);
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

// ========== SUMMARY CARD ==========

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  iconColor?: string;
}

function SummaryCard({ icon: Icon, label, value, iconColor = 'text-blue-600 dark:text-blue-400' }: SummaryCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {label}
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ========== OVERVIEW TAB ==========

interface OverviewTabProps {
  supplier: Supplier;
  statistics: SupplierStatistics | null;
  statsLoading: boolean;
}

function OverviewTab({ supplier, statistics, statsLoading }: OverviewTabProps) {
  const fullAddress = formatFullAddress(supplier);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={DollarSign}
          label="Total Spend"
          value={formatCurrency(statistics?.total_spend ?? supplier.total_spend)}
          iconColor="text-green-600 dark:text-green-400"
        />
        <SummaryCard
          icon={Hash}
          label="Transactions"
          value={statsLoading ? '...' : String(statistics?.transaction_count ?? 0)}
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <SummaryCard
          icon={CalendarCheck}
          label="Last Purchase"
          value={formatDate(statistics?.last_purchase_date ?? supplier.last_purchase_date)}
          iconColor="text-purple-600 dark:text-purple-400"
        />
        <SummaryCard
          icon={Calendar}
          label="First Purchase"
          value={formatDate(statistics?.first_purchase_date ?? null)}
          iconColor="text-indigo-600 dark:text-indigo-400"
        />
      </div>

      {/* Detail sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Contact Information
          </h3>
          <div className="space-y-3">
            {supplier.contact_name && (
              <div className="flex items-start gap-3">
                <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{supplier.contact_name}</p>
                </div>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Phone</p>
                  <a
                    href={`tel:${supplier.phone}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {formatPhone(supplier.phone)}
                  </a>
                </div>
              </div>
            )}
            {supplier.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Email</p>
                  <a
                    href={`mailto:${supplier.email}`}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {supplier.email}
                  </a>
                </div>
              </div>
            )}
            {supplier.website && (
              <div className="flex items-start gap-3">
                <Globe className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Website</p>
                  <a
                    href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline break-all"
                  >
                    {supplier.website}
                  </a>
                </div>
              </div>
            )}
            {!supplier.contact_name && !supplier.phone && !supplier.email && !supplier.website && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No contact information provided
              </p>
            )}
          </div>
        </Card>

        {/* Address */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Address
          </h3>
          {fullAddress ? (
            <div className="space-y-2">
              {supplier.address_line1 && (
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {supplier.address_line1}
                </p>
              )}
              {supplier.address_line2 && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {supplier.address_line2}
                </p>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {[supplier.city, supplier.state].filter(Boolean).join(', ')}
                {supplier.zip_code ? ` ${supplier.zip_code}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No address provided
            </p>
          )}
        </Card>
      </div>

      {/* Notes */}
      {supplier.notes && (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Notes
          </h3>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {supplier.notes}
          </p>
        </Card>
      )}

      {/* Metadata */}
      <Card className="p-5">
        <div className="flex flex-col sm:flex-row gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>
            Created {formatDate(supplier.created_at)}
            {supplier.created_by && ` by ${supplier.created_by.first_name} ${supplier.created_by.last_name}`}
          </span>
          <span>Last updated {formatDate(supplier.updated_at)}</span>
        </div>
      </Card>
    </div>
  );
}

// ========== STATISTICS TAB ==========

interface StatisticsTabProps {
  statistics: SupplierStatistics | null;
  loading: boolean;
  error: string | null;
}

function StatisticsTab({ statistics, loading, error }: StatisticsTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-center">
          <BarChart3 className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </Card>
    );
  }

  if (!statistics) return null;

  const hasSpendByCategory = statistics.spend_by_category.length > 0;
  const hasSpendByMonth = statistics.spend_by_month.length > 0;
  const maxCategorySpend = hasSpendByCategory
    ? Math.max(...statistics.spend_by_category.map((s) => s.total))
    : 0;
  const maxMonthSpend = hasSpendByMonth
    ? Math.max(...statistics.spend_by_month.map((s) => s.total))
    : 0;

  return (
    <div className="space-y-6">
      {/* Spend by Category */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Spend by Category
        </h3>
        {hasSpendByCategory ? (
          <div className="space-y-3">
            {statistics.spend_by_category.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {item.category_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {item.entry_count} {item.entry_count === 1 ? 'entry' : 'entries'}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(item.total)}
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-300"
                    style={{
                      width: maxCategorySpend > 0
                        ? `${(item.total / maxCategorySpend) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No spending data by category yet
          </p>
        )}
      </Card>

      {/* Spend by Month */}
      <Card className="p-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Spend by Month
        </h3>
        {hasSpendByMonth ? (
          <div className="space-y-3">
            {statistics.spend_by_month.map((item, index) => (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {item.month_label}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(item.total)}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300"
                    style={{
                      width: maxMonthSpend > 0
                        ? `${(item.total / maxMonthSpend) * 100}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No monthly spending data yet
          </p>
        )}
      </Card>
    </div>
  );
}

// ========== SKELETON LOADER ==========

function DetailSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
      <div className="space-y-3">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40" />
      </div>
      <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ========== MAIN PAGE ==========

export default function SupplierDetailPage() {
  const params = useParams();
  const supplierId = params.id as string;
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canManage = hasRole(CAN_MANAGE_ROLES);
  const canDeleteProduct = hasRole(CAN_DELETE_PRODUCT_ROLES);
  const canHardDeleteProduct = hasRole(CAN_HARD_DELETE_PRODUCT_ROLES);

  // Data state
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Statistics
  const [statistics, setStatistics] = useState<SupplierStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Toggle active modal
  const [toggleActiveModalOpen, setToggleActiveModalOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Load supplier
  const loadSupplier = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getSupplier(supplierId);
      setSupplier(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load supplier';
      setFetchError(message);
      console.error('Failed to load supplier:', error);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  // Load statistics
  const loadStatistics = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await getSupplierStatistics(supplierId);
      setStatistics(data);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to load statistics';
      setStatsError(message);
      console.error('Failed to load statistics:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [supplierId]);

  const handleToggleActive = async () => {
    if (!supplier) return;
    const newActiveState = !supplier.is_active;
    setToggling(true);
    try {
      await updateSupplier(supplier.id, { is_active: newActiveState });
      toast.success(
        newActiveState
          ? `Supplier "${supplier.name}" reactivated`
          : `Supplier "${supplier.name}" deactivated`
      );
      setToggleActiveModalOpen(false);
      loadSupplier();
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update supplier status';
      toast.error(message);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    if (canView && supplierId) {
      loadSupplier();
      loadStatistics();
    }
  }, [canView, supplierId, loadSupplier, loadStatistics]);

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
          You don&apos;t have permission to view this supplier.
        </p>
      </div>
    );
  }

  if (loading) {
    return <DetailSkeleton />;
  }

  if (fetchError || !supplier) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <Card className="p-8 sm:p-12">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-red-500 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {fetchError || 'Supplier Not Found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Unable to load this supplier. Please try again or go back.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="primary" onClick={loadSupplier} size="sm">
                Try Again
              </Button>
              <Link href="/financial/suppliers">
                <Button variant="secondary" size="sm">
                  Back to Suppliers
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const fullAddress = formatFullAddress(supplier);

  // ======= MAIN RENDER =======

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <div>
        <Link
          href="/financial/suppliers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Suppliers
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex-shrink-0">
            <Building2 className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white break-words">
                {supplier.name}
              </h1>
              {supplier.is_preferred && (
                <Badge variant="amber" icon={Star}>Preferred</Badge>
              )}
              {!supplier.is_active && (
                <Badge variant="neutral" label="Inactive" />
              )}
            </div>
            {fullAddress && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {fullAddress}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              {supplier.email && (
                <a
                  href={`mailto:${supplier.email}`}
                  className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {supplier.email}
                </a>
              )}
              {supplier.phone && (
                <a
                  href={`tel:${supplier.phone}`}
                  className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {formatPhone(supplier.phone)}
                </a>
              )}
            </div>
            {/* Category badges */}
            {supplier.categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {supplier.categories.map((cat) => (
                  <span
                    key={cat.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                  >
                    {cat.color && (
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                    )}
                    {cat.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant={supplier.is_active ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setToggleActiveModalOpen(true)}
            >
              {supplier.is_active ? (
                <><Power className="w-4 h-4" /> Deactivate</>
              ) : (
                <><RotateCcw className="w-4 h-4" /> Reactivate</>
              )}
            </Button>
            <Link href={`/financial/suppliers/${supplier.id}/edit`}>
              <Button variant="primary" size="sm">
                <Edit2 className="w-4 h-4" />
                Edit
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          supplier={supplier}
          statistics={statistics}
          statsLoading={statsLoading}
        />
      )}

      {activeTab === 'products' && (
        <ProductsTab
          supplierId={supplierId}
          canManage={canManage}
          canDelete={canDeleteProduct}
          canHardDelete={canHardDeleteProduct}
        />
      )}

      {activeTab === 'statistics' && (
        <StatisticsTab
          statistics={statistics}
          loading={statsLoading}
          error={statsError}
        />
      )}

      {/* Deactivate/Reactivate Confirmation Modal */}
      {canManage && supplier && (
        <ConfirmModal
          isOpen={toggleActiveModalOpen}
          onClose={() => setToggleActiveModalOpen(false)}
          onConfirm={handleToggleActive}
          title={supplier.is_active ? 'Deactivate Supplier' : 'Reactivate Supplier'}
          message={
            supplier.is_active
              ? `Are you sure you want to deactivate "${supplier.name}"? The supplier will be hidden from active lists but can be reactivated later.`
              : `Are you sure you want to reactivate "${supplier.name}"? The supplier will appear in active lists again.`
          }
          confirmText={supplier.is_active ? 'Deactivate' : 'Reactivate'}
          variant={supplier.is_active ? 'warning' : 'info'}
          loading={toggling}
        />
      )}
    </div>
  );
}
