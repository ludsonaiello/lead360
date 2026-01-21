/**
 * Edit Email Template Page
 * WYSIWYG editor for editing existing email templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { TemplateEditor } from '@/components/communication/TemplateEditor';
import { getTemplate, updateTemplate } from '@/lib/api/communication';
import type { EmailTemplate, UpdateTemplateDto } from '@/lib/types/communication';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateKey = params.key as string;

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        setLoading(true);
        const data = await getTemplate(templateKey);
        setTemplate(data);
      } catch (error) {
        console.error('Failed to fetch template:', error);
        toast.error('Failed to load template');
        router.push('/communications/templates');
      } finally {
        setLoading(false);
      }
    };

    fetchTemplate();
  }, [templateKey]);

  const handleSave = async (data: UpdateTemplateDto) => {
    try {
      const updatedTemplate = await updateTemplate(templateKey, data);
      toast.success('Template updated successfully');
      router.push('/communications/templates');
      return updatedTemplate;
    } catch (error: any) {
      console.error('Failed to update template:', error);
      toast.error(error?.response?.data?.message || 'Failed to update template');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/communications/templates"
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Templates
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Edit Template: {template.template_key}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Make changes to your email template
        </p>
        {template.description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {template.description}
          </p>
        )}
        {template.variables && template.variables.length > 0 && (
          <div className="mt-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Variables: </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {template.variables.map(v => `{{${v}}}`).join(', ')}
            </span>
          </div>
        )}
      </div>

      {/* Template Editor */}
      <TemplateEditor initialData={template} onSave={handleSave} />
    </div>
  );
}
