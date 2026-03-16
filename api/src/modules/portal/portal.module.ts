import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../core/database';
import { JobsModule } from '../jobs/jobs.module';
import { PortalAuthController } from './controllers/portal-auth.controller';
import { PortalProjectController } from './controllers/portal-project.controller';
import { PortalAuthService } from './services/portal-auth.service';
import { PortalProjectService } from './services/portal-project.service';
import { PortalJwtStrategy } from './strategies/portal-jwt.strategy';

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('PORTAL_JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
  ],
  controllers: [PortalAuthController, PortalProjectController],
  providers: [PortalAuthService, PortalProjectService, PortalJwtStrategy],
  exports: [PortalAuthService, PortalProjectService],
})
export class PortalModule {}
