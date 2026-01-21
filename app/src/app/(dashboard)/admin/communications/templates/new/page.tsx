/**
 * Create New System Template Page (Admin)
 * Allows platform admins to create system-wide email templates
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TemplateEditor } from '@/components/communication/TemplateEditor';
import { createTemplate } from '@/lib/api/communication';
import type { CreateTemplateDto, UpdateTemplateDto } from '@/lib/types/communication';
import { toast } from 'react-hot-toast';

export default function NewSystemTemplatePage() {
  const router = useRouter();

  const handleSave = async (data: CreateTemplateDto | UpdateTemplateDto) => {
    try {
      const template = await createTemplate(data as CreateTemplateDto);
      toast.success('System template created successfully');
      router.push('/admin/communications/templates');
      return template;
    } catch (error: any) {
      console.error('Failed to create template:', error);
      toast.error(error?.response?.data?.message || 'Failed to create template');
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/communications/templates"
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create System Email Template
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Create a new system-wide email template for all tenants
        </p>
      </div>

      {/* Template Editor */}
      <TemplateEditor onSave={handleSave} />
    </div>
  );
}
