/**
 * Variable Selector Component
 * Browse and select email template variables from registry
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Search, CheckCircle, X } from 'lucide-react';
import { getVariableRegistry } from '@/lib/api/jobs';
import type { VariableRegistry, VariableMetadata, VariableCategory } from '@/lib/types/jobs';
import toast from 'react-hot-toast';

interface VariableSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVariables: string[];
  onVariablesChange: (variables: string[]) => void;
}

export function VariableSelector({
  isOpen,
  onClose,
  selectedVariables,
  onVariablesChange,
}: VariableSelectorProps) {
  // State
  const [registry, setRegistry] = useState<VariableRegistry>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<VariableCategory | 'all'>('all');
  const [localSelectedVars, setLocalSelectedVars] = useState<string[]>(selectedVariables);

  // Load registry on mount
  useEffect(() => {
    if (isOpen) {
      fetchRegistry();
      setLocalSelectedVars(selectedVariables); // Reset local selection when modal opens
    }
  }, [isOpen, selectedVariables]);

  const fetchRegistry = async () => {
    try {
      setIsLoading(true);
      console.log('[VariableSelector] Fetching variable registry...');
      const data = await getVariableRegistry();
      console.log('[VariableSelector] Registry loaded:', Object.keys(data).length, 'variables');
      setRegistry(data);
    } catch (err: any) {
      console.error('[VariableSelector] Error loading registry:', err);
      toast.error(err.message || 'Failed to load variable registry');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter variables by category and search
  const filteredVariables = useMemo(() => {
    let vars = Object.values(registry);

    // Filter by category
    if (activeCategory !== 'all') {
      vars = vars.filter((v) => v.category === activeCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      vars = vars.filter(
        (v) =>
          v.name.toLowerCase().includes(search) ||
          v.description.toLowerCase().includes(search) ||
          v.category.toLowerCase().includes(search)
      );
    }

    // Sort by name
    return vars.sort((a, b) => a.name.localeCompare(b.name));
  }, [registry, activeCategory, searchTerm]);

  // Toggle variable selection
  const toggleVariable = (variableName: string) => {
    setLocalSelectedVars((prev) => {
      if (prev.includes(variableName)) {
        return prev.filter((v) => v !== variableName);
      } else {
        return [...prev, variableName];
      }
    });
  };

  // Apply changes
  const handleApply = () => {
    onVariablesChange(localSelectedVars);
    onClose();
  };

  // Category tabs configuration
  const categoryTabs = [
    { id: 'all', label: 'All' },
    { id: 'user', label: 'User' },
    { id: 'tenant', label: 'Tenant' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'billing', label: 'Billing' },
    { id: 'system', label: 'System' },
  ];

  // Get badge variant for variable type
  const getTypeBadgeVariant = (type: string): 'neutral' | 'info' | 'success' | 'warning' => {
    switch (type) {
      case 'string':
      case 'email':
      case 'url':
      case 'phone':
        return 'info';
      case 'number':
      case 'currency':
        return 'success';
      case 'boolean':
        return 'warning';
      case 'date':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Template Variables" size="xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <ModalContent>
            {/* Search Input */}
            <div className="mb-4">
              <Input
                type="text"
                placeholder="Search variables by name, description, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Category Tabs */}
            <div className="mb-4">
              <Tabs
                tabs={categoryTabs}
                activeTab={activeCategory}
                onChange={(tab) => setActiveCategory(tab as VariableCategory | 'all')}
              />
            </div>

            {/* Stats */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Showing {filteredVariables.length} of {Object.keys(registry).length} variables
              {localSelectedVars.length > 0 && (
                <span className="ml-2">
                  • {localSelectedVars.length} selected
                </span>
              )}
            </div>

            {/* Variable List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredVariables.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  {searchTerm ? 'No variables found matching your search' : 'No variables available'}
                </div>
              ) : (
                filteredVariables.map((variable) => {
                  const isSelected = localSelectedVars.includes(variable.name);
                  return (
                    <div
                      key={variable.name}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                          : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                      onClick={() => toggleVariable(variable.name)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Variable Name and Type */}
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-mono font-medium text-gray-900 dark:text-gray-100">
                              {`{{${variable.name}}}`}
                            </code>
                            <Badge variant={getTypeBadgeVariant(variable.type)} className="text-xs">
                              {variable.type}
                            </Badge>
                            <Badge variant="neutral" className="text-xs">
                              {variable.category}
                            </Badge>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {variable.description}
                          </p>

                          {/* Example */}
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Example:{' '}
                            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                              {typeof variable.example === 'string'
                                ? variable.example
                                : JSON.stringify(variable.example)}
                            </code>
                          </p>
                        </div>

                        {/* Selection Indicator */}
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Help Text */}
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-800 dark:text-blue-300">
              <p className="font-medium mb-1">How to use variables:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Click any variable to add or remove it from your selection</li>
                <li>Use <code className="bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{`{{variable_name}}`}</code> syntax in your template subject and body</li>
                <li>Variables are replaced with actual data when emails are sent</li>
              </ul>
            </div>
          </ModalContent>

          <ModalActions>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApply}>
              Apply ({localSelectedVars.length} selected)
            </Button>
          </ModalActions>
        </>
      )}
    </Modal>
  );
}

export default VariableSelector;
