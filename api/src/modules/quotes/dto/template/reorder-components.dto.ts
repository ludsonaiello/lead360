import { IsArray, IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderComponentsDto {
  @ApiProperty({
    description: 'Array of component IDs in new order',
    example: ['comp-id-1', 'comp-id-3', 'comp-id-2'],
    type: [String]
  })
  @IsArray()
  @IsString({ each: true })
  component_order: string[];

  @ApiProperty({
    description: 'Section to reorder',
    enum: ['header', 'body', 'footer'],
    example: 'body'
  })
  @IsString()
  @IsIn(['header', 'body', 'footer'])
  section: 'header' | 'body' | 'footer';
}
