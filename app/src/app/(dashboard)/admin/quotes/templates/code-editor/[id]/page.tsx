'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CodeEditor from '@/components/code-editor/CodeEditor';
import { getBuilderTemplate } from '@/lib/api/template-builder';
import type { BuilderTemplate } from '@/lib/types/quote-admin';
import { Loader2, AlertCircle } from 'lucide-react';

/**
 * Edit Code Template Page
 * Allows platform admins to edit existing code templates
 */
export default function EditCodeTemplatePage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<BuilderTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!templateId) return;

    const loadTemplate = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getBuilderTemplate(templateId);

        // Verify it's a code template
        if (data.template_type !== 'code') {
          setError('This template is not a code template. Use the visual builder instead.');
          return;
        }

        setTemplate(data);
      } catch (err: any) {
        console.error('Failed to load template:', err);
        setError(err.response?.data?.message || 'Failed to load template');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [templateId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">
            Loading template...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 text-center border border-gray-200 dark:border-gray-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Failed to Load Template
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/admin/quotes/templates')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Templates
          </button>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Template not found</p>
        </div>
      </div>
    );
  }

  return <CodeEditor templateId={templateId} initialTemplate={template} />;
}
