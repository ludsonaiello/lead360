'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Briefcase, AlertCircle, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as tenantApi from '@/lib/api/tenant';
import { Industry } from '@/lib/types/tenant';

export function IndustriesSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);

  useEffect(() => {
    loadIndustries();
  }, []);

  const loadIndustries = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use getAssignedIndustries to get tenant's assigned industries
      const assignedIndustries = await tenantApi.getAssignedIndustries();
      setIndustries(assignedIndustries);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load industries');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <AlertCircle className="h-5 w-5" />
          <h3 className="font-semibold">Error Loading Industries</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadIndustries}
          className="mt-3"
        >
          Try Again
        </Button>
      </Card>
    );
  }

  // Main content
  return (
    <Card className="p-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Business Industries
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Helps the Voice AI agent understand your business type and services
      </p>

      {/* Content: Empty state or industries badges */}
      {industries.length === 0 ? (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No industries selected</AlertTitle>
          <AlertDescription>
            Industries help the AI agent understand your business context.
            You can manage industries in Business Settings.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <Badge
              key={industry.id}
              variant="gray"
              className="text-sm px-3 py-1"
            >
              {industry.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Edit Industries Link */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/settings/business"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          Edit Industries →
        </Link>
      </div>
    </Card>
  );
}