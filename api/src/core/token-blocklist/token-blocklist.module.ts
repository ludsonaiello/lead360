import { Module } from '@nestjs/common';
import { TokenBlocklistService } from './token-blocklist.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  providers: [TokenBlocklistService],
  exports: [TokenBlocklistService],
})
export class TokenBlocklistModule {}
