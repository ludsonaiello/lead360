import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class MoveItemToGroupDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Target quote group UUID (null to move to ungrouped)',
    nullable: true,
  })
  @IsUUID()
  @IsOptional()
  quote_group_id: string | null;
}
