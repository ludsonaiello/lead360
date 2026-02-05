'use client';

import React, { useState } from 'react';
import { X, Code, CheckCircle, AlertCircle } from 'lucide-react';

interface LoopConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: LoopConfig) => void;
  initialConfig?: LoopConfig;
}

export interface LoopConfig {
  source_array: string; // e.g., "items", "groups", "draw_schedule"
  item_variable_name?: string; // e.g., "item", "group", "payment"
  show_index?: boolean;
  index_variable_name?: string; // e.g., "index", "i"
  empty_message?: string;
}

const ARRAY_SOURCES = [
  {
    value: 'items',
    label: 'Line Items',
    description: 'Quote line items with quantity, price, etc.',
    defaultVarName: 'item',
  },
  {
    value: 'groups',
    label: 'Item Groups',
    description: 'Grouped line items with subtotals',
    defaultVarName: 'group',
  },
  {
    value: 'draw_schedule',
    label: 'Draw Schedule',
    description: 'Payment milestones and dates',
    defaultVarName: 'payment',
  },
  {
    value: 'attachments',
    label: 'Attachments',
    description: 'Attached files and documents',
    defaultVarName: 'attachment',
  },
];

export default function LoopConfigModal({
  isOpen,
  onClose,
  onSave,
  initialConfig,
}: LoopConfigModalProps) {
  const [config, setConfig] = useState<LoopConfig>(
    initialConfig || {
      source_array: 'items',
      item_variable_name: 'item',
      show_index: false,
      index_variable_name: 'index',
      empty_message: 'No items to display',
    }
  );

  const selectedSource = ARRAY_SOURCES.find((s) => s.value === config.source_array);

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  if (!isOpen) return null;

  const exampleCode = `{{#each ${config.source_array}}}
  ${config.show_index ? `{{@index}}. ` : ''}{{${config.item_variable_name || selectedSource?.defaultVarName || 'item'}.title}}
{{/each}}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Configure Loop
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Set up iteration over array data
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Array Source */}
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-3">
              Data Source
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ARRAY_SOURCES.map((source) => (
                <button
                  key={source.value}
                  onClick={() =>
                    setConfig({
                      ...config,
                      source_array: source.value,
                      item_variable_name: source.defaultVarName,
                    })
                  }
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    config.source_array === source.value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {config.source_array === source.value && (
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {source.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {source.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Item Variable Name */}
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-2">
              Item Variable Name
            </label>
            <input
              type="text"
              value={config.item_variable_name || selectedSource?.defaultVarName || 'item'}
              onChange={(e) =>
                setConfig({ ...config, item_variable_name: e.target.value })
              }
              placeholder="item"
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use this name to reference each item in the loop, e.g.,{' '}
              <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                {'{{'}{config.item_variable_name || selectedSource?.defaultVarName || 'item'}
                {'.title}}'}
              </code>
            </p>
          </div>

          {/* Show Index */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                Show Index Numbers
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Display 1, 2, 3... for each item
              </div>
            </div>
            <input
              type="checkbox"
              checked={config.show_index ?? false}
              onChange={(e) => setConfig({ ...config, show_index: e.target.checked })}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {config.show_index && (
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-2">
                Index Variable Name
              </label>
              <input
                type="text"
                value={config.index_variable_name || 'index'}
                onChange={(e) =>
                  setConfig({ ...config, index_variable_name: e.target.value })
                }
                placeholder="index"
                className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Empty Message */}
          <div>
            <label className="text-sm font-medium text-gray-900 dark:text-gray-100 block mb-2">
              Empty State Message
            </label>
            <input
              type="text"
              value={config.empty_message || ''}
              onChange={(e) => setConfig({ ...config, empty_message: e.target.value })}
              placeholder="No items to display"
              className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Shown when the array is empty
            </p>
          </div>

          {/* Preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Code className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Generated Code
              </span>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-xs font-mono whitespace-pre">{exampleCode}</pre>
            </div>
          </div>

          {/* Help */}
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-200">
              <div className="font-semibold mb-1">Loop Usage</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Access item properties with{' '}
                  <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">
                    {'{{'}{config.item_variable_name || 'item'}{'.property}}'}
                  </code>
                </li>
                <li>Use <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{'{{@index}}'}</code> for the current index (0-based)</li>
                <li>Use <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{'{{@first}}'}</code> and <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{'{{@last}}'}</code> for first/last items</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
