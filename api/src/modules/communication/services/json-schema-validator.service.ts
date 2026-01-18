import { Injectable, Logger } from '@nestjs/common';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

export interface ValidationResult {
  valid: boolean;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * JSON Schema Validation Service
 *
 * Validates provider credentials and configuration against JSON Schemas
 * using AJV (Another JSON Schema Validator)
 */
@Injectable()
export class JsonSchemaValidatorService {
  private readonly logger = new Logger(JsonSchemaValidatorService.name);
  private readonly ajv: Ajv;
  private readonly schemaCache = new Map<string, ValidateFunction>();

  constructor() {
    // Initialize AJV with recommended settings
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors, not just the first
      coerceTypes: true, // Convert types if possible
      useDefaults: true, // Set default values from schema
      removeAdditional: false, // Don't remove additional properties
    });

    // Add format validators (email, uri, date-time, etc.)
    addFormats(this.ajv);

    this.logger.log('JSON Schema Validator initialized');
  }

  /**
   * Validate data against a JSON Schema
   *
   * @param schema JSON Schema object
   * @param data Data to validate
   * @returns Validation result with errors if validation fails
   */
  validate(schema: object, data: object): ValidationResult {
    try {
      // Use cache to avoid recompiling schemas
      const cacheKey = JSON.stringify(schema);
      let validateFn = this.schemaCache.get(cacheKey);

      if (!validateFn) {
        validateFn = this.ajv.compile(schema);
        this.schemaCache.set(cacheKey, validateFn);
        this.logger.debug('Schema compiled and cached');
      }

      const valid = validateFn(data);

      if (!valid) {
        const errors = (validateFn.errors || []).map((err) => ({
          field:
            err.instancePath.replace(/^\//, '').replace(/\//g, '.') ||
            err.params.missingProperty ||
            'unknown',
          message: err.message || 'Validation failed',
        }));

        this.logger.debug(`Validation failed: ${JSON.stringify(errors)}`);

        return {
          valid: false,
          errors,
        };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('Schema validation error', error.stack);
      return {
        valid: false,
        errors: [
          {
            field: 'schema',
            message: 'Invalid JSON Schema or data format',
          },
        ],
      };
    }
  }

  /**
   * Clear schema cache (useful for testing)
   */
  clearCache(): void {
    this.schemaCache.clear();
    this.logger.debug('Schema cache cleared');
  }

  /**
   * Get cache size (useful for monitoring)
   */
  getCacheSize(): number {
    return this.schemaCache.size;
  }
}
