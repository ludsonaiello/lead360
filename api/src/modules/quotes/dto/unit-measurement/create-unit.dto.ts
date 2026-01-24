import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUnitDto {
  @ApiProperty({ example: 'Square Foot' })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ example: 'sq ft' })
  @IsString()
  @Length(1, 20)
  abbreviation: string;
}

export class CreateGlobalUnitDto extends CreateUnitDto {}
