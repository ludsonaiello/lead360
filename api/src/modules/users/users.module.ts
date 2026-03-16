import { Module } from '@nestjs/common';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { TokenBlocklistModule } from '../../core/token-blocklist/token-blocklist.module';
import { CommunicationModule } from '../communication/communication.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    TokenBlocklistModule,
    CommunicationModule, // Provides SendEmailService (multi-provider: SMTP, Brevo, SendGrid, SES)
    AuthModule, // Provides AuthService for invite acceptance token issuance
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
