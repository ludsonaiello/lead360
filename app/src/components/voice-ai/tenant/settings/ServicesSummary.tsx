'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wrench, AlertCircle, Loader2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import * as tenantApi from '@/lib/api/tenant';
import { Service } from '@/lib/types/tenant';

export function ServicesSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use getAssignedServices to get tenant's assigned services
      const assignedServices = await tenantApi.getAssignedServices();
      setServices(assignedServices);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load services');
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
          <h3 className="font-semibold">Error Loading Services</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadServices}
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
          <Wrench className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Services Offered
          </h3>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Helps the Voice AI agent understand what services your business provides
      </p>

      {/* Content: Empty state or services badges */}
      {services.length === 0 ? (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No services selected</AlertTitle>
          <AlertDescription>
            Services help the AI agent understand what your business offers.
            You can manage services in Business Settings.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap gap-2">
          {services.map((service) => (
            <Badge
              key={service.id}
              variant="gray"
              className="text-sm px-3 py-1"
            >
              {service.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Edit Services Link */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Link
          href="/settings/business"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
        >
          Edit Services →
        </Link>
      </div>
    </Card>
  );
}
