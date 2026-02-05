'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Eye,
  FileText,
  Mail,
  Palette,
  Download,
  Clock,
  Settings,
  ArrowLeft,
  Undo,
  Redo,
  Smartphone,
  Monitor,
  Tablet,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BuilderToolbarProps {
  templateName: string;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => Promise<void>;
  onPreview: () => void;
  onTestPdf: () => void;
  onTestEmail: () => void;
  onTheme: () => void;
  onExport: () => void;
  onVersionHistory: () => void;
  onSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  viewMode: 'desktop' | 'tablet' | 'mobile';
  onViewModeChange: (mode: 'desktop' | 'tablet' | 'mobile') => void;
}

export default function BuilderToolbar({
  templateName,
  isSaving,
  hasUnsavedChanges,
  canUndo,
  canRedo,
  onSave,
  onPreview,
  onTestPdf,
  onTestEmail,
  onTheme,
  onExport,
  onVersionHistory,
  onSettings,
  onUndo,
  onRedo,
  viewMode,
  onViewModeChange,
}: BuilderToolbarProps) {
  const router = useRouter();

  const handleSave = async () => {
    try {
      await onSave();
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section - Back & Template Name */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/admin/quotes/templates')}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">Back</span>
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {templateName}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
              </p>
            </div>
          </div>

          {/* Center Section - View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('desktop')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md transition-all
                ${
                  viewMode === 'desktop'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
              title="Desktop View"
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('tablet')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md transition-all
                ${
                  viewMode === 'tablet'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
              title="Tablet View"
            >
              <Tablet className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('mobile')}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md transition-all
                ${
                  viewMode === 'mobile'
                    ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }
              `}
              title="Mobile View"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {/* Undo/Redo */}
            <div className="flex items-center gap-1 mr-2">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={`
                  p-2 rounded-lg transition-colors
                  ${
                    canUndo
                      ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }
                `}
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={`
                  p-2 rounded-lg transition-colors
                  ${
                    canRedo
                      ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                      : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }
                `}
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

            {/* Preview */}
            <button
              onClick={onPreview}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Preview Template"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">Preview</span>
            </button>

            {/* Test PDF */}
            <button
              onClick={onTestPdf}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Test PDF Generation"
            >
              <FileText className="w-4 h-4" />
            </button>

            {/* Test Email */}
            <button
              onClick={onTestEmail}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Test Email"
            >
              <Mail className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

            {/* Theme */}
            <button
              onClick={onTheme}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Customize Theme"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Export */}
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Export to Code"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Version History */}
            <button
              onClick={onVersionHistory}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Version History"
            >
              <Clock className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={onSettings}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Template Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div className="h-6 w-px bg-gray-300 dark:bg-gray-700"></div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                ${
                  isSaving || !hasUnsavedChanges
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
                }
              `}
            >
              <Save className="w-4 h-4" />
              <span className="text-sm">
                {isSaving ? 'Saving...' : hasUnsavedChanges ? 'Save' : 'Saved'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
