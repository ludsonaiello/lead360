/**
 * Card Components
 * Reusable card components for dashboard with centralized theming
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800
        border-2 border-gray-200 dark:border-gray-700
        rounded-card
        shadow-soft
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="px-6 py-5 border-b-2 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {description && (
            <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

interface CardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  );
}

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div className={`px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t-2 border-gray-200 dark:border-gray-700 rounded-b-card ${className}`}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    trend: 'up' | 'down' | 'neutral';
  };
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, icon }: StatCardProps) {
  const getTrendColor = () => {
    if (!change) return '';
    switch (change.trend) {
      case 'up':
        return 'text-success-600 dark:text-success-400';
      case 'down':
        return 'text-danger-600 dark:text-danger-400';
      case 'neutral':
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTrendBg = () => {
    if (!change) return '';
    switch (change.trend) {
      case 'up':
        return 'bg-success-50 dark:bg-success-900/20';
      case 'down':
        return 'bg-danger-50 dark:bg-danger-900/20';
      case 'neutral':
        return 'bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              {title}
            </p>
            <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">
              {value}
            </p>
            {change && (
              <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${getTrendBg()} ${getTrendColor()}`}>
                {change.trend === 'up' && (
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                )}
                {change.trend === 'down' && (
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {change.value}
              </div>
            )}
          </div>
          {icon && (
            <div className="flex-shrink-0 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <div className="text-brand-600 dark:text-brand-400">
                {icon}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default Card;
