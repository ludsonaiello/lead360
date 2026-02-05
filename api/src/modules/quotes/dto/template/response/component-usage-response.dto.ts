import { ApiProperty } from '@nestjs/swagger';

export class ComponentUsageResponseDto {
  @ApiProperty({
    description: 'Number of templates using this component',
    example: 5,
    type: Number,
  })
  usage_count: number;

  @ApiProperty({
    description: 'Array of template UUIDs using this component',
    example: ['template-uuid-1', 'template-uuid-2', 'template-uuid-3'],
    type: [String],
  })
  templates: string[];
}
