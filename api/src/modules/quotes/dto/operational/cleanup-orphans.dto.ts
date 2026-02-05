import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class CleanupOrphansDto {
  @ApiProperty({
    description: 'Dry run mode - only count orphans without deleting',
    example: true,
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;

  @ApiProperty({
    description: 'Type of orphaned entities to clean up',
    enum: ['items', 'groups', 'attachments', 'all'],
    example: 'all',
  })
  @IsEnum(['items', 'groups', 'attachments', 'all'], {
    message:
      'Invalid entity type. Must be: items, groups, attachments, or all',
  })
  entity_type: 'items' | 'groups' | 'attachments' | 'all';
}

export class OrphanDetailDto {
  @ApiProperty({
    description: 'Type of orphaned entity',
    example: 'quote_item',
  })
  entity_type: string;

  @ApiProperty({
    description: 'Count of orphaned records',
    example: 15,
  })
  count: number;
}

export class CleanupOrphansResponseDto {
  @ApiProperty({
    description: 'Whether this was a dry run',
    example: true,
  })
  dry_run: boolean;

  @ApiProperty({
    description: 'Total number of orphans found',
    example: 25,
  })
  orphans_found: number;

  @ApiProperty({
    description: 'Total number of orphans deleted (0 if dry run)',
    example: 0,
  })
  orphans_deleted: number;

  @ApiProperty({
    description: 'Breakdown of orphans by entity type',
    type: [OrphanDetailDto],
  })
  details: OrphanDetailDto[];
}
