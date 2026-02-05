'use client';

import React, { useState } from 'react';
import { ChromePicker } from 'react-color';
import {
  Settings,
  Trash2,
  Copy,
  MoveUp,
  MoveDown,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Repeat,
  Image as ImageIcon,
} from 'lucide-react';
import type { TemplateComponent } from '@/lib/types/quote-admin';
import VariableTextField from './VariableTextField';
import LoopConfigModal, { LoopConfig } from './LoopConfigModal';

interface ComponentPropertiesPanelProps {
  component: TemplateComponent | null;
  onUpdate: (updates: Partial<TemplateComponent>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function ComponentPropertiesPanel({
  component,
  onUpdate,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: ComponentPropertiesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    config: true,
    style: true,
    spacing: true,
    advanced: false,
  });

  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [showLoopModal, setShowLoopModal] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (!component) {
    return (
      <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center p-8 text-center">
        <Settings className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
          No Component Selected
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click on a component in the canvas to edit its properties
        </p>
      </div>
    );
  }

  const config = component.config || {};
  const style = component.style || {};
  const padding = style.padding || { top: 10, right: 10, bottom: 10, left: 10 };
  const margin = style.margin || { top: 0, right: 0, bottom: 20, left: 0 };
  const border = style.border || { width: 0, color: '#e5e7eb', style: 'solid' };

  // Update config
  const updateConfig = (key: string, value: any) => {
    onUpdate({
      config: { ...config, [key]: value },
    });
  };

  // Update style
  const updateStyle = (updates: any) => {
    onUpdate({
      style: { ...style, ...updates },
    });
  };

  // Update spacing
  const updatePadding = (side: string, value: number) => {
    updateStyle({
      padding: { ...padding, [side]: value },
    });
  };

  const updateMargin = (side: string, value: number) => {
    updateStyle({
      margin: { ...margin, [side]: value },
    });
  };

  // Component-specific config fields
  const renderConfigFields = () => {
    switch (component.type) {
      case 'header':
        return (
          <>
            <VariableTextField
              label="Header Title"
              value={config.title || ''}
              onChange={(value) => updateConfig('title', value)}
              placeholder="Enter header title..."
              helpText="Use {{variables}} for dynamic content"
            />

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" />
                Logo URL
              </label>
              <VariableTextField
                value={config.logo_url || ''}
                onChange={(value) => updateConfig('logo_url', value)}
                placeholder="{{vendor.logo_url}} or https://..."
                helpText="Can be a URL or variable like {{vendor.logo_url}}"
              />
            </div>

            <VariableTextField
              label="Subtitle/Tagline"
              value={config.subtitle || ''}
              onChange={(value) => updateConfig('subtitle', value)}
              placeholder="Optional subtitle..."
              multiline={false}
            />

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Text Alignment</label>
              <select
                value={config.text_align || 'left'}
                onChange={(e) => updateConfig('text_align', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </>
        );

      case 'customer_info':
      case 'company_info':
      case 'vendor_info':
        return (
          <>
            <VariableTextField
              label="Custom Label"
              value={config.label || ''}
              onChange={(value) => updateConfig('label', value)}
              placeholder={component.type === 'customer_info' ? 'Customer Information' : 'Company Information'}
              multiline={false}
            />

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Email</label>
              <input
                type="checkbox"
                checked={config.show_email ?? true}
                onChange={(e) => updateConfig('show_email', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Phone</label>
              <input
                type="checkbox"
                checked={config.show_phone ?? true}
                onChange={(e) => updateConfig('show_phone', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Address</label>
              <input
                type="checkbox"
                checked={config.show_address ?? true}
                onChange={(e) => updateConfig('show_address', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Layout</label>
              <select
                value={config.layout || 'vertical'}
                onChange={(e) => updateConfig('layout', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </>
        );

      case 'line_items':
      case 'table':
        return (
          <>
            {/* Loop Configuration */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Loop Configuration
                  </span>
                </div>
                <button
                  onClick={() => setShowLoopModal(true)}
                  className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Configure
                </button>
              </div>
              {config.loop_config ? (
                <div className="text-xs text-blue-800 dark:text-blue-200">
                  Looping over: <code className="font-mono bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">{config.loop_config.source_array}</code>
                </div>
              ) : (
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  Click Configure to set up iteration
                </div>
              )}
            </div>

            <VariableTextField
              label="Table Title"
              value={config.title || ''}
              onChange={(value) => updateConfig('title', value)}
              placeholder="Line Items"
              multiline={false}
            />

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Description</label>
              <input
                type="checkbox"
                checked={config.show_description ?? true}
                onChange={(e) => updateConfig('show_description', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Quantity</label>
              <input
                type="checkbox"
                checked={config.show_quantity ?? true}
                onChange={(e) => updateConfig('show_quantity', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Unit Price</label>
              <input
                type="checkbox"
                checked={config.show_unit_price ?? true}
                onChange={(e) => updateConfig('show_unit_price', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Line Total</label>
              <input
                type="checkbox"
                checked={config.show_line_total ?? true}
                onChange={(e) => updateConfig('show_line_total', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Striped Rows</label>
              <input
                type="checkbox"
                checked={config.striped ?? true}
                onChange={(e) => updateConfig('striped', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        );

      case 'totals':
        return (
          <>
            <VariableTextField
              label="Section Title"
              value={config.title || ''}
              onChange={(value) => updateConfig('title', value)}
              placeholder="Quote Summary"
              multiline={false}
            />

            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Subtotal</label>
              <input
                type="checkbox"
                checked={config.show_subtotal ?? true}
                onChange={(e) => updateConfig('show_subtotal', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Tax</label>
              <input
                type="checkbox"
                checked={config.show_tax ?? true}
                onChange={(e) => updateConfig('show_tax', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Show Discount</label>
              <input
                type="checkbox"
                checked={config.show_discount ?? true}
                onChange={(e) => updateConfig('show_discount', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-600 dark:text-gray-400">Highlight Total</label>
              <input
                type="checkbox"
                checked={config.highlight_total ?? true}
                onChange={(e) => updateConfig('highlight_total', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </>
        );

      case 'text':
        return (
          <VariableTextField
            label="Text Content"
            value={config.text || ''}
            onChange={(value) => updateConfig('text', value)}
            placeholder="Enter text content..."
            multiline={true}
            rows={6}
            helpText="Supports Handlebars variables like {{customer.name}}"
          />
        );

      case 'spacer':
        return (
          <div>
            <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
              Height (px)
            </label>
            <input
              type="number"
              value={config.height || 20}
              onChange={(e) => updateConfig('height', parseInt(e.target.value) || 20)}
              min={0}
              max={200}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 'divider':
        return (
          <>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                Thickness (px)
              </label>
              <input
                type="number"
                value={config.thickness || 1}
                onChange={(e) => updateConfig('thickness', parseInt(e.target.value) || 1)}
                min={1}
                max={10}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Color</label>
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(showColorPicker === 'divider' ? null : 'divider')}
                  className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-3"
                  style={{ backgroundColor: config.color || '#e5e7eb' }}
                >
                  <span className="text-xs text-gray-900 dark:text-gray-100">
                    {config.color || '#e5e7eb'}
                  </span>
                </button>
                {showColorPicker === 'divider' && (
                  <div className="absolute z-10 mt-2">
                    <div
                      className="fixed inset-0"
                      onClick={() => setShowColorPicker(null)}
                    />
                    <ChromePicker
                      color={config.color || '#e5e7eb'}
                      onChange={(color) => updateConfig('color', color.hex)}
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        );

      case 'image':
        return (
          <>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" />
                Image URL
              </label>
              <VariableTextField
                value={config.image_url || ''}
                onChange={(value) => updateConfig('image_url', value)}
                placeholder="https://... or {{vendor.logo_url}}"
                helpText="Can be a URL or variable"
              />
            </div>

            <VariableTextField
              label="Alt Text"
              value={config.alt_text || ''}
              onChange={(value) => updateConfig('alt_text', value)}
              placeholder="Image description"
              multiline={false}
            />

            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">Size</label>
              <select
                value={config.size || 'medium'}
                onChange={(e) => updateConfig('size', e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="full">Full Width</option>
              </select>
            </div>
          </>
        );

      default:
        return (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No specific configuration options for this component type
          </p>
        );
    }
  };

  return (
    <div className="w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Properties
        </h2>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className={`
              flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${
                canMoveUp
                  ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700'
              }
            `}
          >
            <MoveUp className="w-3.5 h-3.5" />
            Up
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className={`
              flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${
                canMoveDown
                  ? 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-gray-200 dark:border-gray-700'
              }
            `}
          >
            <MoveDown className="w-3.5 h-3.5" />
            Down
          </button>
          <button
            onClick={onDuplicate}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors border border-gray-200 dark:border-gray-700"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-xs font-medium transition-colors border border-red-200 dark:border-red-800"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Component Config */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('config')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Component Settings
            </span>
            {expandedSections.config ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.config && (
            <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
              {renderConfigFields()}
            </div>
          )}
        </div>

        {/* Style */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('style')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Appearance
            </span>
            {expandedSections.style ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.style && (
            <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
              {/* Background Color */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Background Color
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowColorPicker(showColorPicker === 'bg' ? null : 'bg')}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 px-3"
                    style={{ backgroundColor: style.backgroundColor || 'transparent' }}
                  >
                    <span className="text-xs text-gray-900 dark:text-gray-100">
                      {style.backgroundColor || 'transparent'}
                    </span>
                  </button>
                  {showColorPicker === 'bg' && (
                    <div className="absolute z-10 mt-2 right-0">
                      <div
                        className="fixed inset-0"
                        onClick={() => setShowColorPicker(null)}
                      />
                      <ChromePicker
                        color={style.backgroundColor || '#ffffff'}
                        onChange={(color) => updateStyle({ backgroundColor: color.hex })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Border */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Border Width (px)
                </label>
                <input
                  type="number"
                  value={border.width || 0}
                  onChange={(e) => updateStyle({ border: { ...border, width: parseInt(e.target.value) || 0 } })}
                  min={0}
                  max={10}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Border Radius */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Border Radius (px)
                </label>
                <input
                  type="number"
                  value={style.borderRadius || 0}
                  onChange={(e) => updateStyle({ borderRadius: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={50}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Spacing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => toggleSection('spacing')}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Spacing
            </span>
            {expandedSections.spacing ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {expandedSections.spacing && (
            <div className="p-3 pt-0 space-y-3 border-t border-gray-100 dark:border-gray-700">
              {/* Padding */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-2">
                  Padding (px)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      value={padding.top}
                      onChange={(e) => updatePadding('top', parseInt(e.target.value) || 0)}
                      placeholder="Top"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={padding.right}
                      onChange={(e) => updatePadding('right', parseInt(e.target.value) || 0)}
                      placeholder="Right"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={padding.bottom}
                      onChange={(e) => updatePadding('bottom', parseInt(e.target.value) || 0)}
                      placeholder="Bottom"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={padding.left}
                      onChange={(e) => updatePadding('left', parseInt(e.target.value) || 0)}
                      placeholder="Left"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Margin */}
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-2">
                  Margin (px)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      value={margin.top}
                      onChange={(e) => updateMargin('top', parseInt(e.target.value) || 0)}
                      placeholder="Top"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={margin.right}
                      onChange={(e) => updateMargin('right', parseInt(e.target.value) || 0)}
                      placeholder="Right"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={margin.bottom}
                      onChange={(e) => updateMargin('bottom', parseInt(e.target.value) || 0)}
                      placeholder="Bottom"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={margin.left}
                      onChange={(e) => updateMargin('left', parseInt(e.target.value) || 0)}
                      placeholder="Left"
                      min={0}
                      className="w-full px-2 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loop Configuration Modal */}
      <LoopConfigModal
        isOpen={showLoopModal}
        onClose={() => setShowLoopModal(false)}
        onSave={(loopConfig) => updateConfig('loop_config', loopConfig)}
        initialConfig={config.loop_config}
      />
    </div>
  );
}
