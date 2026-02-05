'use client';

import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Package,
  DollarSign,
  Calendar,
  FileText,
} from 'lucide-react';
import { getHandlebarsVariables } from '@/lib/api/template-builder';
import type { TemplateVariableSchema } from '@/lib/types/quote-admin';
import toast from 'react-hot-toast';

interface HandlebarsVariablesPanelProps {
  onInsertVariable?: (variable: string) => void;
}

export default function HandlebarsVariablesPanel({
  onInsertVariable,
}: HandlebarsVariablesPanelProps) {
  const [schema, setSchema] = useState<TemplateVariableSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    quote: true,
    customer: true,
  });
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  useEffect(() => {
    loadVariables();
  }, []);

  const loadVariables = async () => {
    try {
      setLoading(true);
      const data = await getHandlebarsVariables();
      setSchema(data);
    } catch (error) {
      console.error('Failed to load variables:', error);
      toast.error('Failed to load Handlebars variables');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const copyVariable = async (variable: string) => {
    try {
      await navigator.clipboard.writeText(`{{${variable}}}`);
      setCopiedVariable(variable);
      setTimeout(() => setCopiedVariable(null), 2000);
      toast.success('Variable copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy variable');
    }
  };

  const insertVariable = (variable: string) => {
    if (onInsertVariable) {
      onInsertVariable(`{{${variable}}}`);
    } else {
      copyVariable(variable);
    }
  };

  // Mock schema if API doesn't return one
  const defaultSchema: TemplateVariableSchema = {
    version: '1.0',
    categories: [
      {
        id: 'quote',
        name: 'Quote Information',
        description: 'Quote details and metadata',
        icon: 'FileText',
        variables: [
          {
            name: 'quote.number',
            type: 'string',
            description: 'Quote number/ID',
            example: 'QT-2024-001',
            required: true,
          },
          {
            name: 'quote.date',
            type: 'date',
            description: 'Quote creation date',
            example: '2024-01-15',
            required: true,
          },
          {
            name: 'quote.expiry_date',
            type: 'date',
            description: 'Quote expiration date',
            example: '2024-02-15',
          },
          {
            name: 'quote.status',
            type: 'string',
            description: 'Quote status',
            example: 'pending',
          },
          {
            name: 'quote.notes',
            type: 'string',
            description: 'Internal notes',
          },
        ],
      },
      {
        id: 'customer',
        name: 'Customer Details',
        description: 'Customer/client information',
        icon: 'User',
        variables: [
          {
            name: 'customer.name',
            type: 'string',
            description: 'Customer full name',
            example: 'John Doe',
            required: true,
          },
          {
            name: 'customer.email',
            type: 'string',
            description: 'Customer email address',
            example: 'john@example.com',
          },
          {
            name: 'customer.phone',
            type: 'string',
            description: 'Customer phone number',
            example: '+1 (555) 123-4567',
          },
          {
            name: 'customer.company',
            type: 'string',
            description: 'Customer company name',
            example: 'Acme Corp',
          },
          {
            name: 'customer.address',
            type: 'string',
            description: 'Customer full address',
            example: '123 Main St, City, ST 12345',
          },
        ],
      },
      {
        id: 'company',
        name: 'Your Company',
        description: 'Your business information',
        icon: 'Building2',
        variables: [
          {
            name: 'company.name',
            type: 'string',
            description: 'Your company name',
            example: 'Your Business LLC',
            required: true,
          },
          {
            name: 'company.email',
            type: 'string',
            description: 'Company email',
            example: 'info@yourbusiness.com',
          },
          {
            name: 'company.phone',
            type: 'string',
            description: 'Company phone',
            example: '+1 (555) 987-6543',
          },
          {
            name: 'company.address',
            type: 'string',
            description: 'Company address',
            example: '456 Business Ave, City, ST 54321',
          },
          {
            name: 'company.logo_url',
            type: 'string',
            description: 'Company logo URL',
            example: 'https://example.com/logo.png',
          },
        ],
      },
      {
        id: 'line_items',
        name: 'Line Items',
        description: 'Products/services in the quote',
        icon: 'Package',
        variables: [
          {
            name: 'line_items',
            type: 'array',
            description: 'Array of line items',
            example: '[{...}]',
            children: [
              {
                name: 'line_items.[].description',
                type: 'string',
                description: 'Item description',
                example: 'Premium Service Package',
              },
              {
                name: 'line_items.[].quantity',
                type: 'number',
                description: 'Item quantity',
                example: '2',
              },
              {
                name: 'line_items.[].unit_price',
                type: 'number',
                description: 'Price per unit',
                example: '150.00',
              },
              {
                name: 'line_items.[].total',
                type: 'number',
                description: 'Line item total',
                example: '300.00',
              },
            ],
          },
        ],
      },
      {
        id: 'totals',
        name: 'Pricing Totals',
        description: 'Calculations and totals',
        icon: 'DollarSign',
        variables: [
          {
            name: 'totals.subtotal',
            type: 'number',
            description: 'Subtotal before tax/discount',
            example: '1000.00',
            required: true,
          },
          {
            name: 'totals.tax',
            type: 'number',
            description: 'Tax amount',
            example: '80.00',
          },
          {
            name: 'totals.discount',
            type: 'number',
            description: 'Discount amount',
            example: '50.00',
          },
          {
            name: 'totals.total',
            type: 'number',
            description: 'Final total',
            example: '1030.00',
            required: true,
          },
        ],
      },
      {
        id: 'helpers',
        name: 'Handlebars Helpers',
        description: 'Built-in helper functions',
        icon: 'Calendar',
        variables: [
          {
            name: 'formatDate',
            type: 'helper',
            description: 'Format date values',
            example: '{{formatDate quote.date "MMMM DD, YYYY"}}',
          },
          {
            name: 'formatCurrency',
            type: 'helper',
            description: 'Format currency values',
            example: '{{formatCurrency totals.total "USD"}}',
          },
          {
            name: 'formatNumber',
            type: 'helper',
            description: 'Format numeric values',
            example: '{{formatNumber line_items.[].quantity 2}}',
          },
          {
            name: 'if',
            type: 'helper',
            description: 'Conditional rendering',
            example: '{{#if customer.email}}...{{/if}}',
          },
          {
            name: 'each',
            type: 'helper',
            description: 'Loop through arrays',
            example: '{{#each line_items}}...{{/each}}',
          },
          {
            name: 'unless',
            type: 'helper',
            description: 'Negative conditional',
            example: '{{#unless customer.company}}...{{/unless}}',
          },
        ],
      },
    ],
  };

  // API returns flat array of variables, but component expects categorized structure
  // Use defaultSchema if API doesn't return categories
  const displaySchema = (schema && 'categories' in schema) ? schema : defaultSchema;

  // Filter variables by search
  const filteredCategories = displaySchema.categories.map((category) => ({
    ...category,
    variables: (category.variables || []).filter(
      (variable) =>
        variable.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        variable.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.variables.length > 0);

  // Get icon component
  const getIcon = (iconName: string) => {
    const iconClass = 'w-4 h-4';
    switch (iconName) {
      case 'User':
        return <User className={iconClass} />;
      case 'Building2':
        return <Building2 className={iconClass} />;
      case 'Package':
        return <Package className={iconClass} />;
      case 'DollarSign':
        return <DollarSign className={iconClass} />;
      case 'Calendar':
        return <Calendar className={iconClass} />;
      case 'FileText':
      default:
        return <FileText className={iconClass} />;
    }
  };

  if (loading) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex items-center justify-center p-8">
        <div className="text-center">
          <BookOpen className="w-8 h-8 text-gray-400 animate-pulse mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading variables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Handlebars Variables
          </h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search variables..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredCategories.length > 0 ? (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {getIcon(category.icon)}
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {category.name}
                  </span>
                </div>
                {expandedCategories[category.id] ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Variables */}
              {expandedCategories[category.id] && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {category.variables.map((variable, idx) => (
                    <div
                      key={idx}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-t first:border-t-0 border-gray-100 dark:border-gray-700"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <code className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded">
                          {variable.name}
                        </code>
                        <button
                          onClick={() => insertVariable(variable.name)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Copy variable"
                        >
                          {copiedVariable === variable.name ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {variable.description}
                      </p>
                      {variable.example && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
                          Example: {variable.example}
                        </p>
                      )}
                      {variable.required && (
                        <span className="inline-block mt-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded">
                          Required
                        </span>
                      )}
                      {variable.children && variable.children.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-2">
                          {variable.children.map((child, childIdx) => (
                            <div key={childIdx}>
                              <code className="text-xs font-mono text-purple-600 dark:text-purple-400">
                                {child.name}
                              </code>
                              <p className="text-xs text-gray-500 dark:text-gray-500">
                                {child.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <Search className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No variables found
            </p>
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-purple-50 dark:bg-purple-900/20">
        <div className="flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-purple-900 dark:text-purple-100">
              Pro Tip
            </p>
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
              Click any variable to copy it to clipboard. Use Handlebars helpers for formatting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
