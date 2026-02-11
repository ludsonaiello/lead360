/**
 * Radio Group Component
 * Radio button group for form inputs
 */

'use client';

import React from 'react';

interface RadioGroupProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface RadioGroupItemProps {
  value: string;
  id?: string;
  className?: string;
}

export function RadioGroup({ value, onValueChange, children, className = '' }: RadioGroupProps) {
  return (
    <div className={`space-y-2 ${className}`} role="radiogroup">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            checked: child.props.value === value,
            onChange: () => onValueChange?.(child.props.value),
          } as any);
        }
        return child;
      })}
    </div>
  );
}

export function RadioGroupItem({ value, id, className = '', ...props }: RadioGroupItemProps & any) {
  return (
    <input
      type="radio"
      id={id}
      value={value}
      className={`
        h-4 w-4 border-gray-300 dark:border-gray-600
        text-blue-600 dark:text-blue-500
        focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400
        ${className}
      `}
      {...props}
    />
  );
}
