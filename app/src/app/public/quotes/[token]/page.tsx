/**
 * Public Quote Viewer Page
 * Allows customers to view quotes without authentication
 * Supports password protection and view tracking
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Calendar,
  DollarSign,
  MapPin,
  Phone,
  Mail,
  Building2,
  User,
  Lock,
  Eye,
  X,
  Check,
  AlertCircle,
  FileImage,
  Link as LinkIcon,
  Grid3x3,
  Image as ImageIcon,
  Instagram,
  Facebook,
  Youtube,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import type { PublicQuote } from '@/lib/types/quotes';
import type { File as FileType } from '@/lib/types/files';
import { viewPublicQuote, logQuoteView, logQuoteDownload } from '@/lib/api/quote-public-access';
import { buildFileUrl, getFile } from '@/lib/api/files';

export default function PublicQuoteViewerPage() {
  const params = useParams();
  const token = params?.token as string;

  console.log('[PUBLIC QUOTE PAGE] Component mounted:', {
    token,
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR',
    timestamp: new Date().toISOString()
  });

  const [quote, setQuote] = useState<PublicQuote | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [viewStartTime] = useState(() => Date.now());

  useEffect(() => {
    console.log('[PUBLIC QUOTE PAGE] useEffect triggered:', {
      token,
      timestamp: new Date().toISOString()
    });

    if (token) {
      console.log('[PUBLIC QUOTE PAGE] Loading quote...');
      loadQuote();
    }
  }, [token]);

  // Track page visibility (pause tracking when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Send heartbeat every 30 seconds (only when visible)
  useEffect(() => {
    if (!quote || !isVisible) return;

    const interval = setInterval(async () => {
      const durationSeconds = Math.floor((Date.now() - viewStartTime) / 1000);

      try {
        await logQuoteView(token, { duration_seconds: durationSeconds });
        console.log('[PUBLIC QUOTE PAGE] Heartbeat sent:', durationSeconds, 'seconds');
      } catch (error) {
        console.error('[PUBLIC QUOTE PAGE] Failed to send heartbeat:', error);
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [quote, token, viewStartTime, isVisible]);

  // Track view duration on page unload
  useEffect(() => {
    if (!quote) return;

    const handleBeforeUnload = () => {
      const durationSeconds = Math.floor((Date.now() - viewStartTime) / 1000);
      // Use sendBeacon for reliable logging on page exit
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';
      navigator.sendBeacon(
        `${API_BASE_URL}/public/quotes/${token}/view`,
        JSON.stringify({ duration_seconds: durationSeconds })
      );
      console.log('[PUBLIC QUOTE PAGE] Final duration sent:', durationSeconds, 'seconds');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quote, token, viewStartTime]);

  // Fetch file details when quote loads
  useEffect(() => {
    if (!quote) return;

    const fetchFileDetails = async () => {
      try {
        // Fetch logo file if logo_file_id exists
        if (quote.branding?.logo_file_id) {
          console.log('[PUBLIC QUOTE PAGE] Fetching logo file:', quote.branding.logo_file_id);
          const logoFile = await getFile(quote.branding.logo_file_id);
          setLogoUrl(buildFileUrl(logoFile.url));
          console.log('[PUBLIC QUOTE PAGE] Logo file loaded:', logoFile.url);
        }

        // Fetch PDF file if pdf.file_id exists
        if (quote.pdf?.file_id) {
          console.log('[PUBLIC QUOTE PAGE] Fetching PDF file:', quote.pdf.file_id);
          const pdfFile = await getFile(quote.pdf.file_id);
          setPdfUrl(buildFileUrl(pdfFile.url));
          console.log('[PUBLIC QUOTE PAGE] PDF file loaded:', pdfFile.url);
        }
      } catch (error) {
        console.error('[PUBLIC QUOTE PAGE] Error fetching file details:', error);
        // Don't show error to user, just fail gracefully
      }
    };

    fetchFileDetails();
  }, [quote]);

  const loadQuote = async (passwordAttempt?: string) => {
    console.log('[PUBLIC QUOTE PAGE] loadQuote called:', {
      token,
      hasPassword: !!passwordAttempt,
      timestamp: new Date().toISOString()
    });

    setIsLoading(true);
    setError(null);

    try {
      console.log('[PUBLIC QUOTE PAGE] Fetching quote from API...');
      const data = await viewPublicQuote(token, passwordAttempt);
      console.log('[PUBLIC QUOTE PAGE] Quote loaded successfully');
      setQuote(data);
      setPasswordRequired(false);

      // Log initial view
      const referrer = document.referrer || undefined;
      console.log('[PUBLIC QUOTE PAGE] Logging view...');
      await logQuoteView(token, { referrer_url: referrer });
    } catch (err: any) {
      console.error('[PUBLIC QUOTE PAGE] Error loading quote:', err);

      if (err.response?.status === 401) {
        console.log('[PUBLIC QUOTE PAGE] Password required (401)');
        setPasswordRequired(true);
        setPasswordHint(err.response?.data?.password_hint || null);
      } else if (err.response?.status === 403) {
        console.log('[PUBLIC QUOTE PAGE] Forbidden (403)');
        setError('This quote link has been deactivated or has expired.');
      } else if (err.response?.status === 404) {
        console.log('[PUBLIC QUOTE PAGE] Not found (404)');
        setError('Quote not found. The link may be invalid.');
      } else if (err.response?.status === 429) {
        console.log('[PUBLIC QUOTE PAGE] Rate limited (429)');
        setError('Too many failed password attempts. Please try again in 15 minutes.');
      } else {
        console.error('[PUBLIC QUOTE PAGE] Unknown error:', err);
        setError(err.message || 'Failed to load quote. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('Please enter a password');
      return;
    }

    setIsSubmittingPassword(true);

    try {
      await loadQuote(password);
      setPassword('');
      setFailedAttempts(0);
    } catch (err: any) {
      if (err.response?.status === 401) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        toast.error(`Incorrect password. ${5 - newAttempts} attempts remaining.`);
        setPassword('');
      }
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }

    // Return as-is if not 10 digits
    return phone;
  };

  // Handle PDF download with tracking
  const handleDownloadPDF = async () => {
    try {
      // Track download event
      await logQuoteDownload(token, {
        file_id: quote?.pdf?.file_id,
      });
      console.log('[PUBLIC QUOTE PAGE] Download tracked');

      // Open PDF in new tab
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
      } else {
        toast.error('PDF not available');
      }
    } catch (error) {
      console.error('[PUBLIC QUOTE PAGE] Failed to track download:', error);
      // Don't block download if tracking fails - still open PDF
      if (pdfUrl) {
        window.open(pdfUrl, '_blank');
      }
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 dark:border-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading quote...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Unable to Load Quote
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Password Required Modal
  if (passwordRequired) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">
            Password Protected
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 text-center">
            This quote is password protected. Please enter the password to continue.
          </p>

          {passwordHint && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <span className="font-semibold">Hint:</span> {passwordHint}
              </p>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                disabled={isSubmittingPassword}
                autoFocus
              />
            </div>

            {failedAttempts > 0 && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span>{failedAttempts} failed attempt(s). {5 - failedAttempts} remaining.</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isSubmittingPassword}
              disabled={isSubmittingPassword || !password}
            >
              <Lock className="w-4 h-4 mr-2" />
              Unlock Quote
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Quote Display
  if (!quote) return null;

  // Apply tenant branding colors
  const primaryColor = quote.branding?.primary_color || '#00548E';
  const secondaryColor = quote.branding?.secondary_color || '#0087FF';
  const accentColor = quote.branding?.accent_color || '#A7A228';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <style jsx>{`
        .branded-button-primary {
          background-color: ${primaryColor};
          color: white;
        }
        .branded-button-primary:hover {
          opacity: 0.9;
        }
        .branded-border {
          border-color: ${primaryColor};
        }
        .branded-text {
          color: ${primaryColor};
        }
        .branded-bg {
          background-color: ${primaryColor}15;
        }
      `}</style>

      <div className="max-w-5xl mx-auto">
        {/* Branded Header with Company Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            {/* Company Logo and Name */}
            {logoUrl ? (
              // If logo exists, show only logo (no company name to avoid mobile conflicts)
              // Mobile: centered and full width, Desktop: full height to fill parent row
              <img
                src={logoUrl}
                alt={quote.branding?.company_name || 'Company Logo'}
                className="w-full md:w-auto h-auto md:h-full max-h-24 object-contain"
              />
            ) : (
              // If no logo, show icon + company name
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {quote.branding?.company_name || 'Company'}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Professional Quote</p>
                </div>
              </div>
            )}

            {/* Company Contact Info */}
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              {quote.branding?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                  <a href={`tel:${quote.branding.phone}`} className="hover:underline">
                    {formatPhoneNumber(quote.branding.phone)}
                  </a>
                </div>
              )}
              {quote.branding?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: primaryColor }} />
                  <a href={`mailto:${quote.branding.email}`} className="hover:underline">
                    {quote.branding.email}
                  </a>
                </div>
              )}
              {quote.branding?.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5" style={{ color: primaryColor }} />
                  <span>
                    {typeof quote.branding.address === 'string'
                      ? quote.branding.address
                      : (() => {
                          const addr = quote.branding.address as any;
                          const parts = [
                            addr.line1,
                            addr.line2,
                            [addr.city, addr.state, addr.zip_code].filter(Boolean).join(', '),
                          ].filter(Boolean);
                          return parts.join(', ');
                        })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quote Title and Number */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8" style={{ color: primaryColor }} />
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {quote.title}
                </h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Quote #{quote.quote_number}</p>
            </div>

            {/* View PDF Button */}
            {pdfUrl && (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-opacity hover:opacity-90 w-full md:w-auto"
                style={{ backgroundColor: primaryColor, color: 'white' }}
              >
                <Eye className="w-5 h-5" />
                View PDF
              </button>
            )}
          </div>

          {quote.description && (
            <p className="text-gray-700 dark:text-gray-300 mt-4 whitespace-pre-wrap">{quote.description}</p>
          )}
        </div>

        {/* Valid Until */}
        {quote.valid_until && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <Calendar className="w-5 h-5" />
              <p className="font-semibold">
                Valid until: {formatDate(quote.valid_until)}
              </p>
            </div>
          </div>
        )}

        {/* Customer & Jobsite Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Customer Info */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Customer Information
              </h2>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900 dark:text-white font-semibold">
                  {quote.customer.first_name} {quote.customer.last_name}
                </p>
              </div>

              {quote.customer.company_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {quote.customer.company_name}
                  </p>
                </div>
              )}

              {quote.customer.emails && quote.customer.emails.length > 0 && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a
                    href={`mailto:${quote.customer.emails.find(e => e.is_primary)?.email || quote.customer.emails[0].email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {quote.customer.emails.find(e => e.is_primary)?.email || quote.customer.emails[0].email}
                  </a>
                </div>
              )}

              {quote.customer.phones && quote.customer.phones.length > 0 && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a
                    href={`tel:${quote.customer.phones.find(p => p.is_primary)?.phone || quote.customer.phones[0].phone}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {formatPhoneNumber(quote.customer.phones.find(p => p.is_primary)?.phone || quote.customer.phones[0].phone)}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Jobsite Address */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Jobsite Address
              </h2>
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-300">
              <p className="font-semibold">{quote.jobsite_address.address_line1}</p>
              {quote.jobsite_address.address_line2 && (
                <p>{quote.jobsite_address.address_line2}</p>
              )}
              <p>
                {quote.jobsite_address.city}, {quote.jobsite_address.state}{' '}
                {quote.jobsite_address.zip_code}
              </p>
            </div>
          </div>
        </div>

        {/* Quote Items */}
        {quote.items && quote.items.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Quote Items
            </h2>

            <div className="space-y-4">
              {(() => {
                const sortedItems = quote.items.sort((a, b) => a.display_order - b.display_order);
                let currentGroup: string | null = null;

                return sortedItems.map((item) => {
                  const isNewGroup = item.group && item.group.id !== currentGroup;
                  if (item.group) {
                    currentGroup = item.group.id;
                  }

                  return (
                    <div key={item.id}>
                      {isNewGroup && item.group && (
                        <div className="mb-2 mt-4 first:mt-0">
                          <h3 className="font-bold text-gray-900 dark:text-white mb-1">
                            {item.group.name}
                          </h3>
                          {item.group.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                              {item.group.description}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                              {item.description}
                            </p>
                          )}
                        </div>

                        <div className="text-right ml-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {item.quantity} {item.unit}
                          </p>
                          <p className="font-bold text-gray-900 dark:text-white">
                            {formatCurrency(item.total_cost)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Price Summary */}
        <div className={`grid grid-cols-1 gap-4 mb-6 ${quote.total_discount > 0 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Subtotal</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(quote.subtotal)}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Tax</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatCurrency(quote.total_tax)}
            </p>
          </div>

          {quote.total_discount > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Discount</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                -{formatCurrency(quote.total_discount)}
              </p>
            </div>
          )}

          <div className="rounded-lg shadow p-4" style={{ backgroundColor: primaryColor }}>
            <p className="text-sm text-white opacity-90 mb-1">Total</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(quote.total_price)}
            </p>
          </div>
        </div>

        {/* Draw Schedule */}
        {quote.draw_schedule && quote.draw_schedule.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: primaryColor }} />
              Draw Schedule
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 dark:border-gray-700" style={{ borderColor: primaryColor }}>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-white">Description</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">Percentage</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-900 dark:text-white">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.draw_schedule
                    .sort((a, b) => a.draw_number - b.draw_number)
                    .map((draw, index) => (
                      <tr
                        key={draw.id}
                        className={`border-b dark:border-gray-700 ${
                          index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                          {draw.description}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                          {draw.percentage}%
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(draw.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payment Instructions */}
        {quote.payment_instructions && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5" style={{ color: primaryColor }} />
              Payment Instructions
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {quote.payment_instructions}
              </p>
            </div>
          </div>
        )}

        {/* Terms and Conditions */}
        {quote.terms_and_conditions && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: primaryColor }} />
              Terms and Conditions
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {quote.terms_and_conditions}
              </p>
            </div>
          </div>
        )}

        {/* Estimator */}
        {quote.vendor && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5" style={{ color: primaryColor }} />
              Estimator
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-gray-400" />
                <p className="text-gray-900 dark:text-white font-semibold">{quote.vendor.name}</p>
              </div>
              {quote.vendor.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a
                    href={`mailto:${quote.vendor.email}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {quote.vendor.email}
                  </a>
                </div>
              )}
              {quote.vendor.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a
                    href={`tel:${quote.vendor.phone}`}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {formatPhoneNumber(quote.vendor.phone)}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Attachments */}
        {quote.attachments && quote.attachments.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Attachments
            </h2>

            <div className="space-y-4">
              {quote.attachments.map((attachment) => {
                // Cover Photo
                if (attachment.attachment_type === 'cover_photo' && attachment.file) {
                  return (
                    <div key={attachment.id} className="rounded-lg overflow-hidden">
                      <img
                        src={buildFileUrl(attachment.file?.url)}
                        alt={attachment.title || 'Cover photo'}
                        className="w-full h-auto"
                      />
                      {attachment.title && (
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {attachment.title}
                        </p>
                      )}
                    </div>
                  );
                }

                // Full Page Photo
                if (attachment.attachment_type === 'full_page_photo' && attachment.file) {
                  return (
                    <div key={attachment.id} className="rounded-lg overflow-hidden">
                      <img
                        src={buildFileUrl(attachment.file?.url)}
                        alt={attachment.title || 'Photo'}
                        className="w-full h-auto"
                      />
                      {attachment.title && (
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {attachment.title}
                        </p>
                      )}
                    </div>
                  );
                }

                // Grid Photo
                if (attachment.attachment_type === 'grid_photo' && attachment.file) {
                  return (
                    <div key={attachment.id} className="rounded-lg overflow-hidden">
                      <img
                        src={buildFileUrl(attachment.file?.url)}
                        alt={attachment.title || 'Grid photo'}
                        className="w-full h-auto"
                      />
                      {attachment.title && (
                        <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                          {attachment.title}
                        </p>
                      )}
                    </div>
                  );
                }

                // URL Attachment with QR Code
                if (attachment.attachment_type === 'url_attachment' && attachment.url) {
                  return (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg"
                    >
                      {attachment.qr_code_file && (
                        <img
                          src={buildFileUrl(attachment.qr_code_file?.url)}
                          alt="QR Code"
                          className="w-24 h-24"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-white mb-1">
                          {attachment.title || 'Link'}
                        </p>
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                        >
                          {attachment.url}
                        </a>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        )}

        {/* PO Number */}
        {quote.po_number && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5" style={{ color: primaryColor }} />
              Purchase Order
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              PO Number: <span className="font-semibold">{quote.po_number}</span>
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Thank you for your interest! If you have any questions, please contact us.
            </p>
            {quote.branding && (
              <div className="flex flex-col items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <p className="font-semibold" style={{ color: primaryColor }}>
                  {quote.branding.company_name}
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {quote.branding.phone && (
                    <a href={`tel:${quote.branding.phone}`} className="hover:underline" style={{ color: primaryColor }}>
                      {formatPhoneNumber(quote.branding.phone)}
                    </a>
                  )}
                  {quote.branding.email && (
                    <a href={`mailto:${quote.branding.email}`} className="hover:underline" style={{ color: primaryColor }}>
                      {quote.branding.email}
                    </a>
                  )}
                </div>
                {quote.branding.website && (
                  <a
                    href={quote.branding.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                    style={{ color: secondaryColor }}
                  >
                    {quote.branding.website}
                  </a>
                )}
                {/* Social Media Icons */}
                {quote.branding.social_media && Object.keys(quote.branding.social_media).length > 0 && (
                  <div className="flex items-center justify-center gap-4 mt-4">
                    {quote.branding.social_media.facebook && (
                      <a
                        href={quote.branding.social_media.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 dark:text-gray-400 hover:opacity-70 transition-opacity"
                        aria-label="Facebook"
                      >
                        <Facebook className="w-6 h-6" style={{ color: primaryColor }} />
                      </a>
                    )}
                    {quote.branding.social_media.instagram && (
                      <a
                        href={quote.branding.social_media.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 dark:text-gray-400 hover:opacity-70 transition-opacity"
                        aria-label="Instagram"
                      >
                        <Instagram className="w-6 h-6" style={{ color: primaryColor }} />
                      </a>
                    )}
                    {quote.branding.social_media.youtube && (
                      <a
                        href={quote.branding.social_media.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 dark:text-gray-400 hover:opacity-70 transition-opacity"
                        aria-label="YouTube"
                      >
                        <Youtube className="w-6 h-6" style={{ color: primaryColor }} />
                      </a>
                    )}
                    {quote.branding.social_media.tiktok && (
                      <a
                        href={quote.branding.social_media.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-600 dark:text-gray-400 hover:opacity-70 transition-opacity"
                        aria-label="TikTok"
                      >
                        <Globe className="w-6 h-6" style={{ color: primaryColor }} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-gray-500 dark:text-gray-500 text-xs text-center">
            Powered by <span className="font-semibold">Lead360</span>
          </p>
        </div>
      </div>
    </div>
  );
}
