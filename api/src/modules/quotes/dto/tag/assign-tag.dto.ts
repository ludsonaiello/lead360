import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayMinSize } from 'class-validator';

/**
 * AssignTagDto
 *
 * Assigns one or more tags to a quote
 *
 * @author Backend Developer
 */
export class AssignTagDto {
  @ApiProperty({
    description: 'Array of tag IDs to assign',
    example: ['tag-uuid-1', 'tag-uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  tag_ids: string[];
}
