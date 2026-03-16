import { IsString, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum TaskDependencyTypeEnum {
  finish_to_start = 'finish_to_start',
  start_to_start = 'start_to_start',
  finish_to_finish = 'finish_to_finish',
}

export class CreateTaskDependencyDto {
  @ApiProperty({
    description: 'UUID of the task that this task depends on (prerequisite)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  @IsUUID()
  depends_on_task_id: string;

  @ApiProperty({
    description: 'Type of dependency relationship',
    enum: TaskDependencyTypeEnum,
    example: 'finish_to_start',
  })
  @IsEnum(TaskDependencyTypeEnum)
  dependency_type: TaskDependencyTypeEnum;
}
