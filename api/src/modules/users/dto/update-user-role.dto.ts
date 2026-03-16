import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserRoleDto {
  @ApiProperty({ description: 'UUID of the new role to assign' })
  @IsUUID()
  role_id: string;
}
