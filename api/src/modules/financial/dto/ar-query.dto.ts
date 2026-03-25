import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ArQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by invoice status (draft, sent, partial, paid)',
    example: 'sent',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Return only overdue invoices',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  overdue_only?: boolean = false;
}
