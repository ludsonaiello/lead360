YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B02a — Module Scaffold + Admin Provider CRUD

**Module**: Voice AI
**Sprint**: B02a
**Depends on**: B01 (schema + migration complete)
**Next**: B02b (Credentials CRUD)

---

## Objective

Create the NestJS `voice-ai` module skeleton and build admin-only CRUD endpoints for managing AI providers (Deepgram, OpenAI, Cartesia). Credentials come in B02b.

---

## Pre-Coding Checklist

- [ ] B01 is complete — all tables exist
- [ ] Read `/api/src/modules/admin/` — admin guard pattern
- [ ] Verify backend running: `http://localhost:8000/api/v1`
- [ ] **HIT THE ENDPOINT** after implementing: `curl http://localhost:8000/api/v1/system/voice-ai/providers -H "Authorization: Bearer $TOKEN" | jq .`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Module Structure to Create

```
/api/src/modules/voice-ai/
├── voice-ai.module.ts
├── guards/
│   └── voice-agent-key.guard.ts   (empty placeholder — implemented in B06a)
├── controllers/
│   ├── admin/
│   │   ├── voice-ai-providers.controller.ts
│   │   └── voice-ai-credentials.controller.ts   (empty placeholder — implemented in B02b)
│   ├── tenant/       (empty — used in B04+)
│   └── internal/     (empty — used in B06+)
├── services/
│   └── voice-ai-providers.service.ts
└── dto/
    ├── create-provider.dto.ts
    └── update-provider.dto.ts
```

---

## Task 1: Provider DTOs

### `create-provider.dto.ts`

```typescript
import { IsString, IsIn, IsOptional, IsBoolean, IsNotEmpty, MaxLength, IsUrl } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provider_key: string;  // e.g. 'deepgram', 'openai', 'cartesia'

  @IsString()
  @IsNotEmpty()
  @IsIn(['STT', 'LLM', 'TTS'])
  provider_type: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  display_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @IsOptional()
  @IsUrl()
  documentation_url?: string;

  @IsOptional()
  @IsString()
  capabilities?: string;  // JSON array string

  @IsOptional()
  @IsString()
  config_schema?: string;  // JSON Schema string — drives dynamic config UI (FSA03)

  @IsOptional()
  @IsString()
  default_config?: string;  // JSON object string — default field values

  @IsOptional()
  @IsString()
  pricing_info?: string;  // JSON object string

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

### `update-provider.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateProviderDto } from './create-provider.dto';
export class UpdateProviderDto extends PartialType(CreateProviderDto) {}
```

---

## Task 2: Providers Service

`voice-ai-providers.service.ts`:

```typescript
@Injectable()
export class VoiceAiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<voice_ai_provider[]> {
    return this.prisma.voice_ai_provider.findMany({
      orderBy: [{ provider_type: 'asc' }, { display_name: 'asc' }],
    });
  }

  async findById(id: string): Promise<voice_ai_provider> {
    const provider = await this.prisma.voice_ai_provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);
    return provider;
  }

  async create(dto: CreateProviderDto): Promise<voice_ai_provider> {
    const existing = await this.prisma.voice_ai_provider.findUnique({
      where: { provider_key: dto.provider_key },
    });
    if (existing) throw new ConflictException(`Provider key '${dto.provider_key}' already exists`);
    return this.prisma.voice_ai_provider.create({ data: dto });
  }

  async update(id: string, dto: UpdateProviderDto): Promise<voice_ai_provider> {
    await this.findById(id);  // throws NotFoundException if not found
    return this.prisma.voice_ai_provider.update({ where: { id }, data: dto });
  }

  async softDelete(id: string): Promise<void> {
    await this.findById(id);
    await this.prisma.voice_ai_provider.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
```

---

## Task 3: Providers Controller

`controllers/admin/voice-ai-providers.controller.ts`:

```typescript
@ApiTags('Voice AI - System Admin Providers')
@Controller('system/voice-ai/providers')  // → /api/v1/system/voice-ai/providers
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')   // Check existing pattern from /api/src/modules/admin/
export class VoiceAiProvidersController {
  constructor(private readonly providersService: VoiceAiProvidersService) {}

  @Get()
  findAll() {
    return this.providersService.findAll();
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateProviderDto) {
    return this.providersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.providersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async softDelete(@Param('id') id: string) {
    await this.providersService.softDelete(id);
  }
}
```

---

## Task 4: Module + App Registration

`voice-ai.module.ts` (initial version — will be extended in B02b, B04, B06):

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [VoiceAiProvidersController],
  providers: [VoiceAiProvidersService],
  exports: [VoiceAiProvidersService],
})
export class VoiceAiModule {}
```

Register `VoiceAiModule` in `/api/src/app.module.ts` imports array.

---

## Task 5: Seed Default Providers

Add to the Prisma seed file:

```typescript
await prisma.voice_ai_provider.createMany({
  data: [
    {
      provider_key: 'deepgram',
      provider_type: 'STT',
      display_name: 'Deepgram',
      description: 'Speech-to-text provider',
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: { type: 'string', enum: ['nova-2', 'nova', 'base'], default: 'nova-2' },
          punctuate: { type: 'boolean', default: true },
        },
      }),
      default_config: JSON.stringify({ model: 'nova-2', punctuate: true }),
    },
    {
      provider_key: 'openai',
      provider_type: 'LLM',
      display_name: 'OpenAI',
      description: 'Language model provider (GPT-4o-mini)',
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: { type: 'string', enum: ['gpt-4o-mini', 'gpt-4o'], default: 'gpt-4o-mini' },
          temperature: { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
          max_tokens: { type: 'integer', minimum: 100, maximum: 4000, default: 500 },
        },
      }),
      default_config: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, max_tokens: 500 }),
    },
    {
      provider_key: 'cartesia',
      provider_type: 'TTS',
      display_name: 'Cartesia',
      description: 'Text-to-speech provider',
      config_schema: JSON.stringify({
        type: 'object',
        properties: {
          model: { type: 'string', enum: ['sonic-english', 'sonic-multilingual'], default: 'sonic-english' },
          speed: { type: 'number', minimum: 0.5, maximum: 2.0, default: 1.0 },
        },
      }),
      default_config: JSON.stringify({ model: 'sonic-english', speed: 1.0 }),
    },
  ],
  skipDuplicates: true,
});
```

Run with: `npx prisma db seed`

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/providers` returns list of providers (admin only)
- [ ] `POST /api/v1/system/voice-ai/providers` creates a provider with all fields (config_schema, default_config, capabilities, pricing_info, logo_url, documentation_url)
- [ ] `PATCH /api/v1/system/voice-ai/providers/:id` updates provider
- [ ] `DELETE /api/v1/system/voice-ai/providers/:id` soft-deletes (sets is_active=false)
- [ ] Non-admin gets 403 on all system/* endpoints
- [ ] 3 default providers seeded (deepgram, openai, cartesia) with config_schema
- [ ] Module registered in app.module.ts
- [ ] `npm run build` passes without errors
