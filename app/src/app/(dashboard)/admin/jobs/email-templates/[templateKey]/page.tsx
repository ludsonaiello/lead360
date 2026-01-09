/**
 * Edit Email Template Page
 * Dedicated page for editing email templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { VariableSelector } from '@/components/jobs/VariableSelector';
import { EmailTemplate, UpdateEmailTemplateDto } from '@/lib/types/jobs';
import { getEmailTemplate, updateEmailTemplate } from '@/lib/api/jobs';
import { ArrowLeft, Info, X, Search, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function EditEmailTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateKey = params.templateKey as string;

  // State
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showVariableSelector, setShowVariableSelector] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState<UpdateEmailTemplateDto>({
    subject: '',
    html_body: '',
    text_body: '',
    variables: [],
    description: '',
  });

  useEffect(() => {
    fetchTemplate();
  }, [templateKey]);

  const fetchTemplate = async () => {
    try {
      setIsLoading(true);
      const data = await getEmailTemplate(templateKey);
      setTemplate(data);
      setFormData({
        subject: data.subject,
        html_body: data.html_body,
        text_body: data.text_body || '',
        variables: data.variables,
        description: data.description || '',
      });
    } catch (err: any) {
      console.error('Error fetching template:', err);
      toast.error(err.message || 'Failed to load template');
      router.push('/admin/jobs?tab=email-templates');
    } finally {
      setIsLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.subject || formData.subject.length < 3) {
      newErrors.subject = 'Subject is required (min 3 characters)';
    }

    if (!formData.html_body || formData.html_body.length < 10) {
      newErrors.html_body = 'HTML body is required (min 10 characters)';
    }

    if (formData.variables && formData.variables.length === 0) {
      newErrors.variables = 'At least one variable is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setIsSaving(true);
      await updateEmailTemplate(templateKey, formData);
      toast.success('Email template updated successfully');
      router.push('/admin/jobs?tab=email-templates');
    } catch (err: any) {
      console.error('Error updating template:', err);
      toast.error(err.message || 'Failed to update email template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveVariable = (variable: string) => {
    if (formData.variables) {
      setFormData({
        ...formData,
        variables: formData.variables.filter((v) => v !== variable),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!template) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin/jobs?tab=email-templates">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Templates
          </Button>
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Edit Email Template
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Template Key: <code className="font-mono">{template.template_key}</code>
        </p>
      </div>

      {/* System Template Warning */}
      {template.is_system && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-300">
              <p className="font-semibold mb-1">System Template</p>
              <p>
                This is a system template. You can edit the content, but the template key cannot be changed or deleted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
        {/* Template Key (read-only) */}
        <Input
          label="Template Key"
          value={template.template_key}
          disabled
          helperText="Template key cannot be changed"
        />

        {/* Subject */}
        <Input
          label="Subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Welcome to {{company_name}}!"
          error={errors.subject}
          required
        />

        {/* HTML Body */}
        <Textarea
          label="HTML Body"
          value={formData.html_body}
          onChange={(e) => setFormData({ ...formData, html_body: e.target.value })}
          placeholder="<h1>Hello {{user_name}}</h1><p>Welcome to our platform!</p>"
          rows={12}
          error={errors.html_body}
          required
        />

        {/* Text Body */}
        <Textarea
          label="Text Body (optional)"
          value={formData.text_body}
          onChange={(e) => setFormData({ ...formData, text_body: e.target.value })}
          placeholder="Hello {{user_name}}, welcome to our platform!"
          rows={6}
        />

        {/* Variables */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Variables <span className="text-red-500">*</span>
          </label>

          {/* Browse Variables Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowVariableSelector(true)}
            className="mb-3 w-full sm:w-auto"
          >
            <Search className="w-4 h-4 mr-2" />
            Browse Available Variables
          </Button>

          {/* Error */}
          {errors.variables && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errors.variables}</p>
          )}

          {/* Selected Variables Display */}
          {formData.variables && formData.variables.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {formData.variables.map((variable) => (
                <span
                  key={variable}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium"
                >
                  <code>{`{{${variable}}}`}</code>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariable(variable)}
                    className="hover:text-blue-900 dark:hover:text-blue-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              No variables selected. Click "Browse Available Variables" to discover and add variables.
            </p>
          )}

          {/* Help Text */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Variables are placeholders replaced with actual data when emails are sent. Use {`{{variable_name}}`} syntax in subject and body.
          </p>
        </div>

        {/* Description */}
        <Textarea
          label="Description (optional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brief description of this template"
          rows={3}
        />

        {/* Handlebars Guide */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-semibold">Handlebars Syntax Guide:</p>
              <ul className="list-disc list-inside ml-2">
                <li>
                  Variables: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`{{variable_name}}`}</code>
                </li>
                <li>Use the variables you selected above in your subject and body</li>
                <li>Example: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`Hello {{user_name}}!`}</code></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="secondary"
            onClick={() => router.push('/admin/jobs?tab=email-templates')}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Update Template'}
          </Button>
        </div>
      </div>

      {/* Variable Selector Modal */}
      <VariableSelector
        isOpen={showVariableSelector}
        onClose={() => setShowVariableSelector(false)}
        selectedVariables={formData.variables || []}
        onVariablesChange={(variables) => {
          setFormData({ ...formData, variables });
        }}
      />
    </div>
  );
}
