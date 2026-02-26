// ============================================================================
// JSON Schema Parser Utility
// ============================================================================
// Parse JSON Schema and generate form field metadata for dynamic forms
// ============================================================================

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'enum';
  label: string;
  description?: string;
  default?: any;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  required: boolean;
}

/**
 * Parse JSON Schema string and extract field definitions
 * Handles JSON Schema format used by Voice AI providers
 */
export function parseConfigSchema(schemaString: string | null): SchemaField[] {
  if (!schemaString) return [];

  try {
    const schema = JSON.parse(schemaString);

    // Handle invalid or empty schemas
    if (!schema || typeof schema !== 'object' || !schema.properties) {
      return [];
    }

    const fields: SchemaField[] = [];
    const required = schema.required || [];

    // Iterate through properties
    Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
      const field: SchemaField = {
        name: key,
        type: value.type || 'string',
        label: formatLabel(key),
        description: value.description,
        default: value.default,
        required: required.includes(key),
      };

      // Handle enum (select dropdown)
      if (value.enum && Array.isArray(value.enum)) {
        field.type = 'enum';
        field.enum = value.enum;
      }

      // Handle number constraints
      if (value.type === 'number' || value.type === 'integer') {
        field.minimum = value.minimum;
        field.maximum = value.maximum;
      }

      fields.push(field);
    });

    return fields;
  } catch (error) {
    console.error('[parseConfigSchema] Failed to parse schema:', error);
    return [];
  }
}

/**
 * Convert snake_case or camelCase to Title Case
 */
function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build config object from form values
 */
export function buildConfigFromFields(
  fields: SchemaField[],
  values: Record<string, any>
): string {
  const config: Record<string, any> = {};

  fields.forEach((field) => {
    const value = values[field.name];

    // Skip if value is undefined or empty string for non-required fields
    if (value === undefined || value === '') {
      if (field.default !== undefined) {
        config[field.name] = field.default;
      }
      return;
    }

    // Convert types
    if (field.type === 'number' || field.type === 'integer') {
      config[field.name] = Number(value);
    } else if (field.type === 'boolean') {
      config[field.name] = Boolean(value);
    } else {
      config[field.name] = value;
    }
  });

  return Object.keys(config).length > 0 ? JSON.stringify(config) : '';
}

/**
 * Parse config string and extract field values
 */
export function parseConfigToFields(
  configString: string | null,
  fields: SchemaField[]
): Record<string, any> {
  if (!configString) return {};

  try {
    const config = JSON.parse(configString);
    const values: Record<string, any> = {};

    fields.forEach((field) => {
      if (config[field.name] !== undefined) {
        values[field.name] = config[field.name];
      } else if (field.default !== undefined) {
        values[field.name] = field.default;
      }
    });

    return values;
  } catch (error) {
    console.error('[parseConfigToFields] Failed to parse config:', error);
    return {};
  }
}
