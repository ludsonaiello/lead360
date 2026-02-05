import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserBasicInfoDto {
  @ApiProperty({
    description: 'User unique identifier',
    example: '770e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: '[email protected]',
  })
  email: string;

  @ApiPropertyOptional({
    description: 'User full name',
    example: 'John Doe',
    type: String,
    nullable: true,
  })
  name: string | null;
}
