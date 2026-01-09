/**
 * SMTP Settings Form Component
 * Configure platform SMTP settings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { EmailSettings, UpdateEmailSettingsDto, SmtpEncryption } from '@/lib/types/jobs';
import { Eye, EyeOff, Mail, Info } from 'lucide-react';

interface SmtpSettingsFormProps {
  settings: EmailSettings | null;
  onSave: (data: UpdateEmailSettingsDto) => Promise<void>;
  onTest: (email: string) => Promise<void>;
  isSaving: boolean;
  isTesting: boolean;
  className?: string;
}

export function SmtpSettingsForm({
  settings,
  onSave,
  onTest,
  isSaving,
  isTesting,
  className = '',
}: SmtpSettingsFormProps) {
  const [formData, setFormData] = useState<UpdateEmailSettingsDto>({
    smtp_host: '',
    smtp_port: 587,
    smtp_encryption: 'tls',
    smtp_username: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showTestModal, setShowTestModal] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    if (settings) {
      setFormData({
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_encryption: settings.smtp_encryption,
        smtp_username: settings.smtp_username,
        smtp_password: '', // Don't populate password (masked in API)
        from_email: settings.from_email,
        from_name: settings.from_name,
      });
    }
  }, [settings]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.smtp_host) {
      newErrors.smtp_host = 'SMTP host is required';
    }

    if (!formData.smtp_port || formData.smtp_port < 1 || formData.smtp_port > 65535) {
      newErrors.smtp_port = 'Port must be between 1 and 65535';
    }

    if (!formData.smtp_username) {
      newErrors.smtp_username = 'Username is required';
    }

    if (!formData.smtp_password && !settings) {
      // Password required for new config
      newErrors.smtp_password = 'Password is required';
    }

    if (formData.smtp_password && formData.smtp_password.length < 8) {
      newErrors.smtp_password = 'Password must be at least 8 characters';
    }

    if (!formData.from_email) {
      newErrors.from_email = 'From email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.from_email)) {
      newErrors.from_email = 'Invalid email address';
    }

    if (!formData.from_name) {
      newErrors.from_name = 'From name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    await onSave(formData);
  };

  const handleTestEmailClick = () => {
    setTestEmail('');
    setShowTestModal(true);
  };

  const handleTestEmailSubmit = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      return;
    }
    await onTest(testEmail);
    setShowTestModal(false);
    setTestEmail('');
  };

  const encryptionOptions = [
    { value: 'none', label: 'None' },
    { value: 'tls', label: 'TLS (recommended)' },
    { value: 'ssl', label: 'SSL' },
  ];

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {/* SMTP Host */}
      <Input
        label="SMTP Host"
        value={formData.smtp_host}
        onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
        placeholder="smtp.gmail.com"
        error={errors.smtp_host}
        required
      />

      {/* SMTP Port & Encryption */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Port"
          type="number"
          value={formData.smtp_port}
          onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) || 587 })}
          placeholder="587"
          error={errors.smtp_port}
          required
        />
        <Select
          label="Encryption"
          value={formData.smtp_encryption}
          onChange={(value) => setFormData({ ...formData, smtp_encryption: value as SmtpEncryption })}
          options={encryptionOptions}
          required
        />
      </div>

      {/* Username */}
      <Input
        label="Username"
        value={formData.smtp_username}
        onChange={(e) => setFormData({ ...formData, smtp_username: e.target.value })}
        placeholder="your-email@example.com"
        error={errors.smtp_username}
        required
      />

      {/* Password */}
      <div className="relative">
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={formData.smtp_password}
          onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
          placeholder={settings ? '••••••••' : 'App-specific password'}
          error={errors.smtp_password}
          required={!settings}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-9 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* From Email */}
      <Input
        label="From Email"
        type="email"
        value={formData.from_email}
        onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
        placeholder="noreply@lead360.app"
        error={errors.from_email}
        required
      />

      {/* From Name */}
      <Input
        label="From Name"
        value={formData.from_name}
        onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
        placeholder="Lead360"
        error={errors.from_name}
        required
      />

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-2">
            <p className="font-semibold">Common SMTP Settings:</p>
            <div>
              <p className="font-medium">Gmail:</p>
              <ul className="list-disc list-inside ml-2">
                <li>Host: smtp.gmail.com</li>
                <li>Port: 587 (TLS)</li>
                <li>Password: Use app-specific password (not Gmail password)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">Office 365:</p>
              <ul className="list-disc list-inside ml-2">
                <li>Host: smtp.office365.com</li>
                <li>Port: 587 (TLS)</li>
                <li>Password: Account password</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="secondary"
          onClick={handleTestEmailClick}
          disabled={isTesting}
        >
          <Mail className="w-4 h-4 mr-1" />
          {isTesting ? 'Sending...' : 'Send Test Email'}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Test Email Modal */}
      <Modal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        title="Send Test Email"
        size="sm"
      >
        <ModalContent>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Enter an email address to receive a test email and verify your SMTP settings.
          </p>
          <Input
            label="Email Address"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="your-email@example.com"
            required
            autoFocus
          />
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => setShowTestModal(false)}
            disabled={isTesting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleTestEmailSubmit}
            disabled={isTesting || !testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)}
          >
            <Mail className="w-4 h-4 mr-1" />
            {isTesting ? 'Sending...' : 'Send Test'}
          </Button>
        </ModalActions>
      </Modal>
    </form>
  );
}

export default SmtpSettingsForm;
