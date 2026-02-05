import { ApiProperty } from '@nestjs/swagger';

export class TemplateBasicInfoDto {
  @ApiProperty({
    description: 'Template unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Template name',
    example: 'Modern Professional Quote',
  })
  name: string;

  @ApiProperty({
    description: 'Template type',
    example: 'visual',
    enum: ['visual', 'code'],
  })
  template_type: string;
}
