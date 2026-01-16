/**
 * Email Template List Component
 * Display and manage email templates
 */

'use client';

import React, { useState } from 'react';
import { EmailTemplate } from '@/lib/types/jobs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Edit, Trash2, Eye, Search } from 'lucide-react';

interface EmailTemplateListProps {
  templates: EmailTemplate[];
  onEdit: (template: EmailTemplate) => void;
  onDelete: (key: string) => void;
  onPreview: (template: EmailTemplate) => void;
  isLoading?: boolean;
  className?: string;
}

export function EmailTemplateList({
  templates,
  onEdit,
  onDelete,
  onPreview,
  isLoading = false,
  className = '',
}: EmailTemplateListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = templates.filter(
    (t) =>
      t.template_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = (template: EmailTemplate) => {
    if (template.is_system) {
      alert('System templates cannot be deleted');
      return;
    }

    if (confirm(`Are you sure you want to delete template "${template.template_key}"?`)) {
      onDelete(template.template_key);
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search templates..."
          className="pl-10"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Template Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Variables
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTemplates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No templates found
                </td>
              </tr>
            ) : (
              filteredTemplates.map((template) => (
                <tr
                  key={template.id}
                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {template.template_key}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {template.subject}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {template.variables.length} variables
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {template.is_system ? (
                      <Badge variant="info">System</Badge>
                    ) : (
                      <Badge variant="neutral">Custom</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreview(template)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(template)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template)}
                        disabled={template.is_system}
                        className="text-red-600 dark:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filteredTemplates.length === 0 ? (
          <p className="text-center py-8 text-gray-500 dark:text-gray-400">No templates found</p>
        ) : (
          filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {template.template_key}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {template.subject}
                  </p>
                </div>
                {template.is_system ? (
                  <Badge variant="info">System</Badge>
                ) : (
                  <Badge variant="neutral">Custom</Badge>
                )}
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {template.variables.length} variables
              </p>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => onPreview(template)} className="flex-1">
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onEdit(template)}
                  className="flex-1"
                >
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>
                {!template.is_system && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDelete(template)}
                    className="text-red-600 dark:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmailTemplateList;
