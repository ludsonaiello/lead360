/**
 * BrandingForm Component
 * Manage visual branding (logo and brand colors) with live preview
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Palette, Upload as UploadIcon } from 'lucide-react';
import { brandingSchema, type BrandingFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { TenantProfile } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { ColorPicker } from '@/components/ui/ColorPicker';
import { FileUpload, FileUploadRef } from '@/components/ui/FileUpload';

interface BrandingFormProps {
  tenant: TenantProfile | null;
  onUpdate: () => void;
}

// Helper to get file extension from filename
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
};

export function BrandingForm({ tenant, onUpdate }: BrandingFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';
  const [logoUrl, setLogoUrl] = useState<string | undefined>(
    tenant?.logo_file
      ? `${uploadBaseUrl}/${tenant.id}/images/${tenant.logo_file.file_id}${getFileExtension(tenant.logo_file.original_filename)}`
      : undefined
  );
  const [logoFileName, setLogoFileName] = useState<string | undefined>(tenant?.logo_file?.original_filename || undefined);
  const [logoMimeType, setLogoMimeType] = useState<string | undefined>(tenant?.logo_file?.mime_type || undefined);
  const fileUploadRef = React.useRef<FileUploadRef>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primary_brand_color: tenant?.primary_brand_color || '#007BFF',
      secondary_brand_color: tenant?.secondary_brand_color || '#6C757D',
      accent_color: tenant?.accent_color || '#28A745',
      logo_file_id: tenant?.logo_file_id || undefined,
    },
  });

  console.log(tenant);

  const primaryColor = watch('primary_brand_color') || '#007BFF';
  const secondaryColor = watch('secondary_brand_color') || '#6C757D';
  const accentColor = watch('accent_color') || '#28A745';

  const handleLogoUpload = async (file: File) => {
    try {
      const response = await tenantApi.uploadTenantLogo(file);

      // Extract file_id from URL: /uploads/public/{tenant_id}/files/{file_id}.ext
      const urlParts = response.url.split('/');
      const fileWithExt = urlParts[urlParts.length - 1]; // e.g., "abc123.png"
      const fileId = fileWithExt.split('.')[0]; // e.g., "abc123"

      // Update form field with the uploaded file ID
      setValue('logo_file_id', fileId);

      // Build full URL using environment variable
      const uploadBaseUrl = process.env.NEXT_PUBLIC_UPLOAD_DIR || 'https://app.lead360.app/uploads/public';

      // If response URL is absolute, use it; otherwise construct from base URL + relative path
      let normalizedUrl: string;
      if (response.url.startsWith('http')) {
        normalizedUrl = response.url;
      } else {
        // API returns /public/{tenant_id}/images/{file_id}.ext (missing /uploads)
        // Remove /public/ prefix and construct full URL
        const relativePath = response.url.replace(/^\/public\//, '');
        normalizedUrl = `${uploadBaseUrl}/${relativePath}`;
      }

      setLogoUrl(normalizedUrl);
      setLogoFileName(file.name);
      setLogoMimeType(file.type);
      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || 'Failed to upload logo');
    }
  };

  const handleLogoDelete = async () => {
    try {
      // Delete logo from server
      await tenantApi.deleteTenantLogo();
      // Clear form field
      setValue('logo_file_id', undefined);
      // Clear local state
      setLogoUrl(undefined);
      setLogoFileName(undefined);
      setLogoMimeType(undefined);
      toast.success('Logo deleted successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete logo');
      throw error;
    }
  };

  const onSubmit = async (data: BrandingFormData) => {
    try {
      setIsSubmitting(true);
      // Remove logo_file_id from submission since upload endpoint already saves it
      const { logo_file_id, ...brandingData } = data;
      await tenantApi.updateTenantBranding(brandingData);
      toast.success('Branding updated successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update branding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Branding</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Logo Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <UploadIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Company Logo</h3>
          </div>

          <FileUpload
            ref={fileUploadRef}
            label="Upload Logo"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
            maxSize={5}
            onUpload={handleLogoUpload}
            onDelete={handleLogoDelete}
            preview
            helperText="Recommended size: 500x200px. Max 5MB. PNG, JPG, or SVG."
            currentFileUrl={logoUrl}
            currentFileName={logoFileName}
            currentFileMimeType={logoMimeType}
          />
        </div>

        {/* Brand Colors Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Brand Colors</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ColorPicker
              label="Primary Brand Color"
              value={primaryColor}
              onChange={(color) => setValue('primary_brand_color', color)}
              error={errors.primary_brand_color?.message}
              helperText="Main brand color (headers, buttons)"
            />

            <ColorPicker
              label="Secondary Brand Color"
              value={secondaryColor}
              onChange={(color) => setValue('secondary_brand_color', color)}
              error={errors.secondary_brand_color?.message}
              helperText="Secondary elements (backgrounds)"
            />

            <ColorPicker
              label="Accent Color"
              value={accentColor}
              onChange={(color) => setValue('accent_color', color)}
              error={errors.accent_color?.message}
              helperText="Highlights and call-to-actions"
            />
          </div>
        </div>

        {/* Live Preview Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">Live Preview</h3>

          {/* Mock Invoice Preview */}
          <div className="border-2 border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {/* Invoice Header */}
            <div
              className="p-6 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <div className="flex items-center justify-between">
                <div>
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="h-12 object-contain bg-white rounded px-2 py-1"
                    />
                  ) : (
                    <div className="h-12 w-32 bg-white/20 rounded flex items-center justify-center text-xs">
                      Logo Preview
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold">INVOICE</h2>
                  <p className="text-sm opacity-90">#{tenant?.invoice_prefix || 'INV'}-001</p>
                </div>
              </div>
            </div>

            {/* Invoice Body */}
            <div className="p-6 bg-white dark:bg-gray-900">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Bill To:
                  </h3>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">Sample Customer</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">123 Main St</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">City, ST 12345</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Invoice Details:
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Date: {new Date().toLocaleDateString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Due Date: 30 days</p>
                </div>
              </div>

              {/* Sample Line Items */}
              <div className="border-t border-b border-gray-200 dark:border-gray-700 py-4 mb-6">
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="text-sm font-semibold text-gray-600 dark:text-gray-400 pb-2">
                        Description
                      </th>
                      <th className="text-sm font-semibold text-gray-600 dark:text-gray-400 pb-2 text-right">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-sm text-gray-900 dark:text-gray-100 py-2">
                        Sample Service
                      </td>
                      <td className="text-sm text-gray-900 dark:text-gray-100 py-2 text-right">
                        $1,000.00
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total */}
              <div className="flex justify-end mb-6">
                <div className="w-64">
                  <div className="flex justify-between py-2">
                    <span className="font-semibold text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">$1,000.00</span>
                  </div>
                  <div
                    className="flex justify-between py-3 text-lg font-bold rounded px-3"
                    style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                  >
                    <span>Total:</span>
                    <span>$1,000.00</span>
                  </div>
                </div>
              </div>

              {/* Call to Action Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  className="px-6 py-3 rounded-lg font-semibold text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  Pay Now
                </button>
              </div>
            </div>

            {/* Footer */}
            <div
              className="p-4 text-center text-sm"
              style={{ backgroundColor: secondaryColor, color: 'white' }}
            >
              <p className="opacity-90">Thank you for your business!</p>
              <p className="text-xs opacity-75 mt-1">{tenant?.company_name || 'Your Company'}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            This is a preview of how your branding will appear on invoices and quotes
          </p>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Branding'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default BrandingForm;
