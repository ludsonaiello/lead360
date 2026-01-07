/**
 * InsuranceForm Component
 * Manage General Liability and Workers' Compensation insurance
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import { AlertCircle, Shield, CheckCircle, Building2, FileText, DollarSign, Calendar, Upload } from 'lucide-react';
import { insuranceSchema, type InsuranceFormData } from '@/lib/utils/validation';
import { getInsurance, tenantApi } from '@/lib/api/tenant';
import { Insurance, InsuranceStatus } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { FileUpload } from '@/components/ui/FileUpload';

// Helper to extract date from datetime string
const extractDate = (datetime: string | null | undefined): string => {
  if (!datetime) return '';
  return datetime.split('T')[0];
};

// Helper to get file extension from filename
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
};

export function InsuranceForm() {
  const [insurance, setInsurance] = useState<Insurance | null>(null);
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [glFileUrl, setGlFileUrl] = useState<string | undefined>(undefined);
  const [glFileName, setGlFileName] = useState<string | undefined>(undefined);
  const [glFileMimeType, setGlFileMimeType] = useState<string | undefined>(undefined);
  const [wcFileUrl, setWcFileUrl] = useState<string | undefined>(undefined);
  const [wcFileName, setWcFileName] = useState<string | undefined>(undefined);
  const [wcFileMimeType, setWcFileMimeType] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    setValue,
  } = useForm<InsuranceFormData>({
    resolver: zodResolver(insuranceSchema),
  });

  useEffect(() => {
    loadInsurance();
  }, []);

  const loadInsurance = async () => {
    try {
      setIsLoading(true);
      const [insuranceData, statusData] = await Promise.all([
        tenantApi.getInsurance(),
        tenantApi.getInsuranceStatus(),
      ]);

      setInsurance(insuranceData);
      setInsuranceStatus(statusData);

      // Set file info from insurance data - GL
      const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';
      if (insuranceData.gl_document_file) {
        setGlFileUrl(`${uploadBaseUrl}/${insuranceData.tenant_id}/files/${insuranceData.gl_document_file.file_id}${getFileExtension(insuranceData.gl_document_file.original_filename)}`);
        setGlFileName(insuranceData.gl_document_file.original_filename);
        setGlFileMimeType(insuranceData.gl_document_file.mime_type);
      } else {
        setGlFileUrl(undefined);
        setGlFileName(undefined);
        setGlFileMimeType(undefined);
      }

      // Set file info from insurance data - WC
      if (insuranceData.wc_document_file) {
        setWcFileUrl(`${uploadBaseUrl}/${insuranceData.tenant_id}/files/${insuranceData.wc_document_file.file_id}${getFileExtension(insuranceData.wc_document_file.original_filename)}`);
        setWcFileName(insuranceData.wc_document_file.original_filename);
        setWcFileMimeType(insuranceData.wc_document_file.mime_type);
      } else {
        setWcFileUrl(undefined);
        setWcFileName(undefined);
        setWcFileMimeType(undefined);
      }

      reset({
        gl_insurance_provider: insuranceData.gl_insurance_provider || '',
        gl_policy_number: insuranceData.gl_policy_number || '',
        gl_coverage_amount: insuranceData.gl_coverage_amount ? parseFloat(insuranceData.gl_coverage_amount.toString()) : null,
        gl_effective_date: extractDate(insuranceData.gl_effective_date),
        gl_expiry_date: extractDate(insuranceData.gl_expiry_date),
        gl_document_file_id: insuranceData.gl_document_file_id || null,
        wc_insurance_provider: insuranceData.wc_insurance_provider || '',
        wc_policy_number: insuranceData.wc_policy_number || '',
        wc_coverage_amount: insuranceData.wc_coverage_amount ? parseFloat(insuranceData.wc_coverage_amount.toString()) : null,
        wc_effective_date: extractDate(insuranceData.wc_effective_date),
        wc_expiry_date: extractDate(insuranceData.wc_expiry_date),
        wc_document_file_id: insuranceData.wc_document_file_id || null,
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to load insurance');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: InsuranceFormData) => {
    try {
      setIsSubmitting(true);
      await tenantApi.updateInsurance(data);
      toast.success('Insurance information updated successfully');
      loadInsurance();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update insurance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getExpiryWarning = (expiryDate: string | null, type: 'GL' | 'WC') => {
    if (!expiryDate) return null;

    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date());

    if (daysUntilExpiry < 0) {
      return (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-red-800 dark:text-red-300">
            {type} insurance expired {Math.abs(daysUntilExpiry)} days ago - please renew immediately
          </p>
        </div>
      );
    } else if (daysUntilExpiry <= 30) {
      return (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
            {type} insurance expiring in {daysUntilExpiry} days
          </p>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            {type} insurance is active (expires in {daysUntilExpiry} days)
          </p>
        </div>
      );
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Insurance Information</h2>
      </div>

      {/* Expiry Warnings */}
      {insurance && (
        <div className="space-y-3">
          {getExpiryWarning(insurance.gl_expiry_date, 'GL')}
          {getExpiryWarning(insurance.wc_expiry_date, 'WC')}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* General Liability Insurance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              General Liability Insurance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              {...register('gl_insurance_provider')}
              label="Insurance Provider"
              error={errors.gl_insurance_provider?.message}
              placeholder="e.g., State Farm"
              leftIcon={<Building2 className="w-5 h-5" />}
            />

            <Input
              {...register('gl_policy_number')}
              label="Policy Number"
              error={errors.gl_policy_number?.message}
              placeholder="Policy number"
              leftIcon={<FileText className="w-5 h-5" />}
            />

            <Controller
              name="gl_coverage_amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  {...field}
                  label="Coverage Amount"
                  error={errors.gl_coverage_amount?.message}
                  placeholder="0.00"
                  leftIcon={<DollarSign className="w-5 h-5" />}
                  max={99999999.99}
                  helperText={
                    insurance?.gl_coverage_amount
                      ? `Current: ${formatCurrency(insurance.gl_coverage_amount)}`
                      : 'Maximum: $99,999,999.99'
                  }
                />
              )}
            />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller
                name="gl_effective_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value || ''}
                    label="Effective Date"
                    error={errors.gl_effective_date?.message}
                  />
                )}
              />

              <Controller
                name="gl_expiry_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value || ''}
                    label="Expiry Date"
                    error={errors.gl_expiry_date?.message}
                  />
                )}
              />
            </div>

            <div className="md:col-span-2">
              <FileUpload
                label="GL Insurance Document"
                accept=".pdf,.png,.jpg,.jpeg"
                maxSize={10}
                onUpload={async (file) => {
                  const response = await tenantApi.uploadGLInsuranceDocument(file);

                  // Extract file_id from URL: /uploads/public/{tenant_id}/files/{file_id}.ext
                  const urlParts = response.url.split('/');
                  const fileWithExt = urlParts[urlParts.length - 1]; // e.g., "abc123.pdf"
                  const fileId = fileWithExt.split('.')[0]; // e.g., "abc123"

                  // Update form field with the uploaded file ID
                  setValue('gl_document_file_id', fileId);

                  // Build full URL using environment variable
                  const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';

                  // If response URL is absolute, use it; otherwise construct from base URL + relative path
                  let normalizedUrl: string;
                  if (response.url.startsWith('http')) {
                    normalizedUrl = response.url;
                  } else {
                    // API returns /public/{tenant_id}/files/{file_id}.ext (missing /uploads)
                    // Remove /public/ prefix and construct full URL
                    const relativePath = response.url.replace(/^\/public\//, '');
                    normalizedUrl = `${uploadBaseUrl}/${relativePath}`;
                  }

                  setGlFileUrl(normalizedUrl);
                  setGlFileName(file.name);
                  setGlFileMimeType(file.type);
                  toast.success('GL insurance document uploaded successfully');
                }}
                onDelete={async () => {
                  await tenantApi.deleteGLInsuranceDocument();
                  // Clear form field
                  setValue('gl_document_file_id', null);
                  // Clear local state
                  setGlFileUrl(undefined);
                  setGlFileName(undefined);
                  setGlFileMimeType(undefined);
                  toast.success('GL insurance document deleted successfully');
                }}
                currentFileUrl={glFileUrl}
                currentFileName={glFileName}
                currentFileMimeType={glFileMimeType}
                helperText="Upload PDF, PNG, or JPG (max 10MB)"
              />
            </div>
          </div>
        </div>

        {/* Workers' Compensation Insurance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Workers' Compensation Insurance
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              {...register('wc_insurance_provider')}
              label="Insurance Provider"
              error={errors.wc_insurance_provider?.message}
              placeholder="e.g., Liberty Mutual"
              leftIcon={<Building2 className="w-5 h-5" />}
            />

            <Input
              {...register('wc_policy_number')}
              label="Policy Number"
              error={errors.wc_policy_number?.message}
              placeholder="Policy number"
              leftIcon={<FileText className="w-5 h-5" />}
            />

            <Controller
              name="wc_coverage_amount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  {...field}
                  label="Coverage Amount"
                  error={errors.wc_coverage_amount?.message}
                  placeholder="0.00"
                  leftIcon={<DollarSign className="w-5 h-5" />}
                  max={99999999.99}
                  helperText={
                    insurance?.wc_coverage_amount
                      ? `Current: ${formatCurrency(insurance.wc_coverage_amount)}`
                      : 'Maximum: $99,999,999.99'
                  }
                />
              )}
            />

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              <Controller
                name="wc_effective_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value || ''}
                    label="Effective Date"
                    error={errors.wc_effective_date?.message}
                  />
                )}
              />

              <Controller
                name="wc_expiry_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    {...field}
                    value={field.value || ''}
                    label="Expiry Date"
                    error={errors.wc_expiry_date?.message}
                  />
                )}
              />
            </div>

            <div className="md:col-span-2">
              <FileUpload
                label="WC Insurance Document"
                accept=".pdf,.png,.jpg,.jpeg"
                maxSize={10}
                onUpload={async (file) => {
                  const response = await tenantApi.uploadWCInsuranceDocument(file);

                  // Extract file_id from URL: /uploads/public/{tenant_id}/files/{file_id}.ext
                  const urlParts = response.url.split('/');
                  const fileWithExt = urlParts[urlParts.length - 1]; // e.g., "abc123.pdf"
                  const fileId = fileWithExt.split('.')[0]; // e.g., "abc123"

                  // Update form field with the uploaded file ID
                  setValue('wc_document_file_id', fileId);

                  // Build full URL using environment variable
                  const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';

                  // If response URL is absolute, use it; otherwise construct from base URL + relative path
                  let normalizedUrl: string;
                  if (response.url.startsWith('http')) {
                    normalizedUrl = response.url;
                  } else {
                    // API returns /public/{tenant_id}/files/{file_id}.ext (missing /uploads)
                    // Remove /public/ prefix and construct full URL
                    const relativePath = response.url.replace(/^\/public\//, '');
                    normalizedUrl = `${uploadBaseUrl}/${relativePath}`;
                  }

                  setWcFileUrl(normalizedUrl);
                  setWcFileName(file.name);
                  setWcFileMimeType(file.type);
                  toast.success('WC insurance document uploaded successfully');
                }}
                onDelete={async () => {
                  await tenantApi.deleteWCInsuranceDocument();
                  // Clear form field
                  setValue('wc_document_file_id', null);
                  // Clear local state
                  setWcFileUrl(undefined);
                  setWcFileName(undefined);
                  setWcFileMimeType(undefined);
                  toast.success('WC insurance document deleted successfully');
                }}
                currentFileUrl={wcFileUrl}
                currentFileName={wcFileName}
                currentFileMimeType={wcFileMimeType}
                helperText="Upload PDF, PNG, or JPG (max 10MB)"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Insurance Information'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default InsuranceForm;
