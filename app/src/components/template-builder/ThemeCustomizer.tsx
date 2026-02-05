'use client';

import React, { useState } from 'react';
import { ChromePicker } from 'react-color';
import { X, Palette, Type, Sparkles } from 'lucide-react';

interface ThemeCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: {
    colors: {
      primary: string;
      secondary: string;
      text: string;
      background: string;
      border: string;
    };
    fonts: {
      heading: string;
      body: string;
      monospace: string;
    };
    spacing: {
      unit: number;
      scale: number;
    };
  };
  onApply: (theme: any) => void;
}

export default function ThemeCustomizer({
  isOpen,
  onClose,
  theme,
  onApply,
}: ThemeCustomizerProps) {
  const [localTheme, setLocalTheme] = useState(theme);
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);

  if (!isOpen) return null;

  const updateColor = (key: string, color: string) => {
    setLocalTheme({
      ...localTheme,
      colors: {
        ...localTheme.colors,
        [key]: color,
      },
    });
  };

  const updateFont = (key: string, value: string) => {
    setLocalTheme({
      ...localTheme,
      fonts: {
        ...localTheme.fonts,
        [key]: value,
      },
    });
  };

  const updateSpacing = (key: string, value: number) => {
    setLocalTheme({
      ...localTheme,
      spacing: {
        ...localTheme.spacing,
        [key]: value,
      },
    });
  };

  const handleApply = () => {
    onApply(localTheme);
    onClose();
  };

  const colorOptions = [
    { key: 'primary', label: 'Primary Color', description: 'Main brand color for headings and accents' },
    { key: 'secondary', label: 'Secondary Color', description: 'Supporting brand color' },
    { key: 'text', label: 'Text Color', description: 'Main text color' },
    { key: 'background', label: 'Background Color', description: 'Page background color' },
    { key: 'border', label: 'Border Color', description: 'Default border color' },
  ];

  const fontOptions = [
    'Inter',
    'Arial',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Courier New',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Palatino',
    'Garamond',
    'Bookman',
    'Comic Sans MS',
    'Impact',
  ];

  const presetThemes = [
    {
      name: 'Default Blue',
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        text: '#1f2937',
        background: '#ffffff',
        border: '#e5e7eb',
      },
    },
    {
      name: 'Professional Green',
      colors: {
        primary: '#10b981',
        secondary: '#059669',
        text: '#111827',
        background: '#ffffff',
        border: '#d1d5db',
      },
    },
    {
      name: 'Bold Red',
      colors: {
        primary: '#ef4444',
        secondary: '#dc2626',
        text: '#1f2937',
        background: '#ffffff',
        border: '#e5e7eb',
      },
    },
    {
      name: 'Elegant Purple',
      colors: {
        primary: '#8b5cf6',
        secondary: '#7c3aed',
        text: '#1f2937',
        background: '#ffffff',
        border: '#e5e7eb',
      },
    },
    {
      name: 'Modern Dark',
      colors: {
        primary: '#60a5fa',
        secondary: '#818cf8',
        text: '#f9fafb',
        background: '#111827',
        border: '#374151',
      },
    },
  ];

  const applyPreset = (preset: typeof presetThemes[0]) => {
    setLocalTheme({
      ...localTheme,
      colors: preset.colors,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Theme Customizer
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Customize colors, fonts, and spacing for your template
              </p>
            </div>
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
          {/* Preset Themes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Quick Presets
              </h3>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {presetThemes.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:ring-2 hover:ring-blue-500 transition-all group"
                  title={preset.name}
                >
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: preset.colors.primary }}
                    />
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: preset.colors.secondary }}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {preset.name}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Colors
              </h3>
            </div>
            <div className="space-y-3">
              {colorOptions.map((option) => (
                <div key={option.key}>
                  <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                    {option.label}
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">
                    {option.description}
                  </p>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setActiveColorPicker(
                          activeColorPicker === option.key ? null : option.key
                        )
                      }
                      className="w-full h-12 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors flex items-center gap-3 px-3"
                    >
                      <div
                        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 flex-shrink-0"
                        style={{ backgroundColor: localTheme.colors[option.key as keyof typeof localTheme.colors] }}
                      />
                      <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                        {localTheme.colors[option.key as keyof typeof localTheme.colors]}
                      </span>
                    </button>
                    {activeColorPicker === option.key && (
                      <div className="absolute z-10 mt-2 left-0">
                        <div
                          className="fixed inset-0"
                          onClick={() => setActiveColorPicker(null)}
                        />
                        <ChromePicker
                          color={localTheme.colors[option.key as keyof typeof localTheme.colors]}
                          onChange={(color) => updateColor(option.key, color.hex)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fonts */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Type className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Fonts
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Heading Font
                </label>
                <select
                  value={localTheme.fonts.heading}
                  onChange={(e) => updateFont('heading', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: localTheme.fonts.heading }}
                >
                  {fontOptions.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Body Font
                </label>
                <select
                  value={localTheme.fonts.body}
                  onChange={(e) => updateFont('body', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: localTheme.fonts.body }}
                >
                  {fontOptions.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Monospace Font
                </label>
                <select
                  value={localTheme.fonts.monospace}
                  onChange={(e) => updateFont('monospace', e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ fontFamily: localTheme.fonts.monospace }}
                >
                  {fontOptions.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Spacing */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Spacing
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Base Unit (px)
                </label>
                <input
                  type="number"
                  value={localTheme.spacing.unit}
                  onChange={(e) => updateSpacing('unit', parseInt(e.target.value) || 4)}
                  min={1}
                  max={20}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  Scale Factor
                </label>
                <input
                  type="number"
                  value={localTheme.spacing.scale}
                  onChange={(e) => updateSpacing('scale', parseFloat(e.target.value) || 1)}
                  min={0.5}
                  max={2}
                  step={0.1}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
          >
            Apply Theme
          </button>
        </div>
      </div>
    </div>
  );
}
