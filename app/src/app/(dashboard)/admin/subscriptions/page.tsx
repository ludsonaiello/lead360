/**
 * Subscription Plans Management Page
 * Admin dashboard for managing subscription plans with full CRUD operations
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Users,
  DollarSign,
  Package,
  TrendingUp,
  Eye,
  Calendar,
  Shield,
  X,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  getSubscriptionPlans,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
} from '@/lib/api/admin';
import type {
  SubscriptionPlan,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  FeatureFlags,
} from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { toast } from 'react-hot-toast';

// Available feature flags with labels
const AVAILABLE_FEATURES = [
  { key: 'dashboard', label: 'Dashboard', category: 'Core' },
  { key: 'settings', label: 'Settings', category: 'Core' },
  { key: 'users', label: 'User Management', category: 'Core' },
  { key: 'subscription', label: 'Subscription Management', category: 'Core' },
  { key: 'files', label: 'File Management', category: 'Core' },

  { key: 'leads', label: 'Lead Management', category: 'CRM' },
  { key: 'tasks', label: 'Task Management', category: 'CRM' },
  { key: 'calendar', label: 'Calendar/Scheduling', category: 'CRM' },
  { key: 'timeclock', label: 'Time Tracking', category: 'CRM' },

  { key: 'quotes_module', label: 'Quote Generation', category: 'Financial' },
  { key: 'invoices_module', label: 'Invoice Management', category: 'Financial' },
  { key: 'payments', label: 'Payment Processing', category: 'Financial' },
  { key: 'expenses', label: 'Expense Tracking', category: 'Financial' },

  { key: 'projects', label: 'Project Management', category: 'Project' },

  { key: 'reports', label: 'Advanced Reporting', category: 'Advanced' },
  { key: 'advanced_reporting', label: 'Analytics & Insights', category: 'Advanced' },
  { key: 'inventory_module', label: 'Inventory Management', category: 'Advanced' },

  { key: 'api_access', label: 'API Access', category: 'Enterprise' },
  { key: 'custom_integrations', label: 'Custom Integrations', category: 'Enterprise' },
];

export default function SubscriptionPlansPage() {
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Form data for create/edit
  const [formData, setFormData] = useState<CreateSubscriptionPlanDto>({
    name: '',
    description: '',
    monthly_price: 0,
    annual_price: 0,
    max_users: null,
    max_storage_gb: null,
    feature_flags: {},
    is_active: true,
    is_default: false,
    offers_trial: false,
    trial_days: null,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateSubscriptionPlanDto, string>>>({});

  useEffect(() => {
    loadPlans();
  }, []);

  // Check for edit query parameter and auto-open edit modal
  useEffect(() => {
    const editPlanId = searchParams.get('edit');
    if (editPlanId && plans.length > 0) {
      const planToEdit = plans.find(p => p.id === editPlanId);
      if (planToEdit && !showEditModal) {
        openEditModal(planToEdit);
        // Remove query param from URL without triggering navigation
        window.history.replaceState({}, '', '/admin/subscriptions');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, plans]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const plansResponse = await getSubscriptionPlans();
      setPlans(plansResponse.plans || []);
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      monthly_price: 0,
      annual_price: 0,
      max_users: null,
      max_storage_gb: null,
      feature_flags: {},
      is_active: true,
      is_default: false,
      offers_trial: false,
      trial_days: null,
    });
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateSubscriptionPlanDto, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Plan name is required';
    if (formData.monthly_price <= 0) newErrors.monthly_price = 'Monthly price must be greater than 0';
    if (formData.annual_price <= 0) newErrors.annual_price = 'Annual price must be greater than 0';

    // Validate trial settings
    if (formData.offers_trial) {
      if (!formData.trial_days || formData.trial_days <= 0) {
        newErrors.trial_days = 'Trial days must be greater than 0 when trial is offered';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEditPlan = async () => {
    if (!selectedPlan || !validateForm()) return;

    try {
      setActionLoading(true);
      const updateDto: UpdateSubscriptionPlanDto = { ...formData };
      await updateSubscriptionPlan(selectedPlan.id, updateDto);
      toast.success('Subscription plan updated successfully!');
      setShowEditModal(false);
      setSelectedPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      console.error('Update plan error:', error);
      toast.error(error.message || 'Failed to update subscription plan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan || deleteConfirmText !== 'DELETE') return;

    try {
      setActionLoading(true);
      await deleteSubscriptionPlan(selectedPlan.id);
      toast.success('Subscription plan deleted successfully!');
      setShowDeleteModal(false);
      setSelectedPlan(null);
      setDeleteConfirmText('');
      loadPlans();
    } catch (error: any) {
      console.error('Delete plan error:', error);
      toast.error(error.message || 'Failed to delete subscription plan');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      monthly_price: plan.monthly_price,
      annual_price: plan.annual_price,
      max_users: plan.max_users,
      max_storage_gb: plan.max_storage_gb,
      feature_flags: plan.feature_flags || {},
      is_active: plan.is_active,
      is_default: plan.is_default,
      offers_trial: plan.offers_trial,
      trial_days: plan.trial_days,
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowDeleteModal(true);
  };

  const toggleFeature = (featureKey: string) => {
    setFormData(prev => ({
      ...prev,
      feature_flags: {
        ...prev.feature_flags,
        [featureKey]: !(prev.feature_flags?.[featureKey] || false),
      },
    }));
  };

  const groupedFeatures = AVAILABLE_FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_FEATURES>);

  // Calculate stats
  const stats = {
    totalPlans: plans.length,
    activePlans: plans.filter(p => p.is_active).length,
    defaultPlan: plans.find(p => p.is_default),
    avgMonthlyPrice: plans.length > 0
      ? plans.reduce((sum, p) => sum + p.monthly_price, 0) / plans.length
      : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Subscription Plans</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage subscription plans and pricing for all tenants
          </p>
        </div>
        <Link href="/admin/subscriptions/create">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Plan
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Plans</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.totalPlans}</p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Plans</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{stats.activePlans}</p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Default Plan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-2 truncate">
                {stats.defaultPlan?.name || 'None'}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Monthly Price</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                ${stats.avgMonthlyPrice.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Plans Table */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">All Plans</h2>

        {plans.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-4">No subscription plans found</p>
            <Link href="/admin/subscriptions/create">
              <Button>
                Create Your First Plan
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Plan Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Monthly Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Annual Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Limits
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {plan.name}
                            </span>
                            {plan.is_default && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                Default
                              </span>
                            )}
                            {plan.offers_trial && plan.trial_days && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                {plan.trial_days}-day trial
                              </span>
                            )}
                          </div>
                          {plan.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {plan.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${plan.monthly_price.toFixed(2)}/mo
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${plan.annual_price.toFixed(2)}/yr
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-1">
                        <div className="text-gray-600 dark:text-gray-400">
                          Users: <span className="font-medium text-gray-900 dark:text-white">
                            {plan.max_users || 'Unlimited'}
                          </span>
                        </div>
                        <div className="text-gray-600 dark:text-gray-400">
                          Storage: <span className="font-medium text-gray-900 dark:text-white">
                            {plan.max_storage_gb ? `${plan.max_storage_gb} GB` : 'Unlimited'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          plan.is_active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {plan.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/subscriptions/${plan.id}`}
                          className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                          title="View Plan Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(plan)}
                          className="p-1.5 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                          title="Edit Plan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(plan)}
                          className="p-1.5 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Plan Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedPlan(null);
          resetForm();
        }}
        title={`Edit Plan: ${selectedPlan?.name}`}
        size="lg"
      >
        <ModalContent>
          <div className="space-y-4">
            {/* Same form fields as Create Modal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="e.g., Professional Plan"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Brief description of this plan"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <CurrencyInput
                  label="Monthly Price *"
                  value={formData.monthly_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, monthly_price: value || 0 }))}
                  error={errors.monthly_price}
                  placeholder="0.00"
                  leftIcon={<DollarSign className="w-5 h-5" />}
                  max={99999999.99}
                />
              </div>

              <div>
                <CurrencyInput
                  label="Annual Price *"
                  value={formData.annual_price}
                  onChange={(value) => setFormData(prev => ({ ...prev, annual_price: value || 0 }))}
                  error={errors.annual_price}
                  placeholder="0.00"
                  leftIcon={<DollarSign className="w-5 h-5" />}
                  max={99999999.99}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Users
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_users || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_users: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Storage (GB)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_storage_gb || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_storage_gb: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            {/* Trial Configuration */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={formData.offers_trial || false}
                  onChange={(e) => {
                    const offersTrial = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      offers_trial: offersTrial,
                      trial_days: offersTrial ? (prev.trial_days || 14) : null,
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Offer Free Trial Period</span>
              </label>

              {formData.offers_trial && (
                <div className="ml-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Trial Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.trial_days || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, trial_days: e.target.value ? parseInt(e.target.value) : null }))}
                    className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.trial_days ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                    placeholder="14"
                  />
                  {errors.trial_days && <p className="text-red-500 text-sm mt-1">{errors.trial_days}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Number of days new tenants can use this plan for free
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Feature Flags
              </label>

              {/* Feature Flags grouped by category */}
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(groupedFeatures).map(([category, features]) => (
                  <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {features.map((feature) => (
                        <label key={feature.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.feature_flags?.[feature.key] || false}
                            onChange={() => toggleFeature(feature.key)}
                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{feature.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Check the features you want to enable for this subscription plan
              </p>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Set as Default</span>
              </label>
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => {
              setShowEditModal(false);
              setSelectedPlan(null);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleEditPlan} loading={actionLoading}>
            Update Plan
          </Button>
        </ModalActions>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPlan(null);
          setDeleteConfirmText('');
        }}
        title="Delete Subscription Plan"
        size="md"
      >
        <ModalContent>
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete <strong>{selectedPlan?.name}</strong>?
            </p>
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200">
                <strong>Warning:</strong> If tenants are currently using this plan, they will need to be migrated to another plan first.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="DELETE"
              />
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setSelectedPlan(null);
              setDeleteConfirmText('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeletePlan}
            loading={actionLoading}
            disabled={deleteConfirmText !== 'DELETE'}
          >
            Delete Plan
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
