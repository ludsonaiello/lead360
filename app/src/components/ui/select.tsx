/**
 * Select Component (lowercase export)
 * Shadcn/ui compatible wrapper around our Select component
 */

'use client';

import React, { createContext, useContext, useState } from 'react';
import { Select as BaseSelect, SelectOption } from './Select';

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = createContext<SelectContextType>({});

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, children }: SelectProps) {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      {children}
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <>{placeholder}</>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  const { value, onValueChange } = useContext(SelectContext);

  // Extract SelectItem children and convert to options
  const options: SelectOption[] = [];

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.props.value) {
      options.push({
        value: child.props.value,
        label: typeof child.props.children === 'string'
          ? child.props.children
          : child.props.value,
      });
    }
  });

  return (
    <BaseSelect
      options={options}
      value={value}
      onChange={onValueChange}
      searchable={false}
    />
  );
}

export function SelectItem({ children, value }: { children: React.ReactNode; value: string }) {
  // This is just a placeholder - actual rendering happens in SelectContent
  return null;
}
