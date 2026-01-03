/**
 * BusinessInfoWizard Component
 * 4-step multi-step form for complete business profile
 * Enhanced with icons, validation display, URL prefixes, and improved UX
 */

'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import {
  Building2,
  Scale,
  MapPin,
  Hash,
  Phone,
  Mail,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Landmark,
  CreditCard,
  FileText,
  DollarSign,
  Clock,
  Music2,
} from 'lucide-react';
import {
  businessLegalSchema,
  businessContactSchema,
  businessFinancialSchema,
  businessInvoiceSchema,
  type BusinessLegalFormData,
  type BusinessContactFormData,
  type BusinessFinancialFormData,
  type BusinessInvoiceFormData,
} from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { TenantProfile } from '@/lib/types/tenant';
import { Wizard } from '@/components/ui/Wizard';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Select, SelectOption } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { MaskedInput } from '@/components/ui/MaskedInput';

interface BusinessInfoWizardProps {
  tenant: TenantProfile | null;
  onUpdate: () => void;
}

const businessEntityOptions: SelectOption[] = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'llc', label: 'LLC (Limited Liability Company)' },
  { value: 'corporation', label: 'Corporation' },
  { value: 's-corporation', label: 'S-Corporation' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'dba', label: 'DBA (Doing Business As)' },
];

const US_STATES: SelectOption[] = [
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

const accountTypeOptions: SelectOption[] = [
  { value: 'checking', label: 'Checking Account' },
  { value: 'savings', label: 'Savings Account' },
];

/**
 * Helper function to ensure URL has https:// prefix
 */
const ensureHttpsPrefix = (value: string | undefined): string => {
  if (!value || value.trim() === '') return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

/**
 * Helper function to ensure Venmo has @ prefix
 */
const ensureVenmoPrefix = (value: string | undefined): string => {
  if (!value || value.trim() === '') return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('@')) {
    return trimmed;
  }
  return `@${trimmed}`;
};

/**
 * Helper function to extract date from datetime string
 * Converts "2025-12-30T12:00:00.000Z" to "2025-12-30"
 */
const extractDate = (datetime: string | null | undefined): string => {
  if (!datetime) return '';
  // Extract just the date part (YYYY-MM-DD) from datetime string
  return datetime.split('T')[0];
};

export function BusinessInfoWizard({ tenant, onUpdate }: BusinessInfoWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Legal & Tax
  const step1Form = useForm<BusinessLegalFormData>({
    resolver: zodResolver(businessLegalSchema),
    mode: 'onChange', // Enable onChange validation for real-time feedback
    defaultValues: {
      legal_business_name: tenant?.legal_business_name || '',
      dba_name: tenant?.dba_name || '',
      business_entity_type: tenant?.business_entity_type || undefined,
      state_of_registration: tenant?.state_of_registration || '',
      date_of_incorporation: extractDate(tenant?.date_of_incorporation),
      ein: tenant?.ein || '',
      state_tax_id: tenant?.state_tax_id || '',
      sales_tax_permit: tenant?.sales_tax_permit || '',
    },
  });

  // Step 2: Contact
  const step2Form = useForm<BusinessContactFormData>({
    resolver: zodResolver(businessContactSchema),
    mode: 'onChange',
    defaultValues: {
      primary_contact_phone: tenant?.primary_contact_phone || '',
      secondary_phone: tenant?.secondary_phone || '',
      primary_contact_email: tenant?.primary_contact_email || '',
      support_email: tenant?.support_email || '',
      billing_email: tenant?.billing_email || '',
      website_url: tenant?.website_url || '',
      instagram_url: tenant?.instagram_url || '',
      facebook_url: tenant?.facebook_url || '',
      tiktok_url: tenant?.tiktok_url || '',
      youtube_url: tenant?.youtube_url || '',
    },
  });

  // Step 3: Financial
  const step3Form = useForm<BusinessFinancialFormData>({
    resolver: zodResolver(businessFinancialSchema),
    mode: 'onChange',
    defaultValues: {
      bank_name: tenant?.bank_name || '',
      routing_number: tenant?.routing_number || '',
      account_number: tenant?.account_number || '',
      account_type: tenant?.account_type || undefined,
      venmo_username: tenant?.venmo_username || '',
    },
  });

  // Step 4: Invoice & Quote
  const step4Form = useForm<BusinessInvoiceFormData>({
    resolver: zodResolver(businessInvoiceSchema),
    mode: 'onChange',
    defaultValues: {
      invoice_prefix: tenant?.invoice_prefix || 'INV',
      next_invoice_number: tenant?.next_invoice_number || 1,
      quote_prefix: tenant?.quote_prefix || 'Q-',
      next_quote_number: tenant?.next_quote_number || 1,
      default_quote_validity_days: tenant?.default_quote_validity_days || 30,
      default_quote_terms: tenant?.default_quote_terms || '',
      default_quote_footer: tenant?.default_quote_footer || '',
      default_invoice_footer: tenant?.default_invoice_footer || '',
      default_payment_instructions: tenant?.default_payment_instructions || '',
    },
  });

  const forms = [step1Form, step2Form, step3Form, step4Form];
  const currentForm = forms[currentStep];

  const wizardSteps = [
    { id: 'legal', label: 'Legal & Tax', isValid: step1Form.formState.isValid },
    { id: 'contact', label: 'Contact', isValid: step2Form.formState.isValid },
    { id: 'financial', label: 'Financial', isValid: step3Form.formState.isValid },
    { id: 'invoice', label: 'Invoice & Quote', isValid: step4Form.formState.isValid },
  ];

  const handleNext = async () => {
    const isValid = await currentForm.trigger();
    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, wizardSteps.length - 1));
    } else {
      // Show toast with first error
      const errors = currentForm.formState.errors;
      const firstError = Object.values(errors)[0];
      if (firstError?.message) {
        toast.error(firstError.message as string);
      }
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleFinish = async () => {
    // Validate all forms
    const validations = await Promise.all([
      step1Form.trigger(),
      step2Form.trigger(),
      step3Form.trigger(),
      step4Form.trigger(),
    ]);

    if (validations.every((v) => v)) {
      try {
        setIsSubmitting(true);

        // Combine all form data with URL prefixes applied
        const step2Data = step2Form.getValues();
        const step3Data = step3Form.getValues();

        const allData = {
          ...step1Form.getValues(),
          // Apply https:// prefix to URLs
          ...step2Data,
          website_url: step2Data.website_url ? ensureHttpsPrefix(step2Data.website_url) : undefined,
          facebook_url: step2Data.facebook_url ? ensureHttpsPrefix(step2Data.facebook_url) : undefined,
          youtube_url: step2Data.youtube_url ? ensureHttpsPrefix(step2Data.youtube_url) : undefined,
          instagram_url: step2Data.instagram_url ? ensureHttpsPrefix(step2Data.instagram_url) : undefined,
          tiktok_url: step2Data.tiktok_url ? ensureHttpsPrefix(step2Data.tiktok_url) : undefined,
          // Apply @ prefix to Venmo
          ...step3Data,
          venmo_username: step3Data.venmo_username ? ensureVenmoPrefix(step3Data.venmo_username) : undefined,
          ...step4Form.getValues(),
        };

        console.log('📤 Business Settings - Request Data:', allData);

        const response = await tenantApi.updateTenantProfile(allData);

        console.log('📥 Business Settings - API Response:', response);

        toast.success('Business profile updated successfully');
        onUpdate();
      } catch (error: any) {
        console.error('❌ Business Settings - API Error:', error);
        console.error('❌ Business Settings - Error Response:', error?.response?.data);
        toast.error(error?.response?.data?.message || 'Failed to update business profile');
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast.error('Please fix all validation errors before saving');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <Wizard
        steps={wizardSteps}
        currentStep={currentStep}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onFinish={handleFinish}
        canGoNext={currentForm.formState.isValid}
        isLoading={isSubmitting}
      >
        {/* Step 1: Legal & Tax */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Scale className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Legal & Tax Information
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Official business registration details
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...step1Form.register('legal_business_name')}
                label="Legal Business Name"
                error={step1Form.formState.errors.legal_business_name?.message}
                helperText="Your official registered business name as it appears on legal documents"
                leftIcon={<Building2 className="w-5 h-5" />}
              />

              <Input
                {...step1Form.register('dba_name')}
                label="DBA Name"
                error={step1Form.formState.errors.dba_name?.message}
                helperText="Doing Business As name (if different from legal name)"
                leftIcon={<Building2 className="w-5 h-5" />}
              />

              <Select
                label="Business Entity Type"
                options={businessEntityOptions}
                value={step1Form.watch('business_entity_type') || ''}
                onChange={(value) => step1Form.setValue('business_entity_type', value as any, { shouldValidate: true })}
                error={step1Form.formState.errors.business_entity_type?.message}
                helperText="Your business structure for tax purposes"
                required
              />

              <Select
                label="State of Registration"
                options={US_STATES}
                value={step1Form.watch('state_of_registration') || ''}
                onChange={(value) => step1Form.setValue('state_of_registration', value, { shouldValidate: true })}
                error={step1Form.formState.errors.state_of_registration?.message}
                helperText="State where your business is legally registered"
                searchable
              />

              <Controller
                name="date_of_incorporation"
                control={step1Form.control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value || ''}
                    label="Date of Incorporation"
                    error={step1Form.formState.errors.date_of_incorporation?.message}
                    helperText="When your business was officially formed"
                  />
                )}
              />

              <MaskedInput
                {...step1Form.register('ein')}
                label="EIN (Employer Identification Number)"
                mask="99-9999999"
                maskChar={null}
                placeholder="XX-XXXXXXX"
                error={step1Form.formState.errors.ein?.message}
                helperText="Your federal tax ID number (Format: XX-XXXXXXX)"
                leftIcon={<Hash className="w-5 h-5" />}
              />

              <Input
                {...step1Form.register('state_tax_id')}
                label="State Tax ID"
                error={step1Form.formState.errors.state_tax_id?.message}
                helperText="State-level tax identification number (if applicable)"
                leftIcon={<Hash className="w-5 h-5" />}
              />

              <Input
                {...step1Form.register('sales_tax_permit')}
                label="Sales Tax Permit"
                error={step1Form.formState.errors.sales_tax_permit?.message}
                helperText="Sales tax permit or resale certificate number"
                leftIcon={<FileText className="w-5 h-5" />}
              />
            </div>
          </div>
        )}

        {/* Step 2: Contact */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Contact Information
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  How customers and partners can reach you
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller
                name="primary_contact_phone"
                control={step2Form.control}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    label="Primary Contact Phone"
                    error={step2Form.formState.errors.primary_contact_phone?.message}
                    helperText="Main phone number for business inquiries"
                    required
                    leftIcon={<Phone className="w-5 h-5" />}
                  />
                )}
              />

              <Controller
                name="secondary_phone"
                control={step2Form.control}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    label="Secondary Phone"
                    error={step2Form.formState.errors.secondary_phone?.message}
                    helperText="Alternative contact number (optional)"
                    leftIcon={<Phone className="w-5 h-5" />}
                  />
                )}
              />

              <Input
                {...step2Form.register('primary_contact_email')}
                type="email"
                label="Primary Contact Email"
                error={step2Form.formState.errors.primary_contact_email?.message}
                helperText="Main email address for business communications"
                leftIcon={<Mail className="w-5 h-5" />}
              />

              <Input
                {...step2Form.register('support_email')}
                type="email"
                label="Support Email"
                error={step2Form.formState.errors.support_email?.message}
                helperText="Email for customer support inquiries"
                leftIcon={<Mail className="w-5 h-5" />}
              />

              <Input
                {...step2Form.register('billing_email')}
                type="email"
                label="Billing Email"
                error={step2Form.formState.errors.billing_email?.message}
                helperText="Email for invoices and billing matters"
                leftIcon={<Mail className="w-5 h-5" />}
              />

              <Input
                {...step2Form.register('website_url')}
                type="url"
                label="Website URL"
                error={step2Form.formState.errors.website_url?.message}
                placeholder="example.com"
                helperText="Your business website (https:// will be added automatically)"
                leftIcon={<Globe className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step2Form.setValue('website_url', 'https://');
                  }
                }}
              />

              <Input
                {...step2Form.register('instagram_url')}
                type="url"
                label="Instagram URL"
                error={step2Form.formState.errors.instagram_url?.message}
                placeholder="instagram.com/username"
                helperText="Your Instagram profile (https:// will be added automatically)"
                leftIcon={<Instagram className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step2Form.setValue('instagram_url', 'https://instagram.com/');
                  }
                }}
              />

              <Input
                {...step2Form.register('facebook_url')}
                type="url"
                label="Facebook URL"
                error={step2Form.formState.errors.facebook_url?.message}
                placeholder="facebook.com/page"
                helperText="Your Facebook page (https:// will be added automatically)"
                leftIcon={<Facebook className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step2Form.setValue('facebook_url', 'https://facebook.com/');
                  }
                }}
              />

              <Input
                {...step2Form.register('tiktok_url')}
                type="url"
                label="TikTok URL"
                error={step2Form.formState.errors.tiktok_url?.message}
                placeholder="tiktok.com/@username"
                helperText="Your TikTok profile (https:// will be added automatically)"
                leftIcon={<Music2 className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step2Form.setValue('tiktok_url', 'https://tiktok.com/@');
                  }
                }}
              />

              <Input
                {...step2Form.register('youtube_url')}
                type="url"
                label="YouTube URL"
                error={step2Form.formState.errors.youtube_url?.message}
                placeholder="youtube.com/channel"
                helperText="Your YouTube channel (https:// will be added automatically)"
                leftIcon={<Youtube className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step2Form.setValue('youtube_url', 'https://youtube.com/');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Financial */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Landmark className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Financial Information
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Bank account and payment details
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...step3Form.register('bank_name')}
                label="Bank Name"
                error={step3Form.formState.errors.bank_name?.message}
                helperText="Name of your business banking institution"
                leftIcon={<Landmark className="w-5 h-5" />}
              />

              <MaskedInput
                {...step3Form.register('routing_number')}
                label="Routing Number"
                mask="999999999"
                maskChar={null}
                placeholder="XXXXXXXXX"
                error={step3Form.formState.errors.routing_number?.message}
                helperText="9-digit bank routing number for ACH transfers"
                leftIcon={<Hash className="w-5 h-5" />}
              />

              <Input
                {...step3Form.register('account_number')}
                label="Account Number"
                error={step3Form.formState.errors.account_number?.message}
                maxLength={17}
                helperText="Your business bank account number"
                leftIcon={<CreditCard className="w-5 h-5" />}
              />

              <Select
                label="Account Type"
                options={accountTypeOptions}
                value={step3Form.watch('account_type') || ''}
                onChange={(value) => step3Form.setValue('account_type', value as any, { shouldValidate: true })}
                error={step3Form.formState.errors.account_type?.message}
                helperText="Type of bank account (checking or savings)"
              />

              <Input
                {...step3Form.register('venmo_username')}
                label="Venmo Username"
                error={step3Form.formState.errors.venmo_username?.message}
                placeholder="username"
                helperText="Your Venmo handle (@ will be added automatically)"
                leftIcon={<DollarSign className="w-5 h-5" />}
                onFocus={(e) => {
                  if (!e.target.value || e.target.value === '') {
                    step3Form.setValue('venmo_username', '@');
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value === '@') {
                    step3Form.setValue('venmo_username', '');
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Step 4: Invoice & Quote */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Invoice & Quote Settings
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Customize your invoices and quotes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                {...step4Form.register('invoice_prefix')}
                label="Invoice Prefix"
                error={step4Form.formState.errors.invoice_prefix?.message}
                placeholder="INV"
                maxLength={10}
                helperText="Prefix for invoice numbers (e.g., 'INV-0001')"
                leftIcon={<Hash className="w-5 h-5" />}
                required
              />

              <Input
                {...step4Form.register('next_invoice_number', { valueAsNumber: true })}
                type="number"
                label="Next Invoice Number"
                error={step4Form.formState.errors.next_invoice_number?.message}
                min={1}
                helperText="Starting number for next invoice"
                leftIcon={<Hash className="w-5 h-5" />}
                required
              />

              <Input
                {...step4Form.register('quote_prefix')}
                label="Quote Prefix"
                error={step4Form.formState.errors.quote_prefix?.message}
                placeholder="Q-"
                maxLength={10}
                helperText="Prefix for quote numbers (e.g., 'Q-0001')"
                leftIcon={<Hash className="w-5 h-5" />}
                required
              />

              <Input
                {...step4Form.register('next_quote_number', { valueAsNumber: true })}
                type="number"
                label="Next Quote Number"
                error={step4Form.formState.errors.next_quote_number?.message}
                min={1}
                helperText="Starting number for next quote"
                leftIcon={<Hash className="w-5 h-5" />}
                required
              />

              <Input
                {...step4Form.register('default_quote_validity_days', { valueAsNumber: true })}
                type="number"
                label="Default Quote Validity (days)"
                error={step4Form.formState.errors.default_quote_validity_days?.message}
                min={1}
                max={365}
                helperText="How long quotes remain valid (1-365 days)"
                leftIcon={<Clock className="w-5 h-5" />}
                required
              />
            </div>

            <div className="space-y-6 mt-6">
              <Controller
                name="default_quote_terms"
                control={step4Form.control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    label="Default Quote Terms"
                    error={step4Form.formState.errors.default_quote_terms?.message}
                    rows={4}
                    maxLength={1000}
                    showCharacterCount
                    helperText="Standard terms and conditions that appear on all quotes"
                  />
                )}
              />

              <Controller
                name="default_quote_footer"
                control={step4Form.control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    label="Default Quote Footer"
                    error={step4Form.formState.errors.default_quote_footer?.message}
                    rows={3}
                    maxLength={500}
                    showCharacterCount
                    helperText="Footer text that appears at the bottom of quote documents"
                  />
                )}
              />

              <Controller
                name="default_invoice_footer"
                control={step4Form.control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    label="Default Invoice Footer"
                    error={step4Form.formState.errors.default_invoice_footer?.message}
                    rows={3}
                    maxLength={500}
                    showCharacterCount
                    helperText="Footer text that appears at the bottom of invoice documents"
                  />
                )}
              />

              <Controller
                name="default_payment_instructions"
                control={step4Form.control}
                render={({ field }) => (
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    label="Default Payment Instructions"
                    error={step4Form.formState.errors.default_payment_instructions?.message}
                    rows={3}
                    maxLength={500}
                    showCharacterCount
                    helperText="Instructions for customers on how to pay invoices"
                  />
                )}
              />
            </div>
          </div>
        )}
      </Wizard>
    </div>
  );
}

export default BusinessInfoWizard;
