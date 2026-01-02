import { PartialType } from '@nestjs/swagger';
import { CreateLicenseTypeDto } from './create-license-type.dto';

export class UpdateLicenseTypeDto extends PartialType(CreateLicenseTypeDto) {}
