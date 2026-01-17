import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../core/database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { GoogleMapsService } from './services/google-maps.service';
import { LeadActivitiesService } from './services/lead-activities.service';
import { LeadEmailsService } from './services/lead-emails.service';
import { LeadPhonesService } from './services/lead-phones.service';
import { LeadAddressesService } from './services/lead-addresses.service';
import { ServiceRequestsService } from './services/service-requests.service';
import { LeadNotesService } from './services/lead-notes.service';
import { LeadsService } from './services/leads.service';
import { WebhookAuthService } from './services/webhook-auth.service';
import { LeadsController } from './controllers/leads.controller';
import { ServiceRequestsController } from './controllers/service-requests.controller';
import { WebhookController } from './controllers/webhook.controller';
import { WebhookKeysController } from './controllers/webhook-keys.controller';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';

@Module({
  imports: [PrismaModule, AuditModule, ConfigModule, JwtModule.register({})],
  controllers: [
    LeadsController,
    ServiceRequestsController,
    WebhookController,
    WebhookKeysController,
  ],
  providers: [
    GoogleMapsService,
    LeadActivitiesService,
    LeadEmailsService,
    LeadPhonesService,
    LeadAddressesService,
    ServiceRequestsService,
    LeadNotesService,
    LeadsService,
    WebhookAuthService,
    WebhookAuthGuard,
  ],
  exports: [
    GoogleMapsService,
    LeadActivitiesService,
    LeadEmailsService,
    LeadPhonesService,
    LeadAddressesService,
    ServiceRequestsService,
    LeadNotesService,
    LeadsService,
    WebhookAuthService,
  ],
})
export class LeadsModule {}
