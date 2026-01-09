/**
 * Email Template Editor Component
 * Create/edit email templates with Handlebars variables
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { EmailTemplate, CreateEmailTemplateDto, UpdateEmailTemplateDto } from '@/lib/types/jobs';
import { Info, Plus, X, AlertTriangle, Search } from 'lucide-react';
import { VariableSelector } from './VariableSelector';

interface EmailTemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
  onSave: (data: CreateEmailTemplateDto | UpdateEmailTemplateDto, isNew: boolean) => Promise<void>;
}

export function EmailTemplateEditor({ isOpen, onClose, template, onSave }: EmailTemplateEditorProps) {
  const [templateKey, setTemplateKey] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [newVariable, setNewVariable] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showVariableSelector, setShowVariableSelector] = useState(false);

  useEffect(() => {
    if (template) {
      setTemplateKey(template.template_key);
      setSubject(template.subject);
      setHtmlBody(template.html_body);
      setTextBody(template.text_body || '');
      setVariables(template.variables);
      setDescription(template.description || '');
    } else {
      resetForm();
    }
  }, [template]);

  const resetForm = () => {
    setTemplateKey('');
    setSubject('');
    setHtmlBody('');
    setTextBody('');
    setVariables([]);
    setDescription('');
    setNewVariable('');
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!templateKey && !template) {
      newErrors.templateKey = 'Template key is required';
    } else if (templateKey && templateKey.length < 3) {
      newErrors.templateKey = 'Template key must be at least 3 characters';
    }

    if (!subject || subject.length < 3) {
      newErrors.subject = 'Subject is required (min 3 characters)';
    }

    if (!htmlBody || htmlBody.length < 10) {
      newErrors.htmlBody = 'HTML body is required (min 10 characters)';
    }

    if (variables.length === 0) {
      newErrors.variables = 'At least one variable is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddVariable = () => {
    if (newVariable && !variables.includes(newVariable)) {
      setVariables([...variables, newVariable]);
      setNewVariable('');
    }
  };

  const handleRemoveVariable = (variable: string) => {
    setVariables(variables.filter((v) => v !== variable));
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setIsSaving(true);

      if (template) {
        // Update existing
        const data: UpdateEmailTemplateDto = {
          subject,
          html_body: htmlBody,
          text_body: textBody || undefined,
          variables,
          description: description || undefined,
        };
        await onSave(data, false);
      } else {
        // Create new
        const data: CreateEmailTemplateDto = {
          template_key: templateKey,
          subject,
          html_body: htmlBody,
          text_body: textBody || undefined,
          variables,
          description: description || undefined,
        };
        await onSave(data, true);
      }

      resetForm();
      onClose();
    } catch (err: any) {
      console.error('[EmailTemplateEditor] Error saving:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={template ? `Edit Template: ${template.template_key}` : 'Create Email Template'}
      size="xl"
    >
      <ModalContent>
        <div className="space-y-4">
          {/* System Template Warning */}
          {template?.is_system && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p className="font-semibold mb-1">Warning: Editing System Template</p>
                  <p>
                    You are editing a system template that is used for critical platform functions.
                    Changes will affect all instances where this template is used. Please ensure your
                    modifications maintain the required functionality.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Template Key (only for new templates) */}
          {!template && (
            <Input
              label="Template Key"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
              placeholder="welcome-email"
              error={errors.templateKey}
              required
            />
          )}

          {/* Subject */}
          <Input
            label="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Welcome to {{company_name}}!"
            error={errors.subject}
            required
          />

          {/* HTML Body */}
          <Textarea
            label="HTML Body"
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            placeholder="<h1>Welcome {{user_name}}!</h1>"
            rows={8}
            error={errors.htmlBody}
            required
          />

          {/* Text Body (optional) */}
          <Textarea
            label="Text Body (optional)"
            value={textBody}
            onChange={(e) => setTextBody(e.target.value)}
            placeholder="Welcome {{user_name}}!"
            rows={4}
          />

          {/* Variables */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Variables
            </label>

            {/* Browse Variables Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowVariableSelector(true)}
              className="mb-3 w-full sm:w-auto"
            >
              <Search className="w-4 h-4 mr-2" />
              Browse Available Variables
            </Button>

            {/* Selected Variables Display */}
            {errors.variables && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errors.variables}</p>
            )}

            {variables.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-3">
                {variables.map((variable) => (
                  <span
                    key={variable}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium"
                  >
                    <code>{`{{${variable}}}`}</code>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariable(variable)}
                      className="hover:text-blue-900 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                No variables selected. Click "Browse Available Variables" to discover and add variables.
              </p>
            )}

            {/* Help Text */}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Variables are placeholders replaced with actual data when emails are sent. Use {`{{variable_name}}`} syntax in subject and body.
            </p>
          </div>

          {/* Description */}
          <Textarea
            label="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this template"
            rows={2}
          />

          {/* Handlebars Guide */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300 space-y-1">
                <p className="font-semibold">Handlebars Syntax Guide:</p>
                <ul className="list-disc list-inside ml-2">
                  <li>
                    Variables: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`{{variable_name}}`}</code>
                  </li>
                  <li>Use the variables you defined above in your subject and body</li>
                  <li>Example: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`Hello {{user_name}}!`}</code></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </Button>
      </ModalActions>

      {/* Variable Selector Modal */}
      <VariableSelector
        isOpen={showVariableSelector}
        onClose={() => setShowVariableSelector(false)}
        selectedVariables={variables}
        onVariablesChange={(newVariables) => {
          setVariables(newVariables);
        }}
      />
    </Modal>
  );
}

export default EmailTemplateEditor;
