/**
 * VariablePicker Component
 * Sidebar component for selecting and inserting Handlebars variables
 * Fetches variable registry from API and groups by context
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { getVariableRegistry } from '@/lib/api/communication';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { toast } from 'react-hot-toast';

interface VariablePickerProps {
  onInsert: (variable: string) => void;
}

interface Variable {
  name: string;
  description: string;
  example?: string;
}

interface VariableContext {
  context: string;
  variables: Variable[];
}

export function VariablePicker({ onInsert }: VariablePickerProps) {
  const [registry, setRegistry] = useState<VariableContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContexts, setExpandedContexts] = useState<Set<string>>(new Set(['user', 'company']));

  useEffect(() => {
    const fetchRegistry = async () => {
      try {
        setLoading(true);
        const data = await getVariableRegistry();

        // Transform backend nested format to component format
        // Backend returns: { common: { varName: { type, description, example } }, customer: { ... } }
        // Component needs: [{ context: "common", variables: [{ name, description, example }] }]
        const registryArray: VariableContext[] = Object.entries(data).map(([context, vars]) => ({
          context,
          variables: Object.entries(vars as Record<string, any>)
            .map(([name, varData]) => ({
              name,
              description: varData.description || '',
              example: varData.example,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));

        setRegistry(registryArray);
      } catch (error) {
        console.error('Failed to fetch variable registry:', error);
        toast.error('Failed to load variable registry');
      } finally {
        setLoading(false);
      }
    };

    fetchRegistry();
  }, []);

  const toggleContext = (context: string) => {
    const newExpanded = new Set(expandedContexts);
    if (newExpanded.has(context)) {
      newExpanded.delete(context);
    } else {
      newExpanded.add(context);
    }
    setExpandedContexts(newExpanded);
  };

  const handleInsert = (variableName: string) => {
    onInsert(`{{${variableName}}}`);
    toast.success(`Inserted {{${variableName}}}`);
  };

  const handleCopy = (variableName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`{{${variableName}}}`);
    toast.success(`Copied {{${variableName}}} to clipboard`);
  };

  // Filter variables based on search query
  const filteredRegistry = registry
    .map(context => ({
      ...context,
      variables: context.variables.filter(
        variable =>
          variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          variable.description.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter(context => context.variables.length > 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Available Variables
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          All variables you can insert into your template
        </p>
        <Input
          type="text"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Click any variable to insert it at cursor position
        </p>
      </div>

      {/* Variable Groups */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2">
        {filteredRegistry.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No variables found
          </div>
        ) : (
          filteredRegistry.map((context) => (
            <div key={context.context} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Context Header */}
              <button
                onClick={() => toggleContext(context.context)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                  {context.context} ({context.variables.length})
                </span>
                {expandedContexts.has(context.context) ? (
                  <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {/* Variables List */}
              {expandedContexts.has(context.context) && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {context.variables.map((variable) => (
                    <div
                      key={variable.name}
                      className="p-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => handleInsert(variable.name)}
                          className="flex-1 text-left"
                        >
                          <code className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all">
                            {'{{'}
                            {variable.name}
                            {'}}'}
                          </code>
                          {variable.description && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              {variable.description}
                            </p>
                          )}
                          {variable.example && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                              Example: {variable.example}
                            </p>
                          )}
                        </button>
                        <button
                          onClick={(e) => handleCopy(variable.name, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Copy to clipboard"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Help */}
      <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
        <p className="text-xs text-blue-900 dark:text-blue-100 font-semibold mb-1">
          Using Variables
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Variables are replaced with actual values when emails are sent. Use double curly braces: <code className="font-mono">{'{{variableName}}'}</code>
        </p>
      </div>
    </div>
  );
}

export default VariablePicker;
