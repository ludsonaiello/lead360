/**
 * MetricCard Component
 * Animated metric card with counter, sparkline, and growth indicator
 */

'use client';

import React from 'react';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  format?: 'number' | 'percentage' | 'currency' | 'storage';
  growth?: {
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
  sparkline?: number[];
  icon?: React.ReactNode;
  status?: 'healthy' | 'warning' | 'critical' | 'unhealthy';
}

export default function MetricCard({
  title,
  value,
  format = 'number',
  growth,
  sparkline,
  icon,
  status,
}: MetricCardProps) {
  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4" />;
      case 'down':
        return <TrendingDown className="w-4 h-4" />;
      default:
        return <Minus className="w-4 h-4" />;
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      case 'down':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/30';
    }
  };

  const getStatusColor = (statusValue?: string) => {
    switch (statusValue) {
      case 'healthy':
        return 'border-green-500/20 bg-green-50/50 dark:bg-green-900/10';
      case 'warning':
        return 'border-yellow-500/20 bg-yellow-50/50 dark:bg-yellow-900/10';
      case 'critical':
      case 'unhealthy':
        return 'border-red-500/20 bg-red-50/50 dark:bg-red-900/10';
      default:
        return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
    }
  };

  const formatValue = (val: number) => {
    switch (format) {
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'currency':
        return `$${val.toLocaleString()}`;
      case 'storage':
        return `${val.toFixed(2)} GB`;
      default:
        return val.toLocaleString();
    }
  };

  const sparklineData = sparkline?.map((value, index) => ({
    index,
    value,
  })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg border p-6 shadow-sm hover:shadow-md transition-shadow ${getStatusColor(status)}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
        {icon && (
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            <CountUp
              end={value}
              duration={1}
              separator=","
              decimals={format === 'percentage' ? 1 : 0}
              suffix={format === 'percentage' ? '%' : ''}
              prefix={format === 'currency' ? '$' : ''}
            />
            {format === 'storage' && <span className="text-xl ml-1">GB</span>}
          </p>

          {growth && (
            <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-medium ${getTrendColor(growth.trend)}`}>
              {getTrendIcon(growth.trend)}
              <span>{growth.percentage > 0 ? '+' : ''}{growth.percentage.toFixed(1)}%</span>
              <span className="text-gray-500 dark:text-gray-400">
                ({growth.count > 0 ? '+' : ''}{growth.count})
              </span>
            </div>
          )}
        </div>

        {sparkline && sparkline.length > 0 && (
          <div className="w-24 h-12" style={{ minWidth: 96, minHeight: 48 }}>
            <ResponsiveContainer width={96} height={48}>
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={growth?.trend === 'up' ? '#10b981' : growth?.trend === 'down' ? '#ef4444' : '#6b7280'}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={800}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
