/**
 * LeadStatsWidget Component
 * Display lead statistics and breakdown
 */

'use client';

import React from 'react';
import { Users, TrendingUp, Target, XCircle } from 'lucide-react';
import type { LeadStatsResponse } from '@/lib/types/leads';

interface LeadStatsWidgetProps {
  stats: LeadStatsResponse;
  loading?: boolean;
  className?: string;
}

export function LeadStatsWidget({ stats, loading = false, className = '' }: LeadStatsWidgetProps) {
  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  const totalLeads = stats.total;
  const leadCount = stats.by_status.lead || 0;
  const prospectCount = stats.by_status.prospect || 0;
  const customerCount = stats.by_status.customer || 0;
  const lostCount = stats.by_status.lost || 0;

  // Calculate conversion rate (customers / total leads that reached customer or lost status)
  const convertedOrLost = customerCount + lostCount;
  const conversionRate = convertedOrLost > 0 ? ((customerCount / convertedOrLost) * 100).toFixed(1) : '0.0';

  const statCards = [
    {
      label: 'Total Leads',
      value: totalLeads.toLocaleString(),
      icon: Users,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/10',
    },
    {
      label: 'Active Leads',
      value: leadCount.toLocaleString(),
      icon: Target,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/10',
    },
    {
      label: 'Prospects',
      value: prospectCount.toLocaleString(),
      icon: TrendingUp,
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/10',
    },
    {
      label: 'Customers',
      value: customerCount.toLocaleString(),
      icon: Users,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/10',
    },
  ];

  return (
    <div className={className}>
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className={`${stat.bgColor} rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">{stat.label}</span>
                <div className={`${stat.color} p-2 rounded-lg`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Conversion Rate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Conversion Rate</span>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600 dark:text-green-500">{conversionRate}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {customerCount} of {convertedOrLost} converted
          </p>
        </div>

        {/* Lost Leads */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Lost Leads</span>
            <XCircle className="w-5 h-5 text-gray-600 dark:text-gray-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{lostCount.toLocaleString()}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {convertedOrLost > 0 ? ((lostCount / convertedOrLost) * 100).toFixed(1) : '0.0'}% of concluded leads
          </p>
        </div>
      </div>
    </div>
  );
}

export default LeadStatsWidget;
