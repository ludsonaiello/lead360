import { IsOptional, IsString, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectPhotoDto {
  @ApiPropertyOptional({
    description: 'Updated caption for the photo',
    example: 'Updated: Foundation pour complete — east wing',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional({
    description: 'Whether this photo is visible on the customer portal',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_public?: boolean;
}
