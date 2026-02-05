/**
 * Create New Quote Template Page
 * Create a new quote template from scratch
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { toast } from 'react-hot-toast';
import { createTemplate } from '@/lib/api/quote-admin-templates';

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  // Default template structure
  const [content, setContent] = useState(JSON.stringify({
    layout: 'standard',
    sections: [
      {
        type: 'header',
        title: 'Quote',
        fields: ['quote_number', 'date', 'valid_until']
      },
      {
        type: 'client_info',
        title: 'Client Information',
        fields: ['client_name', 'client_email', 'client_phone', 'client_address']
      },
      {
        type: 'items',
        title: 'Quote Items',
        columns: ['description', 'quantity', 'unit_price', 'subtotal']
      },
      {
        type: 'summary',
        title: 'Quote Summary',
        fields: ['subtotal', 'tax', 'discount', 'total']
      },
      {
        type: 'footer',
        title: 'Terms & Conditions',
        fields: ['notes', 'terms']
      }
    ],
    styling: {
      primaryColor: '#3B82F6',
      secondaryColor: '#64748B',
      fontSize: '12pt',
      fontFamily: 'Arial'
    }
  }, null, 2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      toast.error('Invalid JSON in template content');
      return;
    }

    try {
      setLoading(true);
      await createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        content: parsedContent,
        status,
      });
      toast.success('Template created successfully');
      router.push('/admin/quotes/templates');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Template</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Create a new quote template
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Basic Information
            </h2>

            <Input
              label="Template Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Standard Quote Template"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe this template..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Template Content */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Template Structure (JSON)
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Define the template structure using JSON. The default structure includes standard sections for quotes.
            </p>

            <div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={20}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Template JSON content..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              <Save className="w-4 h-4" />
              Create Template
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
