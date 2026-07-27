import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { CommunicationModule } from '../communication/communication.module';
import { LeadsModule } from '../leads/leads.module';
import { RBACModule } from '../rbac/rbac.module';

// Controllers
import { TimeClockSettingsController } from './controllers/time-clock-settings.controller';
import { EmployeeProfileController } from './controllers/employee-profile.controller';
import { ClockinAddressController } from './controllers/clockin-address.controller';
import { EmployeeProjectAssignmentController } from './controllers/employee-project-assignment.controller';
import { WorkShiftController } from './controllers/work-shift.controller';
import { ClockSessionController } from './controllers/clock-session.controller';
import { BreakEntryController } from './controllers/break-entry.controller';
import { TimeDisputeController } from './controllers/time-dispute.controller';
import { KioskController } from './controllers/kiosk.controller';
import { TimeClockDashboardController } from './controllers/time-clock-dashboard.controller';
import { TimeClockReportsController } from './controllers/time-clock-reports.controller';

// Services
import { TimeClockSettingsService } from './services/time-clock-settings.service';
import { EmployeeProfileService } from './services/employee-profile.service';
import { ClockinAddressService } from './services/clockin-address.service';
import { EmployeeProjectAssignmentService } from './services/employee-project-assignment.service';
import { WorkShiftService } from './services/work-shift.service';
import { ClockSessionService } from './services/clock-session.service';
import { BreakEntryService } from './services/break-entry.service';
import { ClockSessionEditService } from './services/clock-session-edit.service';
import { TimeDisputeService } from './services/time-dispute.service';
import { KioskService } from './services/kiosk.service';
import { GeofenceService } from './services/geofence.service';
import { OvertimeService } from './services/overtime.service';
import { LaborCostAttributionService } from './services/labor-cost-attribution.service';
import { TimeClockDashboardService } from './services/time-clock-dashboard.service';
import { TimeClockReportsService } from './services/time-clock-reports.service';
import { MissedShiftService } from './services/missed-shift.service';
import { ShiftReminderService } from './services/shift-reminder.service';

// Processor, scheduler, guard
import { TimeClockProcessor } from './processors/time-clock.processor';
import { TimeClockScheduler } from './schedulers/time-clock.scheduler';
import { KioskTokenGuard } from './guards/kiosk-token.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CommunicationModule,
    LeadsModule,
    RBACModule,
    BullModule.registerQueue({ name: 'time-clock' }),
  ],
  controllers: [
    TimeClockSettingsController,
    EmployeeProfileController,
    ClockinAddressController,
    EmployeeProjectAssignmentController,
    WorkShiftController,
    ClockSessionController,
    BreakEntryController,
    TimeDisputeController,
    KioskController,
    TimeClockDashboardController,
    TimeClockReportsController,
  ],
  providers: [
    TimeClockSettingsService,
    EmployeeProfileService,
    ClockinAddressService,
    EmployeeProjectAssignmentService,
    WorkShiftService,
    ClockSessionService,
    BreakEntryService,
    ClockSessionEditService,
    TimeDisputeService,
    KioskService,
    GeofenceService,
    OvertimeService,
    LaborCostAttributionService,
    TimeClockDashboardService,
    TimeClockReportsService,
    MissedShiftService,
    ShiftReminderService,
    TimeClockProcessor,
    TimeClockScheduler,
    KioskTokenGuard,
  ],
  exports: [
    TimeClockSettingsService,
    ClockSessionService,
    EmployeeProfileService,
    GeofenceService,
    OvertimeService,
  ],
})
export class TimeClockModule {}
