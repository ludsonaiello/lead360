/**
 * TemplateEditor Component
 * Rich text editor for email templates using TipTap
 * Features:
 * - WYSIWYG editor with formatting toolbar
 * - Variable insertion
 * - HTML/Visual view toggle
 * - Template preview
 * - Validation before save
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Link2,
  Code,
  Eye,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { VariablePicker } from './VariablePicker';
import { previewTemplate, validateTemplate } from '@/lib/api/communication';
import type { EmailTemplate, CreateTemplateDto, UpdateTemplateDto } from '@/lib/types/communication';
import { getAllTenants, type TenantListItem } from '@/lib/api/admin';
import { useAuth } from '@/lib/hooks/useAuth';
import { toast } from 'react-hot-toast';

interface TemplateEditorProps {
  initialData?: EmailTemplate;
  onSave: (data: CreateTemplateDto | UpdateTemplateDto) => Promise<any>;
}

export function TemplateEditor({ initialData, onSave }: TemplateEditorProps) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.is_platform_admin || false;

  // Form state
  const [templateKey, setTemplateKey] = useState(initialData?.template_key || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState<string>(initialData?.category || 'transactional');
  const [templateType, setTemplateType] = useState<string>(initialData?.template_type || 'tenant');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [textBody, setTextBody] = useState(initialData?.text_body || '');
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  // UI state
  const [showHtmlView, setShowHtmlView] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Tenants list (for platform admins)
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // TipTap editor
  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches in Next.js
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your email template here... Use the sidebar to insert variables.',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
    ],
    content: initialData?.html_body || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
    },
  });

  const categoryOptions: SelectOption[] = [
    { value: 'system', label: 'System' },
    { value: 'transactional', label: 'Transactional' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'notification', label: 'Notification' },
  ];

  const templateTypeOptions: SelectOption[] = [
    { value: 'tenant', label: 'Tenant Template' },
    { value: 'shared', label: 'Shared Template (visible to all tenants)' },
    { value: 'platform', label: 'Platform Template (internal use only)' },
  ];

  // Fetch tenants when platform admin selects "tenant" type
  useEffect(() => {
    const fetchTenants = async () => {
      if (!isPlatformAdmin || templateType !== 'tenant' || initialData) {
        return;
      }

      try {
        setLoadingTenants(true);
        const response = await getAllTenants({ limit: 1000, status: 'active' });
        setTenants(response.data);
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
        toast.error('Failed to load tenant list');
      } finally {
        setLoadingTenants(false);
      }
    };

    fetchTenants();
  }, [isPlatformAdmin, templateType, initialData]);

  // Tenant options for selector
  const tenantOptions: SelectOption[] = [
    { value: '', label: 'Select Tenant...' },
    ...tenants.map(tenant => ({
      value: tenant.id,
      label: `${tenant.company_name} (${tenant.subdomain})`,
    })),
  ];

  // Insert variable into editor
  const handleInsertVariable = (variable: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(variable).run();
  };

  // Get HTML from editor
  const getHtmlContent = (): string => {
    if (showHtmlView) {
      // If in HTML view, get from textarea
      const textarea = document.getElementById('html-textarea') as HTMLTextAreaElement;
      return textarea?.value || '';
    }
    return editor?.getHTML() || '';
  };

  // Set HTML to editor
  const setHtmlContent = (html: string) => {
    if (editor) {
      editor.commands.setContent(html);
    }
  };

  // Toggle between visual and HTML view
  const toggleHtmlView = () => {
    if (!showHtmlView) {
      // Switching TO HTML view - save current visual content
      const currentHtml = editor?.getHTML() || '';
      setShowHtmlView(true);
      // Delay to ensure textarea is rendered
      setTimeout(() => {
        const textarea = document.getElementById('html-textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = currentHtml;
        }
      }, 0);
    } else {
      // Switching TO visual view - load HTML into editor
      const textarea = document.getElementById('html-textarea') as HTMLTextAreaElement;
      const html = textarea?.value || '';
      setHtmlContent(html);
      setShowHtmlView(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!templateKey) {
      newErrors.template_key = 'Template key is required';
    } else if (!/^[a-z0-9-_]+$/.test(templateKey)) {
      newErrors.template_key = 'Template key must be lowercase with hyphens/underscores only';
    }

    if (!subject) {
      newErrors.subject = 'Subject is required';
    }

    const htmlContent = getHtmlContent();
    if (!htmlContent || htmlContent === '<p></p>') {
      newErrors.html_body = 'Email body is required';
    }

    // Platform admin creating tenant template must select a tenant
    if (isPlatformAdmin && templateType === 'tenant' && !selectedTenantId) {
      newErrors.tenant_id = 'Please select a tenant for this template';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    try {
      setIsSaving(true);

      const htmlContent = getHtmlContent();

      // Validate template syntax
      const validation = await validateTemplate({
        subject,
        html_body: htmlContent,
        text_body: textBody || undefined,
      });

      if (!validation.valid) {
        const errorMessages = validation.errors ? Object.values(validation.errors).flat() : ['Unknown error'];
        toast.error('Template validation failed: ' + errorMessages.join(', '));
        return;
      }

      const payload: CreateTemplateDto | UpdateTemplateDto = initialData
        ? {
            // Update - no template_key or template_type
            description: description || undefined,
            category: category as any,
            subject,
            html_body: htmlContent,
            text_body: textBody || undefined,
            is_active: isActive,
          }
        : {
            // Create - include template_key and template_type
            template_key: templateKey,
            description: description || undefined,
            category: category as any,
            template_type: templateType as any,
            tenant_id: templateType === 'tenant' && selectedTenantId ? selectedTenantId : undefined,
            subject,
            html_body: htmlContent,
            text_body: textBody || undefined,
            is_active: isActive,
          };

      await onSave(payload);
    } catch (error: any) {
      // Error already handled by parent
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle preview
  const handlePreview = async () => {
    const htmlContent = getHtmlContent();

    if (!subject || !htmlContent) {
      toast.error('Please add a subject and body to preview');
      return;
    }

    try {
      setIsPreviewing(true);

      // For preview, we need to either use saved template key or validate first
      if (initialData) {
        // Editing existing - use template key
        const preview = await previewTemplate(initialData.template_key, {
          sample_data: previewVariables,
        });
        setPreviewData(preview);
        setShowPreview(true);
      } else {
        // New template - validate and show preview manually
        const validation = await validateTemplate({
          subject,
          html_body: htmlContent,
          text_body: textBody || undefined,
        });

        if (!validation.valid) {
          const errorMessages = validation.errors ? Object.values(validation.errors).flat() : ['Unknown error'];
          toast.error('Template has errors: ' + errorMessages.join(', '));
          return;
        }

        // Render preview manually (replace variables with preview values)
        let previewSubject = subject;
        let previewHtml = htmlContent;

        Object.entries(previewVariables).forEach(([key, value]) => {
          const varPattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          previewSubject = previewSubject.replace(varPattern, value);
          previewHtml = previewHtml.replace(varPattern, value);
        });

        setPreviewData({
          subject: previewSubject,
          html_body: previewHtml,
          text_body: textBody || '',
        });
        setShowPreview(true);
      }
    } catch (error: any) {
      console.error('Preview failed:', error);
      toast.error(error?.response?.data?.message || 'Failed to generate preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  if (!editor) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Editor Area (2/3 width on large screens) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Template Information
          </h3>

          {!initialData && (
            <Input
              label="Template Key"
              type="text"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
              placeholder="password-reset"
              required
              error={errors.template_key}
              helperText="Unique identifier (lowercase, hyphens/underscores only)"
            />
          )}

          <Input
            label="Description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Sent when a user requests a password reset"
            helperText="Brief description of when this template is used (optional)"
          />

          <Select
            label="Category"
            options={categoryOptions}
            value={category}
            onChange={(value) => setCategory(value)}
            required
            helperText="Template category for organization"
          />

          {!initialData && isPlatformAdmin && (
            <Select
              label="Template Type"
              options={templateTypeOptions}
              value={templateType}
              onChange={(value) => setTemplateType(value)}
              required
              helperText="Platform admins only: Choose template visibility and purpose"
            />
          )}

          {!initialData && isPlatformAdmin && templateType === 'tenant' && (
            <Select
              label="Assign to Tenant"
              options={tenantOptions}
              value={selectedTenantId}
              onChange={(value) => setSelectedTenantId(value)}
              required
              searchable={true}
              error={errors.tenant_id}
              helperText={loadingTenants ? 'Loading tenants...' : 'Select which tenant this template belongs to'}
              disabled={loadingTenants}
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is-active" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active
            </label>
          </div>
        </div>

        {/* Subject */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Email Subject
          </h3>

          <Input
            label="Subject Line"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Reset your password - {{companyName}}"
            required
            error={errors.subject}
            helperText="Use {{variables}} for dynamic content"
          />
        </div>

        {/* HTML Body Editor */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Email Body
              </h3>
              <button
                onClick={toggleHtmlView}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  showHtmlView
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                <Code className="h-3.5 w-3.5 inline mr-1" />
                {showHtmlView ? 'Visual Editor' : 'HTML Code'}
              </button>
            </div>

            {/* Toolbar (only show in visual mode) */}
            {!showHtmlView && (
              <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  isActive={editor.isActive('bold')}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </ToolbarButton>

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  isActive={editor.isActive('italic')}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  isActive={editor.isActive('heading', { level: 1 })}
                  title="Heading 1"
                >
                  <Heading1 className="h-4 w-4" />
                </ToolbarButton>

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  isActive={editor.isActive('heading', { level: 2 })}
                  title="Heading 2"
                >
                  <Heading2 className="h-4 w-4" />
                </ToolbarButton>

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  isActive={editor.isActive('heading', { level: 3 })}
                  title="Heading 3"
                >
                  <Heading3 className="h-4 w-4" />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  isActive={editor.isActive('bulletList')}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </ToolbarButton>

                <ToolbarButton
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  isActive={editor.isActive('orderedList')}
                  title="Numbered List"
                >
                  <ListOrdered className="h-4 w-4" />
                </ToolbarButton>

                <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

                <ToolbarButton
                  onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  isActive={editor.isActive('link')}
                  title="Insert Link"
                >
                  <Link2 className="h-4 w-4" />
                </ToolbarButton>
              </div>
            )}
          </div>

          {/* Editor Content */}
          <div className="bg-white dark:bg-gray-900">
            {showHtmlView ? (
              <textarea
                id="html-textarea"
                className="w-full min-h-[400px] p-4 font-mono text-sm bg-gray-900 text-gray-100 focus:outline-none resize-y"
                placeholder="<p>HTML content here...</p>"
              />
            ) : (
              <EditorContent editor={editor} />
            )}
          </div>

          {errors.html_body && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
                <AlertCircle className="h-4 w-4" />
                {errors.html_body}
              </div>
            </div>
          )}
        </div>

        {/* Plain Text Body (Optional) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Plain Text Version (Optional)
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Fallback for email clients that don't support HTML
          </p>

          <textarea
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Plain text version of your email..."
            className="w-full min-h-[150px] p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button onClick={handlePreview} variant="secondary" disabled={isPreviewing}>
            {isPreviewing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </>
            )}
          </Button>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Variable Picker Sidebar (1/3 width on large screens) */}
      <div className="lg:col-span-1">
        <div className="sticky top-6 h-[calc(100vh-8rem)] rounded-lg border border-gray-200 dark:border-gray-700">
          <VariablePicker onInsert={handleInsertVariable} />
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewData && (
        <Modal
          isOpen
          onClose={() => setShowPreview(false)}
          title="Template Preview"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subject</h4>
              <p className="text-sm text-gray-900 dark:text-gray-100 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                {previewData.subject}
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">HTML Preview</h4>
              <div
                className="p-4 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: previewData.html_body }}
              />
            </div>

            {previewData.text_body && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Plain Text</h4>
                <pre className="text-sm text-gray-900 dark:text-gray-100 p-3 bg-gray-50 dark:bg-gray-900 rounded whitespace-pre-wrap">
                  {previewData.text_body}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={() => setShowPreview(false)} variant="secondary">
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Toolbar Button Component
function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

export default TemplateEditor;
