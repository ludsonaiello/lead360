'use client';

import React, { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { useRBAC } from '@/contexts/RBACContext';
import {
  DollarSign,
  Receipt,
  Clock,
  FileText,
  BarChart3,
  AlertTriangle,
  CreditCard,
  Milestone,
} from 'lucide-react';
import FinancialOverview from './FinancialOverview';
import CostEntryTable from './CostEntryTable';
import ReceiptSection from './ReceiptSection';
import CrewHoursSection from './CrewHoursSection';
import InvoiceSection from './InvoiceSection';
import ProjectInvoicesSection from './ProjectInvoicesSection';
import PaymentSection from './PaymentSection';
import MilestonesSection from './MilestonesSection';

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
  { id: 'milestones', label: 'Milestones', icon: Milestone },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
];

export default function FinancialTab({ projectId }: FinancialTabProps) {
  const { hasRole } = useRBAC();
  const canView = hasRole(['Owner', 'Admin', 'Manager', 'Bookkeeper']);
  const storageKey = `financial-subtab-${projectId}`;
  const [activeSubTab, setActiveSubTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(storageKey);
      if (stored && FINANCIAL_TABS.some((t) => t.id === stored)) return stored;
    }
    return 'overview';
  });

  // Persist active sub-tab in sessionStorage (not URL hash — hash belongs to top-level Tabs)
  useEffect(() => {
    sessionStorage.setItem(storageKey, activeSubTab);
  }, [activeSubTab, storageKey]);

  if (!canView) {
    return (
      <Card className="p-12 text-center mt-6">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
        <p className="text-gray-500 dark:text-gray-400">You do not have permission to view financial data.</p>
      </Card>
    );
  }

  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'overview':
        return <FinancialOverview projectId={projectId} />;
      case 'costs':
        return <CostEntryTable projectId={projectId} onDataChange={() => {}} />;
      case 'receipts':
        return <ReceiptSection projectId={projectId} onDataChange={() => {}} />;
      case 'crew-hours':
        return <CrewHoursSection projectId={projectId} onDataChange={() => {}} />;
      case 'milestones':
        return <MilestonesSection projectId={projectId} onDataChange={() => {}} />;
      case 'invoices':
        return (
          <div className="space-y-6">
            <ProjectInvoicesSection projectId={projectId} onDataChange={() => {}} />
            <InvoiceSection projectId={projectId} onDataChange={() => {}} />
          </div>
        );
      case 'payments':
        return <PaymentSection projectId={projectId} onDataChange={() => {}} />;
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
