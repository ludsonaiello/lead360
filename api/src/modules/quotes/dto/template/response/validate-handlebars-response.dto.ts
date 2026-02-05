import { ApiProperty } from '@nestjs/swagger';

export class SecurityScanDto {
  @ApiProperty({
    description: 'Did the security scan pass?',
    example: true,
    type: Boolean,
  })
  passed: boolean;

  @ApiProperty({
    description: 'Security issues found (empty if passed)',
    example: [],
    type: [String],
  })
  issues: string[];
}

export class ValidateHandlebarsResponseDto {
  @ApiProperty({
    description: 'Is the Handlebars syntax valid?',
    example: true,
    type: Boolean,
  })
  valid: boolean;

  @ApiProperty({
    description: 'Syntax errors (empty if valid)',
    example: [],
    type: [String],
  })
  errors: string[];

  @ApiProperty({
    description: 'Non-blocking warnings',
    example: ['Variable "customer.middle_name" not found in sample data'],
    type: [String],
  })
  warnings: string[];

  @ApiProperty({
    description: 'Extracted Handlebars variables from template',
    example: ['quote.quote_number', 'quote.created_at', 'company.name', 'customer.name'],
    type: [String],
  })
  variables: string[];

  @ApiProperty({
    description: 'Security scan results',
    type: SecurityScanDto,
  })
  security_scan: SecurityScanDto;
}
