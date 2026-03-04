import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisClientService } from './redis.client';

/**
 * Redis Client Module
 * Provides shared Redis connection for session storage
 * Global module - available everywhere without explicit importing
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisClientService],
  exports: [RedisClientService],
})
export class RedisClientModule {}
