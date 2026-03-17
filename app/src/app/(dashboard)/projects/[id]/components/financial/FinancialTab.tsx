'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import { useRBAC } from '@/contexts/RBACContext';
import { getProjectSummary } from '@/lib/api/projects';
import type { ProjectFinancialSummary } from '@/lib/types/projects';
import {
  DollarSign,
  Receipt,
  Clock,
  FileText,
  BarChart3,
  AlertTriangle,
  CreditCard,
} from 'lucide-react';
import CostSummaryCard from './CostSummaryCard';
import CostEntryTable from './CostEntryTable';
import ReceiptSection from './ReceiptSection';
import CrewHoursSection from './CrewHoursSection';
import InvoiceSection from './InvoiceSection';
import PaymentSection from './PaymentSection';
import FinancialCharts from './FinancialCharts';

interface FinancialTabProps {
  projectId: string;
}

interface SubTabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const FINANCIAL_TABS: SubTabItem[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'costs', label: 'Costs', icon: DollarSign },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'crew-hours', label: 'Crew Hours', icon: Clock },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
];

export default function FinancialTab({ projectId }: FinancialTabProps) {
  const { hasRole } = useRBAC();
  const canView = hasRole(['Owner', 'Admin', 'Manager']);
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState('overview');

  const loadSummary = useCallback(async () => {
    try {
      const data = await getProjectSummary(projectId);
      setSummary(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load financial summary');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleDataChange = () => {
    loadSummary();
  };

  if (!canView) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to view financial data.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="mt-6">
        <LoadingSpinner size="lg" centered />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {error || 'Failed to load financial data'}
        </h3>
      </Card>
    );
  }

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <CostSummaryCard summary={summary} />
            <FinancialCharts projectId={projectId} summary={summary} />
          </div>
        );
      case 'costs':
        return <CostEntryTable projectId={projectId} onDataChange={handleDataChange} />;
      case 'receipts':
        return <ReceiptSection projectId={projectId} onDataChange={handleDataChange} />;
      case 'crew-hours':
        return <CrewHoursSection projectId={projectId} onDataChange={handleDataChange} />;
      case 'invoices':
        return <InvoiceSection projectId={projectId} onDataChange={handleDataChange} />;
      case 'payments':
        return <PaymentSection projectId={projectId} onDataChange={handleDataChange} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 mt-6">
      {/* Sub-tabs */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg min-w-max">
          {FINANCIAL_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab content */}
      {renderSubTabContent()}
    </div>
  );
}
