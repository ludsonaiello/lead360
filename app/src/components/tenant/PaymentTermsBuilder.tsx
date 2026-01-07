/**
 * PaymentTermsBuilder Component
 * Dynamic payment terms builder with templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Plus, Trash2, AlertCircle, CheckCircle, DollarSign, Percent } from 'lucide-react';
import { paymentTermsSchema, type PaymentTermsFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { PaymentTerms, PaymentTermTemplates } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function PaymentTermsBuilder() {
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms | null>(null);
  const [templates, setTemplates] = useState<PaymentTermTemplates | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    control,
    watch,
    setValue,
  } = useForm<PaymentTermsFormData>({
    resolver: zodResolver(paymentTermsSchema),
    defaultValues: {
      terms: [
        { sequence: 1, type: 'percentage', amount: 100, description: 'Upfront payment' },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'terms',
  });

  useEffect(() => {
    loadPaymentTerms();
    loadTemplates();
  }, []);

  const loadPaymentTerms = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getPaymentTerms();
      setPaymentTerms(data);
      console.log("Data: ", data.terms_json);

      // API returns terms_json, not terms
      console.log('typeof data.terms_json:', typeof data.terms_json);
      console.log('isArray:', Array.isArray(data.terms_json));

      if (data.terms_json && data.terms_json.length > 0) {
        // Parse if it's a JSON string, otherwise use as-is
        const termsArray = typeof data.terms_json === 'string'
          ? JSON.parse(data.terms_json)
          : data.terms_json;

        console.log('Replacing fields with:', termsArray);
        replace(termsArray);
      } else {
        console.log('No terms found in response, data.terms_json:', data.terms_json);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load payment terms');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await tenantApi.getPaymentTermTemplates();
      setTemplates(data);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
    }
  };

  const onSubmit = async (data: PaymentTermsFormData) => {
    try {
      setIsSubmitting(true);
      console.log('Submitting payment terms:', data);

      // Calculate total percentage for percentage-based terms
      const percentageTerms = data.terms.filter(term => term.type === 'percentage');
      const totalPercentage = percentageTerms.reduce((sum, term) => sum + (term.amount || 0), 0);

      // Block if total percentage exceeds 100%
      if (totalPercentage > 100) {
        toast.error(`Total percentage cannot exceed 100%. Current total: ${totalPercentage}%`);
        setIsSubmitting(false);
        return;
      }

      const response = await tenantApi.updatePaymentTerms(data);
      console.log('Update response:', response);

      if (response.validation?.percentage_warning) {
        toast.success(`Payment terms updated. ${response.validation.percentage_warning}`, {
          duration: 5000,
        });
      } else {
        toast.success('Payment terms updated successfully');
      }

      loadPaymentTerms();
    } catch (error: any) {
      console.error('Failed to update payment terms:', error);
      toast.error(error?.response?.data?.message || 'Failed to update payment terms');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTerm = () => {
    const nextSequence = fields.length + 1;
    append({
      sequence: nextSequence,
      type: 'percentage',
      amount: 0,
      description: '',
    });
  };

  const handleRemoveTerm = (index: number) => {
    remove(index);
    // Renumber sequences
    const currentTerms = watch('terms');
    currentTerms.forEach((term, idx) => {
      setValue(`terms.${idx}.sequence`, idx + 1);
    });
  };

  const handleApplyTemplate = (templateKey: string) => {
    if (!templates || !templates[templateKey]) return;

    const templateTerms = templates[templateKey];
    replace(templateTerms);
    toast.success('Template applied');
  };

  // Calculate percentage sum on each render
  const calculatePercentageSum = () => {
    const terms = watch('terms');
    // During form reset, watch might return non-array temporarily
    if (!Array.isArray(terms)) return 0;

    return terms
      .filter((term) => term.type === 'percentage')
      .reduce((sum, term) => sum + (term.amount || 0), 0);
  };

  const percentageSum = calculatePercentageSum();
  const hasPercentageWarning = percentageSum !== 100;
  const hasPercentageError = percentageSum > 100;

    const typeOptions: SelectOption[] = [
    { value: 'percentage', label: 'Percentage' },
    { value: 'fixed', label: 'Fixed Amount' },
  ];

  const templateOptions: SelectOption[] = templates
    ? Object.keys(templates).map((key) => {
        const labels: Record<string, string> = {
          '100_upfront': '100% Upfront',
          '50_50': '50% / 50%',
          '50_25_25': '50% / 25% / 25%',
          '33_33_34': '33% / 33% / 34%',
          '25_25_25_25': '25% / 25% / 25% / 25%',
        };
        return { value: key, label: labels[key] || key };
      })
    : [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Payment Terms</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Configure default payment terms that will be applied to all quotes unless customized on individual quotes.
        </p>
      </div>

      {/* Templates */}
      {templates && Object.keys(templates).length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
            Quick Templates
          </p>
          <div className="flex flex-wrap gap-2">
            {templateOptions.map((template) => (
              <button
                key={template.value}
                type="button"
                onClick={() => handleApplyTemplate(template.value)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                {template.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Payment Terms List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
              >
                {/* Sequence */}
                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold flex-shrink-0">
                  {index + 1}
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Type */}
                  <Select
                    options={typeOptions}
                    value={watch(`terms.${index}.type`)}
                    onChange={(value) => setValue(`terms.${index}.type`, value as any)}
                    placeholder="Type"
                  />

                  {/* Amount */}
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 pointer-events-none">
                      {watch(`terms.${index}.type`) === 'percentage' ? (
                        <Percent className="w-4 h-4" />
                      ) : (
                        <DollarSign className="w-4 h-4" />
                      )}
                    </div>
                    <Input
                      {...register(`terms.${index}.amount`, { valueAsNumber: true })}
                      type="number"
                      placeholder={watch(`terms.${index}.type`) === 'percentage' ? '0-100' : '0'}
                      min={0}
                      max={watch(`terms.${index}.type`) === 'percentage' ? 100 : undefined}
                      step={watch(`terms.${index}.type`) === 'percentage' ? 1 : 0.01}
                      className="pl-9"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <Input
                      {...register(`terms.${index}.description`)}
                      placeholder="e.g., Upfront deposit, Upon completion"
                      error={errors.terms?.[index]?.description?.message}
                    />
                  </div>
                </div>

                {/* Remove button */}
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTerm(index)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0"
                    title="Remove term"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}

            {/* Add Term Button */}
            <Button type="button" variant="secondary" onClick={handleAddTerm} fullWidth>
              <Plus className="w-5 h-5" />
              Add Payment Term
            </Button>
          </div>

          {/* Percentage Sum Indicator */}
          {percentageSum > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div
                className={`flex items-center gap-2 p-4 rounded-lg ${
                  hasPercentageError
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : hasPercentageWarning
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}
              >
                {hasPercentageError ? (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                ) : hasPercentageWarning ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-semibold ${
                      hasPercentageError
                        ? 'text-red-800 dark:text-red-300'
                        : hasPercentageWarning
                        ? 'text-yellow-800 dark:text-yellow-300'
                        : 'text-green-800 dark:text-green-300'
                    }`}
                  >
                    Total Percentage: {percentageSum}%
                  </p>
                  {hasPercentageError ? (
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                      Error: Total percentage cannot exceed 100%. Please adjust your payment terms.
                    </p>
                  ) : hasPercentageWarning ? (
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                      Warning: Percentage terms should sum to 100%. Current sum is {percentageSum}%.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {errors.terms && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm font-medium text-red-800 dark:text-red-300">
                {errors.terms.message || 'Please fix validation errors'}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting || hasPercentageError}
          >
            {isSubmitting ? 'Saving...' : 'Save Payment Terms'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default PaymentTermsBuilder;
