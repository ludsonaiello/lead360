import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveQuoteDto {
  @ApiPropertyOptional({
    description: 'Optional comments about the approval',
    example: 'Approved - looks good',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000, { message: 'comments must be at most 1000 characters' })
  comments?: string;
}
