import { ApiProperty } from '@nestjs/swagger';

export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
}

export class ValidationError {
  @ApiProperty({ description: 'Line number where error occurred' })
  line: number;

  @ApiProperty({ description: 'Column number where error occurred' })
  column: number;

  @ApiProperty({ description: 'Error or warning message' })
  message: string;

  @ApiProperty({
    enum: ValidationSeverity,
    description: 'Severity level of the validation issue',
  })
  severity: ValidationSeverity;
}

export class ValidateTemplateResponseDto {
  @ApiProperty({ description: 'Whether the template is valid' })
  is_valid: boolean;

  @ApiProperty({
    type: [ValidationError],
    description: 'Array of validation errors',
  })
  errors: ValidationError[];

  @ApiProperty({
    type: [ValidationError],
    description: 'Array of validation warnings',
  })
  warnings: ValidationError[];

  @ApiProperty({
    type: [String],
    description: 'Variables referenced in template but never used',
  })
  unused_variables: string[];

  @ApiProperty({
    type: [String],
    description: 'Required variables missing from template',
  })
  missing_required_variables: string[];
}
