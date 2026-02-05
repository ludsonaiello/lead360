/**
 * Quote Template Testing Page
 * Test PDF generation and email sending for templates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { FileText, Mail, Download } from 'lucide-react';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';
import {
  listTemplates,
  testTemplatePdf,
  testTemplateEmail,
} from '@/lib/api/quote-admin-templates';
import type { QuoteTemplate } from '@/lib/types/quote-admin';

export default function TemplateTestingPage() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [testData, setTestData] = useState('{\n  "customer_name": "Test Customer",\n  "quote_number": "Q-12345",\n  "total": 5000\n}');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [emailRecipient, setEmailRecipient] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const result = await listTemplates({ is_active: true, limit: 100 });
      setTemplates(result.data);
      if (result.data.length > 0) {
        setSelectedTemplate(result.data[0].id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    try {
      setPdfLoading(true);
      const sampleData = JSON.parse(testData);
      const result = await testTemplatePdf(selectedTemplate, { sample_data: sampleData });
      setPdfUrl(result.pdf_url);
      setSuccessMessage(`PDF generated successfully! Link expires at ${new Date(result.expires_at).toLocaleString()}`);
      setSuccessModalOpen(true);
    } catch (error: any) {
      if (error.message.includes('JSON')) {
        toast.error('Invalid JSON in test data');
      } else {
        toast.error(error.message || 'Failed to generate PDF');
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!selectedTemplate) {
      toast.error('Please select a template');
      return;
    }

    if (!emailRecipient.trim()) {
      toast.error('Please enter recipient email');
      return;
    }

    try {
      setEmailLoading(true);
      const sampleData = JSON.parse(testData);
      const result = await testTemplateEmail(selectedTemplate, {
        recipient_email: emailRecipient,
        sample_data: sampleData,
      });
      setSuccessMessage(`Test email sent successfully to ${result.recipient_email}!`);
      setSuccessModalOpen(true);
    } catch (error: any) {
      if (error.message.includes('JSON')) {
        toast.error('Invalid JSON in test data');
      } else {
        toast.error(error.message || 'Failed to send email');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" centered />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Template Testing</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Test PDF generation and email sending with sample data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Configuration
            </h3>
            <div className="space-y-4">
              {/* Template Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Test Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Test Data (JSON)
                </label>
                <Textarea
                  value={testData}
                  onChange={(e) => setTestData(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder='{"customer_name": "Test", ...}'
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter sample data in JSON format
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-6">
          {/* PDF Testing */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              PDF Testing
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Generate a test PDF using the selected template and sample data.
              </p>
              <Button
                onClick={handleGeneratePdf}
                loading={pdfLoading}
                className="w-full"
              >
                <FileText className="w-4 h-4" />
                Generate Test PDF
              </Button>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </a>
              )}
            </div>
          </Card>

          {/* Email Testing */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Testing
            </h3>
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Send a test email with the generated quote to verify formatting.
              </p>
              <Input
                label="Recipient Email"
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="test@example.com"
                required
              />
              <Button
                onClick={handleSendTestEmail}
                loading={emailLoading}
                className="w-full"
              >
                <Mail className="w-4 h-4" />
                Send Test Email
              </Button>
            </div>
          </Card>

          {/* Preview */}
          {pdfUrl && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                PDF Preview
              </h3>
              <iframe
                src={pdfUrl}
                className="w-full h-96 border border-gray-200 dark:border-gray-700 rounded-lg"
                title="PDF Preview"
              />
            </Card>
          )}
        </div>
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="Success"
      >
        <ModalContent>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-gray-700 dark:text-gray-300">{successMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={() => setSuccessModalOpen(false)}>Close</Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
