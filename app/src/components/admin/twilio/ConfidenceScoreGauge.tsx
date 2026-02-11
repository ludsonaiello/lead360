/**
 * Confidence Score Gauge Component
 * Sprint 4: Transcription Monitoring
 * Visual gauge display for transcription confidence scores
 */

'use client';

import React from 'react';

interface ConfidenceScoreGaugeProps {
  score: string | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceScoreGauge({ score, size = 'md' }: ConfidenceScoreGaugeProps) {
  const scoreValue = score ? parseFloat(score) : null;

  const sizeConfig = {
    sm: { width: 120, height: 80, strokeWidth: 8, fontSize: 16 },
    md: { width: 160, height: 100, strokeWidth: 10, fontSize: 20 },
    lg: { width: 200, height: 120, strokeWidth: 12, fontSize: 24 },
  };

  const config = sizeConfig[size];
  const radius = (config.width - config.strokeWidth) / 2;
  const circumference = Math.PI * radius; // Half circle

  // Determine color based on score
  const getScoreColor = (value: number) => {
    if (value >= 90) return { color: '#10b981', label: 'Excellent', bgClass: 'text-green-600 dark:text-green-400' };
    if (value >= 75) return { color: '#f59e0b', label: 'Good', bgClass: 'text-yellow-600 dark:text-yellow-400' };
    if (value >= 50) return { color: '#ef4444', label: 'Fair', bgClass: 'text-orange-600 dark:text-orange-400' };
    return { color: '#dc2626', label: 'Poor', bgClass: 'text-red-600 dark:text-red-400' };
  };

  if (scoreValue === null) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <div className="text-gray-400 dark:text-gray-500 text-center">
          <p className="text-sm font-medium">Confidence Score</p>
          <p className="text-xs mt-1">N/A</p>
        </div>
      </div>
    );
  }

  const scoreConfig = getScoreColor(scoreValue);
  const dashOffset = circumference - (scoreValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <svg
        width={config.width}
        height={config.height}
        viewBox={`0 0 ${config.width} ${config.height}`}
        className="transform"
      >
        {/* Background arc */}
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}
             A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className="text-gray-200 dark:text-gray-700"
        />

        {/* Progress arc */}
        <path
          d={`M ${config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}
             A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2} ${config.height - config.strokeWidth / 2}`}
          fill="none"
          stroke={scoreConfig.color}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000 ease-out"
        />

        {/* Score text */}
        <text
          x={config.width / 2}
          y={config.height - config.strokeWidth - 10}
          textAnchor="middle"
          className="font-bold fill-current text-gray-900 dark:text-gray-100"
          style={{ fontSize: config.fontSize }}
        >
          {scoreValue.toFixed(1)}%
        </text>
      </svg>

      {/* Label */}
      <div className="mt-2 text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Confidence Score</p>
        <span
          className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${scoreConfig.bgClass}`}
        >
          {scoreConfig.label}
        </span>
      </div>
    </div>
  );
}

export default ConfidenceScoreGauge;
