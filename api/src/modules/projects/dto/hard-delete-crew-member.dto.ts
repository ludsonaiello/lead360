import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class HardDeleteCrewMemberDto {
  @ApiProperty({
    description:
      "Crew member's full name ('First Last') retyped to confirm the irreversible delete.",
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  confirm_name: string;
}
