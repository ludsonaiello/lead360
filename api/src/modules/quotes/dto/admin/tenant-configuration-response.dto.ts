import { ApiProperty } from '@nestjs/swagger';

/**
 * QuoteConfigurationDto
 *
 * Quote-related configuration for the tenant
 */
export class QuoteConfigurationDto {
  @ApiProperty({
    example: 'uuid-123',
    nullable: true,
    description: 'Active template ID (or null)',
  })
  active_template_id: string | null;

  @ApiProperty({
    example: 'Professional Template',
    nullable: true,
    description: 'Active template name (or null)',
  })
  active_template_name: string | null;

  @ApiProperty({
    example: 15.5,
    nullable: true,
    description: 'Default profit margin percentage',
  })
  default_profit_margin: number | null;

  @ApiProperty({
    example: 10.0,
    nullable: true,
    description: 'Default overhead percentage (mapped from default_overhead_rate)',
  })
  default_overhead: number | null;

  @ApiProperty({
    example: 30,
    description: 'Quote expiration days',
  })
  quote_expiration_days: number;

  @ApiProperty({
    example: [{ threshold: 10000, requires_approval: true }],
    description: 'Approval thresholds (JSON array)',
    isArray: true,
  })
  approval_thresholds: any[];
}

/**
 * CustomResourcesDto
 *
 * Count of custom resources created by tenant
 */
export class CustomResourcesDto {
  @ApiProperty({
    example: 12,
    description: 'Number of custom unit measurements',
  })
  custom_units: number;

  @ApiProperty({
    example: 3,
    description: 'Number of custom quote templates',
  })
  custom_templates: number;
}

/**
 * FeatureFlagsDto
 *
 * Feature flags for the tenant
 */
export class FeatureFlagsDto {
  @ApiProperty({
    example: true,
    description: 'Whether quotes module is enabled',
  })
  quotes_enabled: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether approval workflow is enabled (based on approval_thresholds)',
  })
  approval_workflow_enabled: boolean;
}

/**
 * TenantConfigurationResponseDto
 *
 * Response for tenant configuration overview
 */
export class TenantConfigurationResponseDto {
  @ApiProperty({ example: 'abc-123-def-456', description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  tenant_name: string;

  @ApiProperty({
    type: QuoteConfigurationDto,
    description: 'Quote-related configuration',
  })
  quote_configuration: QuoteConfigurationDto;

  @ApiProperty({
    type: CustomResourcesDto,
    description: 'Custom resources count',
  })
  custom_resources: CustomResourcesDto;

  @ApiProperty({ type: FeatureFlagsDto, description: 'Feature flags' })
  feature_flags: FeatureFlagsDto;
}
