import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, voice_ai_provider } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateProviderDto } from '../dto/create-provider.dto';
import { UpdateProviderDto } from '../dto/update-provider.dto';

/**
 * VoiceAiProvidersService
 *
 * Manages the AI provider registry (Deepgram, OpenAI, Cartesia).
 * Platform admin only — no tenant isolation required (admin-managed table).
 */
@Injectable()
export class VoiceAiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<voice_ai_provider[]> {
    return this.prisma.voice_ai_provider.findMany({
      orderBy: [{ provider_type: 'asc' }, { display_name: 'asc' }],
    });
  }

  async findById(id: string): Promise<voice_ai_provider> {
    const provider = await this.prisma.voice_ai_provider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException(`Provider ${id} not found`);
    }
    return provider;
  }

  async create(dto: CreateProviderDto): Promise<voice_ai_provider> {
    const existing = await this.prisma.voice_ai_provider.findUnique({
      where: { provider_key: dto.provider_key },
    });
    if (existing) {
      throw new ConflictException(
        `Provider key '${dto.provider_key}' already exists`,
      );
    }
    return this.prisma.voice_ai_provider.create({ data: dto });
  }

  async update(
    id: string,
    dto: UpdateProviderDto,
  ): Promise<voice_ai_provider> {
    await this.findById(id); // throws NotFoundException if not found
    try {
      return await this.prisma.voice_ai_provider.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Provider key '${dto.provider_key}' already exists`,
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.findById(id); // throws 404 if not found
    try {
      await this.prisma.voice_ai_provider.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new UnprocessableEntityException(
          'Cannot delete this provider — it is referenced by existing credentials or usage records. Remove those first.',
        );
      }
      throw error;
    }
  }
}
