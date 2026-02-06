import { IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewComponentDto {
  @ApiProperty({
    description: 'Component properties to render with',
    example: { company_name: 'Test Company', show_logo: true },
  })
  @IsObject()
  props: any;

  @ApiPropertyOptional({
    description: 'Sample data to override defaults',
    example: { quote: { total: 5000 } },
  })
  @IsObject()
  @IsOptional()
  sample_data?: any;
}
