/**
 * Send Quote Modal Component
 * Complete modal for sending quotes via email
 * Combines recipient selection, custom message, and email preview
 */

'use client';

import React, { useState } from 'react';
import { X, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { SendQuoteResponse } from '@/lib/types/quotes';
import { sendQuote, parseEmailList } from '@/lib/api/quote-email';
import { RecipientSelector } from './RecipientSelector';
import { EmailPreview } from './EmailPreview';

interface SendQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  quoteNumber: string;
  quoteTitle: string;
  quoteTotal: number;
  customerEmail?: string;
  companyName?: string;
  onSuccess: (response: SendQuoteResponse) => void;
}

export function SendQuoteModal({
  isOpen,
  onClose,
  quoteId,
  quoteNumber,
  quoteTitle,
  quoteTotal,
  customerEmail,
  companyName,
  onSuccess,
}: SendQuoteModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [customSubject, setCustomSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sentResponse, setSentResponse] = useState<SendQuoteResponse | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setRecipientEmail('');
    setCcEmails('');
    setCustomSubject('');
    setCustomMessage('');
    setShowSuccess(false);
    setSentResponse(null);
  };

  const handleClose = () => {
    if (!isSending) {
      handleReset();
      onClose();
    }
  };

  const validateForm = () => {
    // Use customer email as default if no recipient specified
    const finalRecipient = recipientEmail || customerEmail;

    if (!finalRecipient) {
      toast.error('Please enter a recipient email address');
      return false;
    }

    // Validate recipient email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalRecipient)) {
      toast.error('Invalid recipient email address');
      return false;
    }

    // Validate CC emails if provided
    if (ccEmails) {
      try {
        parseEmailList(ccEmails);
      } catch (error: any) {
        toast.error(error.message);
        return false;
      }
    }

    // Validate custom subject length
    if (customSubject.length > 200) {
      toast.error('Custom subject must be 200 characters or less');
      return false;
    }

    // Validate custom message length
    if (customMessage.length > 1000) {
      toast.error('Custom message must be 1000 characters or less');
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    setIsSending(true);

    try {
      const sendData: any = {};

      // Add recipient if specified (otherwise defaults to lead's email)
      if (recipientEmail) {
        sendData.recipient_email = recipientEmail;
      }

      // Add CC emails if specified
      if (ccEmails) {
        sendData.cc_emails = parseEmailList(ccEmails);
      }

      // Add custom subject if specified
      if (customSubject) {
        sendData.custom_subject = customSubject;
      }

      // Add custom message if specified
      if (customMessage) {
        sendData.custom_message = customMessage;
      }

      const response = await sendQuote(quoteId, sendData);
      setSentResponse(response);
      setShowSuccess(true);
      toast.success('Quote sent successfully!');
      onSuccess(response);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send quote');
    } finally {
      setIsSending(false);
    }
  };

  const remainingChars = 1000 - customMessage.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {showSuccess ? 'Quote Sent!' : 'Send Quote'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isSending}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {!showSuccess ? (
            <>
              {/* Quote Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-blue-700 dark:text-blue-300 font-semibold">
                      Quote Number
                    </p>
                    <p className="text-blue-900 dark:text-blue-100">{quoteNumber}</p>
                  </div>
                  <div>
                    <p className="text-blue-700 dark:text-blue-300 font-semibold">Total</p>
                    <p className="text-blue-900 dark:text-blue-100 text-lg font-bold">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(quoteTotal)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Form */}
                <div className="space-y-4">
                  {/* Recipient Selection */}
                  <RecipientSelector
                    recipientEmail={recipientEmail}
                    ccEmails={ccEmails}
                    onRecipientChange={setRecipientEmail}
                    onCcChange={setCcEmails}
                    defaultEmail={customerEmail}
                    disabled={isSending}
                  />

                  {/* Custom Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Subject (Optional)
                    </label>
                    <input
                      type="text"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder={`Quote ${quoteNumber} - ${quoteTitle}`}
                      maxLength={200}
                      disabled={isSending}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {200 - customSubject.length} characters remaining
                    </p>
                  </div>

                  {/* Custom Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Message (Optional)
                    </label>
                    <textarea
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      placeholder="Add a personal message to the customer..."
                      maxLength={1000}
                      rows={6}
                      disabled={isSending}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Personal message will be highlighted in the email
                      </p>
                      <p
                        className={`text-xs ${
                          remainingChars < 100
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {remainingChars} characters remaining
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column: Preview */}
                <div>
                  <EmailPreview
                    quoteNumber={quoteNumber}
                    quoteTitle={quoteTitle}
                    quoteTotal={quoteTotal}
                    recipientEmail={recipientEmail || customerEmail || ''}
                    ccEmails={ccEmails}
                    customSubject={customSubject}
                    customMessage={customMessage}
                    companyName={companyName}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isSending}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSend}
                  disabled={isSending}
                  loading={isSending}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Quote
                </Button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Quote Sent Successfully!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your quote has been emailed to the customer with a PDF attachment and
                public viewing link.
              </p>

              {sentResponse && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Summary:
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <div className="flex justify-between">
                      <span>Email ID:</span>
                      <code className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {sentResponse.email_id.substring(0, 8)}...
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>PDF File:</span>
                      <code className="text-xs bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {sentResponse.pdf_file_id.substring(0, 8)}...
                      </code>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        Public URL:
                      </span>
                      <p className="text-xs break-all mt-1 font-mono">
                        {sentResponse.public_url}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SendQuoteModal;
