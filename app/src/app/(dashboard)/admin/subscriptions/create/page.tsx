/**
 * Create Subscription Plan Page
 * Full page form for creating new subscription plans (migrated from modal)
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Package, AlertCircle, X } from 'lucide-react';
import { createSubscriptionPlan } from '@/lib/api/admin';
import type { CreateSubscriptionPlanDto } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

// Available feature flags with labels (EXACT COPY from main page)
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

export default function CreateSubscriptionPlanPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setApiError(null); // Clear previous errors
      await createSubscriptionPlan(formData);
      toast.success('Subscription plan created successfully!');
      router.push('/admin/subscriptions');
    } catch (error: any) {
      console.error('Create plan error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create subscription plan';
      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
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

  // Calculate annual savings
  const calculateAnnualSavings = () => {
    if (formData.monthly_price > 0 && formData.annual_price > 0) {
      const totalMonthly = formData.monthly_price * 12;
      const savings = totalMonthly - formData.annual_price;
      const percentage = (savings / totalMonthly) * 100;
      return { savings, percentage };
    }
    return null;
  };

  const annualSavings = calculateAnnualSavings();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/subscriptions"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Subscription Plans
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Subscription Plan</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure a new subscription plan for your tenants
        </p>
      </div>

      {/* Error Banner */}
      {apiError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Creating Plan</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{apiError}</p>
            </div>
          </div>
          <button
            onClick={() => setApiError(null)}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form - EXACT COPY from Edit Modal */}
      <form onSubmit={handleSubmit}>
        <Card className="p-6">
          <div className="space-y-4">
            {/* Same form fields as modal */}
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

            {/* Annual Savings Display */}
            {annualSavings && annualSavings.savings > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                      Annual Savings: ${annualSavings.savings.toFixed(2)}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                      {annualSavings.percentage.toFixed(1)}% discount compared to monthly billing (${(formData.monthly_price * 12).toFixed(2)}/year)
                    </p>
                  </div>
                </div>
              </div>
            )}

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
                  placeholder="e.g., 10"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum: 1 user
                </p>
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
                  placeholder="e.g., 50"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Minimum: 1 GB
                </p>
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
        </Card>

        {/* Action Buttons */}
        <Card className="p-4 mt-6">
          <div className="flex items-center justify-end gap-3">
            <Link href="/admin/subscriptions">
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
            <Button type="submit" loading={loading}>
              Create Plan
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
