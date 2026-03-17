/**
 * Portal Shell
 * Branded wrapper for all customer portal pages.
 * Fetches tenant branding and applies colors dynamically.
 */

'use client';

import React from 'react';
import { Building2, Phone, Mail, Globe, Facebook, Instagram, Youtube, Music2 } from 'lucide-react';
import { buildFileUrl } from '@/lib/api/files';
import { sanitizeHexColor } from '@/lib/utils/portal';
import type { PortalBranding } from '@/lib/types/portal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface PortalShellProps {
  children: React.ReactNode;
  branding: PortalBranding | null;
  brandingLoading: boolean;
}

function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned[0] === '1') {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}

export function PortalShell({ children, branding, brandingLoading }: PortalShellProps) {
  const primaryColor = sanitizeHexColor(branding?.primary_color, '#1e40af');
  const logoUrl = branding?.logo_url ? buildFileUrl(branding.logo_url) : null;

  if (brandingLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <style jsx global>{`
        .portal-primary { color: ${primaryColor}; }
        .portal-primary-bg { background-color: ${primaryColor}; }
        .portal-primary-border { border-color: ${primaryColor}; }
        .portal-primary-bg-light { background-color: ${primaryColor}10; }
        .portal-btn-primary {
          background-color: ${primaryColor};
          color: white;
          transition: opacity 0.2s;
        }
        .portal-btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .portal-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .portal-link { color: ${primaryColor}; }
        .portal-link:hover { opacity: 0.8; }
      `}</style>

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={branding?.company_name || 'Company'}
                className="h-10 sm:h-12 w-auto object-contain"
              />
            ) : (
              <div
                className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">
                {branding?.company_name || 'Customer Portal'}
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">Customer Portal</p>
            </div>
          </div>

          {branding?.phone && (
            <a
              href={`tel:${branding.phone}`}
              className="flex items-center gap-1.5 text-sm font-medium portal-link"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">{formatPhone(branding.phone)}</span>
            </a>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center gap-3 text-sm text-gray-500">
            {branding?.company_name && (
              <p className="font-semibold text-gray-700">
                {branding.company_name}
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-4">
              {branding?.phone && (
                <a href={`tel:${branding.phone}`} className="flex items-center gap-1 portal-link">
                  <Phone className="w-3.5 h-3.5" />
                  {formatPhone(branding.phone)}
                </a>
              )}
              {branding?.email && (
                <a href={`mailto:${branding.email}`} className="flex items-center gap-1 portal-link">
                  <Mail className="w-3.5 h-3.5" />
                  {branding.email}
                </a>
              )}
              {branding?.website && (
                <a
                  href={branding.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 portal-link"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {branding.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {branding?.address && (
              <p className="text-gray-400 text-xs">
                {branding.address.line1}
                {branding.address.line2 ? `, ${branding.address.line2}` : ''}
                {', '}
                {branding.address.city}, {branding.address.state} {branding.address.zip_code}
              </p>
            )}

            {/* Social media */}
            {branding?.social_media && Object.values(branding.social_media).some(Boolean) && (
              <div className="flex items-center gap-4 mt-1">
                {branding.social_media.facebook && (
                  <a href={branding.social_media.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <Facebook className="w-5 h-5" style={{ color: primaryColor }} />
                  </a>
                )}
                {branding.social_media.instagram && (
                  <a href={branding.social_media.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <Instagram className="w-5 h-5" style={{ color: primaryColor }} />
                  </a>
                )}
                {branding.social_media.youtube && (
                  <a href={branding.social_media.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                    <Youtube className="w-5 h-5" style={{ color: primaryColor }} />
                  </a>
                )}
                {branding.social_media.tiktok && (
                  <a href={branding.social_media.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                    <Music2 className="w-5 h-5" style={{ color: primaryColor }} />
                  </a>
                )}
              </div>
            )}

            <p className="text-gray-300 text-xs mt-2">
              Powered by Lead360
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
