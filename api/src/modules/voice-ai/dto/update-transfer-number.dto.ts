import { PartialType } from '@nestjs/swagger';
import { CreateTransferNumberDto } from './create-transfer-number.dto';

export class UpdateTransferNumberDto extends PartialType(
  CreateTransferNumberDto,
) {}
