import { PartialType } from '@nestjs/swagger';
import { CreateCustomHoursDto } from './create-custom-hours.dto';

export class UpdateCustomHoursDto extends PartialType(CreateCustomHoursDto) {}
