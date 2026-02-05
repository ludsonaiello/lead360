import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsBoolean, Min } from 'class-validator';

export class TemplateVersionDto {
  @ApiProperty({ description: 'Version number' })
  version: number;

  @ApiProperty({ description: 'When this version was created' })
  created_at: string;

  @ApiProperty({ description: 'User who created this version' })
  created_by: string;

  @ApiProperty({ description: 'Summary of changes made in this version' })
  changes_summary: string;

  @ApiProperty({ description: 'HTML content snapshot of this version' })
  html_content_snapshot: string;
}

export class TemplateVersionHistoryResponseDto {
  @ApiProperty({ description: 'Template ID' })
  template_id: string;

  @ApiProperty({ description: 'Current version number' })
  current_version: number;

  @ApiProperty({
    type: [TemplateVersionDto],
    description: 'Array of template versions',
  })
  versions: TemplateVersionDto[];
}

export class RestoreTemplateVersionDto {
  @ApiProperty({
    description: 'Version number to restore',
    example: 1,
  })
  @IsInt()
  @Min(1)
  version: number;

  @ApiProperty({
    default: true,
    description: 'Create backup of current version before restoring',
  })
  @IsBoolean()
  create_backup: boolean;
}

export class RestoreTemplateVersionResponseDto {
  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'New current version number after restore' })
  new_current_version: number;

  @ApiProperty({ description: 'Whether backup was created before restore' })
  backup_created: boolean;
}
