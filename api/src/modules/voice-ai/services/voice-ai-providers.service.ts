import {
  Injectable,
  NotFoundException,
  ConflictException,
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

  /**
   * List all providers, optionally filtered by type and active status.
   * Defaults to is_active = true unless explicitly set to false.
   */
  async findAll(filters?: {
    provider_type?: string;
    is_active?: boolean;
  }): Promise<voice_ai_provider[]> {
    const where: Prisma.voice_ai_providerWhereInput = {
      is_active: filters?.is_active !== undefined ? filters.is_active : true,
    };
    if (filters?.provider_type) {
      where.provider_type = filters.provider_type;
    }
    return this.prisma.voice_ai_provider.findMany({
      where,
      orderBy: [{ provider_type: 'asc' }, { display_name: 'asc' }],
    });
  }

  /**
   * Get a single provider by ID.
   * Throws NotFoundException if not found.
   */
  async findById(id: string): Promise<voice_ai_provider> {
    const provider = await this.prisma.voice_ai_provider.findUnique({
      where: { id },
    });
    if (!provider) {
      throw new NotFoundException(`Provider ${id} not found`);
    }
    return provider;
  }

  /**
   * Get a provider by its unique key (e.g. 'deepgram', 'openai', 'cartesia').
   * Returns null if not found.
   */
  async findByKey(provider_key: string): Promise<voice_ai_provider | null> {
    return this.prisma.voice_ai_provider.findUnique({
      where: { provider_key },
    });
  }

  /**
   * Create a new provider.
   * Throws ConflictException if provider_key already exists.
   */
  async create(dto: CreateProviderDto): Promise<voice_ai_provider> {
    const existing = await this.prisma.voice_ai_provider.findUnique({
      where: { provider_key: dto.provider_key },
    });
    if (existing) {
      throw new ConflictException(
        `Provider key '${dto.provider_key}' already exists`,
      );
    }
    try {
      return await this.prisma.voice_ai_provider.create({ data: dto });
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

  /**
   * Update an existing provider.
   * Throws NotFoundException if not found.
   * Throws ConflictException if the new provider_key is already taken.
   */
  async update(id: string, dto: UpdateProviderDto): Promise<voice_ai_provider> {
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

  /**
   * Soft-delete a provider by setting is_active = false.
   * Does NOT delete the row — preserves credential and usage history.
   * Throws NotFoundException if not found.
   */
  async deactivate(id: string): Promise<voice_ai_provider> {
    await this.findById(id); // throws NotFoundException if not found
    return this.prisma.voice_ai_provider.update({
      where: { id },
      data: { is_active: false },
    });
  }

  /**
   * Hard-delete a provider by permanently removing it from the database.
   * WARNING: This will also cascade delete related credentials and usage records.
   * Throws NotFoundException if not found.
   */
  async delete(id: string): Promise<void> {
    await this.findById(id); // throws NotFoundException if not found
    await this.prisma.voice_ai_provider.delete({
      where: { id },
    });
  }
}
