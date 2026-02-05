'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Eye,
  FileText,
  Mail,
  Download,
  Clock,
  Settings,
  ArrowLeft,
  Undo,
  Redo,
  Play,
  Code,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CodeEditorToolbarProps {
  templateName: string;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => Promise<void>;
  onPreview: () => void;
  onTestPdf: () => void;
  onTestEmail: () => void;
  onValidate: () => void;
  onExportVisual: () => void;
  onVersionHistory: () => void;
  onSettings: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleVariables: () => void;
  showVariables: boolean;
  validationErrors: number;
}

export default function CodeEditorToolbar({
  templateName,
  isSaving,
  hasUnsavedChanges,
  canUndo,
  canRedo,
  onSave,
  onPreview,
  onTestPdf,
  onTestEmail,
  onValidate,
  onExportVisual,
  onVersionHistory,
  onSettings,
  onUndo,
  onRedo,
  onToggleVariables,
  showVariables,
  validationErrors,
}: CodeEditorToolbarProps) {
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

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <Code className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {templateName}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Section - Actions */}
          <div className="flex items-center gap-2">
            {/* Validation Errors Badge */}
            {validationErrors > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{validationErrors} errors</span>
              </div>
            )}

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

            {/* Validate */}
            <button
              onClick={onValidate}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Validate Handlebars Syntax"
            >
              <Play className="w-4 h-4" />
              <span className="text-sm font-medium">Validate</span>
            </button>

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

            {/* Variables Panel Toggle */}
            <button
              onClick={onToggleVariables}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                ${
                  showVariables
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              `}
              title="Toggle Variables Panel"
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Variables</span>
            </button>

            {/* Export to Visual */}
            <button
              onClick={onExportVisual}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Convert to Visual Template"
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
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm hover:shadow-md'
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
