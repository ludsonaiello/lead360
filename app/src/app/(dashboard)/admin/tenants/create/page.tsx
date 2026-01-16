/**
 * Create Tenant Page
 * Multi-step wizard for creating new tenants
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Building2, User, Settings, Eye, EyeOff, FileText, CreditCard, Hash, Calendar, DollarSign } from 'lucide-react';
import { createTenant, checkSubdomainAvailability, getSubscriptionPlans } from '@/lib/api/admin';
import { listIndustries } from '@/lib/api/admin-industries';
import type { CreateTenantDto, Industry, BusinessSize, SubscriptionPlan, BillingCycle } from '@/lib/types/admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { IndustryMultiSelect } from '@/components/admin/shared/IndustryMultiSelect';
import { MaskedInput } from '@/components/ui/MaskedInput';
import { Select } from '@/components/ui/Select';
import { toast } from 'react-hot-toast';

// Import business size options from types
const businessSizeOptions = [
  { label: '1-5 employees', value: '1-5' as BusinessSize },
  { label: '6-10 employees', value: '6-10' as BusinessSize },
  { label: '11-25 employees', value: '11-25' as BusinessSize },
  { label: '26-50 employees', value: '26-50' as BusinessSize },
  { label: '51-100 employees', value: '51-100' as BusinessSize },
  { label: '101-250 employees', value: '101-250' as BusinessSize },
  { label: '251+ employees', value: '251+' as BusinessSize },
];

const businessEntityOptions = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'llc', label: 'LLC (Limited Liability Company)' },
  { value: 'corporation', label: 'Corporation' },
  { value: 's-corporation', label: 'S-Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'dba', label: 'DBA (Doing Business As)' },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

type Step = 1 | 2 | 3 | 4;

export default function CreateTenantPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loadingIndustries, setLoadingIndustries] = useState(true);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [showPassword, setShowPassword] = useState(false);
  const [subdomainManuallyEdited, setSubdomainManuallyEdited] = useState(false);

  const [formData, setFormData] = useState<CreateTenantDto>({
    business_name: '',
    subdomain: '',
    industry_ids: [],
    business_size: undefined,
    business_entity_type: undefined,
    state_of_registration: undefined,
    ein: undefined,
    subscription_status: 'trial', // Default to trial
    subscription_plan_id: undefined,
    trial_end_date: undefined,
    owner_first_name: '',
    owner_last_name: '',
    owner_email: '',
    owner_phone: '',
    owner_password: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CreateTenantDto, string>>>({});

  // Load industries and subscription plans on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Load industries
        setLoadingIndustries(true);
        const industriesData = await listIndustries(true); // Only active industries
        setIndustries(industriesData);

        // Load subscription plans
        setLoadingPlans(true);
        const plansResponse = await getSubscriptionPlans();
        // Filter to only active plans
        const activePlans = plansResponse.plans?.filter(plan => plan.is_active) || [];
        setSubscriptionPlans(activePlans);

        // Set default trial end date (30 days from now)
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        setFormData(prev => ({
          ...prev,
          trial_end_date: trialEndDate.toISOString().split('T')[0], // YYYY-MM-DD format
        }));
      } catch (error) {
        console.error('Failed to load data:', error);
        toast.error('Failed to load initial data');
      } finally {
        setLoadingIndustries(false);
        setLoadingPlans(false);
      }
    }
    loadData();
  }, []);

  // Phone masking function (US format)
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');

    // Apply US phone format
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return `(${cleaned}`;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Password strength validation
  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'red' };
    if (score <= 4) return { score, label: 'Medium', color: 'yellow' };
    return { score, label: 'Strong', color: 'green' };
  };

  const handleInputChange = (field: keyof CreateTenantDto, value: string) => {
    let processedValue = value;

    // Apply phone masking
    if (field === 'owner_phone') {
      processedValue = formatPhoneNumber(value);
    }

    setFormData(prev => ({ ...prev, [field]: processedValue }));
    setErrors(prev => ({ ...prev, [field]: '' }));

    // Auto-generate subdomain from business name (only if not manually edited)
    if (field === 'business_name' && !subdomainManuallyEdited) {
      const subdomain = value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      setFormData(prev => ({ ...prev, subdomain }));
      setSubdomainAvailable(null);
    }

    // Mark subdomain as manually edited when user types in it
    if (field === 'subdomain') {
      setSubdomainManuallyEdited(true);
      if (processedValue.length >= 3) {
        checkSubdomain(processedValue);
      }
    }
  };

  const checkSubdomain = async (subdomain: string) => {
    try {
      setCheckingSubdomain(true);
      const result = await checkSubdomainAvailability(subdomain);
      setSubdomainAvailable(result.available);
    } catch (error) {
      setSubdomainAvailable(null);
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const validateStep = (step: Step): boolean => {
    const newErrors: Partial<Record<keyof CreateTenantDto, string>> = {};

    switch (step) {
      case 1:
        if (!formData.business_name) newErrors.business_name = 'Business name is required';
        if (!formData.subdomain) newErrors.subdomain = 'Subdomain is required';
        else if (!/^[a-z0-9-]{3,30}$/.test(formData.subdomain)) {
          newErrors.subdomain = 'Subdomain must be 3-30 characters (lowercase, numbers, hyphens)';
        } else if (subdomainAvailable === false) {
          newErrors.subdomain = 'Subdomain is not available';
        }
        if (!formData.ein) newErrors.ein = 'EIN is required';
        else if (!/^\d{2}-\d{7}$/.test(formData.ein)) {
          newErrors.ein = 'EIN must be in format XX-XXXXXXX';
        }
        if (!formData.business_entity_type) newErrors.business_entity_type = 'Business entity type is required';
        if (!formData.state_of_registration) newErrors.state_of_registration = 'State of registration is required';
        break;
      case 2:
        if (!formData.owner_first_name) newErrors.owner_first_name = 'First name is required';
        if (!formData.owner_last_name) newErrors.owner_last_name = 'Last name is required';
        if (!formData.owner_email) newErrors.owner_email = 'Owner email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.owner_email)) {
          newErrors.owner_email = 'Invalid email format';
        }
        if (!formData.owner_password) newErrors.owner_password = 'Password is required';
        else if (formData.owner_password.length < 8) {
          newErrors.owner_password = 'Password must be at least 8 characters';
        }
        break;
      case 3:
        // Step 3: Subscription Configuration
        if (!formData.subscription_plan_id) newErrors.subscription_plan_id = 'Subscription plan is required';
        if (!formData.subscription_status) newErrors.subscription_status = 'Subscription status is required';

        if (formData.subscription_status === 'trial') {
          if (!formData.trial_end_date) newErrors.trial_end_date = 'Trial end date is required';
        } else if (formData.subscription_status === 'active') {
          if (!formData.billing_cycle) newErrors.billing_cycle = 'Billing cycle is required';
          if (!formData.next_billing_date) newErrors.next_billing_date = 'Next billing date is required';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(4, prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    try {
      setLoading(true);

      // Prepare submission data with subscription configuration
      const submitData: CreateTenantDto = { ...formData };

      // If trial status, remove billing-related fields
      if (formData.subscription_status === 'trial') {
        delete (submitData as any).billing_cycle;
        delete (submitData as any).next_billing_date;
      }
      // If active status, remove trial_end_date
      else if (formData.subscription_status === 'active') {
        delete submitData.trial_end_date;
      }

      console.log('Creating tenant with data:', submitData);
      const tenant = await createTenant(submitData);
      console.log('Tenant created, response:', JSON.stringify(tenant, null, 2));
      console.log('Tenant ID:', tenant?.id);

      if (!tenant || !tenant.id) {
        console.error('Invalid tenant response - missing id:', tenant);
        toast.error('Tenant created but ID is missing from response');
        router.push('/admin/tenants');
        return;
      }

      toast.success('Tenant created successfully!');
      router.push(`/admin/tenants/${tenant.id}`);
    } catch (error: any) {
      console.error('Create tenant error:', error);
      toast.error(error.message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Business Info', icon: Building2 },
    { number: 2, title: 'Owner Info', icon: User },
    { number: 3, title: 'Initial Settings', icon: Settings },
    { number: 4, title: 'Review', icon: Eye },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/tenants')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Tenant</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Add a new organization to the platform</p>
        </div>
      </div>

      {/* Progress Steps */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;

            return (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      isActive || isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded transition-colors ${
                      currentStep > step.number ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* Form Content */}
      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Business Information</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Name *
              </label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => handleInputChange('business_name', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.business_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="Acme Roofing Inc."
              />
              {errors.business_name && <p className="text-red-500 text-sm mt-1">{errors.business_name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subdomain *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) => handleInputChange('subdomain', e.target.value)}
                  className={`flex-1 px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                    errors.subdomain ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="acme-roofing"
                />
                <span className="text-gray-600 dark:text-gray-400">.lead360.app</span>
              </div>
              {checkingSubdomain && <p className="text-gray-500 text-sm mt-1">Checking availability...</p>}
              {subdomainAvailable === true && <p className="text-green-500 text-sm mt-1">✓ Subdomain available</p>}
              {subdomainAvailable === false && <p className="text-red-500 text-sm mt-1">✗ Subdomain not available</p>}
              {errors.subdomain && <p className="text-red-500 text-sm mt-1">{errors.subdomain}</p>}
            </div>

            <MaskedInput
              label="EIN (Employer Identification Number) *"
              value={formData.ein || ''}
              onChange={(e) => handleInputChange('ein', e.target.value)}
              mask="99-9999999"
              maskChar={null}
              placeholder="XX-XXXXXXX"
              helperText="Federal tax ID number (Format: XX-XXXXXXX)"
              leftIcon={<Hash className="w-5 h-5" />}
              error={errors.ein}
              required
            />

            <Select
              label="Business Entity Type"
              options={businessEntityOptions}
              value={formData.business_entity_type || ''}
              onChange={(value) => handleInputChange('business_entity_type', value)}
              error={errors.business_entity_type}
              helperText="Your business structure for tax purposes"
              required
            />

            <Select
              label="State of Registration"
              options={US_STATES}
              value={formData.state_of_registration || ''}
              onChange={(value) => handleInputChange('state_of_registration', value)}
              error={errors.state_of_registration}
              helperText="State where your business is legally registered"
              searchable
              required
            />

            <IndustryMultiSelect
              industries={industries}
              selectedIds={formData.industry_ids || []}
              onChange={(ids) => setFormData(prev => ({ ...prev, industry_ids: ids }))}
              label="Industries (Optional)"
              placeholder="Select one or more industries"
              disabled={loadingIndustries}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Size (Optional)
              </label>
              <select
                value={formData.business_size || ''}
                onChange={(e) => handleInputChange('business_size', e.target.value as BusinessSize)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select business size (optional)</option>
                {businessSizeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Owner Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={formData.owner_first_name}
                  onChange={(e) => handleInputChange('owner_first_name', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.owner_first_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="John"
                />
                {errors.owner_first_name && <p className="text-red-500 text-sm mt-1">{errors.owner_first_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={formData.owner_last_name}
                  onChange={(e) => handleInputChange('owner_last_name', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.owner_last_name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Smith"
                />
                {errors.owner_last_name && <p className="text-red-500 text-sm mt-1">{errors.owner_last_name}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner Email *
              </label>
              <input
                type="email"
                value={formData.owner_email}
                onChange={(e) => handleInputChange('owner_email', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.owner_email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="john@acmeroofing.com"
              />
              {errors.owner_email && <p className="text-red-500 text-sm mt-1">{errors.owner_email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Owner Phone
              </label>
              <input
                type="tel"
                value={formData.owner_phone}
                onChange={(e) => handleInputChange('owner_phone', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="(555) 123-4567"
                maxLength={14}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">US phone format</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.owner_password}
                  onChange={(e) => handleInputChange('owner_password', e.target.value)}
                  className={`w-full px-4 py-2 pr-12 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.owner_password ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Minimum 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password strength indicator */}
              {formData.owner_password && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          getPasswordStrength(formData.owner_password).color === 'red'
                            ? 'bg-red-500'
                            : getPasswordStrength(formData.owner_password).color === 'yellow'
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${(getPasswordStrength(formData.owner_password).score / 6) * 100}%`,
                        }}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        getPasswordStrength(formData.owner_password).color === 'red'
                          ? 'text-red-600 dark:text-red-400'
                          : getPasswordStrength(formData.owner_password).color === 'yellow'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {getPasswordStrength(formData.owner_password).label}
                    </span>
                  </div>
                </div>
              )}

              {/* Password requirements */}
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Password must contain:</p>
                <ul className="text-xs space-y-0.5">
                  <li
                    className={`flex items-center gap-1 ${
                      formData.owner_password.length >= 8
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{formData.owner_password.length >= 8 ? '✓' : '○'}</span>
                    <span>At least 8 characters</span>
                  </li>
                  <li
                    className={`flex items-center gap-1 ${
                      /[A-Z]/.test(formData.owner_password)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{/[A-Z]/.test(formData.owner_password) ? '✓' : '○'}</span>
                    <span>One uppercase letter</span>
                  </li>
                  <li
                    className={`flex items-center gap-1 ${
                      /[a-z]/.test(formData.owner_password)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{/[a-z]/.test(formData.owner_password) ? '✓' : '○'}</span>
                    <span>One lowercase letter</span>
                  </li>
                  <li
                    className={`flex items-center gap-1 ${
                      /[0-9]/.test(formData.owner_password)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{/[0-9]/.test(formData.owner_password) ? '✓' : '○'}</span>
                    <span>One number</span>
                  </li>
                  <li
                    className={`flex items-center gap-1 ${
                      /[^a-zA-Z0-9]/.test(formData.owner_password)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span>{/[^a-zA-Z0-9]/.test(formData.owner_password) ? '✓' : '○'}</span>
                    <span>One special character (recommended)</span>
                  </li>
                </ul>
              </div>

              {errors.owner_password && <p className="text-red-500 text-sm mt-2">{errors.owner_password}</p>}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                The owner will be prompted to change this password on first login.
              </p>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Subscription Configuration</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Configure the subscription plan and billing for this tenant.
            </p>

            {/* Subscription Plan Selection */}
            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading subscription plans...</span>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subscription Plan *
                  </label>
                  <Select
                    options={subscriptionPlans.map(plan => ({
                      value: plan.id,
                      label: `${plan.name} - $${billingCycle === 'monthly' ? plan.monthly_price : plan.annual_price}/${billingCycle === 'monthly' ? 'mo' : 'yr'}`,
                    }))}
                    value={formData.subscription_plan_id || ''}
                    onChange={(value) => setFormData(prev => ({ ...prev, subscription_plan_id: value }))}
                    error={errors.subscription_plan_id}
                    helperText="Select the subscription plan for this tenant"
                  />
                  {formData.subscription_plan_id && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      {(() => {
                        const selectedPlan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
                        if (!selectedPlan) return null;
                        return (
                          <div className="text-sm space-y-1">
                            <p className="font-medium text-gray-900 dark:text-white">{selectedPlan.name}</p>
                            {selectedPlan.description && (
                              <p className="text-gray-600 dark:text-gray-400">{selectedPlan.description}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Max Users: </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {selectedPlan.max_users || 'Unlimited'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Storage: </span>
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {selectedPlan.max_storage_gb ? `${selectedPlan.max_storage_gb} GB` : 'Unlimited'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Subscription Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Subscription Status *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, subscription_status: 'trial' }))}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        formData.subscription_status === 'trial'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">Trial</span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.subscription_status === 'trial'
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {formData.subscription_status === 'trial' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                        Start with a free trial period
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, subscription_status: 'active' }))}
                      className={`p-4 border-2 rounded-lg transition-all ${
                        formData.subscription_status === 'active'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900 dark:text-white">Active</span>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.subscription_status === 'active'
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {formData.subscription_status === 'active' && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-left">
                        Start with active paid subscription
                      </p>
                    </button>
                  </div>
                </div>

                {/* Conditional Fields Based on Subscription Status */}
                {formData.subscription_status === 'trial' && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                    <h3 className="font-medium text-blue-900 dark:text-blue-300 flex items-center gap-2">
                      <Calendar className="w-5 h-5" />
                      Trial Period Configuration
                    </h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Trial End Date *
                      </label>
                      <input
                        type="date"
                        value={formData.trial_end_date || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, trial_end_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.trial_end_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {errors.trial_end_date && <p className="text-red-500 text-sm mt-1">{errors.trial_end_date}</p>}
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Default: 30 days from today
                      </p>
                    </div>
                  </div>
                )}

                {formData.subscription_status === 'active' && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-4">
                    <h3 className="font-medium text-green-900 dark:text-green-300 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Active Subscription Configuration
                    </h3>

                    {/* Billing Cycle */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Billing Cycle *
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setBillingCycle('monthly');
                            setFormData(prev => ({ ...prev, billing_cycle: 'monthly' }));
                          }}
                          className={`p-3 border-2 rounded-lg transition-all ${
                            billingCycle === 'monthly'
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">Monthly</span>
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                billingCycle === 'monthly'
                                  ? 'border-green-500 bg-green-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {billingCycle === 'monthly' && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                            </div>
                          </div>
                          {formData.subscription_plan_id && (() => {
                            const plan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
                            return plan ? (
                              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                ${plan.monthly_price.toFixed(2)}/mo
                              </p>
                            ) : null;
                          })()}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setBillingCycle('annual');
                            setFormData(prev => ({ ...prev, billing_cycle: 'annual' }));
                          }}
                          className={`p-3 border-2 rounded-lg transition-all ${
                            billingCycle === 'annual'
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">Annual</span>
                            <div
                              className={`w-4 h-4 rounded-full border-2 ${
                                billingCycle === 'annual'
                                  ? 'border-green-500 bg-green-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {billingCycle === 'annual' && <div className="w-2 h-2 bg-white rounded-full m-0.5" />}
                            </div>
                          </div>
                          {formData.subscription_plan_id && (() => {
                            const plan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
                            return plan ? (
                              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                                ${plan.annual_price.toFixed(2)}/yr
                              </p>
                            ) : null;
                          })()}
                        </button>
                      </div>
                    </div>

                    {/* Next Billing Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Next Billing Date *
                      </label>
                      <input
                        type="date"
                        value={formData.next_billing_date || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, next_billing_date: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                        className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.next_billing_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        }`}
                      />
                      {errors.next_billing_date && <p className="text-red-500 text-sm mt-1">{errors.next_billing_date}</p>}
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        When the tenant will be billed next
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Review & Confirm</h2>

            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Business Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Business Name:</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">{formData.business_name}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Subdomain:</dt>
                    <dd className="text-gray-900 dark:text-white font-medium font-mono">{formData.subdomain}.lead360.app</dd>
                  </div>
                  {formData.ein && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">EIN:</dt>
                      <dd className="text-gray-900 dark:text-white font-mono">{formData.ein}</dd>
                    </div>
                  )}
                  {formData.business_entity_type && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Business Entity Type:</dt>
                      <dd className="text-gray-900 dark:text-white">
                        {businessEntityOptions.find(opt => opt.value === formData.business_entity_type)?.label || formData.business_entity_type}
                      </dd>
                    </div>
                  )}
                  {formData.state_of_registration && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">State of Registration:</dt>
                      <dd className="text-gray-900 dark:text-white">
                        {US_STATES.find(state => state.value === formData.state_of_registration)?.label || formData.state_of_registration}
                      </dd>
                    </div>
                  )}
                  {formData.industry_ids && formData.industry_ids.length > 0 && (
                    <div>
                      <dt className="text-gray-600 dark:text-gray-400 mb-1">Industries:</dt>
                      <dd className="flex flex-wrap gap-1">
                        {formData.industry_ids.map((id) => {
                          const industry = industries.find(i => i.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-block px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-sm rounded"
                            >
                              {industry?.name || id}
                            </span>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                  {formData.business_size && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Business Size:</dt>
                      <dd className="text-gray-900 dark:text-white">
                        {businessSizeOptions.find(opt => opt.value === formData.business_size)?.label || formData.business_size}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Owner Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Name:</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">
                      {formData.owner_first_name} {formData.owner_last_name}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Email:</dt>
                    <dd className="text-gray-900 dark:text-white">{formData.owner_email}</dd>
                  </div>
                  {formData.owner_phone && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Phone:</dt>
                      <dd className="text-gray-900 dark:text-white">{formData.owner_phone}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Subscription Configuration</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Plan:</dt>
                    <dd className="text-gray-900 dark:text-white font-medium">
                      {(() => {
                        const plan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
                        return plan?.name || 'Not selected';
                      })()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600 dark:text-gray-400">Status:</dt>
                    <dd>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        formData.subscription_status === 'trial'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {formData.subscription_status === 'trial' ? 'Trial' : 'Active'}
                      </span>
                    </dd>
                  </div>
                  {formData.subscription_status === 'trial' && formData.trial_end_date && (
                    <div className="flex justify-between">
                      <dt className="text-gray-600 dark:text-gray-400">Trial Ends:</dt>
                      <dd className="text-gray-900 dark:text-white">
                        {new Date(formData.trial_end_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </dd>
                    </div>
                  )}
                  {formData.subscription_status === 'active' && (
                    <>
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Billing Cycle:</dt>
                        <dd className="text-gray-900 dark:text-white capitalize">
                          {formData.billing_cycle || 'Monthly'}
                        </dd>
                      </div>
                      {formData.next_billing_date && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600 dark:text-gray-400">Next Billing Date:</dt>
                          <dd className="text-gray-900 dark:text-white">
                            {new Date(formData.next_billing_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-gray-600 dark:text-gray-400">Price:</dt>
                        <dd className="text-gray-900 dark:text-white font-bold">
                          {(() => {
                            const plan = subscriptionPlans.find(p => p.id === formData.subscription_plan_id);
                            if (!plan) return 'N/A';
                            const price = formData.billing_cycle === 'annual' ? plan.annual_price : plan.monthly_price;
                            const period = formData.billing_cycle === 'annual' ? 'year' : 'month';
                            return `$${price.toFixed(2)}/${period}`;
                          })()}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Tenant
                </>
              )}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
