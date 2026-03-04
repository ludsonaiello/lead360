import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditModule } from '../audit/audit.module';
import { EncryptionModule } from '../../core/encryption/encryption.module';
import { CalendarIntegrationModule } from '../calendar-integration/calendar-integration.module';
import { LeadsModule } from '../leads/leads.module';
import { CommunicationModule } from '../communication/communication.module';
import { AppointmentTypesController } from './controllers/appointment-types.controller';
import { AppointmentTypeSchedulesController } from './controllers/appointment-type-schedules.controller';
import { AppointmentsController } from './controllers/appointments.controller';
import { AppointmentActionsController } from './controllers/appointment-actions.controller';
import { AvailabilityController } from './controllers/availability.controller';
import { CalendarDashboardController } from './controllers/calendar-dashboard.controller';
import { ExternalBlocksController } from './controllers/external-blocks.controller';
import { AppointmentTypesService } from './services/appointment-types.service';
import { AppointmentTypeSchedulesService } from './services/appointment-type-schedules.service';
import { AppointmentsService } from './services/appointments.service';
import { AppointmentLifecycleService } from './services/appointment-lifecycle.service';
import { DateTimeConverterService } from './services/datetime-converter.service';
import { SlotCalculationService } from './services/slot-calculation.service';
import { CalendarDashboardService } from './services/calendar-dashboard.service';
import { AppointmentReminderService } from './services/appointment-reminder.service';
import { AppointmentReminderProcessor } from './processors';

@Module({
  imports: [
    AuditModule,
    EncryptionModule,
    CalendarIntegrationModule,
    LeadsModule,
    forwardRef(() => CommunicationModule), // Sprint 20: For SMS sending in reminders (forwardRef to break circular dependency)
    BullModule.registerQueue({ name: 'calendar-reminders' }), // Sprint 20: Appointment reminder queue
  ],
  controllers: [
    AppointmentTypesController,
    AppointmentTypeSchedulesController,
    AppointmentsController,
    AppointmentActionsController,
    AvailabilityController,
    CalendarDashboardController,
    ExternalBlocksController, // Sprint 13B/31: External blocks for visual display
  ],
  providers: [
    AppointmentTypesService,
    AppointmentTypeSchedulesService,
    AppointmentsService,
    AppointmentLifecycleService,
    DateTimeConverterService,
    SlotCalculationService,
    CalendarDashboardService,
    AppointmentReminderService, // Sprint 20: Reminder scheduling
    AppointmentReminderProcessor, // Sprint 20: Reminder processor
    PrismaService,
  ],
  exports: [
    AppointmentTypesService,
    AppointmentTypeSchedulesService,
    AppointmentsService,
    AppointmentLifecycleService,
    DateTimeConverterService,
    SlotCalculationService,
    CalendarDashboardService,
    AppointmentReminderService, // Sprint 20: Export for potential external use
  ],
})
export class CalendarModule {}
