/**
 * Shared Template Variable Types
 * Used by Communication Module, Jobs Module, and any other module that needs template variables
 */

export enum VariableCategory {
  USER = 'user',
  TENANT = 'tenant',
  CUSTOMER = 'customer',
  LEAD = 'lead',
  QUOTE = 'quote',
  INVOICE = 'invoice',
  APPOINTMENT = 'appointment',
  JOB = 'job',
  PAYMENT = 'payment',
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export enum VariableDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
  CURRENCY = 'currency',
}

export interface VariableDefinition {
  name: string;
  type: VariableDataType;
  category: VariableCategory;
  description: string;
  example: any;
  required?: boolean;
  format?: string;
  is_custom?: boolean;
  tenant_id?: string | null;
}

export interface VariableRegistry {
  [variableName: string]: VariableDefinition;
}

export interface VariablesByCategory {
  [category: string]: {
    [variableName: string]: Omit<VariableDefinition, 'category'>;
  };
}
