import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';

export class RunDiagnosticsQueryDto {
  @ApiProperty({
    description: 'Type of diagnostic tests to run',
    enum: ['all', 'pdf', 'email', 'storage', 'database', 'cache'],
    example: 'all',
    required: false,
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['all', 'pdf', 'email', 'storage', 'database', 'cache'], {
    message:
      'Invalid test type. Must be: all, pdf, email, storage, database, or cache',
  })
  test_type?: 'all' | 'pdf' | 'email' | 'storage' | 'database' | 'cache';
}

export class DiagnosticTestResultDto {
  @ApiProperty({
    description: 'Name of the diagnostic test',
    example: 'PDF Generation Test',
  })
  test_name: string;

  @ApiProperty({
    description: 'Test result status',
    enum: ['pass', 'fail'],
    example: 'pass',
  })
  status: 'pass' | 'fail';

  @ApiProperty({
    description: 'Test duration in milliseconds',
    example: 2350,
  })
  duration_ms: number;

  @ApiProperty({
    description: 'Error message if test failed',
    example: 'Connection timeout',
    required: false,
  })
  error_message?: string;
}

export class DiagnosticsResponseDto {
  @ApiProperty({
    description: 'Test suite name',
    example: 'System Diagnostics',
  })
  test_suite: string;

  @ApiProperty({
    description: 'Total number of tests run',
    example: 5,
  })
  tests_run: number;

  @ApiProperty({
    description: 'Number of tests that passed',
    example: 4,
  })
  passed: number;

  @ApiProperty({
    description: 'Number of tests that failed',
    example: 1,
  })
  failed: number;

  @ApiProperty({
    description: 'Array of test results',
    type: [DiagnosticTestResultDto],
  })
  results: DiagnosticTestResultDto[];
}
