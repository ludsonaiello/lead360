/**
 * Wizard Component
 * Multi-step form wrapper with progress indicator and navigation
 */

'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface WizardStep {
  id: string;
  label: string;
  isValid?: boolean;
}

interface WizardProps {
  steps: WizardStep[];
  currentStep: number;
  onNext?: () => void;
  onPrevious?: () => void;
  onFinish?: () => void;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Wizard({
  steps,
  currentStep,
  onNext,
  onPrevious,
  onFinish,
  canGoNext = true,
  canGoPrevious = true,
  isLoading = false,
  children,
  className = '',
}: WizardProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className={`w-full ${className}`}>
      {/* Progress indicator */}
      <div className="mb-8">
        {/* Step labels */}
        <div className="flex justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 ${
                index === currentStep
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : index < currentStep
                  ? 'text-green-600 dark:text-green-400 font-medium'
                  : 'text-gray-500 dark:text-gray-400 font-medium'
              }`}
            >
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2
                  ${
                    index === currentStep
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : index < currentStep
                      ? 'bg-green-100 dark:bg-green-900/30 border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                {index + 1}
              </div>
              <span className="hidden sm:inline text-sm">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step counter */}
        <p className="text-center text-sm text-gray-600 dark:text-gray-400 font-medium mt-3">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      {/* Step content */}
      <div className="mb-8">{children}</div>

      {/* Navigation buttons */}
      <div className="flex justify-between items-center gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onPrevious}
          disabled={isFirstStep || !canGoPrevious || isLoading}
          className={isFirstStep ? 'invisible' : ''}
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            variant="primary"
            onClick={onFinish}
            disabled={!canGoNext || isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save & Finish'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            onClick={onNext}
            disabled={!canGoNext || isLoading}
            loading={isLoading}
          >
            Next
            <ChevronRight className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default Wizard;
