'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Code,
  Loader2,
  Search,
  Copy,
  Check,
  Database,
  User,
  Building,
  MapPin,
  DollarSign,
  FileText,
  Package,
  Paperclip,
  Calendar,
} from 'lucide-react';
import { getTemplateVariablesSchema } from '@/lib/api/template-builder';
import type { TemplateVariableSchema } from '@/lib/types/quote-admin';
import toast from 'react-hot-toast';

interface VariablesPanelProps {
  onInsertVariable?: (variablePath: string) => void;
}

interface VariableItem {
  path: string;
  label: string;
  type: string;
  category: string;
  isArray?: boolean;
  children?: VariableItem[];
}

// Category metadata for organization and icons
const categoryMetadata = {
  quote: {
    label: 'Quote',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
  },
  customer: {
    label: 'Customer',
    icon: User,
    color: 'text-green-600',
    bg: 'bg-green-50 dark:bg-green-900/20',
  },
  vendor: {
    label: 'Vendor',
    icon: Building,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
  },
  jobsite: {
    label: 'Jobsite',
    icon: MapPin,
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
  },
  totals: {
    label: 'Totals & Pricing',
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  terms: {
    label: 'Terms & Conditions',
    icon: FileText,
    color: 'text-gray-600',
    bg: 'bg-gray-50 dark:bg-gray-900/20',
  },
  items: {
    label: 'Line Items (Array)',
    icon: Package,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
  },
  groups: {
    label: 'Item Groups (Array)',
    icon: Database,
    color: 'text-pink-600',
    bg: 'bg-pink-50 dark:bg-pink-900/20',
  },
  attachments: {
    label: 'Attachments (Array)',
    icon: Paperclip,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
  },
  draw_schedule: {
    label: 'Draw Schedule (Array)',
    icon: Calendar,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
  },
};

export default function VariablesPanel({ onInsertVariable }: VariablesPanelProps) {
  const [schema, setSchema] = useState<TemplateVariableSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    quote: true,
    customer: true,
    vendor: false,
    jobsite: false,
    totals: true,
    terms: false,
    items: false,
    groups: false,
    attachments: false,
    draw_schedule: false,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);

  useEffect(() => {
    loadVariables();
  }, []);

  const loadVariables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTemplateVariablesSchema();
      setSchema(data);
    } catch (err: any) {
      console.error('Failed to load variables schema:', err);
      setError(err.response?.data?.message || 'Failed to load variables');
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleCopyVariable = (variablePath: string) => {
    navigator.clipboard.writeText(`{{${variablePath}}}`);
    setCopiedVariable(variablePath);
    toast.success('Variable copied to clipboard');
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const handleInsertVariable = (variablePath: string) => {
    if (onInsertVariable) {
      onInsertVariable(variablePath);
      toast.success('Variable inserted');
    } else {
      handleCopyVariable(variablePath);
    }
  };

  // Parse schema into organized variable structure
  const parseVariables = (): Record<string, VariableItem[]> => {
    if (!schema) return {};

    const organized: Record<string, VariableItem[]> = {};

    // API returns variables directly at root level, not wrapped in "variables" key
    Object.entries(schema).forEach(([category, fields]: [string, any]) => {
      // Skip helpers and metadata fields
      if (category === 'helpers' || category.startsWith('_')) return;
      const items: VariableItem[] = [];

      // Check if this is an array type (has _description and _example)
      if (fields._description && fields._example) {
        // Array type (items, groups, attachments, draw_schedule)
        const exampleData = Array.isArray(fields._example) ? fields._example[0] : fields._example;
        items.push({
          path: category,
          label: category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          type: 'array',
          category,
          isArray: true,
          children: exampleData && typeof exampleData === 'object'
            ? parseRichObjectFields(category, exampleData)
            : [],
        });
      } else if (typeof fields === 'object') {
        // Object type with rich schema (quote, customer, vendor, jobsite, totals, terms)
        items.push(...parseRichObjectFields(category, fields));
      }

      organized[category] = items;
    });

    return organized;
  };

  const parseRichObjectFields = (prefix: string, obj: any): VariableItem[] => {
    const items: VariableItem[] = [];

    Object.entries(obj).forEach(([key, value]: [string, any]) => {
      // Skip internal fields
      if (key.startsWith('_')) return;

      const path = prefix ? `${prefix}.${key}` : key;
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

      // Check if this is a rich schema field with type/description/example
      if (value && typeof value === 'object' && value.type) {
        items.push({
          path,
          label,
          type: value.type || 'string',
          category: prefix,
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested object - recurse
        const children = parseRichObjectFields(path, value);
        if (children.length > 0) {
          items.push({
            path,
            label,
            type: 'object',
            category: prefix,
            children,
          });
        }
      } else {
        // Simple field (fallback for any format)
        items.push({
          path,
          label,
          type: typeof value === 'string' ? value : 'string',
          category: prefix,
        });
      }
    });

    return items;
  };

  const filterVariables = (items: VariableItem[]): VariableItem[] => {
    if (!searchQuery) return items;

    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const matchesPath = item.path.toLowerCase().includes(query);
      const matchesLabel = item.label.toLowerCase().includes(query);
      return matchesPath || matchesLabel;
    });
  };

  const renderVariableItem = (item: VariableItem, depth: number = 0) => {
    const indent = depth * 16;
    const isCopied = copiedVariable === item.path;

    if (item.isArray) {
      return (
        <div key={item.path} style={{ paddingLeft: `${indent}px` }}>
          <div className="group flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors">
            <Database className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {item.label}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                {'{{#each '}{item.path}{'}}...{{/each}}'}
              </div>
            </div>
            <button
              onClick={() => handleCopyVariable(`#each ${item.path}`)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all"
              title="Copy loop syntax"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          </div>
          {item.children && item.children.length > 0 && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => renderVariableItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    if (item.children && item.children.length > 0) {
      return (
        <div key={item.path} style={{ paddingLeft: `${indent}px` }}>
          <div className="group flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            {item.label}
          </div>
          <div className="space-y-1">
            {item.children.map((child) => renderVariableItem(child, depth + 1))}
          </div>
        </div>
      );
    }

    return (
      <div
        key={item.path}
        style={{ paddingLeft: `${indent}px` }}
        className="group flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
        onClick={() => handleInsertVariable(item.path)}
      >
        <Code className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.label}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
            {'{{'}
            {item.path}
            {'}}'}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCopyVariable(item.path);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-all"
          title="Copy variable"
        >
          {isCopied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading variables...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
          <Code className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          Failed to Load Variables
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          onClick={loadVariables}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const organizedVariables = parseVariables();

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Variables
        </h2>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search variables..."
            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Click to insert • Drag to canvas
        </div>
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {Object.entries(organizedVariables).map(([category, items]) => {
          const metadata = categoryMetadata[category as keyof typeof categoryMetadata];
          if (!metadata) return null;

          const Icon = metadata.icon;
          const filteredItems = filterVariables(items);

          if (filteredItems.length === 0 && searchQuery) return null;

          return (
            <div
              key={category}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <button
                onClick={() => toggleCategory(category)}
                className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${metadata.bg}`}
              >
                <Icon className={`w-5 h-5 ${metadata.color} flex-shrink-0`} />
                <span className="flex-1 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {metadata.label}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">
                  {filteredItems.length}
                </span>
                {expandedCategories[category] ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedCategories[category] && (
                <div className="p-2 space-y-1 border-t border-gray-100 dark:border-gray-700">
                  {filteredItems.map((item) => renderVariableItem(item))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer - Helpers Info */}
      {schema && (schema as any).helpers && (schema as any).helpers.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <div className="font-semibold mb-2">Available Helpers:</div>
            <div className="space-y-1">
              {(schema as any).helpers.slice(0, 3).map((helper: any) => (
                <div key={helper.name} className="font-mono">
                  {helper.usage}
                </div>
              ))}
              {(schema as any).helpers.length > 3 && (
                <div className="text-gray-500">+ {(schema as any).helpers.length - 3} more</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
