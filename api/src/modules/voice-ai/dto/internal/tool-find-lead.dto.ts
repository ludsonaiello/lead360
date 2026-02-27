import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FindLeadToolDto {
  @ApiProperty({ example: '+19788968047', description: 'Phone number in E.164 format' })
  @IsString()
  @IsNotEmpty()
  phone_number: string;
}

export class FindLeadToolResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  found: boolean;

  @ApiPropertyOptional()
  lead_id?: string;

  @ApiPropertyOptional()
  lead_name?: string;

  @ApiPropertyOptional()
  error?: string;
}
