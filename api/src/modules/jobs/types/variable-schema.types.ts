/**
 * Variable Schema Types for Email Templates
 * Defines the structure and metadata for template variables
 */

export enum VariableCategory {
  USER = 'user',
  TENANT = 'tenant',
  SUBSCRIPTION = 'subscription',
  BILLING = 'billing',
  SYSTEM = 'system',
  PORTAL = 'portal',
  CUSTOM = 'custom',
}

export enum VariableDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  URL = 'url',
  EMAIL = 'email',
  PHONE = 'phone',
  CURRENCY = 'currency',
  ARRAY = 'array',
  OBJECT = 'object',
}

export interface VariableSchemaField {
  name: string;
  type: VariableDataType;
  category: VariableCategory;
  description: string;
  example: string | number | boolean;
  required: boolean;
  format?: string; // For dates: 'YYYY-MM-DD', for currency: '$0.00'
  default_value?: any;
}

export type VariableSchema = Record<string, VariableSchemaField>;
