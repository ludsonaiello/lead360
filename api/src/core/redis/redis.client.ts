import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Shared Redis Client Service
 * Provides a dedicated Redis connection for session storage
 * Separate from BullMQ Redis connection to avoid interference
 */
@Injectable()
export class RedisClientService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisClientService.name);
  private readonly client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get('REDIS_HOST') || '127.0.0.1';
    const port = parseInt(this.configService.get('REDIS_PORT') || '6380');
    const password = this.configService.get('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password,
      retryStrategy: (times: number) => {
        if (times > 10) return null;
        return Math.min(times * 50, 5000);
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      keepAlive: 30000,
      lazyConnect: false, // Connect immediately
      db: 1, // Use database 1 for sessions (BullMQ uses db 0)
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis session client error:', err);
    });

    this.client.on('connect', () => {
      this.logger.log('Redis session client connected successfully');
    });

    this.client.on('ready', () => {
      this.logger.log('Redis session client ready');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    this.logger.log('Closing Redis session client...');
    await this.client.quit();
  }
}
