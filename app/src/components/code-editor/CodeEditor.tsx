'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import CodeEditorToolbar from './CodeEditorToolbar';
import HandlebarsVariablesPanel from './HandlebarsVariablesPanel';
import {
  createCodeTemplate,
  updateCodeTemplate,
  validateHandlebarsCode,
  previewBuilderTemplate,
  testBuilderTemplatePdf,
  testBuilderTemplateEmail,
} from '@/lib/api/template-builder';
import type {
  BuilderTemplate,
  CreateCodeTemplateDto,
  UpdateCodeTemplateDto,
  ValidateHandlebarsDto,
} from '@/lib/types/quote-admin';
import { Code, Palette, SplitSquareVertical } from 'lucide-react';

interface CodeEditorProps {
  templateId?: string;
  initialTemplate?: BuilderTemplate;
}

export default function CodeEditor({ templateId, initialTemplate }: CodeEditorProps) {
  const router = useRouter();
  const htmlEditorRef = useRef<any>(null);
  const cssEditorRef = useRef<any>(null);

  const [template, setTemplate] = useState<BuilderTemplate | null>(initialTemplate || null);
  const [htmlContent, setHtmlContent] = useState(initialTemplate?.html_content || DEFAULT_HTML);
  const [cssContent, setCssContent] = useState(initialTemplate?.css_content || DEFAULT_CSS);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showVariables, setShowVariables] = useState(true);
  const [validationErrors, setValidationErrors] = useState(0);
  const [layout, setLayout] = useState<'split' | 'html' | 'css'>('split');

  // History for undo/redo
  const [history, setHistory] = useState<Array<{ html: string; css: string }>>([
    { html: htmlContent, css: cssContent },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Add to history when content changes
  const addToHistory = useCallback(
    (html: string, css: string) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({ html, css });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setHasUnsavedChanges(true);
    },
    [history, historyIndex]
  );

  // Debounced history update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (htmlContent !== history[historyIndex]?.html || cssContent !== history[historyIndex]?.css) {
        addToHistory(htmlContent, cssContent);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [htmlContent, cssContent]);

  // Undo/Redo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHtmlContent(prev.html);
      setCssContent(prev.css);
      setHistoryIndex(historyIndex - 1);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHtmlContent(next.html);
      setCssContent(next.css);
      setHistoryIndex(historyIndex + 1);
      setHasUnsavedChanges(true);
    }
  }, [historyIndex, history]);

  // Save template
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (templateId) {
        // Update existing
        const dto: UpdateCodeTemplateDto = {
          html_content: htmlContent,
          css_content: cssContent,
        };
        const updated = await updateCodeTemplate(templateId, dto);
        setTemplate(updated);
        setHasUnsavedChanges(false);
        toast.success('Template saved successfully');
      } else {
        // Create new
        const dto: CreateCodeTemplateDto = {
          name: 'New Code Template',
          html_content: htmlContent,
          css_content: cssContent,
        };
        const created = await createCodeTemplate(dto);
        setTemplate(created);
        setHasUnsavedChanges(false);
        router.push(`/admin/quotes/templates/code-editor/${created.id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  // Validate Handlebars
  const handleValidate = async () => {
    try {
      const dto: ValidateHandlebarsDto = {
        html_content: htmlContent,
        css_content: cssContent,
      };
      const result = await validateHandlebarsCode(dto);

      if (result.is_valid) {
        setValidationErrors(0);
        toast.success('✓ Template is valid!');
      } else {
        setValidationErrors(result.errors?.length || 0);
        const errorMessages = result.errors?.map((e) => e.message).join('\n') || 'Unknown errors';
        toast.error(`Validation failed:\n${errorMessages}`);
      }
    } catch (error) {
      toast.error('Failed to validate template');
    }
  };

  // Preview
  const handlePreview = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    try {
      await previewBuilderTemplate(templateId, { sample_data: {} });
      toast.success('Preview generated');
    } catch (error) {
      toast.error('Failed to generate preview');
    }
  };

  // Test PDF
  const handleTestPdf = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    try {
      const result = await testBuilderTemplatePdf(templateId, { sample_data: {} });
      window.open(result.pdf_url, '_blank');
      toast.success('PDF generated');
    } catch (error) {
      toast.error('Failed to generate PDF');
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    if (!templateId) {
      toast.error('Save the template first');
      return;
    }

    const email = prompt('Enter email address for test:');
    if (!email) return;

    try {
      await testBuilderTemplateEmail(templateId, {
        recipient_email: email,
        sample_data: {},
      });
      toast.success(`Test email sent to ${email}`);
    } catch (error) {
      toast.error('Failed to send test email');
    }
  };

  // Insert variable into active editor
  const handleInsertVariable = (variable: string) => {
    const activeEditor = htmlEditorRef.current;
    if (!activeEditor) return;

    const selection = activeEditor.getSelection();
    const id = { major: 1, minor: 1 };
    const op = {
      identifier: id,
      range: selection,
      text: variable,
      forceMoveMarkers: true,
    };
    activeEditor.executeEdits('insert-variable', [op]);
    activeEditor.focus();
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <CodeEditorToolbar
        templateName={template?.name || 'New Code Template'}
        isSaving={isSaving}
        hasUnsavedChanges={hasUnsavedChanges}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onSave={handleSave}
        onPreview={handlePreview}
        onTestPdf={handleTestPdf}
        onTestEmail={handleTestEmail}
        onValidate={handleValidate}
        onExportVisual={() => toast('Export to visual template coming soon')}
        onVersionHistory={() => toast('Version history coming soon')}
        onSettings={() => toast('Settings coming soon')}
        onUndo={undo}
        onRedo={redo}
        onToggleVariables={() => setShowVariables(!showVariables)}
        showVariables={showVariables}
        validationErrors={validationErrors}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editors */}
        <div className="flex-1 flex flex-col bg-gray-900">
          {/* Layout Switcher */}
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex items-center gap-2">
            <button
              onClick={() => setLayout('split')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${
                  layout === 'split'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }
              `}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              Split View
            </button>
            <button
              onClick={() => setLayout('html')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${
                  layout === 'html'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }
              `}
            >
              <Code className="w-3.5 h-3.5" />
              HTML Only
            </button>
            <button
              onClick={() => setLayout('css')}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors
                ${
                  layout === 'css'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                }
              `}
            >
              <Palette className="w-3.5 h-3.5" />
              CSS Only
            </button>

            <div className="ml-auto text-xs text-gray-400">
              Press <kbd className="px-2 py-1 bg-gray-700 rounded">Ctrl+S</kbd> to save
            </div>
          </div>

          {/* Editors Container */}
          <div className="flex-1 flex overflow-hidden">
            {/* HTML Editor */}
            {(layout === 'split' || layout === 'html') && (
              <div className={layout === 'split' ? 'flex-1 border-r border-gray-700' : 'flex-1'}>
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-orange-400" />
                    <span className="text-sm font-medium text-gray-200">HTML Template</span>
                  </div>
                  <span className="text-xs text-gray-500">Handlebars syntax supported</span>
                </div>
                <Editor
                  height="100%"
                  defaultLanguage="html"
                  value={htmlContent}
                  onChange={(value) => {
                    setHtmlContent(value || '');
                    setHasUnsavedChanges(true);
                  }}
                  onMount={(editor) => {
                    htmlEditorRef.current = editor;
                    // Add Ctrl+S save shortcut
                    editor.addCommand(
                      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                      () => handleSave()
                    );
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            )}

            {/* CSS Editor */}
            {(layout === 'split' || layout === 'css') && (
              <div className={layout === 'split' ? 'flex-1' : 'flex-1'}>
                <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-200">CSS Styles</span>
                  </div>
                  <span className="text-xs text-gray-500">Optional styling</span>
                </div>
                <Editor
                  height="100%"
                  defaultLanguage="css"
                  value={cssContent}
                  onChange={(value) => {
                    setCssContent(value || '');
                    setHasUnsavedChanges(true);
                  }}
                  onMount={(editor) => {
                    cssEditorRef.current = editor;
                    // Add Ctrl+S save shortcut
                    editor.addCommand(
                      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
                      () => handleSave()
                    );
                  }}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    formatOnPaste: true,
                    formatOnType: true,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Variables Panel */}
        {showVariables && <HandlebarsVariablesPanel onInsertVariable={handleInsertVariable} />}
      </div>
    </div>
  );
}

// Default HTML template
const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quote {{quote.number}}</title>
</head>
<body>
  <div class="quote-container">
    <!-- Header -->
    <header class="quote-header">
      <h1>{{company.name}}</h1>
      <p>{{company.address}}</p>
      <p>{{company.email}} | {{company.phone}}</p>
    </header>

    <!-- Quote Info -->
    <section class="quote-info">
      <h2>Quote #{{quote.number}}</h2>
      <p>Date: {{formatDate quote.date "MMMM DD, YYYY"}}</p>
      <p>Valid Until: {{formatDate quote.expiry_date "MMMM DD, YYYY"}}</p>
    </section>

    <!-- Customer Info -->
    <section class="customer-info">
      <h3>Bill To:</h3>
      <p><strong>{{customer.name}}</strong></p>
      {{#if customer.company}}
      <p>{{customer.company}}</p>
      {{/if}}
      <p>{{customer.email}}</p>
      <p>{{customer.phone}}</p>
      <p>{{customer.address}}</p>
    </section>

    <!-- Line Items -->
    <section class="line-items">
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {{#each line_items}}
          <tr>
            <td>{{this.description}}</td>
            <td>{{this.quantity}}</td>
            <td>{{formatCurrency this.unit_price}}</td>
            <td>{{formatCurrency this.total}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
    </section>

    <!-- Totals -->
    <section class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>{{formatCurrency totals.subtotal}}</span>
      </div>
      {{#if totals.tax}}
      <div class="total-row">
        <span>Tax:</span>
        <span>{{formatCurrency totals.tax}}</span>
      </div>
      {{/if}}
      {{#if totals.discount}}
      <div class="total-row">
        <span>Discount:</span>
        <span>-{{formatCurrency totals.discount}}</span>
      </div>
      {{/if}}
      <div class="total-row grand-total">
        <span><strong>Total:</strong></span>
        <span><strong>{{formatCurrency totals.total}}</strong></span>
      </div>
    </section>

    <!-- Footer -->
    <footer class="quote-footer">
      <p>Thank you for your business!</p>
    </footer>
  </div>
</body>
</html>`;

// Default CSS
const DEFAULT_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Arial', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
}

.quote-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.quote-header {
  text-align: center;
  border-bottom: 2px solid #3b82f6;
  padding-bottom: 20px;
  margin-bottom: 30px;
}

.quote-header h1 {
  font-size: 24px;
  color: #3b82f6;
  margin-bottom: 10px;
}

.quote-info {
  margin-bottom: 30px;
}

.quote-info h2 {
  font-size: 20px;
  margin-bottom: 10px;
}

.customer-info {
  background: #f9fafb;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.customer-info h3 {
  font-size: 16px;
  margin-bottom: 10px;
  color: #3b82f6;
}

.line-items table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.line-items th,
.line-items td {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.line-items th {
  background: #3b82f6;
  color: white;
  font-weight: 600;
}

.line-items tbody tr:hover {
  background: #f9fafb;
}

.totals {
  max-width: 400px;
  margin-left: auto;
  margin-bottom: 30px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #e5e7eb;
}

.grand-total {
  border-top: 2px solid #3b82f6;
  border-bottom: 2px solid #3b82f6;
  font-size: 18px;
  margin-top: 10px;
}

.quote-footer {
  text-align: center;
  padding-top: 30px;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
}`;
