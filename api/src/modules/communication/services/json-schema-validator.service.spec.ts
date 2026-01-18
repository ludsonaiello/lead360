import { Test, TestingModule } from '@nestjs/testing';
import { JsonSchemaValidatorService } from './json-schema-validator.service';

describe('JsonSchemaValidatorService', () => {
  let service: JsonSchemaValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JsonSchemaValidatorService],
    }).compile();

    service = module.get<JsonSchemaValidatorService>(
      JsonSchemaValidatorService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validate', () => {
    it('should validate a simple schema successfully', () => {
      const schema = {
        type: 'object',
        properties: {
          api_key: { type: 'string' },
        },
        required: ['api_key'],
      };

      const data = { api_key: 'test-key-123' };

      const result = service.validate(schema, data);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should fail validation when required field is missing', () => {
      const schema = {
        type: 'object',
        properties: {
          api_key: { type: 'string' },
        },
        required: ['api_key'],
      };

      const data = {};

      const result = service.validate(schema, data);

      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0].field).toBe('api_key');
    });

    it('should coerce number to string when type coercion is enabled', () => {
      const schema = {
        type: 'object',
        properties: {
          api_key: { type: 'string' },
        },
        required: ['api_key'],
      };

      const data = { api_key: 12345 };

      const result = service.validate(schema, data);

      // Type coercion is enabled, so number becomes string
      expect(result.valid).toBe(true);
      expect(data.api_key).toBe('12345');
    });

    it('should validate nested objects', () => {
      const schema = {
        type: 'object',
        properties: {
          credentials: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              password: { type: 'string' },
            },
            required: ['username', 'password'],
          },
        },
        required: ['credentials'],
      };

      const data = {
        credentials: {
          username: 'user',
          password: 'pass',
        },
      };

      const result = service.validate(schema, data);

      expect(result.valid).toBe(true);
    });

    it('should validate email format', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
        },
        required: ['email'],
      };

      const validData = { email: 'test@example.com' };
      const invalidData = { email: 'not-an-email' };

      expect(service.validate(schema, validData).valid).toBe(true);
      expect(service.validate(schema, invalidData).valid).toBe(false);
    });

    it('should cache compiled schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          test: { type: 'string' },
        },
      };

      const data1 = { test: 'value1' };
      const data2 = { test: 'value2' };

      // First validation compiles and caches
      const result1 = service.validate(schema, data1);
      // Second validation uses cached schema
      const result2 = service.validate(schema, data2);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it('should coerce types when enabled', () => {
      const schema = {
        type: 'object',
        properties: {
          port: { type: 'number' },
        },
      };

      const data = { port: '587' }; // String that should be coerced to number

      const result = service.validate(schema, data);

      expect(result.valid).toBe(true);
    });

    it('should apply default values', () => {
      const schema = {
        type: 'object',
        properties: {
          timeout: { type: 'number', default: 30 },
        },
      };

      const data = {};

      service.validate(schema, data);

      expect(data).toHaveProperty('timeout', 30);
    });
  });
});
